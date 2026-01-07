/**
 * Offline Queue Service
 * Processes queued offline actions (unsharing, etc.)
 */

import { db } from '../db/db';
import { logger } from '../utils/logger';

const API_URL = '/api';

/**
 * Process generic offline action queue
 * @param {Function} authFetch - Authenticated fetch function
 */
export async function processOfflineQueue(authFetch) {
    if (!authFetch) return;

    try {
        const queue = await db.offline_queue.toArray();
        if (queue.length === 0) return;

        for (const item of queue) {
            try {
                if (item.type === 'UNSHARE_NOTE') {
                    const { noteId, userId } = item.payload;
                    const res = await authFetch(`${API_URL}/notes/${noteId}/share/${userId}`, {
                        method: 'DELETE',
                    });

                    if (res.ok || res.status === 204 || res.status === 404) {
                        // Success or already gone
                        await db.offline_queue.delete(item.id);
                    } else {
                        logger.error('SYNC', 'Failed to process unshare', await res.text());
                    }
                }
            } catch (error) {
                logger.error('SYNC', 'Error processing offline queue item', { id: item.id, error });
            }
        }
    } catch (error) {
        logger.error('SYNC', 'Offline queue processing failed', error);
    }
}
