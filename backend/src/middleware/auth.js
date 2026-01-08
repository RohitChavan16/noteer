import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        logger.debug('AUTH', 'No token provided');
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        logger.warn('AUTH', 'Token verification failed', error.message);
        logger.debug('AUTH', 'Token was', token);
        logger.debug('AUTH', 'Secret starts with', process.env.JWT_SECRET ? process.env.JWT_SECRET.substring(0, 4) + '...' : 'UNDEFINED');
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

// Convenience middleware for admin-only routes
export function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    next();
}
