import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

/**
 * Middleware to authenticate JWT token from Authorization header.
 * Attaches decoded user data to req.user if valid.
 * 
 * @param {import('express').Request} req - Express Request object
 * @param {import('express').Response} res - Express Response object
 * @param {import('express').NextFunction} next - Express Next function
 */
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

/**
 * Middleware factory to enforce role-based access control.
 * 
 * @param {...string} roles - Allowed roles (e.g. 'admin', 'user')
 * @returns {Function} Express middleware
 */
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
/**
 * Middleware to require 'admin' role.
 * 
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    next();
}
