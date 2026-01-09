/**
 * Sync Engine Service
 * Core sync logic for notes - pulling and pushing changes to server.
 */

import { v4 as uuidv4 } from 'uuid';
import { db, workerDb, SYNC_STATUS } from '../db/db';
import { useEncryptionStore } from '../stores/encryptionStore';
import { logger } from '../utils/logger';

const API_URL = '/api';
const SYNC_PAGE_SIZE = 1000;
const YIELD_INTERVAL = 20;

/**
 * Pull note changes from server
 * @param {Function} authFetch - Authenticated fetch function
 * @param {Function} setVersionSyncQueue - Queue setter for version sync
 */
export async function pullChanges(authFetch, setVersionSyncQueue) {
    if (!authFetch) return;

    const encryptionStore = useEncryptionStore.getState();

    if (!encryptionStore.isUnlocked) {
        logger.info('SYNC', 'Encryption not unlocked, skipping pull');
        return;
    }

    try {
        // Get last sync time
        const syncState = await db.syncState.get('lastSyncTime');
        const since = syncState?.value || null;

        // Paginated fetch
        let allNotes = [];
        let allDeleted = [];
        let serverTime = null;
        let page = 0;
        let hasMore = true;

        while (hasMore) {
            const params = new URLSearchParams();
            if (since) params.append('since', since);
            params.append('limit', SYNC_PAGE_SIZE.toString());
            params.append('offset', (page * SYNC_PAGE_SIZE).toString());

            const url = `${API_URL}/notes/sync${params.toString() ? '?' + params.toString() : ''}`;
            const res = await authFetch(url);

            if (!res.ok) throw new Error('Sync pull failed');

            const { notes, deleted, serverTime: st } = await res.json();

            allNotes = allNotes.concat(notes || []);
            allDeleted = allDeleted.concat(deleted || []);
            serverTime = st;

            hasMore = notes && notes.length === SYNC_PAGE_SIZE;
            page++;
        }

        const notesToFetchVersions = [];
        const notesToWrite = [];
        const idsToDelete = [];

        // Phase 1: Read local state and prepare data
        for (let i = 0; i < allNotes.length; i++) {
            const encryptedNote = allNotes[i];

            // Yield to main thread periodically
            if (i > 0 && i % YIELD_INTERVAL === 0) {
                await new Promise(r => setTimeout(r, 0));
            }

            // Check if we have a pending local change
            let local = await db.notes.get(encryptedNote.id);

            // Fallback to number lookup if string fails (legacy IDs)
            if (!local && !isNaN(Number(encryptedNote.id))) {
                local = await db.notes.get(Number(encryptedNote.id));
            }

            if (local && local.sync_status !== SYNC_STATUS.SYNCED) {
                if (local.sync_status === SYNC_STATUS.DELETED) {
                    continue;
                }

                const localTime = new Date(local.updated_at).getTime();
                const serverNoteTime = new Date(encryptedNote.updated_at).getTime();

                if (localTime > serverNoteTime) {
                    continue; // Local is newer
                }
            }

            // Decrypt the note
            let decryptedNote;
            try {
                decryptedNote = await encryptionStore.decryptNote(encryptedNote);
            } catch (e) {
                logger.error('SYNC', 'Failed to decrypt note', { id: encryptedNote.id, error: e });
                decryptedNote = {
                    ...encryptedNote,
                    title: '[Decryption failed]',
                    content: '[Unable to decrypt]',
                    decryptionError: true
                };
            }

            // Map server label_ids to local labels
            if (encryptedNote.label_ids) {
                decryptedNote.labels = encryptedNote.label_ids;
            }

            // Derive status from is_archived/is_trashed
            let status = 'active';
            if (decryptedNote.is_trashed) {
                status = 'trashed';
            } else if (decryptedNote.is_archived) {
                status = 'archived';
            }

            notesToWrite.push({
                ...decryptedNote,
                status,
                sync_status: SYNC_STATUS.SYNCED
            });

            notesToFetchVersions.push(encryptedNote.id);
        }

        // Prepare deletions
        for (const id of allDeleted) {
            idsToDelete.push(id);
        }

        // Phase 2: Bulk write to main thread DB (for useLiveQuery reactivity)
        // Note: Using main thread db instead of workerDb so that useLiveQuery hooks
        // in components like NoteModal can react to changes in real-time
        if (notesToWrite.length > 0) {
            await db.notes.bulkPut(notesToWrite);
            logger.debug('SYNC', `[pullChanges] Bulk-wrote ${notesToWrite.length} notes`);
        }

        // Phase 3: Handle deletions
        if (idsToDelete.length > 0) {
            await db.transaction('rw', db.notes, db.note_versions, async () => {
                for (const id of idsToDelete) {
                    await db.notes.delete(id);
                    await db.note_versions.where('note_id').equals(id).delete();
                }
            });
        }

        // Update sync time
        if (serverTime) {
            await db.syncState.put({ key: 'lastSyncTime', value: serverTime });
        }

        // Update queue for version fetching
        if (notesToFetchVersions.length > 0 && setVersionSyncQueue) {
            setVersionSyncQueue(prev => {
                const next = new Set(prev);
                notesToFetchVersions.forEach(id => next.add(id));
                return next;
            });
        }
    } catch (error) {
        logger.error('SYNC', 'Pull sync failed', error);
    }
}

/**
 * Push local note changes to server
 * @param {Function} authFetch - Authenticated fetch function
 */
export async function pushChanges(authFetch) {
    if (!authFetch) return;

    const encryptionStore = useEncryptionStore.getState();
    if (!encryptionStore.isUnlocked) {
        logger.info('SYNC', 'Encryption not unlocked, skipping push');
        return;
    }

    try {
        const pendingNotes = await db.notes
            .where('sync_status')
            .anyOf([SYNC_STATUS.NEW, SYNC_STATUS.PENDING, SYNC_STATUS.DELETED])
            .toArray();

        if (pendingNotes.length === 0) return;

        const YIELD_INTERVAL_PUSH = 10;
        const operations = [];

        for (let i = 0; i < pendingNotes.length; i++) {
            const note = pendingNotes[i];

            if (i > 0 && i % YIELD_INTERVAL_PUSH === 0) {
                await new Promise(r => setTimeout(r, 0));
            }

            // Skip notes with temporary label IDs
            if (note.labels && note.labels.some(id => isNaN(Number(id)))) {
                logger.debug('SYNC', `[pushChanges] Skipping note ${note.id} waiting for label resolution`);
                continue;
            }

            if (note.sync_status === SYNC_STATUS.NEW) {
                const encryptedNote = await encryptionStore.encryptNote({
                    title: note.title,
                    content: note.content,
                    type: note.type,
                    color: note.color,
                    is_pinned: note.is_pinned,
                    items: note.items
                });

                operations.push({
                    op: 'create',
                    tempId: note.id,
                    data: {
                        title: encryptedNote.title,
                        content: encryptedNote.content,
                        type: encryptedNote.type,
                        color: encryptedNote.color,
                        is_pinned: encryptedNote.is_pinned,
                        items: encryptedNote.items,
                        label_ids: note.labels || [],
                        labels: [],
                        images: note.images || [],
                        encrypted: encryptedNote.encrypted,
                        encrypted_note_key: encryptedNote.encrypted_note_key
                    }
                });
            } else if (note.sync_status === SYNC_STATUS.DELETED) {
                operations.push({ op: 'delete', id: note.id });
            } else {
                // PENDING - update existing note
                let data = {};
                let shouldFullSync = true;

                if (note.sync_dirty_fields && note.sync_dirty_fields.length > 0) {
                    const dirty = new Set(note.sync_dirty_fields);
                    shouldFullSync = false;

                    if (dirty.has('title') || dirty.has('content')) {
                        const encryptedNote = await encryptionStore.encryptNote({
                            id: note.id,
                            title: note.title,
                            content: note.content,
                            encrypted_note_key: note.encrypted_note_key
                        });
                        if (dirty.has('title')) data.title = encryptedNote.title;
                        if (dirty.has('content')) data.content = encryptedNote.content;
                        data.encrypted = true;
                        data.encrypted_note_key = encryptedNote.encrypted_note_key;
                    }

                    if (dirty.has('color')) data.color = note.color;
                    if (dirty.has('is_pinned')) data.is_pinned = note.is_pinned;
                    if (dirty.has('is_archived')) data.is_archived = note.is_archived;
                    if (dirty.has('is_trashed')) data.is_trashed = note.is_trashed;
                    if (dirty.has('items')) data.items = note.items;
                    if (dirty.has('labels')) {
                        data.label_ids = note.labels || [];
                        data.labels = [];
                    }
                    if (dirty.has('images')) data.images = note.images || [];
                }

                if (shouldFullSync) {
                    const encryptedNote = await encryptionStore.encryptNote({
                        id: note.id,
                        title: note.title,
                        content: note.content,
                        color: note.color,
                        is_pinned: note.is_pinned,
                        is_archived: note.is_archived,
                        is_trashed: note.is_trashed,
                        items: note.items,
                        encrypted_note_key: note.encrypted_note_key
                    });

                    data = {
                        title: encryptedNote.title,
                        content: encryptedNote.content,
                        color: encryptedNote.color,
                        is_pinned: encryptedNote.is_pinned,
                        is_archived: encryptedNote.is_archived,
                        is_trashed: encryptedNote.is_trashed,
                        items: encryptedNote.items,
                        label_ids: note.labels || [],
                        labels: [],
                        images: note.images || [],
                        encrypted: encryptedNote.encrypted,
                        encrypted_note_key: encryptedNote.encrypted_note_key
                    };
                }

                operations.push({
                    op: 'update',
                    id: note.id,
                    data: data,
                    version: note.version
                });
            }
        }

        if (operations.length === 0) return;

        const res = await authFetch(`${API_URL}/notes/sync/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operations })
        });

        if (!res.ok) throw new Error('Sync push failed');

        const { results } = await res.json();

        // Process results
        const notesToUpdate = [];
        const idsToDelete = [];
        const createsWithNewId = [];
        const conflictsToResolve = [];
        const notesToResurrect = [];

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const original = pendingNotes[i];

            if (result.success) {
                if (result.op === 'create') {
                    createsWithNewId.push({ original, result });
                } else if (result.op === 'delete') {
                    idsToDelete.push(original.id);
                } else {
                    notesToUpdate.push({
                        ...original,
                        updated_at: result.updated_at,
                        sync_status: SYNC_STATUS.SYNCED,
                        sync_dirty_fields: []
                    });
                }
            } else if (result.status === 409 || result.error === 'Conflict') {
                conflictsToResolve.push({ original, result });
            } else if (result.op === 'update' && result.error === 'Note not found') {
                notesToResurrect.push(original.id);
            } else {
                logger.error('SYNC', 'Operation failed', result);
            }
        }

        // Batch updates via worker
        if (notesToUpdate.length > 0) {
            try {
                await workerDb.notes.bulkPut(notesToUpdate);
            } catch (e) {
                logger.error('SYNC', 'Worker bulk update failed, falling back', e);
                await db.notes.bulkPut(notesToUpdate);
            }
        }

        // Handle creates with ID replacement
        for (const { original, result } of createsWithNewId) {
            await db.transaction('rw', db.notes, async () => {
                await db.notes.delete(original.id);
                await db.notes.put({
                    ...original,
                    id: result.id,
                    updated_at: result.updated_at,
                    sync_status: SYNC_STATUS.SYNCED
                });
            });
        }

        // Batch deletes
        if (idsToDelete.length > 0) {
            await db.notes.bulkDelete(idsToDelete);
        }

        // Resurrect notes not found on server
        for (const id of notesToResurrect) {
            logger.warn('SYNC', `Note ${id} not found on server. Resurrecting as new.`);
            await db.notes.update(id, {
                sync_status: SYNC_STATUS.NEW,
                updated_at: new Date().toISOString()
            });
        }

        // Defer conflict resolution to background
        if (conflictsToResolve.length > 0) {
            resolveConflicts(conflictsToResolve, authFetch);
        }
    } catch (error) {
        logger.error('SYNC', 'Push sync failed', error);
    }
}

/**
 * Resolve conflicts in background
 * @param {Array} conflicts - Array of {original, result} objects
 * @param {Function} authFetch - Authenticated fetch function
 */
function resolveConflicts(conflicts, authFetch) {
    queueMicrotask(async () => {
        for (const { original } of conflicts) {
            try {
                logger.warn('SYNC', `Resolving conflict for note ${original.id}...`);
                const res = await authFetch(`${API_URL}/notes/${original.id}`);
                if (res.ok) {
                    const serverNote = await res.json();
                    let decryptedServerNote;

                    try {
                        const encStore = useEncryptionStore.getState();
                        decryptedServerNote = await encStore.decryptNote(serverNote);
                    } catch (_e) {
                        decryptedServerNote = { ...serverNote, content: '[Decryption Failed]' };
                    }

                    // For shared notes (non-owners), just accept server version without creating conflict copy
                    // Only the owner should have conflict copies as they "own" the note
                    if (original.is_owner === false) {
                        logger.info('SYNC', `Shared note conflict - accepting server version for ${original.id}`);
                        let serverStatus = 'active';
                        if (decryptedServerNote.is_trashed) serverStatus = 'trashed';
                        else if (decryptedServerNote.is_archived) serverStatus = 'archived';

                        await db.notes.put({
                            ...decryptedServerNote,
                            status: serverStatus,
                            sync_status: SYNC_STATUS.SYNCED
                        });
                        continue;
                    }

                    // Owner - create conflict copy with their local changes
                    const conflictId = uuidv4();
                    const conflictNote = {
                        ...original,
                        id: conflictId,
                        title: `${original.title} (Conflict ${new Date().toLocaleTimeString()})`,
                        sync_status: SYNC_STATUS.NEW,
                        status: original.status || 'active',
                        version: 1,
                        updated_at: new Date().toISOString(),
                        // Don't copy sharing - this is owner's personal conflict copy
                        is_owner: true,
                        collaborators: [],
                        shared_note_key: null
                    };
                    await db.notes.add(conflictNote);

                    // Derive status for server note
                    let serverStatus = 'active';
                    if (decryptedServerNote.is_trashed) serverStatus = 'trashed';
                    else if (decryptedServerNote.is_archived) serverStatus = 'archived';

                    await db.notes.put({
                        ...decryptedServerNote,
                        status: serverStatus,
                        sync_status: SYNC_STATUS.SYNCED
                    });
                    logger.info('SYNC', `Conflict resolved: Created copy ${conflictId}`);
                }
            } catch (err) {
                logger.error('SYNC', 'Error resolving conflict', err);
            }
        }
    });
}
