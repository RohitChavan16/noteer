import { useState, useEffect } from 'react';
import { Image, Loader, Center, Text } from '@mantine/core';
import { useEncryptionStore } from '../stores/encryptionStore';
import { IconLock } from '@tabler/icons-react';
import { db, LOCAL_IMAGE_PREFIX } from '../db/db';
import { logger } from '../utils/logger';

export default function EncryptedImage({ src, noteId, alt, iv, originalName, encryptionIv, ...props }) {
    const [decryptedSrc, setDecryptedSrc] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const { decryptImage, isUnlocked } = useEncryptionStore();

    // Use passed encryptionIv prop or fallback to iv
    const effectiveIv = encryptionIv || iv;

    useEffect(() => {
        let isMounted = true;
        let objectUrl = null;

        const loadDecryptedImage = async () => {
            // Handle local offline images
            if (src && src.startsWith(LOCAL_IMAGE_PREFIX)) {
                const imageId = src.replace(LOCAL_IMAGE_PREFIX, '');
                try {
                    setLoading(true);
                    const offlineImage = await db.offline_images.get(imageId);
                    if (offlineImage && offlineImage.blob && isMounted) {
                        objectUrl = URL.createObjectURL(offlineImage.blob);
                        setDecryptedSrc(objectUrl);
                    } else if (isMounted) {
                        setError('Image not found');
                    }
                } catch (err) {
                    logger.error('UI', 'Failed to load offline image', err);
                    if (isMounted) setError('Failed to load image');
                } finally {
                    if (isMounted) setLoading(false);
                }
                return;
            }

            // If normal image (not encrypted extension), just use src
            if (!src || (!src.endsWith('.enc') && !effectiveIv)) {
                setDecryptedSrc(src);
                return;
            }

            if (!isUnlocked) {
                // Wait for unlock
                return;
            }

            if (!effectiveIv) {
                // Encrypted file but no IV? Cannot decrypt.
                logger.warn('UI', 'Encrypted image missing IV', src);
                setError('Missing encryption metadata');
                return;
            }

            try {
                setLoading(true);
                // Fetch the encrypted blob
                const response = await fetch(src);
                if (!response.ok) throw new Error('Failed to fetch image');
                const encryptedArrayBuffer = await response.arrayBuffer();

                // Decrypt
                const blob = await decryptImage(encryptedArrayBuffer, effectiveIv, noteId);

                if (isMounted) {
                    objectUrl = URL.createObjectURL(blob);
                    setDecryptedSrc(objectUrl);
                }
            } catch (err) {
                logger.error('UI', 'Failed to decrypt image', err);
                if (isMounted) setError('Decryption failed');
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadDecryptedImage();

        return () => {
            isMounted = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [src, effectiveIv, noteId, isUnlocked, decryptImage]);

    if (loading) {
        return (
            <Center style={{ height: props.height || '100%', minHeight: 100, backgroundColor: 'rgba(0,0,0,0.1)' }}>
                <Loader size="sm" variant="dots" />
            </Center>
        );
    }

    if (error) {
        return (
            <Center style={{ height: props.height || '100%', minHeight: 100, backgroundColor: 'rgba(0,0,0,0.05)', flexDirection: 'column', gap: 8 }}>
                <IconLock size={24} style={{ opacity: 0.5 }} />
                <Text size="xs" c="dimmed">{error}</Text>
            </Center>
        );
    }

    return <Image src={decryptedSrc || src} alt={alt || originalName} {...props} />;
}
