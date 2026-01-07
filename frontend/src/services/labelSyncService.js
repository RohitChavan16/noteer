/**
 * Label Sync Service
 * Handles synchronization of labels between local Dexie and server.
 */

import { db, SYNC_STATUS } from '../db/db';
import { logger } from '../utils/logger';

const API_URL = '/api';

/**
 * Pull labels from server and sync to local DB
 * @param {Function} authFetch - Authenticated fetch function
 */
export async function pullLabels(authFetch) {
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

            // Delete local SYNCED labels that are missing from server (State Reconciliation)
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
                            updated_at: new Date().toISOString(),
                            sync_status: note.sync_status === SYNC_STATUS.NEW ? SYNC_STATUS.NEW : SYNC_STATUS.PENDING
                        });
                    }
                }
            }
        });
    } catch (error) {
        logger.error('SYNC', 'Pull labels failed', error);
    }
}

/**
 * Push local label changes to server
 * @param {Function} authFetch - Authenticated fetch function
 */
export async function pushLabels(authFetch) {
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

                        // Update all notes that reference this temporary label ID
                        await db.transaction('rw', db.notes, db.labels, async () => {
                            const affectedNotes = await db.notes
                                .filter(n => Array.isArray(n.labels) && n.labels.includes(label.id))
                                .toArray();

                            for (const note of affectedNotes) {
                                const newLabels = note.labels.map(lid => lid === label.id ? serverLabel.id : lid);
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
}
