import { useState, useCallback, useRef } from 'react';
import { useNotesStore } from '../stores/notesStore';
import { useEncryptionStore } from '../stores/encryptionStore';
import { notifications } from '@mantine/notifications';
import { logger } from '../utils/logger';

/**
 * Custom hook for managing note images with upload and encryption support
 * Extracted from NoteModal to reduce component complexity
 * @param {Array} initialImages - Initial images array
 * @param {string|number} noteId - Note ID for encryption context
 * @param {number} maxImages - Maximum allowed images (default: 2)
 */
export function useNoteImages(initialImages = [], noteId = null, maxImages = 2) {
    const [images, setImages] = useState(initialImages);
    const [isUploading, setIsUploading] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const openRef = useRef(null);

    const { uploadImage } = useNotesStore();

    /**
     * Handle file drop/upload
     * Encrypts images if encryption is unlocked
     */
    const handleDrop = useCallback(async (files) => {
        const remainingSlots = maxImages - images.length;
        if (remainingSlots <= 0) {
            return;
        }
        const filesToUpload = files.slice(0, remainingSlots);

        setIsUploading(true);
        try {
            const { isUnlocked, encryptImage: encryptImageFn } = useEncryptionStore.getState();

            for (const file of filesToUpload) {
                let fileToUpload = file;
                let encryptionIv = null;

                // Encrypt image if encryption is unlocked and note has been saved
                if (isUnlocked && noteId) {
                    try {
                        const { encryptedBlob, iv } = await encryptImageFn(file, noteId);
                        fileToUpload = new File([encryptedBlob], file.name + '.enc', { type: 'application/octet-stream' });
                        encryptionIv = iv;
                    } catch (encError) {
                        logger.warn('UI', 'Image encryption failed, falling back to unencrypted', encError);
                        // Fall back to unencrypted upload
                    }
                }

                const uploaded = await uploadImage(fileToUpload);
                if (uploaded) {
                    // Store encryption IV with image metadata
                    if (encryptionIv) {
                        uploaded.encryption_iv = encryptionIv;
                    }
                    setImages(prev => [...prev, uploaded]);
                }
            }
        } catch (error) {
            logger.error('UI', 'Image upload failed', error);
            notifications.show({ title: 'Upload failed', message: 'Failed to upload image', color: 'red' });
        } finally {
            setIsUploading(false);
        }
    }, [images.length, maxImages, noteId, uploadImage]);

    /**
     * Handle dropzone rejection
     */
    const handleReject = useCallback((files) => {
        const errors = files.flatMap(f => f.errors.map(e => e.message));
        notifications.show({
            title: 'Upload failed',
            message: errors.join(', ') || 'Only JPEG, PNG, GIF and WebP images are allowed (max 10MB)',
            color: 'red',
            autoClose: 5000
        });
    }, []);

    /**
     * Remove image by index
     */
    const removeImage = useCallback((index) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    }, []);

    /**
     * Open file picker
     */
    const openFilePicker = useCallback(() => {
        if (images.length < maxImages && openRef.current) {
            openRef.current();
        }
    }, [images.length, maxImages]);

    /**
     * Check if can add more images
     */
    const canAddImage = images.length < maxImages;

    return {
        images,
        setImages,
        isUploading,
        previewImage,
        setPreviewImage,
        openRef,
        handleDrop,
        handleReject,
        removeImage,
        openFilePicker,
        canAddImage,
        maxImages,
    };
}

export default useNoteImages;
