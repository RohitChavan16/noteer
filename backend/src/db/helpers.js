/**
 * Database Query Helpers
 * 
 * Optimized bulk operations to reduce N+1 query patterns.
 */

import { query } from './index.js';

/**
 * Bulk insert checklist items for a note
 * Uses PostgreSQL UNNEST for single-query insert
 * @param {number} noteId 
 * @param {Array<{content: string, is_checked: boolean}>} items 
 */
export async function bulkInsertItems(noteId, items) {
    if (!items || items.length === 0) return;

    const contents = items.map(i => i.content);
    const checks = items.map(i => i.is_checked || false);
    const positions = items.map((_, i) => i);

    await query(
        `INSERT INTO note_items (note_id, content, is_checked, position)
         SELECT $1, unnest($2::text[]), unnest($3::boolean[]), unnest($4::int[])`,
        [noteId, contents, checks, positions]
    );
}

/**
 * Bulk insert images for a note
 * @param {number} noteId 
 * @param {number} userId 
 * @param {Array<{url: string, original_name: string, mime_type: string, size: number}>} images 
 */
export async function bulkInsertImages(noteId, userId, images) {
    if (!images || images.length === 0) return;

    const urls = images.map(i => i.url);
    const names = images.map(i => i.original_name || null);
    const mimes = images.map(i => i.mime_type || null);
    const sizes = images.map(i => i.size || null);

    await query(
        `INSERT INTO note_images (note_id, user_id, url, original_name, mime_type, size)
         SELECT $1, $2, unnest($3::text[]), unnest($4::text[]), unnest($5::text[]), unnest($6::bigint[])`,
        [noteId, userId, urls, names, mimes, sizes]
    );
}

/**
 * Set labels for a note (deletes existing, inserts new)
 * Creates missing labels automatically using INSERT ON CONFLICT
 * @param {number} userId 
 * @param {number} noteId 
 * @param {string[]} labelNames 
 */
export async function setNoteLabels(userId, noteId, labelNames) {
    if (!labelNames || labelNames.length === 0) {
        await query('DELETE FROM user_note_labels WHERE user_id = $1 AND note_id = $2', [userId, noteId]);
        return;
    }

    // Ensure all labels exist (single query with upsert)
    await query(
        `INSERT INTO labels (user_id, name)
         SELECT $1, unnest($2::text[])
         ON CONFLICT (user_id, name) DO NOTHING`,
        [userId, labelNames]
    );

    // Get all label IDs
    const labelResult = await query(
        `SELECT id, name FROM labels WHERE user_id = $1 AND name = ANY($2)`,
        [userId, labelNames]
    );

    const labelIds = labelResult.rows.map(r => r.id);

    // Delete existing and insert new (2 queries total instead of 2N+1)
    await query('DELETE FROM user_note_labels WHERE user_id = $1 AND note_id = $2', [userId, noteId]);

    if (labelIds.length > 0) {
        await query(
            `INSERT INTO user_note_labels (user_id, note_id, label_id)
             SELECT $1, $2, unnest($3::int[])
             ON CONFLICT DO NOTHING`,
            [userId, noteId, labelIds]
        );
    }
}
