/**
 * Admin Settings Routes
 * 
 * Handles application settings management (OIDC configuration, etc.)
 * All routes require admin role.
 */

import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import * as client from 'openid-client';
import { query } from '../db/index.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// Helper: Get settings from database
async function getSettingsFromDB(keys) {
    const result = await query(
        `SELECT key, value FROM app_settings WHERE key = ANY($1)`,
        [keys]
    );
    const settings = {};
    for (const row of result.rows) {
        settings[row.key] = row.value || '';
    }
    return settings;
}

// Helper: Save setting to database
async function saveSetting(key, value, userId) {
    await query(
        `INSERT INTO app_settings (key, value, updated_by, updated_at) 
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = CURRENT_TIMESTAMP`,
        [key, value, userId]
    );
}

// GET /api/admin/settings - Get current settings
router.get('/', async (req, res, next) => {
    try {
        const oidcSettings = await getSettingsFromDB([
            'oidc_issuer_url',
            'oidc_client_id',
            'oidc_client_secret'
        ]);

        res.json({
            oidc: {
                issuerUrl: oidcSettings.oidc_issuer_url || '',
                clientId: oidcSettings.oidc_client_id || '',
                // Never return the actual secret, just indicate if it exists
                hasSecret: !!(oidcSettings.oidc_client_secret)
            }
        });
    } catch (error) {
        next(error);
    }
});

// PUT /api/admin/settings - Update settings
const validateSettings = [
    body('oidc.issuerUrl').optional().isString().trim(),
    body('oidc.clientId').optional().isString().trim(),
    body('oidc.clientSecret').optional().isString(),
];

router.put('/', validateSettings, async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { oidc } = req.body;
        const userId = req.user.id;

        if (oidc) {
            if (oidc.issuerUrl !== undefined) {
                await saveSetting('oidc_issuer_url', oidc.issuerUrl, userId);
            }
            if (oidc.clientId !== undefined) {
                await saveSetting('oidc_client_id', oidc.clientId, userId);
            }
            // Only update secret if a non-empty value is provided
            if (oidc.clientSecret && oidc.clientSecret.length > 0) {
                await saveSetting('oidc_client_secret', oidc.clientSecret, userId);
            }
        }

        // Clear OIDC config cache
        clearOIDCConfigCache();

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// POST /api/admin/settings/test-oidc - Test OIDC connection
router.post('/test-oidc', async (req, res, _next) => {
    try {
        const oidcSettings = await getSettingsFromDB([
            'oidc_issuer_url',
            'oidc_client_id',
            'oidc_client_secret'
        ]);

        const issuerUrl = oidcSettings.oidc_issuer_url;
        const clientId = oidcSettings.oidc_client_id;
        const clientSecret = oidcSettings.oidc_client_secret;

        if (!issuerUrl) {
            return res.status(400).json({
                success: false,
                error: 'OIDC Issuer URL is not configured'
            });
        }

        if (!clientId) {
            return res.status(400).json({
                success: false,
                error: 'OIDC Client ID is not configured'
            });
        }

        // Try to discover the OIDC configuration
        const issuer = new URL(issuerUrl);
        const config = await client.discovery(issuer, clientId, clientSecret, undefined, {
            execute: [client.allowInsecureRequests],
        });

        res.json({
            success: true,
            issuer: config.serverMetadata().issuer,
            authorizationEndpoint: config.serverMetadata().authorization_endpoint,
            tokenEndpoint: config.serverMetadata().token_endpoint,
        });
    } catch (error) {
        console.error('OIDC test failed:', error);
        res.status(400).json({
            success: false,
            error: error.message || 'Failed to connect to OIDC provider'
        });
    }
});

// Cache for OIDC config
let oidcConfigCache = null;
let oidcConfigCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function clearOIDCConfigCache() {
    oidcConfigCache = null;
    oidcConfigCacheTime = 0;
}

// Export function to get OIDC config from DB (used by auth.js)
export async function getOIDCSettingsFromDB() {
    // Check cache
    if (oidcConfigCache && (Date.now() - oidcConfigCacheTime) < CACHE_TTL) {
        return oidcConfigCache;
    }

    const settings = await getSettingsFromDB([
        'oidc_issuer_url',
        'oidc_client_id',
        'oidc_client_secret'
    ]);

    oidcConfigCache = {
        issuerUrl: settings.oidc_issuer_url || '',
        clientId: settings.oidc_client_id || '',
        clientSecret: settings.oidc_client_secret || ''
    };
    oidcConfigCacheTime = Date.now();

    return oidcConfigCache;
}

export default router;
