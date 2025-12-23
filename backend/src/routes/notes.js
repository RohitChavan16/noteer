/**
 * Notes CRUD Routes
 * 
 * Handles basic note operations: list, get, create, update, delete, trash, restore.
 * 
 * Separated modules:
 * - noteSync.js: Sync API for mobile clients (/sync, /batch)
 * - noteVersions.js: Version history (:id/versions)
 * - noteShares.js: Sharing functionality (:id/share, :id/shares)
 */

import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { query } from '../db/index.js';
import { bulkInsertItems, bulkInsertImages, setNoteLabels } from '../db/helpers.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Validation middleware
const validateNote = [
    body('title').optional().trim().isLength({ max: 500 }),
    body('content').optional().trim().isLength({ max: 60000 }).withMessage('Note content too long (max 60000 chars)'),
    body('items').optional().isArray({ max: 200 }).withMessage('Too many checklist items (max 200)'),
    body('type').optional().isIn(['note', 'checklist', 'picture']),
    body('color').optional().isIn(['default', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'brown', 'gray']),
    body('is_pinned').optional().isBoolean(),
    body('reminder_at').optional().isISO8601(),
];

// GET /api/notes - List notes (owned + shared with me)
router.get('/', async (req, res, next) => {
    try {
        const { archived, trashed, label, search } = req.query;
        const userId = req.user.id;

        let sql = `
            WITH note_data AS (
                -- Owned notes
                SELECT n.*, 
                       TRUE as is_owner,
                       FALSE as share_is_archived,
                       (SELECT array_agg(DISTINCT l.name) FROM user_note_labels unl JOIN labels l ON unl.label_id = l.id WHERE unl.note_id = n.id AND unl.user_id = $1 AND l.name IS NOT NULL) as labels,
                       COALESCE((
                           SELECT json_agg(json_build_object('content', ni.content, 'is_checked', ni.is_checked, 'position', ni.position) ORDER BY ni.position)
                           FROM note_items ni WHERE ni.note_id = n.id
                       ), '[]'::json) as items,
                       COALESCE((
                           SELECT json_agg(json_build_object('id', img.id, 'url', img.url, 'original_name', img.original_name, 'mime_type', img.mime_type, 'size', img.size, 'created_at', img.created_at))
                           FROM note_images img WHERE img.note_id = n.id
                       ), '[]'::json) as images,
                       (SELECT COUNT(*) > 0 FROM note_shares ns WHERE ns.note_id = n.id) as is_shared,
                       (SELECT json_agg(json_build_object(
                           'id', u.id, 'email', u.email, 'given_name', u.given_name, 
                           'family_name', u.family_name, 'avatar_url', u.avatar_url
                       )) FROM note_shares ns JOIN users u ON ns.shared_with_id = u.id WHERE ns.note_id = n.id) as collaborators,
                       NULL::json as owner
                FROM notes n
                WHERE n.user_id = $1

                UNION ALL

                -- Shared with me notes
                SELECT n.*, 
                       FALSE as is_owner,
                       ns.is_archived as share_is_archived,
                       (SELECT array_agg(DISTINCT l.name) FROM user_note_labels unl JOIN labels l ON unl.label_id = l.id WHERE unl.note_id = n.id AND unl.user_id = $1 AND l.name IS NOT NULL) as labels,
                       COALESCE((
                           SELECT json_agg(json_build_object('content', ni.content, 'is_checked', ni.is_checked, 'position', ni.position) ORDER BY ni.position)
                           FROM note_items ni WHERE ni.note_id = n.id
                       ), '[]'::json) as items,
                       COALESCE((
                           SELECT json_agg(json_build_object('id', img.id, 'url', img.url, 'original_name', img.original_name, 'mime_type', img.mime_type, 'size', img.size, 'created_at', img.created_at))
                           FROM note_images img WHERE img.note_id = n.id
                       ), '[]'::json) as images,
                       FALSE as is_shared,
                       NULL::json as collaborators,
                       json_build_object(
                           'id', owner_user.id, 'email', owner_user.email, 
                           'given_name', owner_user.given_name, 'family_name', owner_user.family_name,
                           'avatar_url', owner_user.avatar_url
                       ) as owner
                FROM notes n
                JOIN note_shares ns ON ns.note_id = n.id AND ns.shared_with_id = $1
                JOIN users owner_user ON n.user_id = owner_user.id
                WHERE n.is_trashed = false
            )
            SELECT * FROM note_data nd
            WHERE 1=1
        `;

        const params = [userId];
        let paramIndex = 2;

        if (archived === 'true') {
            sql += ` AND ((nd.is_owner = true AND nd.is_archived = true AND nd.is_trashed = false) 
                     OR (nd.is_owner = false AND nd.share_is_archived = true))`;
        } else if (trashed === 'true') {
            sql += ` AND nd.is_owner = true AND nd.is_trashed = true`;
        } else {
            sql += ` AND ((nd.is_owner = true AND nd.is_archived = false AND nd.is_trashed = false)
                     OR (nd.is_owner = false AND nd.share_is_archived = false))`;
        }

        if (search) {
            sql += ` AND (nd.title ILIKE $${paramIndex} OR nd.content ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (label) {
            sql += ` AND $${paramIndex} = ANY(nd.labels)`;
            params.push(label);
            paramIndex++;
        }

        sql += ` ORDER BY nd.is_pinned DESC, nd.updated_at DESC`;

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
             WHERE n.id = $1 AND n.user_id = $2
             GROUP BY n.id`,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        const items = await query('SELECT * FROM note_items WHERE note_id = $1 ORDER BY position', [id]);
        const images = await query('SELECT * FROM note_images WHERE note_id = $1 ORDER BY created_at', [id]);

        res.json({ ...result.rows[0], items: items.rows, images: images.rows });
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

        const { title, content, type, color, is_pinned, reminder_at, items, labels, images } = req.body;
        const userId = req.user.id;

        const result = await query(
            `INSERT INTO notes (user_id, title, content, type, color, is_pinned, reminder_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [userId, title || '', content || '', type || 'note', color || 'default', is_pinned || false, reminder_at || null]
        );

        const note = result.rows[0];

        // Bulk insert related data (single query each instead of N+1)
        await bulkInsertItems(note.id, items);
        await setNoteLabels(userId, note.id, labels);
        await bulkInsertImages(note.id, userId, images);

        note.items = items || [];
        note.labels = labels || [];
        note.images = images || [];

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
        const { title, content, type, color, is_pinned, is_archived, reminder_at, items, labels, images } = req.body;

        // Check if user owns the note or has shared access
        const noteCheck = await query(
            `SELECT n.id, n.user_id, n.is_trashed,
                    CASE WHEN n.user_id = $2 THEN true ELSE false END as is_owner,
                    ns.id as share_id
             FROM notes n
             LEFT JOIN note_shares ns ON ns.note_id = n.id AND ns.shared_with_id = $2
             WHERE n.id = $1 AND (n.user_id = $2 OR ns.id IS NOT NULL)`,
            [id, userId]
        );

        if (noteCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        const noteInfo = noteCheck.rows[0];
        const isOwner = noteInfo.is_owner;

        if (noteInfo.is_trashed) {
            return res.status(403).json({ error: 'Cannot update note in trash. Restore it first.' });
        }

        // Handle is_archived separately for shared users
        if (is_archived !== undefined && !isOwner) {
            await query('UPDATE note_shares SET is_archived = $1 WHERE note_id = $2 AND shared_with_id = $3', [is_archived, id, userId]);
            if (Object.keys(req.body).length === 1) {
                return res.json({ success: true, is_archived });
            }
        }

        // Build dynamic update
        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (title !== undefined) { updates.push(`title = $${paramIndex++}`); params.push(title); }
        if (content !== undefined) { updates.push(`content = $${paramIndex++}`); params.push(content); }
        if (type !== undefined) { updates.push(`type = $${paramIndex++}`); params.push(type); }
        if (color !== undefined) { updates.push(`color = $${paramIndex++}`); params.push(color); }
        if (is_pinned !== undefined && isOwner) { updates.push(`is_pinned = $${paramIndex++}`); params.push(is_pinned); }
        if (is_archived !== undefined && isOwner) { updates.push(`is_archived = $${paramIndex++}`); params.push(is_archived); }
        if (reminder_at !== undefined) { updates.push(`reminder_at = $${paramIndex++}`); params.push(reminder_at); }

        if (updates.length === 0 && !items && !labels) {
            return res.json({ success: true });
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(id);

        // Save version before updating
        const versionLimit = parseInt(process.env.NOTE_VERSION_LIMIT || '10');
        const currentState = await query(
            `SELECT n.*, 
                    COALESCE((SELECT json_agg(ni ORDER BY position) FROM note_items ni WHERE ni.note_id = n.id), '[]'::json) as items,
                    COALESCE((SELECT json_agg(l.name) FROM user_note_labels unl JOIN labels l ON unl.label_id = l.id WHERE unl.note_id = n.id AND unl.user_id = $2), '[]'::json) as labels
             FROM notes n WHERE n.id = $1`,
            [id]
        );

        if (currentState.rows.length > 0) {
            await query('INSERT INTO note_versions (note_id, data) VALUES ($1, $2)', [id, JSON.stringify(currentState.rows[0])]);
            await query(
                `DELETE FROM note_versions WHERE id IN (SELECT id FROM note_versions WHERE note_id = $1 ORDER BY created_at DESC OFFSET $2)`,
                [id, versionLimit]
            );
        }

        const result = await query(`UPDATE notes SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        // Update items (bulk)
        if (items && Array.isArray(items)) {
            await query('DELETE FROM note_items WHERE note_id = $1', [id]);
            await bulkInsertItems(id, items);
        }

        // Update labels (bulk)
        if (labels && Array.isArray(labels)) {
            await setNoteLabels(userId, id, labels);
        }

        // Update images (bulk)
        if (images && Array.isArray(images)) {
            await query('DELETE FROM note_images WHERE note_id = $1', [id]);
            await bulkInsertImages(id, userId, images);
        }

        const responseNote = { ...result.rows[0] };
        if (items) responseNote.items = items;
        if (labels) responseNote.labels = labels;
        if (images) responseNote.images = images;

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

        const result = await query('DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export default router;
