import { create } from 'zustand';
import { useAuthStore } from './authStore';

const API_URL = '/api';

// Helper to get authFetch from authStore
const getAuthFetch = () => useAuthStore.getState().authFetch;

export const useNotesStore = create((set, get) => ({
    notes: [],
    isLoading: false,
    error: null,
    searchQuery: '',
    viewMode: 'grid', // 'grid' | 'list'

    setSearchQuery: (query) => set({ searchQuery: query }),
    setViewMode: (mode) => set({ viewMode: mode }),

    fetchNotes: async (options = {}) => {
        set({ isLoading: true, error: null });
        try {
            const params = new URLSearchParams();
            if (options.archived) params.append('archived', 'true');
            if (options.trashed) params.append('trashed', 'true');
            if (options.label) params.append('label', options.label);
            if (options.search) params.append('search', options.search);

            const authFetch = getAuthFetch();
            const res = await authFetch(`${API_URL}/notes?${params}`);

            if (!res.ok) throw new Error('Failed to fetch notes');

            const notes = await res.json();
            set({ notes, isLoading: false });
        } catch (error) {
            set({ error: error.message, isLoading: false });
        }
    },

    createNote: async (noteData) => {
        try {
            const authFetch = getAuthFetch();
            const res = await authFetch(`${API_URL}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(noteData),
            });

            if (!res.ok) throw new Error('Failed to create note');

            const note = await res.json();
            set((state) => ({ notes: [note, ...state.notes] }));
            return note;
        } catch (error) {
            set({ error: error.message });
            return null;
        }
    },

    updateNote: async (id, noteData) => {
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
            }));
            return updatedNote;
        } catch (error) {
            set({ error: error.message });
            return null;
        }
    },

    trashNote: async (id) => {
        try {
            const authFetch = getAuthFetch();
            const res = await authFetch(`${API_URL}/notes/${id}/trash`, {
                method: 'POST',
            });

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
            const res = await authFetch(`${API_URL}/notes/${id}/restore`, {
                method: 'POST',
            });

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
            const res = await authFetch(`${API_URL}/notes/${id}`, {
                method: 'DELETE',
            });

            if (!res.ok) throw new Error('Failed to delete note');

            set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
            return true;
        } catch (error) {
            set({ error: error.message });
            return false;
        }
    },

    pinNote: async (id, isPinned) => {
        return get().updateNote(id, { is_pinned: isPinned });
    },

    archiveNote: async (id) => {
        const result = await get().updateNote(id, { is_archived: true });
        if (result) {
            set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
        }
        return result;
    },

    unarchiveNote: async (id) => {
        const result = await get().updateNote(id, { is_archived: false });
        if (result) {
            set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
        }
        return result;
    },
}));
