import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { query } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// POST /api/notes/:id/share - Share note with a user
router.post('/:id/share', [param('id').isInt(), body('user_id').isInt()], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { user_id: targetUserId } = req.body;
        const userId = req.user.id;

        // Verify ownership
        const noteCheck = await query('SELECT user_id FROM notes WHERE id = $1', [id]);
        if (noteCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }
        if (noteCheck.rows[0].user_id !== userId) {
            return res.status(403).json({ error: 'Only the owner can share this note' });
        }

        // Cannot share with yourself
        if (targetUserId === userId) {
            return res.status(400).json({ error: 'Cannot share note with yourself' });
        }

        // Check target user exists
        const targetUser = await query(
            'SELECT id, email, given_name, family_name, avatar_url FROM users WHERE id = $1',
            [targetUserId]
        );
        if (targetUser.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Create share (ignore if already exists)
        await query(
            `INSERT INTO note_shares (note_id, shared_with_id) 
             VALUES ($1, $2) 
             ON CONFLICT (note_id, shared_with_id) DO NOTHING`,
            [id, targetUserId]
        );

        // Update note's updated_at for sync
        await query('UPDATE notes SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

        res.status(201).json({
            success: true,
            user: {
                ...targetUser.rows[0],
                name: `${targetUser.rows[0].given_name || ''} ${targetUser.rows[0].family_name || ''}`.trim() || targetUser.rows[0].email
            }
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/notes/:id/share/:userId - Unshare note from a user
router.delete('/:id/share/:userId', [param('id').isInt(), param('userId').isInt()], async (req, res, next) => {
    try {
        const { id, userId: targetUserId } = req.params;
        const currentUserId = req.user.id;

        // Check note exists
        const noteCheck = await query('SELECT user_id FROM notes WHERE id = $1', [id]);
        if (noteCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        const isOwner = noteCheck.rows[0].user_id === currentUserId;
        const targetId = parseInt(targetUserId);

        // If owner - can unshare anyone. If not owner - can only remove self
        if (!isOwner && targetId !== currentUserId) {
            return res.status(403).json({ error: 'You can only remove yourself from shared notes' });
        }

        const result = await query(
            'DELETE FROM note_shares WHERE note_id = $1 AND shared_with_id = $2 RETURNING id',
            [id, targetId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Share not found' });
        }

        // Update note's updated_at for sync
        await query('UPDATE notes SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// GET /api/notes/:id/shares - List users note is shared with
router.get('/:id/shares', param('id').isInt(), async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Verify ownership or shared access
        const noteCheck = await query(
            `SELECT n.user_id FROM notes n 
             LEFT JOIN note_shares ns ON ns.note_id = n.id AND ns.shared_with_id = $2
             WHERE n.id = $1 AND (n.user_id = $2 OR ns.id IS NOT NULL)`,
            [id, userId]
        );
        if (noteCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        const result = await query(
            `SELECT u.id, u.email, u.given_name, u.family_name, u.avatar_url, ns.is_archived, ns.created_at as shared_at
             FROM note_shares ns
             JOIN users u ON ns.shared_with_id = u.id
             WHERE ns.note_id = $1
             ORDER BY ns.created_at`,
            [id]
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

export default router;
