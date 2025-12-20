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

// GET /api/notes - List notes (owned + shared with me)
router.get('/', async (req, res, next) => {
    try {
        const { archived, trashed, label, search } = req.query;
        const userId = req.user.id;

        // Build query for owned notes
        let sql = `
            WITH note_data AS (
                -- Owned notes
                SELECT n.*, 
                       TRUE as is_owner,
                       FALSE as share_is_archived,
                       COALESCE(
                           -- First try user_note_labels, fallback to note_labels for backward compat
                           (SELECT array_agg(DISTINCT l.name) FROM user_note_labels unl JOIN labels l ON unl.label_id = l.id WHERE unl.note_id = n.id AND unl.user_id = $1 AND l.name IS NOT NULL),
                           (SELECT array_agg(DISTINCT l.name) FROM note_labels nl JOIN labels l ON nl.label_id = l.id AND l.user_id = $1 WHERE nl.note_id = n.id AND l.name IS NOT NULL)
                       ) as labels,
                       COALESCE((
                           SELECT json_agg(json_build_object('content', ni.content, 'is_checked', ni.is_checked, 'position', ni.position) ORDER BY ni.position)
                           FROM note_items ni
                           WHERE ni.note_id = n.id
                       ), '[]'::json) as items,
                       COALESCE((
                           SELECT json_agg(json_build_object('id', img.id, 'url', img.url, 'original_name', img.original_name, 'mime_type', img.mime_type, 'size', img.size, 'created_at', img.created_at))
                           FROM note_images img
                           WHERE img.note_id = n.id
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
                           FROM note_items ni
                           WHERE ni.note_id = n.id
                       ), '[]'::json) as items,
                       COALESCE((
                           SELECT json_agg(json_build_object('id', img.id, 'url', img.url, 'original_name', img.original_name, 'mime_type', img.mime_type, 'size', img.size, 'created_at', img.created_at))
                           FROM note_images img
                           WHERE img.note_id = n.id
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
            // For archived view: show owned archived OR shared with archived state
            sql += ` AND ((nd.is_owner = true AND nd.is_archived = true AND nd.is_trashed = false) 
                     OR (nd.is_owner = false AND nd.share_is_archived = true))`;
        } else if (trashed === 'true') {
            // Only owned notes can be in trash
            sql += ` AND nd.is_owner = true AND nd.is_trashed = true`;
        } else {
            // Active notes: not archived (per ownership), not trashed
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
                   ), '[]'::json) as items,
                   COALESCE((
                       SELECT json_agg(json_build_object('id', img.id, 'url', img.url, 'original_name', img.original_name))
                       FROM note_images img
                       WHERE img.note_id = n.id
                   ), '[]'::json) as images
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

        // Get images
        const images = await query(
            'SELECT * FROM note_images WHERE note_id = $1 ORDER BY created_at',
            [id]
        );

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

        // Add checklist items
        if (items && Array.isArray(items)) {
            for (let i = 0; i < items.length; i++) {
                await query(
                    'INSERT INTO note_items (note_id, content, is_checked, position) VALUES ($1, $2, $3, $4)',
                    [note.id, items[i].content, items[i].is_checked || false, i]
                );
            }
        }

        // Add labels (per-user labels)
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
                    'INSERT INTO user_note_labels (user_id, note_id, label_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                    [userId, note.id, labelResult.rows[0].id]
                );
            }
        }

        // Add images
        if (images && Array.isArray(images)) {
            for (const img of images) {
                await query(
                    'INSERT INTO note_images (note_id, user_id, url, original_name, mime_type, size) VALUES ($1, $2, $3, $4, $5, $6)',
                    [note.id, userId, img.url, img.original_name, img.mime_type, img.size]
                );
            }
        }

        // Attach items, labels, and images to response
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
            // Update the share's is_archived state instead of the note
            await query(
                'UPDATE note_shares SET is_archived = $1 WHERE note_id = $2 AND shared_with_id = $3',
                [is_archived, id, userId]
            );
            // If only archiving, return early with success
            if (Object.keys(req.body).length === 1) {
                return res.json({ success: true, is_archived });
            }
        }

        // Build dynamic update for note fields
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

        // If no note updates needed (was just archive for shared user), skip
        if (updates.length === 0 && !items && !labels) {
            return res.json({ success: true });
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);

        params.push(id);

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
       WHERE id = $${paramIndex}
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

        // Update labels if provided (per-user labels)
        if (labels && Array.isArray(labels)) {
            // Delete existing user_note_labels for this user and note
            await query('DELETE FROM user_note_labels WHERE user_id = $1 AND note_id = $2', [userId, id]);
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
                    'INSERT INTO user_note_labels (user_id, note_id, label_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                    [userId, id, labelResult.rows[0].id]
                );
            }
        }

        // Update images if provided
        if (images && Array.isArray(images)) {
            // Delete existing images for this note
            await query('DELETE FROM note_images WHERE note_id = $1', [id]);
            for (const img of images) {
                await query(
                    'INSERT INTO note_images (note_id, user_id, url, original_name, mime_type, size) VALUES ($1, $2, $3, $4, $5, $6)',
                    [id, userId, img.url, img.original_name, img.mime_type, img.size]
                );
            }
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

// ============================================================================
// NOTE SHARING API
// ============================================================================

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
            `INSERT INTO note_shares (note_id, owner_id, shared_with_id) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (note_id, shared_with_id) DO NOTHING`,
            [id, userId, targetUserId]
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

// DELETE /api/notes/:id/share/:userId - Unshare note from a user (owner action)
// Also used by shared user to remove note from their list
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

        // If owner - can unshare anyone
        // If not owner - can only remove self
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

