import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { db, SYNC_STATUS } from '../db/db';
import { useAuthStore } from './authStore';
import { useEncryptionStore } from './encryptionStore';

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
    viewMode: getDefaultViewMode(),
    sortBy: 'updated_at',  // 'updated_at' | 'title'
    sortOrder: 'desc',     // 'asc' | 'desc'

    // Sync state (for UI indicators)
    isSyncing: false,
    pendingChanges: false,
    lastSyncedAt: null,

    // UI State setters
    setSearchQuery: (query) => set({ searchQuery: query }),
    setViewMode: (mode) => set({ viewMode: mode }),
    setSortBy: (sortBy) => set({ sortBy }),
    setSortOrder: (sortOrder) => set({ sortOrder }),

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

            // Write to local Dexie DB
            await db.notes.add(newNote);

            set({ pendingChanges: true });
            return newNote;
        } catch (error) {
            console.error('Failed to create note:', error);
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

            // Update in Dexie
            await db.notes.update(id, updates);

            set({ pendingChanges: true });
            return true;
        } catch (error) {
            console.error('Failed to update note:', error);
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

            if (note.sync_status === SYNC_STATUS.NEW) {
                // Note was never synced to server, just delete locally
                await db.notes.delete(id);
            } else {
                // Mark for deletion, sync engine will delete on server
                await db.notes.update(id, { sync_status: SYNC_STATUS.DELETED });
            }

            set({ pendingChanges: true });
            return true;
        } catch (error) {
            console.error('Failed to delete note:', error);
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
            console.error(error);
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
            console.error(error);
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
            console.error(error);
            set({ error: error.message });
            return null;
        }
    },
}));
