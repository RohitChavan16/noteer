export function errorHandler(err, req, res, next) {
    console.error('Error:', err);

    // PostgreSQL errors
    if (err.code === '23505') {
        return res.status(409).json({ error: 'Resource already exists' });
    }
    if (err.code === '23503') {
        return res.status(400).json({ error: 'Referenced resource not found' });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(403).json({ error: 'Invalid token' });
    }
    if (err.name === 'TokenExpiredError') {
        return res.status(403).json({ error: 'Token expired' });
    }

    // Validation errors
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON' });
    }

    // Default error
    console.error('SERVER ERROR DETAIL:', err.message, err.stack);
    res.status(err.status || 500).json({
        error: err.message,
        stack: err.stack,
        details: err
    });
}
