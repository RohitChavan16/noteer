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
            'SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC'
        );
        res.json(result.rows);
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
            'SELECT id, email, name, role, created_at FROM users WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

// PATCH /api/users/:id - Update user
router.patch('/:id', [
    param('id').isInt(),
    body('name').optional().trim().isLength({ max: 255 }),
    body('password').optional().isLength({ min: 6 }),
    body('role').optional().isIn(['admin', 'user']),
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { name, password, role } = req.body;

        // Users can only update themselves unless admin
        if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Only admins can change roles
        if (role && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can change roles' });
        }

        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            params.push(name);
        }
        if (password) {
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
       RETURNING id, email, name, role, created_at`,
            params
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(result.rows[0]);
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
