import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';

export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (_error) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}

export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
}

export async function refreshUserData(req, res, next) {
    if (req.user && req.user.id) {
        try {
            const result = await query(
                'SELECT id, email, name, role FROM users WHERE id = $1',
                [req.user.id]
            );
            if (result.rows.length > 0) {
                req.user = result.rows[0];
            }
        } catch (_error) {
            // Keep existing user data on error
        }
    }
    next();
}
