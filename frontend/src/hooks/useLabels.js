import { useLiveQuery } from 'dexie-react-hooks';
import { db, SYNC_STATUS } from '../db/db';

export function useLabels() {
    return useLiveQuery(
        async () => {
            const labels = await db.labels
                .filter(label => label.sync_status !== SYNC_STATUS.DELETED)
                .toArray();

            // Sort by name case-insensitive
            return labels.sort((a, b) => a.name.localeCompare(b.name));
        },
        [], // Dependencies
        []  // Default value
    );
}
