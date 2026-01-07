/**
 * Sync Hook - Orchestrates sync operations
 * 
 * This hook coordinates syncing between local Dexie database and server.
 * Heavy logic has been extracted to service modules:
 * - syncEngine.js: pullChanges, pushChanges, conflict resolution
 * - labelSyncService.js: label sync operations
 * - imageSyncService.js: offline image uploads
 * - offlineQueueService.js: offline action queue
 */

import { useEffect, useCallback, useState } from 'react';
import { db, SYNC_STATUS } from '../db/db';
import { useAuthStore } from '../stores/authStore';
import { useNotesStore } from '../stores/notesStore';
import { logger } from '../utils/logger';

// Import service modules
import { pullChanges, pushChanges } from '../services/syncEngine';
import { pullLabels, pushLabels } from '../services/labelSyncService';
import { uploadOfflineImages } from '../services/imageSyncService';
import { processOfflineQueue } from '../services/offlineQueueService';

// Constants
const API_URL = '/api';
const SYNC_INTERVAL_MS = 4000;
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

// Global sync lock
let globalSyncLock = false;

/**
 * Sync Engine Hook - The "Sync Edge"
 */
export function useSync() {
    const authFetch = useAuthStore.getState().authFetch;
    const isSyncing = useNotesStore(state => state.isSyncing);

    // Lazy Version Sync Queue
    const [versionSyncQueue, setVersionSyncQueue] = useState(new Set());

    // Effect: Background Fetch Versions for Queue
    useEffect(() => {
        if (versionSyncQueue.size === 0 || isSyncing) return;

        const fetchVersions = async () => {
            const idsToFetch = Array.from(versionSyncQueue);
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
                            const versionsByNote = new Map();
                            for (const version of versions) {
                                if (!versionsByNote.has(version.note_id)) {
                                    versionsByNote.set(version.note_id, []);
                                }
                                versionsByNote.get(version.note_id).push(version);
                            }

                            for (const [noteId, noteVersions] of versionsByNote) {
                                await db.note_versions.where('note_id').equals(noteId).delete();
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
                        logger.debug('SYNC', `[LazySync] Replaced local versions with ${versions.length} server versions`);
                    }
                }
            } catch (error) {
                logger.warn('SYNC', '[LazySync] Failed to fetch versions', error);
            }
        };

        const timeoutId = setTimeout(fetchVersions, 3000);
        return () => clearTimeout(timeoutId);
    }, [versionSyncQueue, isSyncing, authFetch]);

    // Wrapped callbacks that pass authFetch
    const doPullChanges = useCallback(async () => {
        await pullChanges(authFetch, setVersionSyncQueue);
    }, [authFetch]);

    const doPushChanges = useCallback(async () => {
        await pushChanges(authFetch);
    }, [authFetch]);

    const doPullLabels = useCallback(async () => {
        await pullLabels(authFetch);
    }, [authFetch]);

    const doPushLabels = useCallback(async () => {
        await pushLabels(authFetch);
    }, [authFetch]);

    const doUploadOfflineImages = useCallback(async () => {
        await uploadOfflineImages(authFetch);
    }, [authFetch]);

    const doProcessOfflineQueue = useCallback(async () => {
        await processOfflineQueue(authFetch);
    }, [authFetch]);

    // Full sync with retry logic
    const sync = useCallback(async (retryCount = 0) => {
        if (globalSyncLock) return;
        globalSyncLock = true;

        useNotesStore.setState({ isSyncing: true });

        try {
            // 1. Upload any offline images
            await doUploadOfflineImages();

            // 2. Sync labels
            await doPushLabels();
            await doPullLabels();

            // 3. Process offline queue
            await doProcessOfflineQueue();

            // 4. Sync notes
            await doPushChanges();
            await doPullChanges();

            // 5. Update state
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

            // Retry with exponential backoff
            if (navigator.onLine && retryCount < MAX_RETRY_ATTEMPTS) {
                const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
                logger.info('SYNC', `Sync retry ${retryCount + 1}/${MAX_RETRY_ATTEMPTS} in ${delay}ms`);
                globalSyncLock = false;
                setTimeout(() => sync(retryCount + 1), delay);
                return;
            }
        } finally {
            globalSyncLock = false;
        }
    }, [doUploadOfflineImages, doPushLabels, doPullLabels, doPushChanges, doPullChanges, doProcessOfflineQueue]);

    // Auto-sync on mount and periodically
    useEffect(() => {
        // Register sync function in store
        useNotesStore.getState().setTriggerSync(sync);

        // Initial sync
        sync();

        // Periodic sync
        const interval = setInterval(sync, SYNC_INTERVAL_MS);

        // Sync on online event
        const handleOnline = () => sync();
        window.addEventListener('online', handleOnline);

        // Sync on tab focus
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

    return { sync, pushChanges: doPushChanges, pullChanges: doPullChanges };
}
