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
import { logger } from '../utils/logger.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Helper for safe JSON parsing
const safeParse = (str) => {
    try {
        return str ? JSON.parse(str) : null;
    } catch (e) {
        logger.warn('CRYPTO', 'Failed to parse JSON for user key', e.message);
        return null;
    }
};

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
        logger.error('CRYPTO', 'Get encryption status error', error);
        res.status(500).json({ error: 'Failed to get encryption status' });
    }
});

/**
 * POST /api/encryption/keys
 * Store user's RSA keypair (public + encrypted private key)
 * This is called once during initial setup.
 */
router.post('/keys', async (req, res) => {
    try {
        const { publicKey, encryptedPrivateKey } = req.body;

        if (!publicKey || !encryptedPrivateKey) {
            return res.status(400).json({ error: 'Both public key and encrypted private key are required' });
        }

        // Enforce Strict Types: Keys must be JSON objects (JWK / Encrypted Payload)
        // We reject strings to avoid ambiguity.
        if (typeof publicKey !== 'object' || Array.isArray(publicKey)) {
            return res.status(400).json({ error: 'Public key must be a JSON object (JWK)' });
        }
        if (typeof encryptedPrivateKey !== 'object' || Array.isArray(encryptedPrivateKey)) {
            return res.status(400).json({ error: 'Encrypted private key must be a JSON object' });
        }

        const publicKeyJson = JSON.stringify(publicKey);
        const privateKeyJson = JSON.stringify(encryptedPrivateKey);

        await query(
            'UPDATE users SET public_key = $1, encrypted_private_key = $2 WHERE id = $3',
            [publicKeyJson, privateKeyJson, req.user.id]
        );

        logger.info('CRYPTO', `User ${req.user.id} stored encryption keys`);
        res.json({ success: true });
    } catch (error) {
        logger.error('CRYPTO', 'Store keys error', error);
        res.status(500).json({ error: 'Failed to store encryption keys' });
    }
});

/**
 * GET /api/encryption/keys
 * Get user's encrypted private key and public key (for restoration)
 */
router.get('/keys', async (req, res) => {
    try {
        const result = await query(
            'SELECT public_key, encrypted_private_key FROM users WHERE id = $1',
            [req.user.id]
        );

        const user = result.rows[0];

        if (!user || !user.public_key) {
            return res.status(404).json({ error: 'Encryption keys not found' });
        }

        // If private key is missing but public key exists (legacy broken state),
        // client should handle this (reset setup).

        const publicKey = safeParse(user.public_key);
        const encryptedPrivateKey = safeParse(user.encrypted_private_key);

        if (!publicKey) {
            return res.status(404).json({ error: 'Encryption keys corrupted' });
        }

        res.json({
            publicKey,
            encryptedPrivateKey
        });

    } catch (error) {
        logger.error('CRYPTO', 'Get keys error', error);
        res.status(500).json({ error: 'Failed to retrieve encryption keys' });
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

        const publicKey = safeParse(result.rows[0].public_key);

        if (!publicKey) {
            return res.status(404).json({ error: 'User public key corrupted' });
        }

        // Return the public key
        res.json({
            publicKey
        });
    } catch (error) {
        logger.error('CRYPTO', 'Get public key error', error);
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
        logger.error('CRYPTO', 'Store note key error', error);
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
        logger.error('CRYPTO', 'Get note key error', error);
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
        logger.error('CRYPTO', 'Delete note key error', error);
        res.status(500).json({ error: 'Failed to delete note key' });
    }
});

export default router;
