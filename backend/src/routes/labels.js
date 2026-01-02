import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { query } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/labels - List all labels for user
router.get('/', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const result = await query(
            `SELECT l.id, l.name, l.created_at,
             (
                SELECT COUNT(DISTINCT unl.note_id)
                FROM user_note_labels unl
                JOIN notes n ON n.id = unl.note_id
                WHERE unl.label_id = l.id AND n.is_trashed = false
             ) :: integer as note_count
             FROM labels l
             WHERE l.user_id = $1
             ORDER BY l.name ASC`,
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        next(error);
    }
});

// POST /api/labels - Create a new label
// Modified for E2E: accepts encrypted blob as name, no unique check
router.post('/', [
    body('name').trim().isLength({ min: 1, max: 5000 }).withMessage('Label name must be 1-5000 characters'),
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const userId = req.user.id;
        const { name } = req.body;

        const result = await query(
            'INSERT INTO labels (user_id, name) VALUES ($1, $2) RETURNING id, name, created_at',
            [userId, name]
        );

        res.status(201).json({ ...result.rows[0], note_count: 0 });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/labels/:id - Delete a label
router.delete('/:id', [
    param('id').isInt().withMessage('Invalid label ID'),
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const userId = req.user.id;
        const { id } = req.params;

        // Verify ownership
        const label = await query(
            'SELECT id FROM labels WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
        if (label.rows.length === 0) {
            return res.status(404).json({ error: 'Label not found' });
        }

        // Delete label (user_note_labels will cascade)
        await query('DELETE FROM labels WHERE id = $1', [id]);

        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export default router;
