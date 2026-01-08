
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { requireRole, requireAdmin } from './auth.js';

describe('Auth Middleware', () => {
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
