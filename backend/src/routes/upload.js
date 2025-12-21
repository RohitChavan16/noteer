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
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, GIF and WebP images are allowed'));
        }
    }
});

// Generate thumbnails and save all versions
async function saveWithThumbnails(file, userId) {
    const uploadDir = path.join(UPLOADS_BASE, 'users', String(userId));
    fs.mkdirSync(uploadDir, { recursive: true });

    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const baseName = uniqueSuffix;

    const originalFilename = `${baseName}${ext}`;
    const thumbSmallFilename = `${baseName}_thumb_small.jpg`;
    const thumbMediumFilename = `${baseName}_thumb_medium.jpg`;

    const originalPath = path.join(uploadDir, originalFilename);
    const thumbSmallPath = path.join(uploadDir, thumbSmallFilename);
    const thumbMediumPath = path.join(uploadDir, thumbMediumFilename);

    // Save original
    await fs.promises.writeFile(originalPath, file.buffer);

    // Generate small thumbnail (100px)
    await sharp(file.buffer)
        .resize(THUMB_SMALL, THUMB_SMALL, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(thumbSmallPath);

    // Generate medium thumbnail (400px)
    await sharp(file.buffer)
        .resize(THUMB_MEDIUM, THUMB_MEDIUM, { fit: 'inside' })
        .jpeg({ quality: 85 })
        .toFile(thumbMediumPath);

    return {
        url: `/uploads/users/${userId}/${originalFilename}`,
        thumb_small: `/uploads/users/${userId}/${thumbSmallFilename}`,
        thumb_medium: `/uploads/users/${userId}/${thumbMediumFilename}`,
        original_name: file.originalname,
        mime_type: file.mimetype,
        size: file.size
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
