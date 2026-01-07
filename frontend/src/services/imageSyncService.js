/**
 * Image Sync Service
 * Handles uploading offline images and updating note references.
 */

import { db, SYNC_STATUS, LOCAL_IMAGE_PREFIX } from '../db/db';
import { logger } from '../utils/logger';

const API_URL = '/api';

/**
 * Upload offline images and replace local URLs with server URLs
 * @param {Function} authFetch - Authenticated fetch function
 */
export async function uploadOfflineImages(authFetch) {
    if (!authFetch) return;

    try {
        const offlineImages = await db.offline_images.toArray();
        if (offlineImages.length === 0) return;

        for (const offlineImage of offlineImages) {
            try {
                // Upload blob to server
                const formData = new FormData();
                formData.append('images', offlineImage.blob, `image_${offlineImage.id}`);

                const res = await authFetch(`${API_URL}/upload`, {
                    method: 'POST',
                    body: formData,
                });

                if (!res.ok) {
                    logger.error('SYNC', 'Failed to upload offline image', { id: offlineImage.id });
                    continue;
                }

                const uploadedFiles = await res.json();
                const serverImage = uploadedFiles[0];
                const localUrl = `${LOCAL_IMAGE_PREFIX}${offlineImage.id}`;

                // Find all notes that reference this local image and update them
                const notesWithImage = await db.notes
                    .filter(note => {
                        if (!note.images || !Array.isArray(note.images)) return false;
                        return note.images.some(img =>
                            img.url === localUrl ||
                            img.thumb_medium === localUrl ||
                            img.thumb_small === localUrl
                        );
                    })
                    .toArray();

                // Replace local URLs with server URLs in each note
                for (const note of notesWithImage) {
                    const updatedImages = note.images.map(img => {
                        if (img.url === localUrl || img.thumb_medium === localUrl) {
                            return {
                                ...serverImage,
                                _isOffline: undefined
                            };
                        }
                        return img;
                    });

                    // Update note with new image URLs and mark for sync
                    await db.notes.update(note.id, {
                        images: updatedImages,
                        sync_status: note.sync_status === SYNC_STATUS.NEW
                            ? SYNC_STATUS.NEW
                            : SYNC_STATUS.PENDING
                    });
                }

                // Delete from offline storage
                await db.offline_images.delete(offlineImage.id);

            } catch (error) {
                logger.error('SYNC', 'Error processing offline image', { id: offlineImage.id, error });
            }
        }
    } catch (error) {
        logger.error('SYNC', 'Failed to upload offline images', error);
    }
}
