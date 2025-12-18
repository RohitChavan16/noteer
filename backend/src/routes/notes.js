import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
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

// ============================================================================
// SYNC API - Multi-platform support (Web + Android)
// ============================================================================

// GET /api/notes/sync - Delta sync for mobile clients
// Returns notes modified since a given timestamp
router.get('/sync', async (req, res, next) => {
    try {
        const { since } = req.query;
        const userId = req.user.id;

        // Parse the since parameter (ISO8601 timestamp)
        let sinceDate = null;
        if (since) {
            sinceDate = new Date(since);
            if (isNaN(sinceDate.getTime())) {
                return res.status(400).json({ error: 'Invalid "since" parameter. Use ISO8601 format.' });
            }
        }

        // Get server time before queries for consistency
        const serverTime = new Date().toISOString();

        // Build query for modified notes
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

        if (sinceDate) {
            sql += ` AND n.updated_at > $${paramIndex}`;
            params.push(sinceDate);
            paramIndex++;
        }

        sql += ` GROUP BY n.id ORDER BY n.updated_at DESC`;

        const result = await query(sql, params);

        // Get deleted note IDs since timestamp (trashed notes that were permanently deleted)
        // For now, we use trashed_at as a proxy since we don't have deleted_at yet
        let deleted = [];
        if (sinceDate) {
            const deletedResult = await query(
                `SELECT id FROM notes 
                 WHERE user_id = $1 AND is_trashed = true AND trashed_at > $2`,
                [userId, sinceDate]
            );
            deleted = deletedResult.rows.map(r => r.id);
        }

        res.json({
            notes: result.rows,
            deleted: deleted,
            serverTime: serverTime
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/notes/batch - Batch operations for offline sync
router.post('/batch', async (req, res, next) => {
    try {
        const { operations } = req.body;
        const userId = req.user.id;

        if (!Array.isArray(operations)) {
            return res.status(400).json({ error: 'operations must be an array' });
        }

        const results = [];

        for (const op of operations) {
            try {
                switch (op.op) {
                    case 'create': {
                        const { title, content, type, color, is_pinned, items, labels } = op.data || {};
                        const result = await query(
                            `INSERT INTO notes (user_id, title, content, type, color, is_pinned)
                             VALUES ($1, $2, $3, $4, $5, $6)
                             RETURNING *`,
                            [userId, title || '', content || '', type || 'note', color || 'default', is_pinned || false]
                        );
                        const note = result.rows[0];

                        // Add items if checklist
                        if (items && Array.isArray(items)) {
                            for (let i = 0; i < items.length; i++) {
                                await query(
                                    'INSERT INTO note_items (note_id, content, is_checked, position) VALUES ($1, $2, $3, $4)',
                                    [note.id, items[i].content, items[i].is_checked || false, i]
                                );
                            }
                        }

                        results.push({ success: true, op: 'create', id: note.id, updated_at: note.updated_at });
                        break;
                    }

                    case 'update': {
                        const { id, data } = op;
                        if (!id) {
                            results.push({ success: false, op: 'update', error: 'Missing id' });
                            break;
                        }

                        const { title, content, color, is_pinned, is_archived, items } = data || {};
                        const updates = [];
                        const params = [];
                        let paramIndex = 1;

                        if (title !== undefined) { updates.push(`title = $${paramIndex++}`); params.push(title); }
                        if (content !== undefined) { updates.push(`content = $${paramIndex++}`); params.push(content); }
                        if (color !== undefined) { updates.push(`color = $${paramIndex++}`); params.push(color); }
                        if (is_pinned !== undefined) { updates.push(`is_pinned = $${paramIndex++}`); params.push(is_pinned); }
                        if (is_archived !== undefined) { updates.push(`is_archived = $${paramIndex++}`); params.push(is_archived); }

                        updates.push(`updated_at = CURRENT_TIMESTAMP`);
                        params.push(id, userId);

                        const result = await query(
                            `UPDATE notes SET ${updates.join(', ')} 
                             WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
                             RETURNING *`,
                            params
                        );

                        if (result.rows.length === 0) {
                            results.push({ success: false, op: 'update', id, error: 'Note not found' });
                        } else {
                            // Update items if provided
                            if (items && Array.isArray(items)) {
                                await query('DELETE FROM note_items WHERE note_id = $1', [id]);
                                for (let i = 0; i < items.length; i++) {
                                    await query(
                                        'INSERT INTO note_items (note_id, content, is_checked, position) VALUES ($1, $2, $3, $4)',
                                        [id, items[i].content, items[i].is_checked || false, i]
                                    );
                                }
                            }
                            results.push({ success: true, op: 'update', id, updated_at: result.rows[0].updated_at });
                        }
                        break;
                    }

                    case 'delete': {
                        const { id } = op;
                        if (!id) {
                            results.push({ success: false, op: 'delete', error: 'Missing id' });
                            break;
                        }

                        // Soft delete - move to trash
                        const result = await query(
                            `UPDATE notes SET is_trashed = true, trashed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                             WHERE id = $1 AND user_id = $2
                             RETURNING id`,
                            [id, userId]
                        );

                        if (result.rows.length === 0) {
                            results.push({ success: false, op: 'delete', id, error: 'Note not found' });
                        } else {
                            results.push({ success: true, op: 'delete', id });
                        }
                        break;
                    }

                    default:
                        results.push({ success: false, op: op.op, error: 'Unknown operation' });
                }
            } catch (opError) {
                results.push({ success: false, op: op.op, id: op.id, error: opError.message });
            }
        }

        res.json({ results });
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

        // --- VERSIONING START ---
        // Save current state as a version before updating
        const versionLimit = parseInt(process.env.NOTE_VERSION_LIMIT || '10');

        // 1. Get full current state
        const currentState = await query(
            `SELECT n.*, 
                    COALESCE((SELECT json_agg(ni ORDER BY position) FROM note_items ni WHERE ni.note_id = n.id), '[]'::json) as items,
                    COALESCE((SELECT json_agg(l.name) FROM note_labels nl JOIN labels l ON nl.label_id = l.id WHERE nl.note_id = n.id), '[]'::json) as labels
             FROM notes n
             WHERE n.id = $1`,
            [id]
        );

        if (currentState.rows.length > 0) {
            const noteData = currentState.rows[0];
            // 2. Insert into note_versions
            await query(
                'INSERT INTO note_versions (note_id, data) VALUES ($1, $2)',
                [id, JSON.stringify(noteData)]
            );

            // 3. Cleanup old versions (keep last N)
            await query(
                `DELETE FROM note_versions 
                 WHERE id IN (
                    SELECT id FROM note_versions 
                    WHERE note_id = $1 
                    ORDER BY created_at DESC 
                    OFFSET $2
                 )`,
                [id, versionLimit]
            );
        }
        // --- VERSIONING END ---

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

// GET /api/notes/:id/versions - List versions
router.get('/:id/versions', param('id').isInt(), async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Verify ownership
        const noteCheck = await query('SELECT 1 FROM notes WHERE id = $1 AND user_id = $2', [id, userId]);
        if (noteCheck.rows.length === 0) return res.status(404).json({ error: 'Note not found' });

        const result = await query(
            'SELECT id, created_at FROM note_versions WHERE note_id = $1 ORDER BY created_at DESC',
            [id]
        );

        res.json(result.rows);
    } catch (error) {
        next(error);
    }
});

// POST /api/notes/:id/versions/:versionId/restore - Restore version
router.post('/:id/versions/:versionId/restore', [param('id').isInt(), param('versionId').isInt()], async (req, res, next) => {
    try {
        const { id, versionId } = req.params;
        const userId = req.user.id;

        // Verify ownership
        const noteCheck = await query('SELECT 1 FROM notes WHERE id = $1 AND user_id = $2', [id, userId]);
        if (noteCheck.rows.length === 0) return res.status(404).json({ error: 'Note not found' });

        // Get version data
        const versionResult = await query(
            'SELECT data FROM note_versions WHERE id = $1 AND note_id = $2',
            [versionId, id]
        );

        if (versionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Version not found' });
        }

        const versionData = versionResult.rows[0].data;

        // --- SAVE CURRENT STATE FIRST (as a new version) ---
        const versionLimit = parseInt(process.env.NOTE_VERSION_LIMIT || '10');
        const currentState = await query(
            `SELECT n.*, 
                    COALESCE((SELECT json_agg(ni ORDER BY position) FROM note_items ni WHERE ni.note_id = n.id), '[]'::json) as items,
                    COALESCE((SELECT json_agg(l.name) FROM note_labels nl JOIN labels l ON nl.label_id = l.id WHERE nl.note_id = n.id), '[]'::json) as labels
             FROM notes n
             WHERE n.id = $1`,
            [id]
        );
        if (currentState.rows.length > 0) {
            await query(
                'INSERT INTO note_versions (note_id, data) VALUES ($1, $2)',
                [id, JSON.stringify(currentState.rows[0])]
            );
            await query(
                `DELETE FROM note_versions WHERE id IN (SELECT id FROM note_versions WHERE note_id = $1 ORDER BY created_at DESC OFFSET $2)`,
                [id, versionLimit]
            );
        }
        // ----------------------------------------------------

        // Restore core fields
        await query(
            `UPDATE notes SET 
                title = $1, content = $2, type = $3, color = $4, is_pinned = $5, reminder_at = $6, updated_at = CURRENT_TIMESTAMP
             WHERE id = $7`,
            [versionData.title, versionData.content, versionData.type, versionData.color, versionData.is_pinned, versionData.reminder_at, id]
        );

        // Restore items
        await query('DELETE FROM note_items WHERE note_id = $1', [id]);
        if (versionData.items && Array.isArray(versionData.items) && versionData.items.length > 0) {
            for (let i = 0; i < versionData.items.length; i++) {
                const item = versionData.items[i];
                await query(
                    'INSERT INTO note_items (note_id, content, is_checked, position) VALUES ($1, $2, $3, $4)',
                    [id, item.content, item.is_checked, item.position]
                );
            }
        }

        // Restore labels
        await query('DELETE FROM note_labels WHERE note_id = $1', [id]);
        if (versionData.labels && Array.isArray(versionData.labels) && versionData.labels.length > 0) {
            for (const labelName of versionData.labels) {
                // Ensure label exists (it might have been deleted globally, though unlikely if we don't delete labels)
                // Re-using logic from check
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


        res.json({ message: 'Restored successfully' });
    } catch (error) {
        next(error);
    }
});

export default router;

