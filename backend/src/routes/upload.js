import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Use persistent storage path (mounted as volume in Docker)
const UPLOADS_BASE = process.env.UPLOADS_PATH || '/var/lib/noteer/uploads';

// Thumbnail sizes
const THUMB_SMALL = 100;  // For NoteCard overview
const THUMB_MEDIUM = 400; // For NoteModal
const MAX_DIMENSION = 3840; // Max 4K resolution

// Configure storage - store in memory first, then save with thumbnails
const storage = multer.memoryStorage();

// Supported image MIME types
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
];

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype) || file.mimetype === 'application/octet-stream') {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, GIF, WebP and Encrypted files are allowed'));
        }
    }
});

// Generate thumbnails and save all versions (all converted to WebP)
async function saveWithThumbnails(file, userId) {
    const uploadDir = path.join(UPLOADS_BASE, 'users', String(userId));
    fs.mkdirSync(uploadDir, { recursive: true });

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const baseName = uniqueSuffix;

    const isEncrypted = file.originalname.endsWith('.enc') || file.mimetype === 'application/octet-stream';

    if (isEncrypted) {
        // Save encrypted file directly
        const filename = `${baseName}.enc`;
        const filePath = path.join(uploadDir, filename);
        await fs.promises.writeFile(filePath, file.buffer);

        return {
            url: `/uploads/users/${userId}/${filename}`,
            thumb_small: `/uploads/users/${userId}/${filename}`, // No thumbnails for encrypted
            thumb_medium: `/uploads/users/${userId}/${filename}`,
            original_name: file.originalname,
            mime_type: 'application/octet-stream',
            size: file.size,
            encryption_iv: null // Will be populated by caller if available
        };
    }

    // All files saved as WebP
    const originalFilename = `${baseName}.webp`;
    const thumbSmallFilename = `${baseName}_thumb_small.webp`;
    const thumbMediumFilename = `${baseName}_thumb_medium.webp`;

    const originalPath = path.join(uploadDir, originalFilename);
    const thumbSmallPath = path.join(uploadDir, thumbSmallFilename);
    const thumbMediumPath = path.join(uploadDir, thumbMediumFilename);

    // Get image metadata to check dimensions
    const metadata = await sharp(file.buffer).metadata();
    const needsResize = metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION;

    // Save original as WebP (resize if larger than 4K)
    let sharpInstance = sharp(file.buffer);

    if (needsResize) {
        sharpInstance = sharpInstance.resize(MAX_DIMENSION, MAX_DIMENSION, {
            fit: 'inside',
            withoutEnlargement: true
        });
    }

    await sharpInstance
        .webp({ quality: 85 })
        .toFile(originalPath);

    // Get actual file size after conversion
    const stats = await fs.promises.stat(originalPath);

    // Generate small thumbnail (100px) as WebP
    await sharp(file.buffer)
        .resize(THUMB_SMALL, THUMB_SMALL, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(thumbSmallPath);

    // Generate medium thumbnail (400px) as WebP
    await sharp(file.buffer)
        .resize(THUMB_MEDIUM, THUMB_MEDIUM, { fit: 'inside' })
        .webp({ quality: 85 })
        .toFile(thumbMediumPath);

    return {
        url: `/uploads/users/${userId}/${originalFilename}`,
        thumb_small: `/uploads/users/${userId}/${thumbSmallFilename}`,
        thumb_medium: `/uploads/users/${userId}/${thumbMediumFilename}`,
        original_name: file.originalname,
        mime_type: 'image/webp',  // Always WebP now
        size: stats.size  // Actual size after conversion
    };
}

// POST /api/upload
router.post('/', authenticateToken, upload.array('images', 2), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const uploadedFiles = [];
        for (const file of req.files) {
            const fileData = await saveWithThumbnails(file, req.user.id);
            uploadedFiles.push(fileData);
        }

        res.json(uploadedFiles);
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload images' });
    }
});

export default router;
