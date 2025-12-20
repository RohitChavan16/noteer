import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth.js';
import { fileURLToPath } from 'url';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Per-user folder: uploads/users/:userId/
        // We assume authenticateToken populates req.user
        if (!req.user || !req.user.id) {
            return cb(new Error('User verification failed'));
        }
        const userId = req.user.id;
        // Go up two levels from src/routes to root, then to uploads
        const uploadPath = path.join(__dirname, '../../uploads/users', String(userId));

        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Unique filename: timestamp-random.ext
        const ext = path.extname(file.originalname);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

// POST /api/upload
router.post('/', authenticateToken, upload.array('images', 10), (req, res) => {
    // req.files contains uploaded files
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = req.files.map(file => ({
        url: `/uploads/users/${req.user.id}/${file.filename}`,
        original_name: file.originalname,
        mime_type: file.mimetype,
        size: file.size
    }));

    res.json(uploadedFiles);
});

export default router;
