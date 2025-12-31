import { create } from 'zustand';
import { db, SYNC_STATUS } from '../db/db';
import { v4 as uuidv4 } from 'uuid';

export const useLabelsStore = create((set, get) => ({
    // State is now managed by useLabels hook via Dexie, this store handles actions
    isLoading: false,
    error: null,

    createLabel: async (name) => {
        set({ isLoading: true, error: null });
        try {
            // Check for duplicates (case-insensitive) considering only non-deleted labels
            const existing = await db.labels
                .filter(l => l.name.toLowerCase() === name.toLowerCase() && l.sync_status !== SYNC_STATUS.DELETED)
                .first();

            if (existing) {
                set({ isLoading: false });
                return { success: true, label: existing };
            }

            const newLabel = {
                id: uuidv4(),
                name: name.trim(),
                sync_status: SYNC_STATUS.NEW
            };

            await db.labels.add(newLabel);
            set({ isLoading: false });
            return { success: true, label: newLabel };
        } catch (error) {
            console.error('Failed to create label:', error);
            set({ error: 'Failed to create label locally', isLoading: false });
            return { success: false, error: 'Failed to create label' };
        }
    },

    deleteLabel: async (id) => {
        try {
            // Soft delete
            await db.labels.update(id, { sync_status: SYNC_STATUS.DELETED });
            return { success: true };
        } catch (error) {
            console.error('Failed to delete label:', error);
            return { success: false, error: error.message };
        }
    },

    // Get or create a label by name (for inline creation)
    getOrCreateLabel: async (name) => {
        return await get().createLabel(name);
    }
}));
