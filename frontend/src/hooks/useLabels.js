import { useLiveQuery } from 'dexie-react-hooks';
import { db, SYNC_STATUS } from '../db/db';
import { useEncryptionStore } from '../stores/encryptionStore';
import { useMemo } from 'react';

export function useLabels() {
    return useLiveQuery(
        async () => {
            const { decryptLabel } = useEncryptionStore.getState();

            const [labels, notes] = await Promise.all([
                db.labels
                    .filter(label => label.sync_status !== SYNC_STATUS.DELETED)
                    .toArray(),
                db.notes
                    .filter(n => n.status !== 'trashed')
                    .toArray()
            ]);

            // Decrypt label names
            const decryptedLabels = await Promise.all(labels.map(async (label) => {
                const name = await decryptLabel(label.name);
                return { ...label, name };
            }));

            // Calculate counts
            const counts = {}; // Map<LabelID, count>

            // Create map of Name->ID for legacy support
            const nameToId = {};
            decryptedLabels.forEach(l => {
                nameToId[l.name.toLowerCase()] = l.id;
            });

            notes.forEach(note => {
                // Handle label_ids (preferred) or labels (legacy/mixed)
                const ids = note.label_ids || note.labels;

                if (Array.isArray(ids)) {
                    ids.forEach(identifier => {
                        // Check if identifier is ID (UUID) or Name
                        // Heuristic: UUID is usually 36 chars. Names can be anything.
                        // But wait, if we use ID, it's an ID. If legacy name, it's a name.
                        // Simple check: Is it in our labels list as ID?
                        const labelById = decryptedLabels.find(l => l.id === identifier);

                        if (labelById) {
                            counts[identifier] = (counts[identifier] || 0) + 1;
                        } else {
                            // Try finding by name (legacy)
                            const idByName = nameToId[identifier.toString().toLowerCase()];
                            if (idByName) {
                                counts[idByName] = (counts[idByName] || 0) + 1;
                            }
                        }
                    });
                }
            });

            // Merge counts and sort by name
            return decryptedLabels.map(label => ({
                ...label,
                note_count: counts[label.id] || 0
            })).sort((a, b) => a.name.localeCompare(b.name));
        },
        [], // Dependencies
        []  // Default value
    );
}

// Helper hook to get a Map of ID -> Name
export function useLabelsMap() {
    const labels = useLabels();

    return useMemo(() => {
        const map = new Map();
        if (labels) {
            labels.forEach(l => map.set(l.id, l.name));
        }
        return map;
    }, [labels]);
}
