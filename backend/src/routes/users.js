import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { body, param, validationResult } from 'express-validator';
import { query } from '../db/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/users - List users (admin only)
router.get('/', requireRole('admin'), async (req, res, next) => {
    try {
        const result = await query(
            'SELECT id, email, given_name, family_name, role, oidc_subject, avatar_url, created_at FROM users ORDER BY created_at DESC'
        );
        const users = result.rows.map(u => ({
            ...u,
            name: `${u.given_name || ''} ${u.family_name || ''}`.trim() || u.email
        }));
        res.json(users);
    } catch (error) {
        next(error);
    }
});

// GET /api/users/search - Search users by email or name (for sharing)
router.get('/search', async (req, res, next) => {
    try {
        const { q } = req.query;
        const currentUserId = req.user.id;

        if (!q || q.length < 2) {
            return res.json([]);
        }

        const searchTerm = `%${q}%`;
        const result = await query(
            `SELECT id, email, given_name, family_name, avatar_url 
             FROM users 
             WHERE id != $1 
               AND (email ILIKE $2 OR given_name ILIKE $2 OR family_name ILIKE $2)
             ORDER BY email ASC
             LIMIT 10`,
            [currentUserId, searchTerm]
        );

        const users = result.rows.map(u => ({
            ...u,
            name: `${u.given_name || ''} ${u.family_name || ''}`.trim() || u.email
        }));
        res.json(users);
    } catch (error) {
        next(error);
    }
});

// GET /api/users/:id - Get user by ID (admin or self)
router.get('/:id', param('id').isInt(), async (req, res, next) => {
    try {
        const { id } = req.params;

        // Users can only view themselves unless admin
        if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await query(
            'SELECT id, email, given_name, family_name, role, oidc_subject, oidc_issuer, avatar_url, created_at FROM users WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        res.json({
            ...user,
            name: `${user.given_name || ''} ${user.family_name || ''}`.trim() || user.email,
            isOidc: !!user.oidc_subject,
        });
    } catch (error) {
        next(error);
    }
});

// PATCH /api/users/:id - Update user (name, email, password)
router.patch('/:id', [
    param('id').isInt(),
    body('given_name').optional().trim().isLength({ max: 255 }),
    body('family_name').optional().trim().isLength({ max: 255 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('password').optional().isLength({ min: 6 }),
    body('role').optional().isIn(['admin', 'user']),
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { given_name, family_name, email, password, role } = req.body;

        // Users can only update themselves unless admin
        if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check if user is OIDC managed
        const userResult = await query('SELECT oidc_subject FROM users WHERE id = $1', [id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isOidcUser = !!userResult.rows[0].oidc_subject;

        // OIDC users cannot change email or password
        if (isOidcUser && (email || password)) {
            return res.status(403).json({
                error: 'OIDC users cannot change email or password. Profile is managed by identity provider.'
            });
        }

        // Only admins can change roles
        if (role && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can change roles' });
        }

        // Check email uniqueness if changing email
        if (email) {
            const existing = await query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, id]);
            if (existing.rows.length > 0) {
                return res.status(409).json({ error: 'Email already in use' });
            }
        }

        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (given_name !== undefined) {
            updates.push(`given_name = $${paramIndex++}`);
            params.push(given_name);
        }
        if (family_name !== undefined) {
            updates.push(`family_name = $${paramIndex++}`);
            params.push(family_name);
        }
        if (email && !isOidcUser) {
            updates.push(`email = $${paramIndex++}`);
            params.push(email);
        }
        if (password && !isOidcUser) {
            updates.push(`password_hash = $${paramIndex++}`);
            params.push(await bcrypt.hash(password, 12));
        }
        if (role && req.user.role === 'admin') {
            updates.push(`role = $${paramIndex++}`);
            params.push(role);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(id);

        const result = await query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} 
       RETURNING id, email, given_name, family_name, role, oidc_subject, avatar_url, created_at`,
            params
        );

        const updatedUser = result.rows[0];
        res.json({
            ...updatedUser,
            name: `${updatedUser.given_name || ''} ${updatedUser.family_name || ''}`.trim() || updatedUser.email,
            isOidc: !!updatedUser.oidc_subject,
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/users/:id - Delete user (admin only)
router.delete('/:id', [requireRole('admin'), param('id').isInt()], async (req, res, next) => {
    try {
        const { id } = req.params;

        // Prevent self-deletion
        if (req.user.id === parseInt(id)) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }

        const result = await query(
            'DELETE FROM users WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export default router;
