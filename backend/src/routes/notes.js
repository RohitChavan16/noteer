import { Router } from 'express';
import { body, param, query as queryValidator, validationResult } from 'express-validator';
import { query } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Validation
const validateNote = [
    body('title').optional().trim().isLength({ max: 500 }),
    body('content').optional().trim(),
    body('type').optional().isIn(['note', 'checklist']),
    body('color').optional().isIn(['default', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'brown', 'gray']),
    body('is_pinned').optional().isBoolean(),
    body('reminder_at').optional().isISO8601(),
];

// GET /api/notes - List notes
router.get('/', async (req, res, next) => {
    try {
        const { archived, trashed, label, search } = req.query;
        const userId = req.user.id;

        let sql = `
            SELECT n.*, 
                   array_agg(DISTINCT l.name) FILTER (WHERE l.name IS NOT NULL) as labels,
                   COALESCE((
                       SELECT json_agg(json_build_object('content', ni.content, 'is_checked', ni.is_checked, 'position', ni.position) ORDER BY ni.position)
                       FROM note_items ni
                       WHERE ni.note_id = n.id
                   ), '[]'::json) as items
            FROM notes n
            LEFT JOIN note_labels nl ON n.id = nl.note_id
            LEFT JOIN labels l ON nl.label_id = l.id
            WHERE n.user_id = $1
        `;

        const params = [userId];
        let paramIndex = 2;

        if (archived === 'true') {
            sql += ` AND n.is_archived = true AND n.is_trashed = false`;
        } else if (trashed === 'true') {
            sql += ` AND n.is_trashed = true`;
        } else {
            sql += ` AND n.is_archived = false AND n.is_trashed = false`;
        }

        if (search) {
            sql += ` AND (n.title ILIKE $${paramIndex} OR n.content ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (label) {
            sql += ` AND EXISTS (
                SELECT 1 FROM note_labels nl2 
                JOIN labels l2 ON nl2.label_id = l2.id 
                WHERE nl2.note_id = n.id AND l2.name = $${paramIndex}
            )`;
            params.push(label);
            paramIndex++;
        }

        sql += ` GROUP BY n.id ORDER BY n.is_pinned DESC, n.updated_at DESC`;

        const result = await query(sql, params);
        res.json(result.rows);
    } catch (error) {
        next(error);
    }
});

// GET /api/notes/:id - Get single note
router.get('/:id', param('id').isInt(), async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await query(
            `SELECT n.*, array_agg(l.name) FILTER (WHERE l.name IS NOT NULL) as labels
       FROM notes n
       LEFT JOIN note_labels nl ON n.id = nl.note_id
       LEFT JOIN labels l ON nl.label_id = l.id
       WHERE n.id = $1 AND n.user_id = $2
       GROUP BY n.id`,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        // Get checklist items if any
        const items = await query(
            'SELECT * FROM note_items WHERE note_id = $1 ORDER BY position',
            [id]
        );

        res.json({ ...result.rows[0], items: items.rows });
    } catch (error) {
        next(error);
    }
});

// POST /api/notes - Create note
router.post('/', validateNote, async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { title, content, type, color, is_pinned, reminder_at, items, labels } = req.body;
        const userId = req.user.id;

        const result = await query(
            `INSERT INTO notes (user_id, title, content, type, color, is_pinned, reminder_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
            [userId, title || '', content || '', type || 'note', color || 'default', is_pinned || false, reminder_at || null]
        );

        const note = result.rows[0];

        // Add checklist items
        if (items && Array.isArray(items)) {
            for (let i = 0; i < items.length; i++) {
                await query(
                    'INSERT INTO note_items (note_id, content, is_checked, position) VALUES ($1, $2, $3, $4)',
                    [note.id, items[i].content, items[i].is_checked || false, i]
                );
            }
        }

        // Add labels
        if (labels && Array.isArray(labels)) {
            for (const labelName of labels) {
                // Get or create label
                let labelResult = await query(
                    'SELECT id FROM labels WHERE user_id = $1 AND name = $2',
                    [userId, labelName]
                );
                if (labelResult.rows.length === 0) {
                    labelResult = await query(
                        'INSERT INTO labels (user_id, name) VALUES ($1, $2) RETURNING id',
                        [userId, labelName]
                    );
                }
                await query(
                    'INSERT INTO note_labels (note_id, label_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [note.id, labelResult.rows[0].id]
                );
            }
        }

        // Attach items and labels to response
        note.items = items || [];
        note.labels = labels || [];

        res.status(201).json(note);
    } catch (error) {
        next(error);
    }
});

// PATCH /api/notes/:id - Update note
router.patch('/:id', [param('id').isInt(), ...validateNote], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const userId = req.user.id;
        const { title, content, type, color, is_pinned, is_archived, reminder_at, items, labels } = req.body;

        // Build dynamic update
        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (title !== undefined) { updates.push(`title = $${paramIndex++}`); params.push(title); }
        if (content !== undefined) { updates.push(`content = $${paramIndex++}`); params.push(content); }
        if (type !== undefined) { updates.push(`type = $${paramIndex++}`); params.push(type); }
        if (color !== undefined) { updates.push(`color = $${paramIndex++}`); params.push(color); }
        if (is_pinned !== undefined) { updates.push(`is_pinned = $${paramIndex++}`); params.push(is_pinned); }
        if (is_archived !== undefined) { updates.push(`is_archived = $${paramIndex++}`); params.push(is_archived); }
        if (reminder_at !== undefined) { updates.push(`reminder_at = $${paramIndex++}`); params.push(reminder_at); }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);

        params.push(id, userId);

        // First check if note exists and is not trashed
        const existingNote = await query(
            'SELECT id, is_trashed FROM notes WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (existingNote.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        if (existingNote.rows[0].is_trashed) {
            return res.status(403).json({ error: 'Cannot update note in trash. Restore it first.' });
        }

        const result = await query(
            `UPDATE notes SET ${updates.join(', ')} 
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING *`,
            params
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        // Update checklist items if provided
        if (items && Array.isArray(items)) {
            await query('DELETE FROM note_items WHERE note_id = $1', [id]);
            for (let i = 0; i < items.length; i++) {
                await query(
                    'INSERT INTO note_items (note_id, content, is_checked, position) VALUES ($1, $2, $3, $4)',
                    [id, items[i].content, items[i].is_checked || false, i]
                );
            }
        }

        // Update labels if provided
        if (labels && Array.isArray(labels)) {
            await query('DELETE FROM note_labels WHERE note_id = $1', [id]);
            for (const labelName of labels) {
                let labelResult = await query(
                    'SELECT id FROM labels WHERE user_id = $1 AND name = $2',
                    [userId, labelName]
                );
                if (labelResult.rows.length === 0) {
                    labelResult = await query(
                        'INSERT INTO labels (user_id, name) VALUES ($1, $2) RETURNING id',
                        [userId, labelName]
                    );
                }
                await query(
                    'INSERT INTO note_labels (note_id, label_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [id, labelResult.rows[0].id]
                );
            }
        }

        const responseNote = { ...result.rows[0] };
        if (items) responseNote.items = items;
        if (labels) responseNote.labels = labels;

        res.json(responseNote);
    } catch (error) {
        next(error);
    }
});

// POST /api/notes/:id/trash - Move to trash
router.post('/:id/trash', param('id').isInt(), async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await query(
            `UPDATE notes SET is_trashed = true, trashed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2 RETURNING *`,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

// POST /api/notes/:id/restore - Restore from trash
router.post('/:id/restore', param('id').isInt(), async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await query(
            `UPDATE notes SET is_trashed = false, trashed_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2 RETURNING *`,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

// DELETE /api/notes/:id - Permanently delete note
router.delete('/:id', param('id').isInt(), async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await query(
            'DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id',
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export default router;
