import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import * as client from 'openid-client';
import { query } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { getOIDCSettingsFromDB, getAppUrl } from './settings.js';

const router = Router();

// OIDC Configuration loader - checks database first, then falls back to env vars
async function getOIDCConfig() {
    // Try database first
    let issuerUrl, clientId, clientSecret;

    try {
        const dbConfig = await getOIDCSettingsFromDB();
        issuerUrl = dbConfig.issuerUrl;
        clientId = dbConfig.clientId;
        clientSecret = dbConfig.clientSecret;
    } catch (_e) {
        console.log('[OIDC] Database config not available, using env vars');
    }

    // Fallback to env vars removed. OIDC must be configured via Admin Panel.

    if (!issuerUrl) throw new Error('OIDC not configured');

    const issuer = new URL(issuerUrl);
    const config = await client.discovery(issuer, clientId, clientSecret, undefined, {
        execute: [client.allowInsecureRequests] // Allow http for testing if needed
    });

    // Store issuer URL for later use (e.g., when saving to user record)
    config._issuerUrl = issuerUrl;

    return config;
}

// Helper to check if OIDC is configured (sync check for /config endpoint)
async function isOIDCConfigured() {
    try {
        const dbConfig = await getOIDCSettingsFromDB();
        if (dbConfig.issuerUrl) return true;
    } catch (_e) {
        // Ignore
    }
    return false;
}

// GET /api/auth/debug - Log frontend messages
router.get('/debug', (req, res) => {
    console.log('[Frontend Debug]', req.query.msg);
    res.sendStatus(200);
});

// GET /api/auth/oidc/login
router.get('/oidc/login', async (req, res, next) => {
    try {
        const oidcConfigured = await isOIDCConfigured();
        if (!oidcConfigured) {
            return res.status(503).send('OIDC not configured');
        }

        const config = await getOIDCConfig();
        const code_verifier = client.randomPKCECodeVerifier();
        const code_challenge = await client.calculatePKCECodeChallenge(code_verifier);
        const state = client.randomState();

        // Determine base URL:
        // 1. APP_URL from env or Admin Panel (best for production behind proxy)
        // 2. Request host (works for local/direct)
        const configuredAppUrl = await getAppUrl();
        const baseUrl = configuredAppUrl || `${req.protocol}://${req.get('host')}`;

        const redirect_uri = process.env.OIDC_CALLBACK_URL || `${baseUrl}/api/auth/callback`;

        console.log('[OIDC] Login started');
        console.log('[OIDC] Base URL:', baseUrl);
        console.log('[OIDC] Redirect URI:', redirect_uri);

        let parameters = {
            redirect_uri,
            scope: 'openid email profile',
            code_challenge,
            code_challenge_method: 'S256',
            state,
        };

        const redirectTo = client.buildAuthorizationUrl(config, parameters);

        // Store code_verifier and state in cookie (secure, httpOnly)
        // relax secure requirement if not on https to avoid issues behind proxies without proper headers or localhost
        const isSecure = process.env.NODE_ENV === 'production' && req.protocol === 'https';

        res.cookie('oidc_session', JSON.stringify({ code_verifier, state }), {
            httpOnly: true,
            secure: isSecure,
            maxAge: 300000 // 5 minutes
        });

        console.log('[OIDC] Set cookie oidc_session. Secure:', isSecure);
        console.log('[OIDC] Redirecting to:', redirectTo.href);

        res.redirect(redirectTo.href);
    } catch (error) {
        next(error);
    }
});

// GET /api/auth/callback
router.get('/callback', async (req, res) => {
    try {
        const oidcConfigured = await isOIDCConfigured();
        if (!oidcConfigured) {
            return res.status(503).send('OIDC not configured');
        }

        const config = await getOIDCConfig();
        const currentUrl = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);

        const sessionCookie = req.cookies?.oidc_session;
        let code_verifier, state;

        try {
            const session = sessionCookie ? JSON.parse(sessionCookie) : {};
            code_verifier = session.code_verifier;
            state = session.state;
        } catch (e) {
            console.error('[OIDC] Failed to parse cookie:', e);
        }

        console.log('[OIDC] Callback received');
        console.log('[OIDC] Current URL:', currentUrl.toString());
        console.log('[OIDC] Session found:', !!sessionCookie);
        console.log('[OIDC] State match:', !!state);

        if (!code_verifier || !state) {
            console.error('[OIDC] Missing secure session data');
            return res.status(400).send('Missing secure session verification data. Please try again.');
        }

        const tokens = await client.authorizationCodeGrant(
            config,
            currentUrl,
            {
                pkceCodeVerifier: code_verifier,
                expectedState: state,
            }
        );

        console.log('[OIDC] Tokens received');

        // Check if we got claims immediately or need to fetch userinfo
        let claims = tokens.claims();
        let email = claims.email;
        let sub = claims.sub;
        let given_name = claims.given_name;
        let family_name = claims.family_name;
        let name = claims.name;
        let picture = claims.picture;

        if (!email || (!given_name && !name)) {
            console.log('[OIDC] Fetching full UserInfo...');
            const userInfo = await client.fetchUserInfo(config, tokens.access_token, sub);
            console.log('[OIDC] User info received:', JSON.stringify(userInfo));

            email = email || userInfo.email;
            sub = sub || userInfo.sub;

            given_name = given_name || userInfo.given_name;
            family_name = family_name || userInfo.family_name;
            name = name || userInfo.name || userInfo.preferred_username;
            picture = picture || userInfo.picture;
        }

        // Fallbacks for names
        if (!given_name) {
            if (name) {
                const parts = name.split(' ');
                given_name = parts[0];
                if (parts.length > 1) {
                    family_name = parts.slice(1).join(' ');
                }
            } else {
                given_name = email.split('@')[0];
            }
        }

        if (!email) {
            return res.status(400).send('OIDC provider did not return an email address');
        }

        // 1. Try to find user by OIDC Subject (stable ID)
        // This handles cases where the user changed their email in the OIDC provider
        let result = await query('SELECT *, public_key FROM users WHERE oidc_subject = $1', [sub]);
        let user = result.rows[0];

        if (user) {
            // User exists and is already linked. Sync details.
            // We update email, names, and avatar to match the identity provider
            if (user.email !== email || user.given_name !== given_name || user.family_name !== family_name || user.avatar_url !== picture) {
                console.log(`[OIDC] Syncing user ${user.id}: Profile changed in provider`);
                await query(
                    'UPDATE users SET email = $1, given_name = $2, family_name = $3, avatar_url = $4 WHERE id = $5',
                    [email, given_name, family_name, picture || null, user.id]
                );
                // Refresh local user object
                user.email = email;
                user.given_name = given_name;
                user.family_name = family_name;
                user.avatar_url = picture;
            }
        } else {
            // 2. If not found by subject, try to find by email (First time link)
            result = await query('SELECT * FROM users WHERE email = $1', [email]);
            user = result.rows[0];

            if (user) {
                // User exists but not linked. Link now.
                console.log(`[OIDC] Linking existing user ${user.email} to OIDC subject ${sub}`);
                // Also update names if they are currently default/empty, or just always sync them?
                // Strategy: For good UX, we sync names from OIDC on link
                await query(
                    'UPDATE users SET oidc_subject = $1, oidc_issuer = $2, given_name = COALESCE($3, given_name), family_name = COALESCE($4, family_name), avatar_url = COALESCE($5, avatar_url) WHERE id = $6',
                    [sub, config._issuerUrl, given_name, family_name, picture || null, user.id]
                );
            } else {
                // 3. Create new user
                console.log(`[OIDC] Creating new user ${email}`);
                const insertResult = await query(
                    'INSERT INTO users (email, given_name, family_name, role, oidc_subject, oidc_issuer, avatar_url) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
                    [email, given_name, family_name || '', 'user', sub, config._issuerUrl, picture || null]
                );
                user = insertResult.rows[0];
            }
        }

        // Refresh user to ensure we have the absolute latest data before token generation
        if (!user.given_name && given_name) {
            const refreshed = await query('SELECT * FROM users WHERE id = $1', [user.id]);
            user = refreshed.rows[0];
        }// Generate our app's JWT
        const token = generateToken(user);

        // Clear OIDC cookie
        res.clearCookie('oidc_session');
        res.clearCookie('oidc_verifier'); // Cleanup old cookie if exists

        // Redirect to frontend with token and encryption status
        // In a SPA, we usually redirect to a page that grabs the token from query param
        const hasEncryptionKey = user.public_key ? '1' : '0';
        res.redirect(`/?token=${token}&enc=${hasEncryptionKey}`);

    } catch (error) {
        console.error('OIDC Error:', error);
        // Log cause if available
        if (error.cause) console.error('OIDC Error Cause:', error.cause);

        res.status(500).send('Authentication failed: ' + error.message);
    }
});

// Validation middleware
const validateLogin = [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
];

const validateRegister = [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('given_name').optional().trim().isLength({ max: 255 }),
    body('family_name').optional().trim().isLength({ max: 255 }),
];

// Generate JWT token (no expiration - tokens are permanent)
function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role,
            given_name: user.given_name,
            family_name: user.family_name,
            isOidc: !!user.oidc_subject
        },
        process.env.JWT_SECRET
    );
}

// GET /api/auth/config - Get public auth config
router.get('/config', async (req, res) => {
    const oidcEnabled = await isOIDCConfigured();
    res.json({
        registrationEnabled: process.env.REGISTRATION_ENABLED !== 'false',
        oidcEnabled,
    });
});

// POST /api/auth/login
router.post('/login', validateLogin, async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        const result = await query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user || !user.password_hash) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = generateToken(user);
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                given_name: user.given_name,
                family_name: user.family_name,
                name: `${user.given_name || ''} ${user.family_name || ''}`.trim() || user.email, // Computed name for frontend convenience
                role: user.role,
                isOidc: !!user.oidc_subject,
                hasEncryptionKey: !!user.public_key,
            },
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/register
router.post('/register', validateRegister, async (req, res, next) => {
    try {
        // Check if registration is enabled
        if (process.env.REGISTRATION_ENABLED === 'false') {
            return res.status(403).json({
                error: 'Registration is disabled. Please contact an administrator.'
            });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password, given_name, family_name } = req.body;

        // Check if user exists
        const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const result = await query(
            'INSERT INTO users (email, password_hash, given_name, family_name) VALUES ($1, $2, $3, $4) RETURNING id, email, given_name, family_name, role',
            [email, passwordHash, given_name || '', family_name || '']
        );

        const user = result.rows[0];
        const token = generateToken(user);

        res.status(201).json({
            token,
            user: {
                id: user.id,
                email: user.email,
                given_name: user.given_name,
                family_name: user.family_name,
                name: `${user.given_name || ''} ${user.family_name || ''}`.trim() || user.email,
                role: user.role,
                isOidc: false,
                hasEncryptionKey: false, // New user, no encryption key yet
            },
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res, next) => {
    try {
        // Fetch full user data from database to get avatar_url
        const result = await query(
            'SELECT id, email, given_name, family_name, role, avatar_url, public_key FROM users WHERE id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const dbUser = result.rows[0];
        const user = {
            ...dbUser,
            isOidc: !!req.user.isOidc,
            name: `${dbUser.given_name || ''} ${dbUser.family_name || ''}`.trim() || dbUser.email,
            hasEncryptionKey: !!dbUser.public_key,
        };
        delete user.public_key; // Don't send the actual key
        res.json({ user });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/logout (client-side token removal, but we can blacklist if needed)
router.post('/logout', authenticateToken, (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

export default router;
