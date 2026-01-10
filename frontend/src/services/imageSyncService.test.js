import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadOfflineImages } from './imageSyncService';
import { db, SYNC_STATUS, LOCAL_IMAGE_PREFIX } from '../db/db';
import { logger } from '../utils/logger';

// Mock dependencies
vi.mock('../db/db', () => ({
    db: {
        offline_images: {
            toArray: vi.fn(),
            delete: vi.fn(),
        },
        notes: {
            filter: vi.fn(),
            update: vi.fn(),
        },
    },
    SYNC_STATUS: {
        NEW: 'NEW',
        PENDING: 'PENDING',
    },
    LOCAL_IMAGE_PREFIX: 'local_image_',
}));

vi.mock('../utils/logger', () => ({
    logger: {
        error: vi.fn(),
        info: vi.fn(),
    },
}));

describe('ImageSyncService', () => {
    let mockAuthFetch;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAuthFetch = vi.fn();

        // Setup default db.notes.filter chaining
        db.notes.filter.mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
        });
    });

    it('should return early if authFetch is not provided', async () => {
        await uploadOfflineImages(null);
        expect(db.offline_images.toArray).not.toHaveBeenCalled();
    });

    it('should return early if no offline images exist', async () => {
        db.offline_images.toArray.mockResolvedValue([]);

        await uploadOfflineImages(mockAuthFetch);

        expect(mockAuthFetch).not.toHaveBeenCalled();
    });

    it('should upload image and update referencing notes', async () => {
        const offlineImageId = 'img123';
        const serverUrl = 'https://example.com/images/server_img123.jpg';
        const noteId = 'note1';

        const offlineImage = {
            id: offlineImageId,
            blob: new Blob(['test'], { type: 'image/jpeg' }),
        };

        const noteWithLocalImage = {
            id: noteId,
            images: [
                { url: `${LOCAL_IMAGE_PREFIX}${offlineImageId}` },
                { url: 'https://existing.com/other.jpg' }
            ],
            sync_status: SYNC_STATUS.SYNCED,
        };

        // Mock DB responses
        db.offline_images.toArray.mockResolvedValue([offlineImage]);

        // Mock notes filtering
        const toArrayMock = vi.fn().mockResolvedValue([noteWithLocalImage]);
        db.notes.filter.mockReturnValue({ toArray: toArrayMock });

        // Mock successful upload response
        mockAuthFetch.mockResolvedValue({
            ok: true,
            json: async () => [{
                url: serverUrl,
                width: 100,
                height: 100
            }],
        });

        await uploadOfflineImages(mockAuthFetch);

        // Verify upload
        expect(mockAuthFetch).toHaveBeenCalledTimes(1);
        const formData = mockAuthFetch.mock.calls[0][1].body;
        expect(formData).toBeInstanceOf(FormData);
        // FormData.get returns File (which inherits Blob), checking size or type is safer than reference equality
        const appendedFile = formData.get('images');
        expect(appendedFile).toBeInstanceOf(Blob);

        // Verify note update
        expect(db.notes.update).toHaveBeenCalledTimes(1);
        expect(db.notes.update).toHaveBeenCalledWith(noteId, {
            images: [
                { url: serverUrl, width: 100, height: 100, _isOffline: undefined },
                { url: 'https://existing.com/other.jpg' }
            ],
            sync_status: SYNC_STATUS.PENDING
        });

        // Verify query deletion
        expect(db.offline_images.delete).toHaveBeenCalledWith(offlineImageId);
    });

    it('should handle upload failure', async () => {
        const offlineImage = {
            id: 'img_fail',
            blob: new Blob(['test'], { type: 'image/jpeg' }),
        };

        db.offline_images.toArray.mockResolvedValue([offlineImage]);
        mockAuthFetch.mockResolvedValue({ ok: false });

        await uploadOfflineImages(mockAuthFetch);

        expect(logger.error).toHaveBeenCalledWith(
            'SYNC',
            'Failed to upload offline image',
            { id: offlineImage.id }
        );
        expect(db.offline_images.delete).not.toHaveBeenCalled();
        expect(db.notes.update).not.toHaveBeenCalled();
    });

    it('should handles processing error gracefully', async () => {
        const offlineImage = {
            id: 'img_error',
            blob: new Blob(['error_test'], { type: 'image/jpeg' })
        };
        db.offline_images.toArray.mockResolvedValue([offlineImage]);
        mockAuthFetch.mockRejectedValue(new Error('Network error'));

        await uploadOfflineImages(mockAuthFetch);

        expect(logger.error).toHaveBeenCalledWith(
            'SYNC',
            'Error processing offline image',
            expect.objectContaining({
                id: offlineImage.id,
                error: expect.any(Error)
            })
        );
    });
});
