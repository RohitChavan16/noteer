import { create } from 'zustand';
import { useAuthStore } from './authStore';

const API_URL = '/api';

export const useLabelsStore = create((set, get) => ({
    labels: [],
    isLoading: false,
    error: null,

    fetchLabels: async () => {
        const { authFetch } = useAuthStore.getState();
        set({ isLoading: true, error: null });
        try {
            const res = await authFetch(`${API_URL}/labels`);
            if (!res.ok) throw new Error('Failed to fetch labels');
            const labels = await res.json();
            set({ labels, isLoading: false });
        } catch (error) {
            set({ error: error.message, isLoading: false });
        }
    },

    createLabel: async (name) => {
        const { authFetch } = useAuthStore.getState();
        const { labels } = get();

        // Check if label already exists locally to avoid 409 error
        const existingLabel = labels.find((l) => l.name.toLowerCase() === name.toLowerCase());
        if (existingLabel) {
            return { success: false, error: 'Label already exists' };
        }

        try {
            const res = await authFetch(`${API_URL}/labels`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            if (!res.ok) {
                const data = await res.json();
                return { success: false, error: data.error || 'Failed to create label' };
            }
            const newLabel = await res.json();
            set((state) => ({ labels: [...state.labels, newLabel].sort((a, b) => a.name.localeCompare(b.name)) }));
            return { success: true, label: newLabel };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    deleteLabel: async (id) => {
        const { authFetch } = useAuthStore.getState();
        try {
            const res = await authFetch(`${API_URL}/labels/${id}`, {
                method: 'DELETE',
            });
            if (!res.ok && res.status !== 204) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete label');
            }
            set((state) => ({ labels: state.labels.filter((l) => l.id !== id) }));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Get or create a label by name (for inline creation)
    getOrCreateLabel: async (name) => {
        const { labels, createLabel } = get();
        const existing = labels.find((l) => l.name.toLowerCase() === name.toLowerCase());
        if (existing) {
            return { success: true, label: existing };
        }
        return await createLabel(name);
    },
}));
