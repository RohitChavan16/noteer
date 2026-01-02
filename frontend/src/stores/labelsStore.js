import { create } from 'zustand';
import { db, SYNC_STATUS } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import { useEncryptionStore } from './encryptionStore';

export const useLabelsStore = create((set, get) => ({
    // State is now managed by useLabels hook via Dexie, this store handles actions
    isLoading: false,
    error: null,

    createLabel: async (name) => {
        set({ isLoading: true, error: null });
        try {
            const { encryptLabel, decryptLabel } = useEncryptionStore.getState();

            // Check for duplicates by fetching all and decrypting (since we can't query encrypted names)
            const allLabels = await db.labels.toArray();

            // Filter out deleted and check names
            for (const label of allLabels) {
                if (label.sync_status === SYNC_STATUS.DELETED) continue;

                const decryptedName = await decryptLabel(label.name);
                if (decryptedName.toLowerCase() === name.trim().toLowerCase()) {
                    set({ isLoading: false });
                    return { success: true, label };
                }
            }

            const encryptedName = await encryptLabel(name.trim());

            const newLabel = {
                id: uuidv4(),
                name: encryptedName,
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
            // Soft delete the label
            await db.labels.update(id, { sync_status: SYNC_STATUS.DELETED });

            // FIX: Immediately remove this label from all local notes to update UI
            await db.transaction('rw', db.notes, async () => {
                const affectedNotes = await db.notes
                    .filter(n => Array.isArray(n.labels) && n.labels.includes(id))
                    .toArray();

                for (const note of affectedNotes) {
                    const newLabels = note.labels.filter(lid => lid !== id);

                    // We only update the local state for UI purposes.
                    // The backend will handle the relationship deletion via CASCADE when the label deletion is synced.
                    await db.notes.update(note.id, {
                        labels: newLabels,
                        updated_at: new Date().toISOString() // Update timestamp to trigger UI refresh
                    });
                }
            });

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
