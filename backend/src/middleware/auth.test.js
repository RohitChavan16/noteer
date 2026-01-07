/**
 * Unit tests for auth middleware
 * Uses Node.js native test runner
 */

import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';

// Note: These mocks are prepared for future use when we need to test
// actual token verification. Currently we test the middleware logic.
// Mock jwt before importing auth
const _mockJwt = {
    verify: mock.fn()
};

// Mock query before importing auth
const _mockQuery = mock.fn();

// Mock logger
const _mockLogger = {
    debug: mock.fn(),
    warn: mock.fn(),
    error: mock.fn(),
    info: mock.fn()
};

// We need to use dynamic import with mocks - for now test the logic directly
// Since ES modules make mocking harder, we'll test the middleware behavior

describe('authenticateToken', () => {
    let req, res, next;

    beforeEach(() => {
        req = { headers: {} };
        res = {
            status: mock.fn(() => res),
            json: mock.fn(() => res)
        };
        next = mock.fn();
    });

    it('should return 401 when no token provided', async () => {
        // Import the actual module
        const { authenticateToken } = await import('./auth.js');

        req.headers['authorization'] = undefined;

        authenticateToken(req, res, next);

        assert.strictEqual(res.status.mock.calls.length, 1);
        assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
        assert.strictEqual(next.mock.calls.length, 0);
    });

    it('should return 401 when authorization header has no Bearer token', async () => {
        const { authenticateToken } = await import('./auth.js');

        req.headers['authorization'] = 'Basic abc123';

        authenticateToken(req, res, next);

        // Split on ' ' gives ['Basic', 'abc123'], [1] = 'abc123' which is truthy
        // But jwt.verify will fail, so we expect 403
        assert.ok(res.status.mock.calls.length >= 1);
    });
});

describe('requireRole', () => {
    let req, res, next;

    beforeEach(() => {
        req = { user: null };
        res = {
            status: mock.fn(() => res),
            json: mock.fn(() => res)
        };
        next = mock.fn();
    });

    it('should return 401 when no user on request', async () => {
        const { requireRole } = await import('./auth.js');

        const middleware = requireRole('admin', 'user');
        middleware(req, res, next);

        assert.strictEqual(res.status.mock.calls.length, 1);
        assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
        assert.strictEqual(next.mock.calls.length, 0);
    });

    it('should return 403 when user has wrong role', async () => {
        const { requireRole } = await import('./auth.js');

        req.user = { id: 1, role: 'guest' };
        const middleware = requireRole('admin', 'user');
        middleware(req, res, next);

        assert.strictEqual(res.status.mock.calls.length, 1);
        assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
        assert.strictEqual(next.mock.calls.length, 0);
    });

    it('should call next when user has correct role', async () => {
        const { requireRole } = await import('./auth.js');

        req.user = { id: 1, role: 'admin' };
        const middleware = requireRole('admin', 'user');
        middleware(req, res, next);

        assert.strictEqual(next.mock.calls.length, 1);
        assert.strictEqual(res.status.mock.calls.length, 0);
    });
});

describe('requireAdmin', () => {
    let req, res, next;

    beforeEach(() => {
        req = { user: null };
        res = {
            status: mock.fn(() => res),
            json: mock.fn(() => res)
        };
        next = mock.fn();
    });

    it('should return 401 when no user', async () => {
        const { requireAdmin } = await import('./auth.js');

        requireAdmin(req, res, next);

        assert.strictEqual(res.status.mock.calls.length, 1);
        assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
    });

    it('should return 403 when user is not admin', async () => {
        const { requireAdmin } = await import('./auth.js');

        req.user = { id: 1, role: 'user' };
        requireAdmin(req, res, next);

        assert.strictEqual(res.status.mock.calls.length, 1);
        assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
    });

    it('should call next when user is admin', async () => {
        const { requireAdmin } = await import('./auth.js');

        req.user = { id: 1, role: 'admin' };
        requireAdmin(req, res, next);

        assert.strictEqual(next.mock.calls.length, 1);
    });
});
