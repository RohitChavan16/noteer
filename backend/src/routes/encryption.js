/**
 * Encryption Routes
 * 
 * API endpoints for E2E encryption key management.
 * - Public key storage/retrieval for RSA key exchange
 * - Note key storage for encrypted sharing
 */

import express from 'express';
import { query } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/encryption/status
 * Check if current user has encryption setup (has public key)
 */
router.get('/status', async (req, res) => {
    try {
        const result = await query(
            'SELECT public_key FROM users WHERE id = $1',
            [req.user.id]
        );

        res.json({
            hasPublicKey: !!result.rows[0]?.public_key
        });
    } catch (error) {
        console.error('Get encryption status error:', error);
        res.status(500).json({ error: 'Failed to get encryption status' });
    }
});

/**
 * POST /api/encryption/public-key
 * Store user's RSA public key (during mnemonic setup)
 */
router.post('/public-key', async (req, res) => {
    try {
        const { publicKey } = req.body;

        if (!publicKey) {
            return res.status(400).json({ error: 'Public key is required' });
        }

        // Store as JSON string
        const publicKeyJson = typeof publicKey === 'string'
            ? publicKey
            : JSON.stringify(publicKey);

        await query(
            'UPDATE users SET public_key = $1 WHERE id = $2',
            [publicKeyJson, req.user.id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Store public key error:', error);
        res.status(500).json({ error: 'Failed to store public key' });
    }
});

/**
 * GET /api/encryption/public-key/:userId
 * Get another user's public key (for sharing a note with them)
 */
router.get('/public-key/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await query(
            'SELECT public_key FROM users WHERE id = $1',
            [userId]
        );

        if (!result.rows[0]) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!result.rows[0].public_key) {
            return res.status(404).json({ error: 'User has no encryption key' });
        }

        // Return the public key (already JSON string)
        res.json({
            publicKey: JSON.parse(result.rows[0].public_key)
        });
    } catch (error) {
        console.error('Get public key error:', error);
        res.status(500).json({ error: 'Failed to get public key' });
    }
});

/**
 * POST /api/encryption/notes/:noteId/keys
 * Store encrypted Note Key for a recipient (when sharing a note)
 */
router.post('/notes/:noteId/keys', async (req, res) => {
    try {
        const { noteId } = req.params;
        const { recipientId, encryptedKey } = req.body;

        if (!recipientId || !encryptedKey) {
            return res.status(400).json({ error: 'recipientId and encryptedKey are required' });
        }

        // Verify user owns or has access to this note
        const noteCheck = await query(
            `SELECT n.id FROM notes n
       LEFT JOIN note_shares ns ON ns.note_id = n.id AND ns.shared_with_id = $2
       WHERE n.id = $1 AND (n.user_id = $2 OR ns.id IS NOT NULL)`,
            [noteId, req.user.id]
        );

        if (!noteCheck.rows[0]) {
            return res.status(403).json({ error: 'Not authorized to share this note' });
        }

        // Store encrypted key for recipient
        await query(
            `INSERT INTO note_keys (note_id, user_id, encrypted_key)
       VALUES ($1, $2, $3)
       ON CONFLICT (note_id, user_id) 
       DO UPDATE SET encrypted_key = $3`,
            [noteId, recipientId, encryptedKey]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Store note key error:', error);
        res.status(500).json({ error: 'Failed to store note key' });
    }
});

/**
 * GET /api/encryption/notes/:noteId/key
 * Get encrypted Note Key for current user (when accessing a shared note)
 */
router.get('/notes/:noteId/key', async (req, res) => {
    try {
        const { noteId } = req.params;

        const result = await query(
            'SELECT encrypted_key FROM note_keys WHERE note_id = $1 AND user_id = $2',
            [noteId, req.user.id]
        );

        if (!result.rows[0]) {
            return res.status(404).json({ error: 'No encryption key found for this note' });
        }

        res.json({
            encryptedKey: result.rows[0].encrypted_key
        });
    } catch (error) {
        console.error('Get note key error:', error);
        res.status(500).json({ error: 'Failed to get note key' });
    }
});

/**
 * DELETE /api/encryption/notes/:noteId/keys/:userId
 * Remove encrypted Note Key when unsharing (revocation)
 */
router.delete('/notes/:noteId/keys/:userId', async (req, res) => {
    try {
        const { noteId, userId } = req.params;

        // Verify user owns this note
        const noteCheck = await query(
            'SELECT id FROM notes WHERE id = $1 AND user_id = $2',
            [noteId, req.user.id]
        );

        if (!noteCheck.rows[0]) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await query(
            'DELETE FROM note_keys WHERE note_id = $1 AND user_id = $2',
            [noteId, userId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Delete note key error:', error);
        res.status(500).json({ error: 'Failed to delete note key' });
    }
});

export default router;
