import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { query } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Validation middleware
const validateLogin = [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
];

const validateRegister = [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('name').optional().trim().isLength({ max: 255 }),
];

// Generate JWT token
function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
}

// POST /api/auth/login
router.post('/login', validateLogin, async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        const result = await query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user || !user.password_hash) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = generateToken(user);
        res.json({
            token,
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/register
router.post('/register', validateRegister, async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password, name } = req.body;

        // Check if user exists
        const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const result = await query(
            'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, role',
            [email, passwordHash, name || null]
        );

        const user = result.rows[0];
        const token = generateToken(user);

        res.status(201).json({
            token,
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
    res.json({ user: req.user });
});

// POST /api/auth/logout (client-side token removal, but we can blacklist if needed)
router.post('/logout', authenticateToken, (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

export default router;
