import { Router } from 'express';
import { param } from 'express-validator';
import { query } from '../db/index.js';
import { bulkInsertItems, bulkInsertImages, setNoteLabels, cleanupOrphanImages } from '../db/helpers.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// POST /api/notes/versions/sync - Batch fetch versions
router.post('/versions/sync', async (req, res, next) => {
    try {
        const { noteIds } = req.body;
        const userId = req.user.id;

        if (!Array.isArray(noteIds) || noteIds.length === 0) {
            return res.json([]);
        }

        // Limit batch size to prevent query overload (e.g., 50 notes max)
        const BATCH_LIMIT = 50;
        const idsToFetch = noteIds.slice(0, BATCH_LIMIT);

        // Fetch versions for requested notes
        // Enforce ownership/access via JOIN with notes/shares
        const result = await query(
            `SELECT nv.note_id, nv.id, nv.created_at, nv.data
             FROM note_versions nv
             JOIN notes n ON n.id = nv.note_id
             LEFT JOIN note_shares ns ON ns.note_id = n.id AND ns.shared_with_id = $2
             WHERE nv.note_id = ANY($1) 
             AND (n.user_id = $2 OR ns.shared_with_id = $2)
             ORDER BY nv.created_at DESC`,
            [idsToFetch, userId]
        );

        res.json(result.rows);
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

        // Save current state first (as a new version)
        const MAX_VERSIONS = 10;
        const currentState = await query(
            `SELECT n.*, 
                    COALESCE((SELECT json_agg(ni ORDER BY position) FROM note_items ni WHERE ni.note_id = n.id), '[]'::json) as items,
                    COALESCE((SELECT json_agg(l.name) FROM user_note_labels unl JOIN labels l ON unl.label_id = l.id WHERE unl.note_id = n.id AND unl.user_id = $2), '[]'::json) as labels,
                    COALESCE((SELECT json_agg(img) FROM note_images img WHERE img.note_id = n.id), '[]'::json) as images
             FROM notes n
             WHERE n.id = $1`,
            [id, userId]
        );
        if (currentState.rows.length > 0) {
            await query(
                'INSERT INTO note_versions (note_id, data) VALUES ($1, $2)',
                [id, JSON.stringify(currentState.rows[0])]
            );

            // Get versions that will be deleted (for image cleanup)
            const versionsToDelete = await query(
                `SELECT data FROM note_versions WHERE id IN (SELECT id FROM note_versions WHERE note_id = $1 ORDER BY created_at DESC OFFSET $2)`,
                [id, MAX_VERSIONS]
            );

            // Delete old versions
            await query(
                `DELETE FROM note_versions WHERE id IN (SELECT id FROM note_versions WHERE note_id = $1 ORDER BY created_at DESC OFFSET $2)`,
                [id, MAX_VERSIONS]
            );

            // Cleanup orphan images from deleted versions
            if (versionsToDelete.rows.length > 0) {
                const deletedData = versionsToDelete.rows.map(r => r.data);
                await cleanupOrphanImages(id, deletedData);
            }
        }

        // Restore core fields
        await query(
            `UPDATE notes SET 
                title = $1, content = $2, type = $3, color = $4, is_pinned = $5, reminder_at = $6, updated_at = CURRENT_TIMESTAMP
             WHERE id = $7`,
            [versionData.title, versionData.content, versionData.type, versionData.color, versionData.is_pinned, versionData.reminder_at, id]
        );

        // Restore items (bulk)
        await query('DELETE FROM note_items WHERE note_id = $1', [id]);
        await bulkInsertItems(id, versionData.items);

        // Restore labels (bulk)
        await setNoteLabels(userId, id, versionData.labels);

        // Restore images (bulk) - if version has images data
        if (versionData.images && Array.isArray(versionData.images)) {
            await query('DELETE FROM note_images WHERE note_id = $1', [id]);
            await bulkInsertImages(id, userId, versionData.images);
        }

        res.json({ message: 'Restored successfully' });
    } catch (error) {
        next(error);
    }
});

export default router;
