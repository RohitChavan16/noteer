import { create } from 'zustand';
import _ from 'lodash';
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

export const useNotesStore = create((set, get) => {
    // Keep track of debounced save functions per note ID
    const saveHandlers = new Map();

    return {
        notes: [],
        isLoading: false,
        error: null,
        searchQuery: '',
        viewMode: getDefaultViewMode(),

        // Sync state
        isSyncing: false,
        pendingChanges: false,
        lastSyncedAt: null,

        // Polling state
        lastFetchOptions: null,
        pollingInterval: null,

        setSearchQuery: (query) => set({ searchQuery: query }),
        setViewMode: (mode) => set({ viewMode: mode }),

        startPolling: () => {
            if (get().pollingInterval) return;
            const interval = setInterval(() => {
                const { fetchNotes, lastFetchOptions, pendingChanges, isSyncing } = get();
                // Do not poll if changes are pending
                if (pendingChanges || isSyncing) return;
                // Only poll if we have options (meaning a page has loaded)
                if (lastFetchOptions) {
                    fetchNotes(lastFetchOptions, true);
                }
            }, 5000); // Poll every 5 seconds
            set({ pollingInterval: interval });
        },

        stopPolling: () => {
            const { pollingInterval } = get();
            if (pollingInterval) clearInterval(pollingInterval);
            set({ pollingInterval: null });
        },

        fetchNotes: async (options = {}, silent = false) => {
            // Save options for polling
            set({ lastFetchOptions: options });

            if (!silent) {
                set({ isLoading: true, error: null });
            }

            try {
                const params = new URLSearchParams();
                if (options.archived) params.append('archived', 'true');
                if (options.trashed) params.append('trashed', 'true');
                if (options.label) params.append('label', options.label);
                if (options.search) params.append('search', options.search);

                const authFetch = getAuthFetch();
                const res = await authFetch(`${API_URL}/notes?${params}`);

                if (!res.ok) throw new Error('Failed to fetch notes');

                let notes = await res.json();

                // Decrypt notes if encryption is unlocked
                const { isUnlocked, decryptNote } = getEncryption();
                if (isUnlocked) {
                    notes = await Promise.all(notes.map(note => decryptNote(note)));
                }

                set({ notes, isLoading: false });
            } catch (error) {
                if (!silent) {
                    set({ error: error.message, isLoading: false });
                } else {
                    console.error('Polling failed:', error);
                }
            }
        },

        createNote: async (noteData) => {
            try {
                // Encrypt note before sending to server
                const { isUnlocked, encryptNote } = getEncryption();
                let dataToSend = noteData;
                if (isUnlocked) {
                    dataToSend = await encryptNote(noteData);
                }

                const authFetch = getAuthFetch();
                const res = await authFetch(`${API_URL}/notes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dataToSend),
                });

                if (!res.ok) throw new Error('Failed to create note');

                const serverNote = await res.json();

                // Keep the original unencrypted data for local state
                const note = {
                    ...serverNote,
                    title: noteData.title,
                    content: noteData.content
                };

                set((state) => ({ notes: [note, ...state.notes] }));
                return note;
            } catch (error) {
                set({ error: error.message });
                return null;
            }
        },

        // Optimistic update with debounced backend sync
        updateNote: async (id, noteData) => {
            // 1. Optimistic update
            set((state) => ({
                notes: state.notes.map((n) => (n.id === id ? { ...n, ...noteData } : n)),
                pendingChanges: true
            }));

            // 2. define save function
            const saveToBackend = async (dataToSave) => {
                set({ isSyncing: true });
                try {
                    // Encrypt before sending - ONLY if sensitive fields are changing
                    const { isUnlocked, encryptNote } = getEncryption();
                    let encryptedData = dataToSave;

                    const sensitiveFields = ['title', 'content'];
                    const hasSensitiveChange = sensitiveFields.some(f => dataToSave[f] !== undefined);

                    if (isUnlocked && hasSensitiveChange) {
                        // To encrypt correctly, we need the FULL note content (even if only title changed, 
                        // we need content to re-encrypt both with the same key/IV handling if needed, 
                        // or just to avoid sending empty string for the missing field)
                        const currentNote = get().notes.find(n => n.id === id);

                        // Safety check
                        if (currentNote) {
                            const merged = { ...currentNote, ...dataToSave };
                            const encryptedResult = await encryptNote(merged);

                            encryptedData = {
                                ...dataToSave,
                                title: encryptedResult.title,
                                content: encryptedResult.content,
                                encrypted: true,
                                encrypted_note_key: encryptedResult.encrypted_note_key
                            };
                        }
                    }

                    const authFetch = getAuthFetch();
                    const res = await authFetch(`${API_URL}/notes/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(encryptedData),
                    });

                    if (!res.ok) throw new Error('Failed to update note');

                    const updatedNote = await res.json();

                    // Update state with confirmed data from backend (e.g. updated_at)
                    set((state) => ({
                        notes: state.notes.map((n) => (n.id === id ? { ...n, ...updatedNote } : n)),
                        isSyncing: false,
                        pendingChanges: false,
                        lastSyncedAt: new Date()
                    }));
                } catch (error) {
                    console.error('Sync failed:', error);
                    set({ error: error.message, isSyncing: false });
                }
            };

            // 3. Get or create debounced handler
            if (!saveHandlers.has(id)) {
                // Debounce for 2 seconds (as per user request: "not immediately")
                saveHandlers.set(id, _.debounce(saveToBackend, 2000));
            }

            // 4. Trigger debounced save
            const handler = saveHandlers.get(id);
            handler(noteData);

            return true; // Return immediately for optimistic UI
        },

        // Immediate save (e.g. for creating copies or critical updates)
        forceSyncNote: async (id, noteData) => {
            // Cancel any pending debounced save for this note
            if (saveHandlers.has(id)) {
                saveHandlers.get(id).cancel();
            }

            set({ isSyncing: true });
            try {
                const authFetch = getAuthFetch();
                const res = await authFetch(`${API_URL}/notes/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(noteData),
                });

                if (!res.ok) throw new Error('Failed to update note');
                const updatedNote = await res.json();

                set((state) => ({
                    notes: state.notes.map((n) => (n.id === id ? { ...n, ...updatedNote } : n)),
                    isSyncing: false,
                    pendingChanges: false,
                    lastSyncedAt: new Date()
                }));
                return updatedNote;
            } catch (error) {
                set({ error: error.message, isSyncing: false });
                return null;
            }
        },

        trashNote: async (id) => {
            try {
                const authFetch = getAuthFetch();
                const res = await authFetch(`${API_URL}/notes/${id}/trash`, { method: 'POST' });
                if (!res.ok) throw new Error('Failed to trash note');
                set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
                return true;
            } catch (error) {
                set({ error: error.message });
                return false;
            }
        },

        restoreNote: async (id) => {
            try {
                const authFetch = getAuthFetch();
                const res = await authFetch(`${API_URL}/notes/${id}/restore`, { method: 'POST' });
                if (!res.ok) throw new Error('Failed to restore note');
                set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
                return true;
            } catch (error) {
                set({ error: error.message });
                return false;
            }
        },

        deleteNote: async (id) => {
            try {
                const authFetch = getAuthFetch();
                const res = await authFetch(`${API_URL}/notes/${id}`, { method: 'DELETE' });
                if (!res.ok) throw new Error('Failed to delete note');
                set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
                return true;
            } catch (error) {
                set({ error: error.message });
                return false;
            }
        },

        pinNote: async (id, isPinned) => {
            return get().forceSyncNote(id, { is_pinned: isPinned });
        },

        archiveNote: async (id) => {
            set((state) => ({ notes: state.notes.filter((n) => n.id !== id) })); // Optimistic remove
            const result = await get().forceSyncNote(id, { is_archived: true });
            return result;
        },

        unarchiveNote: async (id) => {
            set((state) => ({ notes: state.notes.filter((n) => n.id !== id) })); // Optimistic remove
            const result = await get().forceSyncNote(id, { is_archived: false });
            return result;
        },

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

        restoreNoteVersion: async (id, versionId) => {
            const authFetch = getAuthFetch();
            const res = await authFetch(`${API_URL}/notes/${id}/versions/${versionId}/restore`, {
                method: 'POST'
            });
            if (!res.ok) throw new Error('Failed to restore version');
            return await res.json();
        },

        uploadImage: async (file) => {
            try {
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
            } catch (error) {
                console.error(error);
                set({ error: error.message });
                return null;
            }
        },

        flushPendingUpdates: async () => {
            const promises = [];
            for (const handler of saveHandlers.values()) {
                const result = handler.flush();
                if (result instanceof Promise) {
                    promises.push(result);
                }
            }
            if (promises.length > 0) {
                await Promise.all(promises);
            }
        },
    };
});
