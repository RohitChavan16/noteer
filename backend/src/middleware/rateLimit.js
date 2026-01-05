/**
 * Rate Limiting Middleware
 * 
 * Smart in-memory rate limiter for API protection.
 * Uses User ID (from JWT) when available, falls back to IP address.
 * For production with multiple instances, use Redis-backed solution.
 */

import { logger } from '../utils/logger.js';

// In-memory store for request counts
const requestCounts = new Map();

// Cleanup old entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of requestCounts.entries()) {
        if (now - data.windowStart > 60000) {
            requestCounts.delete(key);
        }
    }
}, 300000);

/**
 * Extract user ID from JWT token (optimistic decode, no verification)
 * Verification happens later in auth middleware - this is just for rate limit key
 */
function extractUserIdFromToken(req) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }
        const token = authHeader.slice(7);
        // Decode payload without verification (base64 decode middle part)
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        return payload.userId || payload.sub || payload.id || null;
    } catch {
        return null;
    }
}

/**
 * Create rate limiter middleware
 * @param {object} options
 * @param {number} options.windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 * @param {number} options.max - Max requests per window (default: 100)
 * @param {string} options.message - Error message (default: 'Too many requests')
 * @param {boolean} options.skipSuccessfulRequests - Don't count successful responses
 * @param {function} options.keyGenerator - Custom key generator function (receives req)
 */
export function rateLimit(options = {}) {
    const {
        windowMs = 60000,
        max = 100,
        message = 'Too many requests, please try again later.',
        skipSuccessfulRequests = false,
        keyGenerator = null,
    } = options;

    // Default smart key generator: User ID (from token) -> IP address
    const getKey = keyGenerator || ((req) => {
        // Try to get user ID from existing req.user (if auth ran first)
        if (req.user && req.user.id) {
            return `user:${req.user.id}`;
        }
        // Try optimistic JWT decode (for when limiter runs before auth)
        const userId = extractUserIdFromToken(req);
        if (userId) {
            return `user:${userId}`;
        }
        // Fallback to IP address
        return `ip:${req.ip}`;
    });

    return (req, res, next) => {
        // Use smart key generator
        const key = `${getKey(req)}:${req.path}`;
        const now = Date.now();

        let data = requestCounts.get(key);

        if (!data || now - data.windowStart > windowMs) {
            // New window
            data = { count: 1, windowStart: now };
            requestCounts.set(key, data);
        } else {
            data.count++;
        }

        // Set rate limit headers
        res.set('X-RateLimit-Limit', max);
        res.set('X-RateLimit-Remaining', Math.max(0, max - data.count));
        res.set('X-RateLimit-Reset', new Date(data.windowStart + windowMs).toISOString());

        if (data.count > max) {
            logger.warn('RATELIMIT', `Rate limit exceeded: ${key} (${data.count}/${max})`);
            res.status(429).json({ error: message });
            return;
        }

        if (skipSuccessfulRequests) {
            const originalEnd = res.end;
            res.end = function (...args) {
                if (res.statusCode < 400) {
                    data.count--;
                }
                return originalEnd.apply(res, args);
            };
        }

        next();
    };
}

// Pre-configured limiters for common use cases
export const authLimiter = rateLimit({
    windowMs: 60000,    // 1 minute
    max: 50,            // 50 attempts per minute
    message: 'Too many login attempts, please try again after a minute.',
});

export const apiLimiter = rateLimit({
    windowMs: 60000,    // 1 minute  
    max: 500,           // 500 requests per minute
});

export const uploadLimiter = rateLimit({
    windowMs: 60000,    // 1 minute
    max: 100,          // 100 uploads per minute
});
