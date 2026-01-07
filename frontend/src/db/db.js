import Dexie from 'dexie';
import { getWebWorkerDB } from 'dexie-worker';

export const db = new Dexie('noteer');

// Version 3: Added status field for efficient indexing + *labels multiEntry index
// NOTE: status = 'active' | 'archived' | 'trashed' (replaces boolean is_archived/is_trashed for indexing)
db.version(3).stores({
    notes: 'id, user_id, updated_at, title, is_pinned, status, sync_status, version, [status+is_pinned+updated_at], [status+is_pinned+title], *labels',
    syncState: 'key',
    offline_images: 'id, created_at',
    labels: 'id, name, sync_status, [name+sync_status]',
    offline_queue: '++id, type, created_at',
    note_versions: 'id, note_id, created_at, [note_id+created_at]'
});

// Note status constants
export const NOTE_STATUS = {
    ACTIVE: 'active',
    ARCHIVED: 'archived',
    TRASHED: 'trashed'
};

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
