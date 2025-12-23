import { Router } from 'express';
import { param } from 'express-validator';
import { query } from '../db/index.js';
import { bulkInsertItems, setNoteLabels } from '../db/helpers.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

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
        const versionLimit = parseInt(process.env.NOTE_VERSION_LIMIT || '10');
        const currentState = await query(
            `SELECT n.*, 
                    COALESCE((SELECT json_agg(ni ORDER BY position) FROM note_items ni WHERE ni.note_id = n.id), '[]'::json) as items,
                    COALESCE((SELECT json_agg(l.name) FROM user_note_labels unl JOIN labels l ON unl.label_id = l.id WHERE unl.note_id = n.id AND unl.user_id = $2), '[]'::json) as labels
             FROM notes n
             WHERE n.id = $1`,
            [id, userId]
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

        res.json({ message: 'Restored successfully' });
    } catch (error) {
        next(error);
    }
});

export default router;
