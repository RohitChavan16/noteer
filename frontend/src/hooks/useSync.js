import { useEffect, useCallback, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { db, SYNC_STATUS, LOCAL_IMAGE_PREFIX } from '../db/db';
import { useAuthStore } from '../stores/authStore';
import { useEncryptionStore } from '../stores/encryptionStore';
import { useNotesStore } from '../stores/notesStore';
import { logger } from '../utils/logger';

// Constants
const API_URL = '/api';
const SYNC_INTERVAL_MS = 4000; // 4 seconds
const SYNC_PAGE_SIZE = 1000;
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

// Global sync lock - prevents duplicate syncs from multiple hook instances (React StrictMode)
let globalSyncLock = false;

/**
 * Sync Engine Hook - The "Sync Edge"
 */
export function useSync() {
    const authFetch = useAuthStore.getState().authFetch;
    const isSyncing = useNotesStore(state => state.isSyncing); // Subscribe to syncing state

    // Lazy Version Sync Queue
    const [versionSyncQueue, setVersionSyncQueue] = useState(new Set());

    // Effect: Background Fetch Versions for Queue
    // Debounced to avoid spamming during active sync
    useEffect(() => {
        if (versionSyncQueue.size === 0 || isSyncing) return;

        const fetchVersions = async () => {
            const idsToFetch = Array.from(versionSyncQueue);
            // Clear queue immediately (optimistic)
            setVersionSyncQueue(new Set());

            try {
                const response = await authFetch(`${API_URL}/notes/versions/sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ noteIds: idsToFetch })
                });

                if (response.ok) {
                    const versions = await response.json();
                    if (versions.length > 0) {
                        await db.transaction('rw', db.note_versions, async () => {
                            // Group versions by note_id
                            const versionsByNote = new Map();
                            for (const version of versions) {
                                if (!versionsByNote.has(version.note_id)) {
                                    versionsByNote.set(version.note_id, []);
                                }
                                versionsByNote.get(version.note_id).push(version);
                            }

                            // For each note: delete LOCAL versions, then insert SERVER versions
                            // Server is the source of truth for versions
                            for (const [noteId, noteVersions] of versionsByNote) {
                                // Delete all local versions for this note
                                await db.note_versions.where('note_id').equals(noteId).delete();

                                // Insert server versions
                                for (const version of noteVersions) {
                                    await db.note_versions.put({
                                        id: version.id,
                                        note_id: version.note_id,
                                        created_at: version.created_at,
                                        data: version.data
                                    });
                                }
                            }
                        });
                        logger.debug('SYNC', `[LazySync] Replaced local versions with ${versions.length} server versions for ${idsToFetch.length} notes`);

                    }
                }
            } catch (error) {
                logger.warn('SYNC', '[LazySync] Failed to fetch versions', error);
                // In a real enterprise app, we'd smart-retry or dead-letter queue this
            }
        };

        const timeoutId = setTimeout(fetchVersions, 3000); // 3s debounce after sync activity
        return () => clearTimeout(timeoutId);
    }, [versionSyncQueue, isSyncing, authFetch]);

    // Pull changes from server (with decryption)
    const pullChanges = useCallback(async () => {

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


            // If no lastSyncTime, this is initial sync - need to fetch ALL notes
            // Backend may paginate, so we loop until we get all
            let allNotes = [];
            let allDeleted = [];
            let serverTime = null;
            let page = 0;
            const pageSize = SYNC_PAGE_SIZE;
            let hasMore = true;

            while (hasMore) {
                const params = new URLSearchParams();
                if (since) params.append('since', since);
                params.append('limit', pageSize.toString());
                params.append('offset', (page * pageSize).toString());

                const url = `${API_URL}/notes/sync${params.toString() ? '?' + params.toString() : ''}`;
                const res = await authFetch(url);

                if (!res.ok) throw new Error('Sync pull failed');

                const { notes, deleted, serverTime: st } = await res.json();

                allNotes = allNotes.concat(notes || []);
                allDeleted = allDeleted.concat(deleted || []);
                serverTime = st;

                // Check if we got less than pageSize, meaning no more pages
                hasMore = notes && notes.length === pageSize;
                page++;
            }



            // OPTIMIZATION: Process in transaction but yield periodically to avoid blocking main thread
            const YIELD_INTERVAL = 20; // Yield every 20 notes
            const notesToFetchVersions = [];

            await db.transaction('rw', db.notes, db.syncState, db.note_versions, async () => {
                for (let i = 0; i < allNotes.length; i++) {
                    const encryptedNote = allNotes[i];

                    // Yield to main thread periodically (don't block UI)
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
                        // Conflict: Local has pending changes

                        // CRITICAL: If locally deleted, ALWAYS keep local deletion (ignore server update)
                        // The deletion will be pushed in the next cycle
                        if (local.sync_status === SYNC_STATUS.DELETED) {
                            logger.debug('SYNC', '[pullChanges] Validating: Skipping update for locally DELETED note', encryptedNote.id);
                            continue;
                        }

                        // Resolution: Preserve local if it's newer, otherwise server wins
                        const localTime = new Date(local.updated_at).getTime();
                        const serverNoteTime = new Date(encryptedNote.updated_at).getTime();

                        if (localTime > serverNoteTime) {
                            // Local is newer, keep local version (will be pushed later)
                            continue;
                        }
                        // Server is newer or same time, server wins - fall through to update
                    }

                    // Decrypt the note

                    let decryptedNote;
                    try {
                        decryptedNote = await encryptionStore.decryptNote(encryptedNote);

                    } catch (e) {
                        logger.error('SYNC', 'Failed to decrypt note', { id: encryptedNote.id, error: e });
                        // Store with decryption error marker
                        decryptedNote = {
                            ...encryptedNote,
                            title: '[Decryption failed]',
                            content: '[Unable to decrypt]',
                            decryptionError: true
                        };
                    }

                    // Store decrypted note in local DB
                    if (decryptedNote.is_trashed) {
                        logger.debug('SYNC', '[pullChanges] Validating trashed note before save:', { id: decryptedNote.id, is_trashed: decryptedNote.is_trashed });
                    }

                    // Map server label_ids to local labels property
                    // This ensures frontend components (which use note.labels) work with IDs
                    if (encryptedNote.label_ids) {
                        decryptedNote.labels = encryptedNote.label_ids;
                    }

                    await db.notes.put({
                        ...decryptedNote,
                        sync_status: SYNC_STATUS.SYNCED
                    });

                    // Track for lazy version sync
                    notesToFetchVersions.push(encryptedNote.id);
                }

                // Remove deleted notes
                for (const id of allDeleted) {
                    await db.notes.delete(id);
                    // Also cleanup versions
                    await db.note_versions.where('note_id').equals(id).delete();
                }

                // Update sync time
                if (serverTime) {
                    await db.syncState.put({ key: 'lastSyncTime', value: serverTime });
                }
            });

            // Update queue for version fetching
            if (notesToFetchVersions.length > 0) {
                setVersionSyncQueue(prev => {
                    const next = new Set(prev);
                    notesToFetchVersions.forEach(id => next.add(id));
                    return next;
                });
            }
        } catch (error) {
            logger.error('SYNC', 'Pull sync failed', error);
        }
    }, [authFetch]);

    // Upload offline images and replace local URLs with server URLs
    const uploadOfflineImages = useCallback(async () => {
        if (!authFetch) return;

        try {
            const offlineImages = await db.offline_images.toArray();
            if (offlineImages.length === 0) return;

            for (const offlineImage of offlineImages) {
                try {
                    // Upload blob to server
                    const formData = new FormData();
                    formData.append('images', offlineImage.blob, `image_${offlineImage.id}`);

                    const res = await authFetch(`${API_URL}/upload`, {
                        method: 'POST',
                        body: formData,
                    });

                    if (!res.ok) {
                        logger.error('SYNC', 'Failed to upload offline image', { id: offlineImage.id });
                        continue;
                    }

                    const uploadedFiles = await res.json();
                    const serverImage = uploadedFiles[0];
                    const localUrl = `${LOCAL_IMAGE_PREFIX}${offlineImage.id}`;

                    // Find all notes that reference this local image and update them
                    const notesWithImage = await db.notes
                        .filter(note => {
                            if (!note.images || !Array.isArray(note.images)) return false;
                            return note.images.some(img =>
                                img.url === localUrl ||
                                img.thumb_medium === localUrl ||
                                img.thumb_small === localUrl
                            );
                        })
                        .toArray();

                    // Replace local URLs with server URLs in each note
                    for (const note of notesWithImage) {
                        const updatedImages = note.images.map(img => {
                            if (img.url === localUrl || img.thumb_medium === localUrl) {
                                return {
                                    ...serverImage,
                                    _isOffline: undefined
                                };
                            }
                            return img;
                        });

                        // Update note with new image URLs and mark for sync
                        await db.notes.update(note.id, {
                            images: updatedImages,
                            sync_status: note.sync_status === SYNC_STATUS.NEW
                                ? SYNC_STATUS.NEW
                                : SYNC_STATUS.PENDING
                        });
                    }

                    // Delete from offline storage
                    await db.offline_images.delete(offlineImage.id);

                } catch (error) {
                    logger.error('SYNC', 'Error processing offline image', { id: offlineImage.id, error });
                }
            }
        } catch (error) {
            logger.error('SYNC', 'Failed to upload offline images', error);
        }
    }, [authFetch]);

    // Pull labels from server
    const pullLabels = useCallback(async () => {
        if (!authFetch) return;

        try {
            const res = await authFetch(`${API_URL}/labels`);
            if (!res.ok) throw new Error('Failed to fetch labels');
            const serverLabels = await res.json();

            await db.transaction('rw', db.labels, db.notes, async () => {
                for (const label of serverLabels) {
                    // Check if we have a pending local change
                    const local = await db.labels.get(label.id);
                    if (local && local.sync_status !== SYNC_STATUS.SYNCED) {
                        // Conflict: Local wins for now (LWW simplicity)
                        continue;
                    }

                    // Upsert label
                    await db.labels.put({
                        ...label,
                        sync_status: SYNC_STATUS.SYNCED
                    });
                }

                // FIX: Delete local SYNCED labels that are missing from server (State Reconciliation)
                // This handles cases where backend DB was reset or label was deleted on another device
                const serverIds = new Set(serverLabels.map(l => l.id));
                const localSynced = await db.labels
                    .where('sync_status')
                    .equals(SYNC_STATUS.SYNCED)
                    .toArray();

                for (const local of localSynced) {
                    if (!serverIds.has(local.id)) {
                        logger.info('SYNC', 'Removing ghost label', { id: local.id, name: local.name });

                        // 1. Delete label
                        await db.labels.delete(local.id);

                        // 2. Remove reference from all notes
                        const affectedNotes = await db.notes
                            .filter(n => Array.isArray(n.labels) && n.labels.includes(local.id))
                            .toArray();

                        for (const note of affectedNotes) {
                            const newLabels = note.labels.filter(lid => lid !== local.id);
                            await db.notes.update(note.id, {
                                labels: newLabels,
                                updated_at: new Date().toISOString(), // Trigger UI update
                                sync_status: note.sync_status === SYNC_STATUS.NEW ? SYNC_STATUS.NEW : SYNC_STATUS.PENDING
                            });
                        }
                    }
                }
            });
        } catch (error) {
            logger.error('SYNC', 'Pull labels failed', error);
        }
    }, [authFetch]);

    // Push local label changes to server
    const pushLabels = useCallback(async () => {
        if (!authFetch) return;

        try {
            const pendingLabels = await db.labels
                .where('sync_status')
                .anyOf([SYNC_STATUS.NEW, SYNC_STATUS.PENDING, SYNC_STATUS.DELETED])
                .toArray();

            if (pendingLabels.length === 0) return;

            for (const label of pendingLabels) {
                try {
                    let res;
                    if (label.sync_status === SYNC_STATUS.NEW) {
                        res = await authFetch(`${API_URL}/labels`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: label.name, color: label.color })
                        });
                    } else if (label.sync_status === SYNC_STATUS.PENDING) {
                        res = await authFetch(`${API_URL}/labels/${label.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: label.name, color: label.color })
                        });
                    } else if (label.sync_status === SYNC_STATUS.DELETED) {
                        res = await authFetch(`${API_URL}/labels/${label.id}`, {
                            method: 'DELETE'
                        });
                    }

                    if (res && (res.ok || (label.sync_status === SYNC_STATUS.DELETED && res.status === 404))) {
                        if (label.sync_status === SYNC_STATUS.DELETED) {
                            await db.labels.delete(label.id);
                        } else if (label.sync_status === SYNC_STATUS.NEW) {
                            const serverLabel = await res.json();

                            // FIX: Update all notes that reference this temporary label ID
                            // We must do this in a transaction to ensure no state drift
                            await db.transaction('rw', db.notes, db.labels, async () => {
                                // Find notes with the temporary label ID
                                const affectedNotes = await db.notes
                                    .filter(n => Array.isArray(n.labels) && n.labels.includes(label.id))
                                    .toArray();

                                // Update references
                                for (const note of affectedNotes) {
                                    const newLabels = note.labels.map(lid => lid === label.id ? serverLabel.id : lid);

                                    // Ensure note is marked for sync to push the new Label ID
                                    // If it was NEW, keep NEW. If SYNCED/PENDING, mark PENDING.
                                    const nextStatus = note.sync_status === SYNC_STATUS.NEW
                                        ? SYNC_STATUS.NEW
                                        : SYNC_STATUS.PENDING;

                                    await db.notes.update(note.id, {
                                        labels: newLabels,
                                        sync_status: nextStatus,
                                        updated_at: new Date().toISOString()
                                    });
                                }

                                // Delete temporary ID and insert server ID
                                await db.labels.delete(label.id);
                                await db.labels.put({ ...serverLabel, sync_status: SYNC_STATUS.SYNCED });
                            });

                        } else {
                            // Update existing
                            await db.labels.update(label.id, { sync_status: SYNC_STATUS.SYNCED });
                        }
                    }
                } catch (e) {
                    logger.error('SYNC', 'Failed to push label', { id: label.id, error: e });
                }
            }
        } catch (error) {
            logger.error('SYNC', 'Push labels failed', error);
        }
    }, [authFetch]);

    // Process generic offline action queue (e.g. unsharing)
    const processOfflineQueue = useCallback(async () => {
        if (!authFetch) return;

        try {
            const queue = await db.offline_queue.toArray();
            if (queue.length === 0) return;

            for (const item of queue) {
                try {
                    if (item.type === 'UNSHARE_NOTE') {
                        const { noteId, userId } = item.payload;
                        const res = await authFetch(`${API_URL}/notes/${noteId}/share/${userId}`, {
                            method: 'DELETE',
                        });

                        if (res.ok || res.status === 204 || res.status === 404) {
                            // Success or already gone
                            await db.offline_queue.delete(item.id);
                        } else {
                            logger.error('SYNC', 'Failed to process unshare', await res.text());
                        }
                    }
                } catch (error) {
                    logger.error('SYNC', 'Error processing offline queue item', { id: item.id, error });
                }
            }
        } catch (error) {
            logger.error('SYNC', 'Offline queue processing failed', error);
        }
    }, [authFetch]);

    // Push local changes to server (with encryption)
    const pushChanges = useCallback(async () => {
        if (!authFetch) return;

        const encryptionStore = useEncryptionStore.getState();
        if (!encryptionStore.isUnlocked) {
            logger.info('SYNC', 'Encryption not unlocked, skipping push');
            return;
        }

        try {
            // Get all pending notes
            const pendingNotes = await db.notes
                .where('sync_status')
                .anyOf([SYNC_STATUS.NEW, SYNC_STATUS.PENDING, SYNC_STATUS.DELETED])
                .toArray();

            if (pendingNotes.length === 0) return;


            // Build batch operations with encryption
            const operations = [];
            for (const note of pendingNotes) {
                // FIX: Skip notes with temporary label IDs (UUIDs)
                // We must wait for pushLabels to resolve them to server IDs (integers)
                // Otherwise we risk sending empty labels (if filtered) or crashing backend (if sent as UUID)
                if (note.labels && note.labels.some(id => isNaN(Number(id)))) {
                    logger.debug('SYNC', `[pushChanges] Skipping note ${note.id} waiting for label resolution`);
                    continue;
                }

                if (note.sync_status === SYNC_STATUS.NEW) {
                    // Encrypt the note before sending
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
                        tempId: note.id, // Local temp ID
                        data: {
                            title: encryptedNote.title,
                            content: encryptedNote.content,
                            type: encryptedNote.type,
                            color: encryptedNote.color,
                            is_pinned: encryptedNote.is_pinned,
                            items: encryptedNote.items,
                            label_ids: note.labels || [],
                            labels: [], // Legacy compat
                            images: note.images || [], // FIX: Sync images metadata
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

                    // Check for dirty fields (Partial Sync)
                    if (note.sync_dirty_fields && note.sync_dirty_fields.length > 0) {
                        const dirty = new Set(note.sync_dirty_fields);
                        shouldFullSync = false;

                        // Encrypt ONLY if title/content changed
                        if (dirty.has('title') || dirty.has('content')) {
                            const encryptedNote = await encryptionStore.encryptNote({
                                id: note.id,
                                title: note.title,
                                content: note.content,
                                encrypted_note_key: note.encrypted_note_key
                            });
                            if (dirty.has('title')) data.title = encryptedNote.title;
                            if (dirty.has('content')) data.content = encryptedNote.content;

                            // Always send encryption metadata if we touched encrypted fields
                            data.encrypted = true;
                            data.encrypted_note_key = encryptedNote.encrypted_note_key;
                        }

                        // Map other fields
                        if (dirty.has('color')) data.color = note.color;
                        if (dirty.has('is_pinned')) data.is_pinned = note.is_pinned;
                        if (dirty.has('is_archived')) data.is_archived = note.is_archived;
                        if (dirty.has('is_trashed')) data.is_trashed = note.is_trashed;

                        // Sub-resources - only include if dirty
                        if (dirty.has('items')) data.items = note.items;
                        if (dirty.has('labels')) {
                            data.label_ids = note.labels || [];
                            data.labels = []; // Clear legacy
                        }
                        if (dirty.has('images')) data.images = note.images || [];

                        // Debug log for partial sync
                        // logger.debug('SYNC', `[PartialSync] Note ${note.id} fields: ${Array.from(dirty).join(', ')}`);
                    }

                    if (shouldFullSync) {
                        // Full sync fallback (Legacy behavior or missing dirty flags)
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
                        version: note.version // Enable Optimistic Concurrency Control
                    });
                }
            }


            const res = await authFetch(`${API_URL}/notes/sync/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ operations })
            });

            if (!res.ok) throw new Error('Sync push failed');

            const { results } = await res.json();


            // Process results
            // Note: We cannot use a transaction here because we await authFetch inside the loop for conflict resolution
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const original = pendingNotes[i];

                if (result.success) {
                    if (result.op === 'create') {
                        // Replace temp ID with server ID
                        // We use small transactions for atomic ID swaps if needed, but here simple deletes/puts appear safer one by one
                        await db.transaction('rw', db.notes, async () => {
                            await db.notes.delete(original.id);
                            await db.notes.put({
                                ...original,
                                id: result.id,
                                updated_at: result.updated_at,
                                sync_status: SYNC_STATUS.SYNCED
                            });
                        });
                    } else if (result.op === 'delete') {
                        await db.notes.delete(original.id);
                    } else {
                        // Update
                        await db.notes.update(original.id, {
                            updated_at: result.updated_at,
                            sync_status: SYNC_STATUS.SYNCED,
                            sync_dirty_fields: [] // Clear dirty flags
                        });
                    }
                } else if (result.status === 409 || result.error === 'Conflict') {
                    logger.warn('SYNC', `Conflict detected for note ${original.id}. Resolving...`);

                    try {
                        // 1. Fetch server version
                        const res = await authFetch(`${API_URL}/notes/${original.id}`);
                        if (res.ok) {
                            const serverNote = await res.json();
                            let decryptedServerNote;

                            // 2. Decrypt server version
                            try {
                                const encryptionStore = useEncryptionStore.getState();
                                decryptedServerNote = await encryptionStore.decryptNote(serverNote);
                            } catch (e) {
                                logger.error('SYNC', 'Failed to decrypt server note during conflict', e);
                                decryptedServerNote = { ...serverNote, content: '[Decryption Failed]' };
                            }

                            // 3. Create Conflicted Copy from LOCAL changes
                            const conflictId = uuidv4();
                            const conflictNote = {
                                ...original,
                                id: conflictId,
                                title: `${original.title} (Conflict ${new Date().toLocaleTimeString()})`,
                                sync_status: SYNC_STATUS.NEW,
                                version: 1,
                                updated_at: new Date().toISOString()
                            };
                            await db.notes.add(conflictNote);

                            // 4. Revert original note to SERVER version
                            await db.notes.put({
                                ...decryptedServerNote,
                                sync_status: SYNC_STATUS.SYNCED
                            });

                            logger.info('SYNC', `Conflict resolved: Created copy ${conflictId}, reverted ${original.id}`);
                        }
                    } catch (err) {
                        logger.error('SYNC', 'Error resolving conflict', err);
                    }
                } else if (result.op === 'update' && result.error === 'Note not found') {
                    // FIX: Note exists locally but missing on server (e.g. wiped or ID mismatch)
                    // Self-heal by marking as NEW to force re-creation/upload
                    logger.warn('SYNC', `Note ${original.id} not found on server. Resurrecting as new.`);

                    await db.notes.update(original.id, {
                        sync_status: SYNC_STATUS.NEW,
                        updated_at: new Date().toISOString()
                    });

                } else {
                    logger.error('SYNC', 'Operation failed', result);
                }
            }
        } catch (error) {
            logger.error('SYNC', 'Push sync failed', error);
        }
    }, [authFetch]);

    // Full sync with retry logic
    const sync = useCallback(async (retryCount = 0) => {

        if (globalSyncLock) return;
        globalSyncLock = true;

        // Update sync status in store atomically
        useNotesStore.setState({ isSyncing: true });

        try {
            // First upload any offline images and update note references

            await uploadOfflineImages();

            // Sync labels

            await pushLabels();

            await pullLabels();

            // Process offline queue (unshares etc.)

            await processOfflineQueue();

            // Sync notes

            await pushChanges();

            await pullChanges();

            // Atomic state update to prevent race conditions
            // Check pending changes immediately after sync operations
            const pendingCount = await db.notes
                .where('sync_status')
                .anyOf([SYNC_STATUS.NEW, SYNC_STATUS.PENDING, SYNC_STATUS.DELETED])
                .count();

            useNotesStore.setState({
                lastSyncedAt: new Date(),
                isSyncing: false,
                pendingChanges: pendingCount > 0
            });

        } catch (error) {
            logger.error('SYNC', 'Sync failed', error);
            useNotesStore.setState({ isSyncing: false });

            // Retry with exponential backoff (only if online)
            if (navigator.onLine && retryCount < MAX_RETRY_ATTEMPTS) {
                const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
                logger.info('SYNC', `Sync retry ${retryCount + 1}/${MAX_RETRY_ATTEMPTS} in ${delay}ms`);
                globalSyncLock = false; // Allow retry
                setTimeout(() => sync(retryCount + 1), delay);
                return; // Don't reset syncInProgress yet
            }
        } finally {
            globalSyncLock = false;
        }
    }, [uploadOfflineImages, pushLabels, pullLabels, pushChanges, pullChanges, processOfflineQueue]);

    // Auto-sync on mount and periodically
    useEffect(() => {

        // Register sync function in store for manual trigger
        useNotesStore.getState().setTriggerSync(sync);


        // Initial sync
        sync();

        // Periodic sync every SYNC_INTERVAL_MS
        const interval = setInterval(sync, SYNC_INTERVAL_MS);

        // Sync on online event
        const handleOnline = () => sync();
        window.addEventListener('online', handleOnline);

        // Sync on tab focus (visibility change)
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                sync();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            clearInterval(interval);
            window.removeEventListener('online', handleOnline);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [sync]);

    return { sync, pushChanges, pullChanges };
}
