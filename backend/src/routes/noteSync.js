import { Router } from 'express';
import { query, getPool } from '../db/index.js';
import { setNoteLabelIds, setNoteLabels } from '../db/helpers.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/notes/sync - Delta sync for mobile clients
// Returns notes modified since a given timestamp
// GET /api/notes/sync - Delta sync for mobile clients
// Returns notes modified since a given timestamp
// Now includes BOTH owned notes and notes shared with the user
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

        // 1. Definition of subqueries for arrays (labels, items, images)
        // Note: These must use 'note_table_alias.id' to reference the outer query
        const subqueries = {
            labels: `(
                SELECT array_agg(DISTINCT l.id)
                FROM user_note_labels unl
                JOIN labels l ON unl.label_id = l.id
                WHERE unl.note_id = n.id AND unl.user_id = $1
            )`,
            items: `COALESCE((
                SELECT json_agg(json_build_object('content', ni.content, 'is_checked', ni.is_checked, 'position', ni.position) ORDER BY ni.position)
                FROM note_items ni
                WHERE ni.note_id = n.id
            ), '[]'::json)`,
            images: `COALESCE((
                SELECT json_agg(json_build_object('id', img.id, 'url', img.url, 'original_name', img.original_name))
                FROM note_images img
                WHERE img.note_id = n.id
            ), '[]'::json)`,
            collaborators: `COALESCE((
                SELECT json_agg(json_build_object(
                    'id', u.id, 
                    'name', COALESCE(u.given_name || ' ' || u.family_name, u.email), 
                    'email', u.email, 
                    'avatar_url', u.avatar_url,
                    'is_owner', (u.id = n.user_id)
                ))
                FROM note_shares ns
                JOIN users u ON ns.shared_with_id = u.id
                WHERE ns.note_id = n.id
            ), '[]'::json)`
        };

        // 2. Build the UNION query
        // We select "effective" columns for is_pinned/is_archived to simplify frontend logic
        // For shared notes, we use the values from note_shares (ns)
        let sql = `
            WITH combined_notes AS (
                -- A. Owned Notes
                SELECT 
                    n.id, n.user_id, n.title, n.content, n.type, n.color, 
                    n.version, n.updated_at, n.created_at, n.trashed_at, n.deleted_at, n.reminder_at,
                    n.is_trashed,
                    n.is_pinned as original_pinned,
                    n.is_archived as original_archived,
                    n.encrypted, n.encrypted_note_key, n.encryption_version,
                    
                    TRUE as is_owner,
                    n.is_pinned as is_pinned,       -- Owner uses note's is_pinned
                    n.is_archived as is_archived,   -- Owner uses note's is_archived
                    NULL::text as shared_note_key,
                    
                    ${subqueries.labels} as labels,
                    ${subqueries.items} as items,
                    ${subqueries.images} as images,
                    ${subqueries.collaborators} as collaborators
                FROM notes n
                WHERE n.user_id = $1 AND n.deleted_at IS NULL

                UNION ALL

                -- B. Shared Notes
                SELECT 
                    n.id, n.user_id, n.title, n.content, n.type, n.color, 
                    n.version, n.updated_at, n.created_at, n.trashed_at, n.deleted_at, n.reminder_at,
                    n.is_trashed,
                    n.is_pinned as original_pinned,
                    n.is_archived as original_archived,
                    n.encrypted, n.encrypted_note_key, n.encryption_version,
                    
                    FALSE as is_owner,
                    ns.is_pinned as is_pinned,      -- Shared user uses share's is_pinned
                    ns.is_archived as is_archived,  -- Shared user uses share's is_archived
                    nk.encrypted_key as shared_note_key,
                    
                    ${subqueries.labels} as labels,
                    ${subqueries.items} as items,
                    ${subqueries.images} as images,
                    ${subqueries.collaborators} as collaborators
                FROM notes n
                JOIN note_shares ns ON ns.note_id = n.id AND ns.shared_with_id = $1
                LEFT JOIN note_keys nk ON nk.note_id = n.id AND nk.user_id = $1
                WHERE n.deleted_at IS NULL
            )
            SELECT * FROM combined_notes
        `;

        const params = [userId];

        // Filter by 'since' if provided
        if (sinceDate) {
            sql += ` WHERE updated_at > $2`;
            params.push(sinceDate);
        }

        sql += ` ORDER BY updated_at DESC`;

        const result = await query(sql, params);
        console.log(`[SYNC DEBUG] User ${userId} sync since ${sinceDate}: Found ${result.rows.length} notes`);

        // Get deleted note IDs since timestamp
        // Must check both owned notes AND shares that were removed
        let deleted = [];
        if (sinceDate) {
            // 1. Trashed/Deleted owned notes (and confirmed deleted)
            const deletedOwned = await query(
                `SELECT id FROM notes 
                 WHERE user_id = $1 AND deleted_at IS NOT NULL AND updated_at > $2`,
                [userId, sinceDate]
            );

            // 2. Removed shares (logic: if I previously had it but now don't, treat as deleted)
            // This is harder in "delta" logic without a robust "tombstone" table for shares.
            // For now, we rely on the client realizing a note is missing if they do a full sync, 
            // OR we assume 'deleted' list includes soft-deleted items.
            // A truly robust system needs a 'share_tombstones' table.

            // Current compromise: Return IDs of notes that are explicitly trashed/deleted.
            // Note: If a user is un-shared from a note, they won't see it in the list updates,
            // but we don't strictly send a "delete" command for it yet. 
            // (Client-side garbage collection for stale shares is a future task).

            deleted = deletedOwned.rows.map(r => r.id);
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
                    const { title, content, type, color, is_pinned, items, labels, label_ids, encrypted, encrypted_note_key } = op.data || {};
                    const result = await client.query(
                        `INSERT INTO notes (user_id, title, content, type, color, is_pinned, encrypted, encrypted_note_key)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                             RETURNING *`,
                        [userId, title || '', content || '', type || 'note', color || 'default', is_pinned || false, encrypted || false, encrypted_note_key || null]
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

                    // Handle labels
                    if (label_ids && Array.isArray(label_ids)) {
                        await setNoteLabelIds(userId, note.id, label_ids, client);
                    } else if (labels && Array.isArray(labels)) {
                        for (const labelName of labels) {
                            // Get or create label
                            let labelResult = await client.query(
                                'SELECT id FROM labels WHERE user_id = $1 AND name = $2',
                                [userId, labelName]
                            );
                            let labelId;
                            if (labelResult.rows.length === 0) {
                                const insertLabel = await client.query(
                                    'INSERT INTO labels (user_id, name) VALUES ($1, $2) RETURNING id',
                                    [userId, labelName]
                                );
                                labelId = insertLabel.rows[0].id;
                            } else {
                                labelId = labelResult.rows[0].id;
                            }
                            // Link label to note
                            await client.query(
                                'INSERT INTO user_note_labels (user_id, note_id, label_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                                [userId, note.id, labelId]
                            );
                        }
                    }

                    results.push({ success: true, op: 'create', id: note.id, updated_at: note.updated_at });
                    break;
                }

                case 'update': {
                    const { id, data, version } = op; // Expect version from client
                    if (!id) {
                        results.push({ success: false, op: 'update', error: 'Missing id' });
                        break;
                    }

                    const { title, content, color, is_pinned, is_archived, is_trashed, items, labels, label_ids } = data || {};
                    const updates = [];
                    const params = [];
                    let paramIndex = 1;

                    if (title !== undefined) { updates.push(`title = $${paramIndex++}`); params.push(title); }
                    if (content !== undefined) { updates.push(`content = $${paramIndex++}`); params.push(content); }
                    if (color !== undefined) { updates.push(`color = $${paramIndex++}`); params.push(color); }
                    if (is_pinned !== undefined) { updates.push(`is_pinned = $${paramIndex++}`); params.push(is_pinned); }
                    if (is_archived !== undefined) { updates.push(`is_archived = $${paramIndex++}`); params.push(is_archived); }
                    if (is_trashed !== undefined) { updates.push(`is_trashed = $${paramIndex++}`); params.push(is_trashed); }

                    // Increment version explicitly
                    updates.push(`version = version + 1`);
                    updates.push(`updated_at = CURRENT_TIMESTAMP`);

                    params.push(id, userId);

                    // If client provided a version, use it for OCC check
                    let whereClause = `WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}`;
                    if (version !== undefined) {
                        whereClause += ` AND version = $${paramIndex++}`;
                        params.push(version);
                    }

                    const result = await client.query(
                        `UPDATE notes SET ${updates.join(', ')} 
                             ${whereClause}
                             RETURNING *`,
                        params
                    );

                    if (result.rows.length === 0) {
                        // Check if it was a version conflict or just not found
                        const exists = await client.query('SELECT version FROM notes WHERE id = $1 AND user_id = $2', [id, userId]);

                        if (exists.rows.length > 0) {
                            // Note exists but version didn't match -> Conflict!
                            const currentVersion = exists.rows[0].version;
                            results.push({
                                success: false,
                                op: 'update',
                                id,
                                error: 'Conflict',
                                status: 409,
                                serverVersion: currentVersion
                            });
                        } else {
                            results.push({ success: false, op: 'update', id, error: 'Note not found' });
                        }
                    } else {
                        const updatedNote = result.rows[0];

                        if (items && Array.isArray(items)) {
                            await client.query('DELETE FROM note_items WHERE note_id = $1', [id]);
                            for (let i = 0; i < items.length; i++) {
                                await client.query(
                                    'INSERT INTO note_items (note_id, content, is_checked, position) VALUES ($1, $2, $3, $4)',
                                    [id, items[i].content, items[i].is_checked || false, i]
                                );
                            }
                        }

                        if (label_ids && Array.isArray(label_ids)) {
                            await setNoteLabelIds(userId, id, label_ids, client);
                        } else if (labels && Array.isArray(labels)) {
                            // Legacy support for names (optional, can be removed if strictly E2E)
                            await setNoteLabels(userId, id, labels, client);
                        }

                        results.push({
                            success: true,
                            op: 'update',
                            id,
                            updated_at: updatedNote.updated_at,
                            version: updatedNote.version
                        });
                    }
                    break;
                }

                case 'delete': {
                    const { id } = op;
                    if (!id) {
                        results.push({ success: false, op: 'delete', error: 'Missing id' });
                        break;
                    }

                    // FIXED: Set deleted_at timestamp for permanent deletion tombstone
                    const result = await client.query(
                        `UPDATE notes SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
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
