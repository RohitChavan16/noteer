import { create } from 'zustand';
import { db, SYNC_STATUS } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import { useEncryptionStore } from './encryptionStore';
import { logger } from '../utils/logger';

/**
 * In-memory cache of decrypted label names for O(1) duplicate check.
 * Map: labelId -> lowercased decrypted name
 */
let labelNameCache = null;

/**
 * Build or rebuild the label name cache from DB
 */
async function buildNameCache() {
    const { decryptLabel } = useEncryptionStore.getState();
    const allLabels = await db.labels.toArray();
    const cache = new Map();

    for (const label of allLabels) {
        if (label.sync_status === SYNC_STATUS.DELETED) continue;
        try {
            const decryptedName = await decryptLabel(label.name);
            cache.set(label.id, decryptedName.toLowerCase());
        } catch (e) {
            // Skip labels that fail to decrypt
            logger.warn('LABELS', `Failed to decrypt label ${label.id}`, e);
        }
    }

    labelNameCache = cache;
    return cache;
}

/**
 * Get cache, building it if needed
 */
async function getNameCache() {
    if (labelNameCache === null) {
        return await buildNameCache();
    }
    return labelNameCache;
}

/**
 * Invalidate cache (call on encryption state change)
 */
export function invalidateLabelCache() {
    labelNameCache = null;
}

export const useLabelsStore = create((set, get) => ({
    // State is now managed by useLabels hook via Dexie, this store handles actions
    isLoading: false,
    error: null,

    createLabel: async (name) => {
        set({ isLoading: true, error: null });
        try {
            const { encryptLabel } = useEncryptionStore.getState();
            const normalizedName = name.trim().toLowerCase();

            // O(1) duplicate check using cache
            const cache = await getNameCache();

            // Check if name already exists
            for (const [labelId, cachedName] of cache.entries()) {
                if (cachedName === normalizedName) {
                    // Return existing label
                    const existingLabel = await db.labels.get(labelId);
                    set({ isLoading: false });
                    return { success: true, label: existingLabel };
                }
            }

            // Create new label
            const encryptedName = await encryptLabel(name.trim());

            const newLabel = {
                id: uuidv4(),
                name: encryptedName,
                sync_status: SYNC_STATUS.NEW
            };

            await db.labels.add(newLabel);

            // Update cache with new label (O(1) insert)
            cache.set(newLabel.id, normalizedName);

            set({ isLoading: false });
            return { success: true, label: newLabel };
        } catch (error) {
            logger.error('LABELS', 'Failed to create label', error);
            set({ error: 'Failed to create label locally', isLoading: false });
            return { success: false, error: 'Failed to create label' };
        }
    },

    deleteLabel: async (id) => {
        try {
            // Soft delete the label
            await db.labels.update(id, { sync_status: SYNC_STATUS.DELETED });

            // Remove from cache
            if (labelNameCache) {
                labelNameCache.delete(id);
            }

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
            logger.error('LABELS', 'Failed to delete label', error);
            return { success: false, error: error.message };
        }
    },

    // Get or create a label by name (for inline creation)
    getOrCreateLabel: async (name) => {
        return await get().createLabel(name);
    },

    // Force rebuild cache (useful after sync)
    rebuildCache: async () => {
        await buildNameCache();
    }
}));
