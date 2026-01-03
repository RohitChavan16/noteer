/**
 * Centralized Error Handler
 * 
 * Structured error logging with environment-aware output.
 * In production: logs to structured JSON format (ready for log aggregation)
 * In development: logs to console with full stack traces
 */

const isProduction = process.env.NODE_ENV === 'production';
import { logger } from '../utils/logger.js';

// Request counter for correlation
let requestCounter = 0;

/**
 * Generate a request ID for correlation
 */
export function requestId(req, res, next) {
    req.requestId = `req_${Date.now()}_${++requestCounter}`;
    res.set('X-Request-Id', req.requestId);
    next();
}

/**
 * Log error with structured format
 */
function logError(err, req) {
    const errorLog = {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        userId: req.user?.id,
        error: {
            name: err.name,
            message: err.message,
            code: err.code,
        },
    };

    if (!isProduction) {
        errorLog.stack = err.stack;
        errorLog.details = err;
    }

    // In production, this would go to log aggregation (e.g., stdout for Docker/K8s)
    // In production, this would go to log aggregation (e.g., stdout for Docker/K8s)
    if (isProduction) {
        logger.error('API', err.message, errorLog);
    } else {
        logger.error('API', `${errorLog.requestId}: ${err.message}`, err.stack);
    }

    return errorLog;
}

/**
 * Main error handler middleware
 */
export function errorHandler(err, req, res, _next) {
    logError(err, req);

    // PostgreSQL constraint errors
    if (err.code === '23505') {
        return res.status(409).json({
            error: 'Resource already exists',
            requestId: req.requestId,
        });
    }
    if (err.code === '23503') {
        return res.status(400).json({
            error: 'Referenced resource not found',
            requestId: req.requestId,
        });
    }
    if (err.code === '23502') {
        return res.status(400).json({
            error: 'Missing required field',
            requestId: req.requestId,
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(403).json({
            error: 'Invalid token',
            requestId: req.requestId,
        });
    }
    if (err.name === 'TokenExpiredError') {
        return res.status(403).json({
            error: 'Token expired',
            requestId: req.requestId,
        });
    }

    // Validation errors
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
            error: 'Invalid JSON',
            requestId: req.requestId,
        });
    }

    // Default server error - hide details in production
    const status = err.status || 500;
    const response = {
        error: isProduction ? 'Internal server error' : err.message,
        requestId: req.requestId,
    };

    if (!isProduction) {
        response.stack = err.stack;
    }

    res.status(status).json(response);
}

/**
 * Not found handler for undefined routes
 */
export function notFoundHandler(req, res) {
    res.status(404).json({
        error: 'Not found',
        path: req.path,
        requestId: req.requestId,
    });
}
