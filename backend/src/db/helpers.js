/**
 * Database Query Helpers
 * 
 * Optimized bulk operations to reduce N+1 query patterns.
 */

import { query } from './index.js';
import { logger } from '../utils/logger.js';

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
 * @param {object} [dbClient] - Optional database client for transactions
 */
export async function bulkInsertImages(noteId, userId, images, dbClient = null) {
    if (!images || images.length === 0) return;

    const executeQuery = (text, params) => dbClient ? dbClient.query(text, params) : query(text, params);

    const urls = images.map(i => i.url);
    const names = images.map(i => i.original_name || null);
    const mimes = images.map(i => i.mime_type || null);
    const sizes = images.map(i => i.size || null);
    const ivs = images.map(i => i.encryption_iv || null);

    await executeQuery(
        `INSERT INTO note_images (note_id, user_id, url, original_name, mime_type, size, encryption_iv)
         SELECT $1, $2, unnest($3::text[]), unnest($4::text[]), unnest($5::text[]), unnest($6::bigint[]), unnest($7::text[])`,
        [noteId, userId, urls, names, mimes, sizes, ivs]
    );
}

/**
 * Set labels for a note (deletes existing, inserts new)
 * Creates missing labels automatically using INSERT ON CONFLICT
 * @param {number} userId 
 * @param {number} noteId 
 * @param {string[]} labelNames 
 * @param {object} [dbClient] - Optional database client for transactions
 */
export async function setNoteLabels(userId, noteId, labelNames, dbClient = null) {
    const executeQuery = (text, params) => dbClient ? dbClient.query(text, params) : query(text, params);

    if (!labelNames || labelNames.length === 0) {
        await executeQuery('DELETE FROM user_note_labels WHERE user_id = $1 AND note_id = $2', [userId, noteId]);
        return;
    }

    // Ensure all labels exist (single query with upsert)
    await executeQuery(
        `INSERT INTO labels (user_id, name)
         SELECT $1, unnest($2::text[])
         ON CONFLICT (user_id, name) DO NOTHING`,
        [userId, labelNames]
    );

    // Get all label IDs
    const labelResult = await executeQuery(
        `SELECT id, name FROM labels WHERE user_id = $1 AND name = ANY($2)`,
        [userId, labelNames]
    );

    const labelIds = labelResult.rows.map(r => r.id);

    // Delete existing and insert new (2 queries total instead of 2N+1)
    await executeQuery('DELETE FROM user_note_labels WHERE user_id = $1 AND note_id = $2', [userId, noteId]);

    if (labelIds.length > 0) {
        await executeQuery(
            `INSERT INTO user_note_labels (user_id, note_id, label_id)
             SELECT $1, $2, unnest($3::int[])
             ON CONFLICT DO NOTHING`,
            [userId, noteId, labelIds]
        );
    }
}

/**
 * Set labels for a note using IDs directly (E2E Encrypted flow)
 * @param {number} userId 
 * @param {number} noteId 
 * @param {number[]} labelIds 
 * @param {object} [dbClient] - Optional database client for transactions
 */
export async function setNoteLabelIds(userId, noteId, labelIds, dbClient = null) {
    const executeQuery = (text, params) => dbClient ? dbClient.query(text, params) : query(text, params);

    // Delete existing links
    await executeQuery('DELETE FROM user_note_labels WHERE user_id = $1 AND note_id = $2', [userId, noteId]);

    if (!labelIds || labelIds.length === 0) {
        return;
    }

    // Verify ownership of all labels before inserting
    const validLabels = await executeQuery(
        'SELECT id FROM labels WHERE user_id = $1 AND id = ANY($2)',
        [userId, labelIds]
    );
    const validIds = validLabels.rows.map(r => r.id);

    if (validIds.length > 0) {
        await executeQuery(
            `INSERT INTO user_note_labels (user_id, note_id, label_id)
             SELECT $1, $2, unnest($3::int[])
             ON CONFLICT DO NOTHING`,
            [userId, noteId, validIds]
        );
    }
}

/**
 * Cleanup orphan images after version rotation
 * Deletes image files that are no longer referenced by current note or remaining versions
 * @param {number} noteId 
 * @param {Array} deletedVersionsData - Array of version data objects that were deleted
 */
export async function cleanupOrphanImages(noteId, deletedVersionsData) {
    if (!deletedVersionsData || deletedVersionsData.length === 0) return;

    const fs = await import('fs');
    const path = await import('path');
    const UPLOADS_BASE = process.env.UPLOADS_PATH || '/var/lib/noteer/uploads';

    // Collect all image URLs from deleted versions
    const deletedImageUrls = new Set();
    for (const versionData of deletedVersionsData) {
        if (versionData.images && Array.isArray(versionData.images)) {
            for (const img of versionData.images) {
                if (img.url) deletedImageUrls.add(img.url);
                if (img.thumb_small && img.thumb_small !== img.url) deletedImageUrls.add(img.thumb_small);
                if (img.thumb_medium && img.thumb_medium !== img.url) deletedImageUrls.add(img.thumb_medium);
            }
        }
    }

    if (deletedImageUrls.size === 0) return;

    // Get all image URLs still in use (current note + remaining versions)
    const currentImages = await query('SELECT url FROM note_images WHERE note_id = $1', [noteId]);
    const currentUrls = new Set(currentImages.rows.map(r => r.url));

    const remainingVersions = await query('SELECT data FROM note_versions WHERE note_id = $1', [noteId]);
    for (const row of remainingVersions.rows) {
        const data = row.data;
        if (data.images && Array.isArray(data.images)) {
            for (const img of data.images) {
                if (img.url) currentUrls.add(img.url);
            }
        }
    }

    // Delete orphan files
    for (const url of deletedImageUrls) {
        if (!currentUrls.has(url)) {
            // URL format: /uploads/users/123/filename.webp
            const relativePath = url.replace(/^\/uploads\//, '');
            const filePath = path.join(UPLOADS_BASE, relativePath);
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }


            } catch (err) {
                logger.error('DB', `Failed to delete orphan image: ${filePath}`, err);
            }
        }
    }
}

/**
 * Save current state of note as a new version
 * Handles version limits and orphan image cleanup
 * @param {number} noteId 
 * @param {number} userId 
 * @param {object} [dbClient] - Optional database client for transactions
 */
export async function saveNoteVersion(noteId, userId, dbClient = null) {
    const executeQuery = (text, params) => dbClient ? dbClient.query(text, params) : query(text, params);
    const versionLimit = parseInt(process.env.NOTE_VERSION_LIMIT || '10');

    // 1. Fetch complete current state
    const currentState = await executeQuery(
        `SELECT n.*, 
                COALESCE((SELECT json_agg(ni ORDER BY position) FROM note_items ni WHERE ni.note_id = n.id), '[]'::json) as items,
                COALESCE((SELECT json_agg(l.name) FROM user_note_labels unl JOIN labels l ON unl.label_id = l.id WHERE unl.note_id = n.id AND unl.user_id = $2), '[]'::json) as labels,
                COALESCE((SELECT json_agg(img) FROM note_images img WHERE img.note_id = n.id), '[]'::json) as images
         FROM notes n WHERE n.id = $1`,
        [noteId, userId]
    );

    if (currentState.rows.length === 0) return;

    // 2. Insert new version
    await executeQuery(
        'INSERT INTO note_versions (note_id, data) VALUES ($1, $2)',
        [noteId, JSON.stringify(currentState.rows[0])]
    );

    // 3. Get versions above limit (to be deleted)
    const versionsToDelete = await executeQuery(
        `SELECT data FROM note_versions WHERE id IN (SELECT id FROM note_versions WHERE note_id = $1 ORDER BY created_at DESC OFFSET $2)`,
        [noteId, versionLimit]
    );

    if (versionsToDelete.rows.length > 0) {
        // 4. Delete old versions
        await executeQuery(
            `DELETE FROM note_versions WHERE id IN (SELECT id FROM note_versions WHERE note_id = $1 ORDER BY created_at DESC OFFSET $2)`,
            [noteId, versionLimit]
        );

        // 5. Cleanup orphan images
        // Note: cleanupOrphanImages creates its own internal queries/imports, usually safe to run outside transaction
        // or we need to pass dbClient if we refactor it.
        // Current implementation of cleanupOrphanImages uses 'query' directly from import.
        // Ideally we should update cleanupOrphanImages to accept dbClient too, but for image deletion (fs) it doesn't matter much.
        // However, it reads 'note_images' and 'note_versions'. If we are in a transaction that modified these, 
        // using global 'query' might not see uncommitted changes if isolation level is Read Committed.
        // BUT versions are inserted/deleted in this transaction.

        // For safety, let's just await it. If it misses something due to transaction isolation, it just leaves a file for next time.
        // The critical part is DB consistency.

        try {
            const deletedData = versionsToDelete.rows.map(r => r.data);
            await cleanupOrphanImages(noteId, deletedData);
        } catch (e) {
            logger.warn('DB', 'Orphan image cleanup failed (non-critical)', e);
        }
    }
}
