import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { db, SYNC_STATUS } from '../db/db';
import { useAuthStore } from './authStore';
import { useEncryptionStore } from './encryptionStore';
import { logger } from '../utils/logger';

const API_URL = '/api';

// Helper to get authFetch from authStore
const getAuthFetch = () => useAuthStore.getState().authFetch;

// Helper to get encryption functions
const getEncryption = () => useEncryptionStore.getState();

// Detect touch device for default view mode (phones, tablets)
const getDefaultViewMode = () => {
    if (typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
        return 'list';
    }
    return 'grid';
};

// Load persisted UI preferences from localStorage
const loadPersistedPrefs = () => {
    try {
        const stored = localStorage.getItem('noteer-ui-prefs');
        if (stored) return JSON.parse(stored);
    } catch (_e) { /* ignore */ }
    return {};
};

const persistedPrefs = loadPersistedPrefs();

/**
 * Notes Store - Refactored for Local-First Architecture
 * 
 * IMPORTANT CHANGES:
 * - `notes` array REMOVED - use useNotes() hook with useLiveQuery instead
 * - `fetchNotes` / `fetchMoreNotes` REMOVED - sync engine handles data fetching
 * - CRUD operations now write to local Dexie DB first, then sync handles server push
 * - All operations are optimistic (instant UI feedback)
 */
export const useNotesStore = create((set, get) => ({
    // UI State only (no longer stores notes array)
    isLoading: false,
    error: null,
    searchQuery: '',
    viewMode: persistedPrefs.viewMode || getDefaultViewMode(),
    sortBy: persistedPrefs.sortBy || 'created_at',  // 'created_at' | 'title'
    sortOrder: persistedPrefs.sortOrder || 'desc',  // 'asc' | 'desc'

    // Infinite Scroll state
    displayLimit: 20,

    // Sync state (for UI indicators)
    isSyncing: false,
    pendingChanges: false,
    lastSyncedAt: null,
    triggerSync: null, // Will be set by useSync hook

    // UI State setters (with persistence)
    setSearchQuery: (query) => set({ searchQuery: query }),

    // Infinite Scroll actions
    loadMore: () => set(state => ({ displayLimit: state.displayLimit + 20 })),
    resetLimit: () => set({ displayLimit: 20 }),

    // Selection Mode State
    isSelectionMode: false,
    selectedNoteIds: [], // Array of strings

    // Selection Mode Actions
    toggleSelectionMode: () => set(state => {
        const newMode = !state.isSelectionMode;
        return {
            isSelectionMode: newMode,
            selectedNoteIds: newMode ? [] : [] // Always clear selection when toggling? Or keep it? User said "Zrusit vypne... odoznaci vse". So clear.
        };
    }),

    toggleNoteSelection: (id) => set(state => {
        const currentSelected = state.selectedNoteIds;
        const isSelected = currentSelected.includes(id);

        let newSelected;
        if (isSelected) {
            newSelected = currentSelected.filter(noteId => noteId !== id);
        } else {
            newSelected = [...currentSelected, id];
        }

        return { selectedNoteIds: newSelected };
    }),

    selectAll: (ids) => set({ selectedNoteIds: [...ids] }), // Pass visible IDs from component

    clearSelection: () => set({ selectedNoteIds: [], isSelectionMode: false }), // User said "Cancel" turns off mode

    // Bulk Actions
    bulkUpdateNotes: async (ids, changes) => {
        try {
            if (!ids || ids.length === 0) return true;

            await db.transaction('rw', db.notes, async () => {
                const now = new Date().toISOString();

                // 1. Fetch all notes in parallel (faster than awaiting one by one)
                // Use bulkGet if available, or Promise.all with gets
                const notes = await db.notes.bulkGet(ids);

                // 2. Prepare bulk updates
                const updates = [];

                for (let i = 0; i < notes.length; i++) {
                    const note = notes[i];
                    if (!note) continue; // Skip if not found

                    // Determine new sync status
                    const newSyncStatus = note.sync_status === SYNC_STATUS.NEW
                        ? SYNC_STATUS.NEW
                        : SYNC_STATUS.PENDING;

                    // Track dirty fields for partial sync
                    const changeKeys = Object.keys(changes).filter(k => k !== 'updated_at' && k !== 'sync_status');
                    const existingDirty = note.sync_dirty_fields || [];
                    const newDirty = [...new Set([...existingDirty, ...changeKeys])];

                    // Merge changes
                    const updatedNote = {
                        ...note,
                        ...changes,
                        updated_at: now,
                        sync_status: newSyncStatus,
                        sync_dirty_fields: newDirty
                    };

                    // Sanitize whitelisted fields if needed (omitted here for speed/trust)
                    updates.push(updatedNote);
                }

                // 3. Perform bulk put (extremely fast)
                if (updates.length > 0) {
                    await db.notes.bulkPut(updates);
                }
            });

            get().clearSelection();
            set({ pendingChanges: true });
            return true;
        } catch (error) {
            logger.error('NOTES', 'Failed bulk update', error);
            return false;
        }
    },

    /**
     * Bulk add labels to notes (merges with existing labels)
     */
    bulkAddLabels: async (ids, newLabels) => {
        try {
            if (!ids || ids.length === 0 || !newLabels || newLabels.length === 0) return true;

            await db.transaction('rw', db.notes, async () => {
                const now = new Date().toISOString();
                const notes = await db.notes.bulkGet(ids);
                const updates = [];

                for (let i = 0; i < notes.length; i++) {
                    const note = notes[i];
                    if (!note) continue;

                    const newSyncStatus = note.sync_status === SYNC_STATUS.NEW
                        ? SYNC_STATUS.NEW
                        : SYNC_STATUS.PENDING;

                    const currentLabels = note.labels || [];
                    // Merge and deduplicate
                    const mergedLabels = [...new Set([...currentLabels, ...newLabels])];

                    // Track dirty fields
                    const existingDirty = note.sync_dirty_fields || [];
                    const newDirty = [...new Set([...existingDirty, 'labels'])];

                    const updatedNote = {
                        ...note,
                        labels: mergedLabels,
                        updated_at: now,
                        sync_status: newSyncStatus,
                        sync_dirty_fields: newDirty
                    };
                    updates.push(updatedNote);
                }

                if (updates.length > 0) {
                    await db.notes.bulkPut(updates);
                }
            });
            get().clearSelection();
            set({ pendingChanges: true });
            return true;
        } catch (error) {
            logger.error('NOTES', 'Failed bulk label add', error);
            return false;
        }
    },

    bulkRemoveLabels: async (ids, labelsToRemove) => {
        try {
            if (!ids || ids.length === 0 || !labelsToRemove || labelsToRemove.length === 0) return true;

            await db.transaction('rw', db.notes, async () => {
                const now = new Date().toISOString();
                const notes = await db.notes.bulkGet(ids);
                const updates = [];

                for (let i = 0; i < notes.length; i++) {
                    const note = notes[i];
                    if (!note) continue;

                    const currentLabels = note.labels || [];
                    // Remove specified labels
                    const newLabels = currentLabels.filter(l => !labelsToRemove.includes(l));

                    // working only if something changed
                    if (newLabels.length === currentLabels.length) continue;

                    const newSyncStatus = note.sync_status === SYNC_STATUS.NEW
                        ? SYNC_STATUS.NEW
                        : SYNC_STATUS.PENDING;

                    // Track dirty fields
                    const existingDirty = note.sync_dirty_fields || [];
                    const newDirty = [...new Set([...existingDirty, 'labels'])];

                    const updatedNote = {
                        ...note,
                        labels: newLabels,
                        updated_at: now,
                        sync_status: newSyncStatus,
                        sync_dirty_fields: newDirty
                    };
                    updates.push(updatedNote);
                }

                if (updates.length > 0) {
                    await db.notes.bulkPut(updates);
                }
            });
            get().clearSelection();
            set({ pendingChanges: true });
            return true;
        } catch (error) {
            logger.error('NOTES', 'Failed bulk label remove', error);
            return false;
        }
    },

    bulkTrashNotes: async (ids) => {
        return get().bulkUpdateNotes(ids, { is_trashed: true });
    },

    bulkArchiveNotes: async (ids) => {
        return get().bulkUpdateNotes(ids, { is_archived: true });
    },

    bulkUnarchiveNotes: async (ids) => {
        return get().bulkUpdateNotes(ids, { is_archived: false });
    },

    bulkRestoreNotes: async (ids) => {
        return get().bulkUpdateNotes(ids, { is_trashed: false });
    },

    bulkDeleteNotes: async (ids) => {
        try {
            await Promise.all(ids.map(id => get().deleteNote(id)));
            get().clearSelection();
            return true;
        } catch (error) {
            logger.error('NOTES', 'Failed bulk delete', error);
            return false;
        }
    },

    setViewMode: (mode) => {
        set({ viewMode: mode });
        try {
            const prefs = loadPersistedPrefs();
            localStorage.setItem('noteer-ui-prefs', JSON.stringify({ ...prefs, viewMode: mode }));
        } catch (_e) { /* ignore */ }
    },
    setSortBy: (sortBy) => {
        set({ sortBy });
        try {
            const prefs = loadPersistedPrefs();
            localStorage.setItem('noteer-ui-prefs', JSON.stringify({ ...prefs, sortBy }));
        } catch (_e) { /* ignore */ }
    },
    setSortOrder: (sortOrder) => {
        set({ sortOrder });
        try {
            const prefs = loadPersistedPrefs();
            localStorage.setItem('noteer-ui-prefs', JSON.stringify({ ...prefs, sortOrder }));
        } catch (_e) { /* ignore */ }
    },

    setTriggerSync: (fn) => set({ triggerSync: fn }),

    /**
     * Create a new note - writes to local DB immediately
     * Sync engine will push to server in background
     */
    createNote: async (noteData) => {
        try {
            // Input validation
            if (!noteData || typeof noteData !== 'object') {
                throw new Error('Invalid note data');
            }

            // Generate a temporary UUID for the new note
            const tempId = uuidv4();
            const now = new Date().toISOString();

            // Sanitize and validate input fields
            const newNote = {
                id: tempId,
                title: typeof noteData.title === 'string' ? noteData.title.slice(0, 200) : '',
                content: typeof noteData.content === 'string' ? noteData.content.slice(0, 60000) : '',
                type: ['text', 'checklist', 'picture'].includes(noteData.type) ? noteData.type : 'text',
                color: typeof noteData.color === 'string' ? noteData.color : null,
                is_pinned: Boolean(noteData.is_pinned),
                is_archived: false,
                is_trashed: false,
                items: Array.isArray(noteData.items) ? noteData.items : null,
                labels: Array.isArray(noteData.labels) ? noteData.labels : [],
                images: Array.isArray(noteData.images) ? noteData.images : [],
                created_at: now,
                updated_at: now,
                sync_status: SYNC_STATUS.NEW // Mark for sync
            };

            // NOTE: Do NOT encrypt here! Notes are stored PLAINTEXT in local Dexie DB.
            // Encryption happens at the "sync edge" in useSync.js pushChanges().
            // This enables local search/sort and keeps the architecture clean.

            // Write to local Dexie DB
            try {
                await db.notes.add(newNote);
            } catch (dbError) {
                logger.error('NOTES', 'Dexie write failed (createNote)', dbError);
                throw dbError;
            }

            set({ pendingChanges: true });
            return newNote;
        } catch (error) {
            logger.error('NOTES', 'Failed to create note', error);
            set({ error: error.message });
            return null;
        }
    },

    /**
     * Update a note - writes to local DB immediately
     * Sync engine will push to server in background
     */
    updateNote: async (id, noteData) => {
        try {
            const now = new Date().toISOString();

            // Get current note to merge data
            const currentNote = await db.notes.get(id);
            if (!currentNote) {
                throw new Error('Note not found');
            }

            // Determine new sync status
            // If note is NEW (not yet on server), keep it NEW
            // Otherwise mark as PENDING
            const newSyncStatus = currentNote.sync_status === SYNC_STATUS.NEW
                ? SYNC_STATUS.NEW
                : SYNC_STATUS.PENDING;

            // Sanitize and whitelist update fields
            const updates = {};
            if (noteData.title !== undefined) updates.title = typeof noteData.title === 'string' ? noteData.title.slice(0, 200) : '';
            if (noteData.content !== undefined) updates.content = typeof noteData.content === 'string' ? noteData.content.slice(0, 60000) : '';
            if (noteData.type !== undefined) updates.type = ['text', 'checklist', 'picture'].includes(noteData.type) ? noteData.type : 'text';
            if (noteData.color !== undefined) updates.color = typeof noteData.color === 'string' ? noteData.color : null;
            if (noteData.is_pinned !== undefined) updates.is_pinned = Boolean(noteData.is_pinned);
            if (noteData.is_archived !== undefined) updates.is_archived = Boolean(noteData.is_archived);
            if (noteData.is_trashed !== undefined) updates.is_trashed = Boolean(noteData.is_trashed);
            if (noteData.items !== undefined) updates.items = Array.isArray(noteData.items) ? noteData.items : null;
            if (noteData.labels !== undefined) updates.labels = Array.isArray(noteData.labels) ? noteData.labels : [];
            if (noteData.images !== undefined) updates.images = Array.isArray(noteData.images) ? noteData.images : [];

            // Always update metadata
            updates.updated_at = now;
            updates.sync_status = newSyncStatus;

            // Track dirty fields for partial sync
            const dirtyKeys = Object.keys(updates).filter(k => k !== 'updated_at' && k !== 'sync_status' && k !== 'sync_dirty_fields');
            const existingDirty = currentNote.sync_dirty_fields || [];
            updates.sync_dirty_fields = [...new Set([...existingDirty, ...dirtyKeys])];

            // Update in Dexie
            await db.notes.update(id, updates);

            set({ pendingChanges: true });
            return true;
        } catch (error) {
            logger.error('NOTES', 'Failed to update note', error);
            set({ error: error.message });
            return false;
        }
    },

    /**
     * Trash a note (soft delete)
     */
    trashNote: async (id) => {
        return get().updateNote(id, { is_trashed: true });
    },

    /**
     * Restore a note from trash
     */
    restoreNote: async (id) => {
        return get().updateNote(id, { is_trashed: false });
    },

    /**
     * Permanently delete a note
     */
    deleteNote: async (id) => {
        try {
            const note = await db.notes.get(id);
            if (!note) return true;

            if (!note) return true;

            logger.debug('NOTES', 'Deleting note', { id, status: note.sync_status });

            if (note.sync_status === SYNC_STATUS.NEW) {
                // Note was never synced to server, just delete locally
                logger.debug('NOTES', 'Physical delete (NEW)');
                await db.notes.delete(id);
            } else {
                // Mark for deletion, sync engine will delete on server
                logger.debug('NOTES', 'Soft delete (marking DELETED)');
                await db.notes.update(id, { sync_status: SYNC_STATUS.DELETED });
            }

            set({ pendingChanges: true });
            return true;
        } catch (error) {
            logger.error('NOTES', 'Failed to delete note', error);
            set({ error: error.message });
            return false;
        }
    },

    /**
     * Pin/Unpin a note
     */
    pinNote: async (id, isPinned) => {
        return get().updateNote(id, { is_pinned: isPinned });
    },

    /**
     * Archive a note
     */
    archiveNote: async (id) => {
        return get().updateNote(id, { is_archived: true });
    },

    /**
     * Unarchive a note
     */
    unarchiveNote: async (id) => {
        return get().updateNote(id, { is_archived: false });
    },

    /**
     * Get note versions (still uses API - versions are server-side only)
     */
    getNoteVersions: async (id) => {
        try {
            const authFetch = getAuthFetch();
            const res = await authFetch(`${API_URL}/notes/${id}/versions`);
            if (!res.ok) throw new Error('Failed to fetch versions');
            return await res.json();
        } catch (error) {
            logger.error('NOTES', 'Failed to get note versions', error);
            return [];
        }
    },

    /**
     * Restore a note version (still uses API - versions are server-side only)
     */
    restoreNoteVersion: async (id, versionId) => {
        try {
            const authFetch = getAuthFetch();
            const res = await authFetch(`${API_URL}/notes/${id}/versions/${versionId}/restore`, {
                method: 'POST'
            });
            if (!res.ok) throw new Error('Failed to restore version');
            const restoredNote = await res.json();

            // Update local DB with restored content
            const { isUnlocked, decryptNote } = getEncryption();
            let noteToStore = restoredNote;
            if (isUnlocked && restoredNote.encrypted) {
                noteToStore = await decryptNote(restoredNote);
            }

            await db.notes.put({
                ...noteToStore,
                sync_status: SYNC_STATUS.SYNCED
            });

            return restoredNote;
        } catch (error) {
            logger.error('NOTES', 'Failed to restore note version', error);
            throw error;
        }
    },

    /**
     * Upload image - stores locally when offline, uploads when online
     */
    uploadImage: async (file) => {
        try {
            // Check if online
            if (navigator.onLine) {
                // Online: upload to server
                const formData = new FormData();
                formData.append('images', file);

                const authFetch = getAuthFetch();
                const res = await authFetch(`${API_URL}/upload`, {
                    method: 'POST',
                    body: formData,
                });

                if (!res.ok) throw new Error('Failed to upload image');
                const uploadedFiles = await res.json();
                return uploadedFiles[0];
            } else {
                // Offline: store blob locally
                const { v4: uuidv4 } = await import('uuid');
                const { LOCAL_IMAGE_PREFIX } = await import('../db/db');

                const imageId = uuidv4();
                const now = new Date().toISOString();

                // Store blob in offline_images table
                // NOTE: Stored as plaintext locally. Encryption happens on server upload.
                // This is acceptable in our Local-First Zero-Knowledge model as we trust the local device.
                await db.offline_images.add({
                    id: imageId,
                    blob: file,
                    mime_type: file.type,
                    created_at: now
                });

                // Return a placeholder that will be resolved by useLocalImage hook
                const localUrl = `${LOCAL_IMAGE_PREFIX}${imageId}`;
                return {
                    url: localUrl,
                    thumb_small: localUrl,
                    thumb_medium: localUrl,
                    _isOffline: true
                };
            }
        } catch (error) {
            logger.error('NOTES', 'Failed to upload image', error);
            set({ error: error.message });
            return null;
        }
    },
}));
