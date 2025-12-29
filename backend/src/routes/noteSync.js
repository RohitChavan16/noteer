import { Router } from 'express';
import { query, getPool } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/notes/sync - Delta sync for mobile clients
// Returns notes modified since a given timestamp
router.get('/', async (req, res, next) => {
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
                   COALESCE((
                       SELECT array_agg(DISTINCT l.name)
                       FROM user_note_labels unl
                       JOIN labels l ON unl.label_id = l.id
                       WHERE unl.note_id = n.id AND unl.user_id = $1
                   ), ARRAY[]::text[]) as labels,
                   COALESCE((
                       SELECT json_agg(json_build_object('content', ni.content, 'is_checked', ni.is_checked, 'position', ni.position) ORDER BY ni.position)
                       FROM note_items ni
                       WHERE ni.note_id = n.id
                   ), '[]'::json) as items,
                   COALESCE((
                       SELECT json_agg(json_build_object('id', img.id, 'url', img.url, 'original_name', img.original_name))
                       FROM note_images img
                       WHERE img.note_id = n.id
                   ), '[]'::json) as images
            FROM notes n
            WHERE n.user_id = $1
        `;
        const params = [userId];
        let paramIndex = 2;

        if (sinceDate) {
            sql += ` AND n.updated_at > $${paramIndex}`;
            params.push(sinceDate);
            paramIndex++;
        }

        sql += ` ORDER BY n.updated_at DESC`;

        const result = await query(sql, params);

        // Get deleted note IDs since timestamp
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
    const { operations } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(operations)) {
        return res.status(400).json({ error: 'operations must be an array' });
    }

    // Use transaction for batch operations to ensure data integrity
    const client = await getPool().connect();
    const results = [];

    try {
        await client.query('BEGIN');

        for (const op of operations) {
            switch (op.op) {
                case 'create': {
                    const { title, content, type, color, is_pinned, items } = op.data || {};
                    const result = await client.query(
                        `INSERT INTO notes (user_id, title, content, type, color, is_pinned)
                             VALUES ($1, $2, $3, $4, $5, $6)
                             RETURNING *`,
                        [userId, title || '', content || '', type || 'note', color || 'default', is_pinned || false]
                    );
                    const note = result.rows[0];

                    if (items && Array.isArray(items)) {
                        for (let i = 0; i < items.length; i++) {
                            await client.query(
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

                    const result = await client.query(
                        `UPDATE notes SET ${updates.join(', ')} 
                             WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
                             RETURNING *`,
                        params
                    );

                    if (result.rows.length === 0) {
                        results.push({ success: false, op: 'update', id, error: 'Note not found' });
                    } else {
                        if (items && Array.isArray(items)) {
                            await client.query('DELETE FROM note_items WHERE note_id = $1', [id]);
                            for (let i = 0; i < items.length; i++) {
                                await client.query(
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

                    const result = await client.query(
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
        }

        await client.query('COMMIT');
        res.json({ results });
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
});

export default router;
