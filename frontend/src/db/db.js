import Dexie from 'dexie';
import { getWebWorkerDB } from 'dexie-worker';

export const db = new Dexie('noteer');

// Version 2: Added compound indexes for sorting
db.version(2).stores({
    notes: 'id, user_id, updated_at, title, is_pinned, is_archived, is_trashed, sync_status, version, [is_pinned+updated_at], [is_pinned+title]',
    syncState: 'key',
    offline_images: 'id, created_at',
    labels: 'id, name, sync_status, [name+sync_status]',
    offline_queue: '++id, type, created_at', // Generic queue for offline actions (unshare, etc.)
    note_versions: 'id, note_id, created_at, [note_id+created_at]' // Offline version history
});

// Initialize DB (required for dexie-worker)
db.open().catch(err => {
    console.error('Failed to open database:', err);
});

// Web Worker DB proxy for heavy operations (runs off main thread)
// Use workerDb for bulk writes to avoid blocking UI
export const workerDb = getWebWorkerDB(db);

// Helpers for sync status
export const SYNC_STATUS = {
    SYNCED: 'synced',
    PENDING: 'pending',
    NEW: 'new',
    DELETED: 'deleted'
};

// Local image URL prefix
export const LOCAL_IMAGE_PREFIX = 'local-image:';
