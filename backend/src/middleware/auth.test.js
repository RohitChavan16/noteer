
import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';

// Import after defined imports
import { authenticateToken, requireRole, requireAdmin } from './auth.js';

describe('Auth Middleware', () => {

    describe('authenticateToken', () => {
        let req, res, next;
        const originalSecret = process.env.JWT_SECRET;
        const TEST_SECRET = 'test-secret';

        beforeEach(() => {
            process.env.JWT_SECRET = TEST_SECRET;
            req = { headers: {} };
            res = {
                status: mock.fn(() => res),
                json: mock.fn(() => res)
            };
            next = mock.fn();
        });

        afterEach(() => {
            process.env.JWT_SECRET = originalSecret;
        });

        it('should return 401 when no token provided', () => {
            authenticateToken(req, res, next);

            assert.strictEqual(res.status.mock.calls.length, 1);
            assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
            assert.strictEqual(next.mock.calls.length, 0);
        });

        it('should return 401 when authorization header is malformed', () => {
            // Case 1: Just "Bearer" (undefined token)
            req.headers['authorization'] = 'Bearer';
            authenticateToken(req, res, next);

            assert.strictEqual(res.status.mock.calls.length, 1);
            assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
        });

        it('should call next if token is valid', () => {
            const token = jwt.sign({ id: 1, role: 'user' }, TEST_SECRET);
            req.headers['authorization'] = `Bearer ${token}`;

            authenticateToken(req, res, next);

            assert.strictEqual(next.mock.calls.length, 1);
            assert.deepStrictEqual(req.user.id, 1);
            assert.deepStrictEqual(req.user.role, 'user');
        });

        it('should return 403 if token is invalid', () => {
            const token = jwt.sign({ id: 1, role: 'user' }, 'wrong-secret');
            req.headers['authorization'] = `Bearer ${token}`;

            authenticateToken(req, res, next);

            assert.strictEqual(res.status.mock.calls.length, 1);
            assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
            assert.strictEqual(next.mock.calls.length, 0);
        });
    });

    describe('requireRole', () => {
        it('should return 401 if no user attached to request', (t, done) => {
            const req = {};
            const res = {
                status: (code) => {
                    assert.strictEqual(code, 401);
                    return {
                        json: (data) => {
                            assert.deepStrictEqual(data, { error: 'Authentication required' });
                            done();
                        }
                    };
                }
            };
            const next = () => {
                assert.fail('Should not call next');
            };

            requireRole('admin')(req, res, next);
        });

        it('should return 403 if user has insufficient permissions', (t, done) => {
            const req = { user: { role: 'user' } };
            const res = {
                status: (code) => {
                    assert.strictEqual(code, 403);
                    return {
                        json: (data) => {
                            assert.deepStrictEqual(data, { error: 'Insufficient permissions' });
                            done();
                        }
                    };
                }
            };
            const next = () => {
                assert.fail('Should not call next');
            };

            requireRole('admin')(req, res, next);
        });

        it('should call next if user has allowed role', (t, done) => {
            const req = { user: { role: 'admin' } };
            const res = {
                status: () => assert.fail('Should not call status'),
                json: () => assert.fail('Should not call json')
            };
            const next = () => {
                done();
            };

            requireRole('admin')(req, res, next);
        });

        it('should allow multiple roles', (t, done) => {
            const req = { user: { role: 'editor' } };
            const next = () => done();
            const res = { status: () => ({ json: () => { } }) };

            requireRole('admin', 'editor')(req, res, next);
        });
    });

    describe('requireAdmin', () => {
        it('should return 401 if no user', (t, done) => {
            const req = {};
            const res = {
                status: (code) => {
                    assert.strictEqual(code, 401);
                    return {
                        json: (data) => {
                            assert.deepStrictEqual(data, { error: 'Authentication required' });
                            done();
                        }
                    };
                }
            };
            requireAdmin(req, res, () => assert.fail('Should not call next'));
        });

        it('should return 403 if user is not admin', (t, done) => {
            const req = { user: { role: 'user' } };
            const res = {
                status: (code) => {
                    assert.strictEqual(code, 403);
                    return {
                        json: (data) => {
                            assert.deepStrictEqual(data, { error: 'Admin access required' });
                            done();
                        }
                    };
                }
            };
            requireAdmin(req, res, () => assert.fail('Should not call next'));
        });

        it('should call next if user is admin', (t, done) => {
            const req = { user: { role: 'admin' } };
            requireAdmin(req, {}, () => done());
        });
    });
});
