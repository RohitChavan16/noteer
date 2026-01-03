import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import https from 'https';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cookieParser from 'cookie-parser';
import { logger } from './utils/logger.js';

import authRoutes from './routes/auth.js';
import notesRoutes from './routes/notes.js';
import noteSyncRoutes from './routes/noteSync.js';
import noteVersionsRoutes from './routes/noteVersions.js';
import noteSharesRoutes from './routes/noteShares.js';
import usersRoutes from './routes/users.js';
import labelsRoutes from './routes/labels.js';
import uploadRoutes from './routes/upload.js';
import settingsRoutes from './routes/settings.js';
import encryptionRoutes from './routes/encryption.js';
import { errorHandler, requestId, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter, authLimiter, uploadLimiter } from './middleware/rateLimit.js';
import { initializeDatabase } from './db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Auto-generate JWT secret if not provided
const JWT_SECRET_FILE = '/var/lib/noteer/jwt-secret';

function getOrGenerateJwtSecret() {
  // If JWT_SECRET is explicitly set in env, use it
  if (process.env.JWT_SECRET && process.env.JWT_SECRET !== 'change-this-to-a-secure-random-string') {
    return process.env.JWT_SECRET;
  }

  // Try to load from file
  try {
    if (fs.existsSync(JWT_SECRET_FILE)) {
      const secret = fs.readFileSync(JWT_SECRET_FILE, 'utf8').trim();
      if (secret.length >= 32) {
        logger.info('STARTUP', 'Loaded JWT secret from file');
        return secret;
      }
    }
  } catch (_err) {
    // File doesn't exist or can't be read, generate new secret
  }

  // Generate new secret
  const newSecret = crypto.randomBytes(64).toString('hex');

  // Try to save to file for persistence
  try {
    const dir = dirname(JWT_SECRET_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
    }
    // Ensure directory is writable
    fs.accessSync(dir, fs.constants.W_OK);
    fs.accessSync(dir, fs.constants.W_OK);
    fs.writeFileSync(JWT_SECRET_FILE, newSecret, { mode: 0o600 });
    logger.info('STARTUP', 'Generated and saved new JWT secret');
  } catch (err) {
    logger.warn('STARTUP', 'Could not save JWT secret to file', err.message);
    logger.warn('STARTUP', 'Sessions will not persist across container restarts');
  }

  return newSecret;
}

// Set JWT_SECRET in process.env for use by other modules
process.env.JWT_SECRET = getOrGenerateJwtSecret();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy (required for correct protocol and IP detection behind reverse proxies)
// TRUST_PROXY env var: number (hops) or string (e.g., 'loopback, linklocal, 10.0.0.0/8')
const trustProxyEnv = process.env.TRUST_PROXY;
let trustProxyConfig;
if (!trustProxyEnv) {
  trustProxyConfig = 1; // Default: trust first proxy hop
} else if (!isNaN(trustProxyEnv)) {
  trustProxyConfig = parseInt(trustProxyEnv, 10);
} else {
  trustProxyConfig = trustProxyEnv; // String (CIDR, loopback, etc.)
}
app.set('trust proxy', trustProxyConfig);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Let frontend handle CSP
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Request ID for correlation
app.use(requestId);

// Debug logging middleware - ALWAYS log in this debugging session
app.use((req, res, next) => {
  logger.info('API', `${req.method} ${req.url}`, { requestId: req.requestId });
  next();
});

// API Routes with rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/notes/sync', apiLimiter, noteSyncRoutes);    // Sync API - must be before :id routes
app.use('/api/notes', apiLimiter, noteVersionsRoutes);      // Versions API
app.use('/api/notes', apiLimiter, noteSharesRoutes);        // Shares API
app.use('/api/notes', apiLimiter, notesRoutes);             // Main CRUD
app.use('/api/users', apiLimiter, usersRoutes);
app.use('/api/labels', apiLimiter, labelsRoutes);
app.use('/api/upload', uploadLimiter, uploadRoutes);
app.use('/api/admin/settings', apiLimiter, settingsRoutes);
app.use('/api/encryption', apiLimiter, encryptionRoutes);

// Public config for frontend (runtime, not build-time)
app.get('/api/config', (req, res) => {
  res.json({
    logLevel: (process.env.LOG_LEVEL || 'warn').toUpperCase(),
  });
});

// Health check (no rate limit)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler for undefined API routes
app.use('/api', notFoundHandler);

// Serve uploads from persistent storage
const UPLOADS_PATH = process.env.UPLOADS_PATH || '/var/lib/noteer/uploads';
app.use('/uploads', express.static(UPLOADS_PATH));

// Serve static frontend in production - AFTER API routes
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../../frontend/dist')));

  // SPA fallback
  app.get(/(.*)/, (req, res) => {
    res.sendFile(join(__dirname, '../../frontend/dist/index.html'));
  });
}

// Error handler
app.use(errorHandler);

// Start server
async function start() {
  try {
    await initializeDatabase();

    if (process.env.SSL_ENABLED === 'true' && process.env.SSL_CERT_PATH && process.env.SSL_KEY_PATH) {
      const httpsOptions = {
        cert: fs.readFileSync(process.env.SSL_CERT_PATH),
        key: fs.readFileSync(process.env.SSL_KEY_PATH),
      };
      https.createServer(httpsOptions, app).listen(PORT, () => {
        logger.info('SERVER', `Noteer backend running on https://localhost:${PORT}`);
      });
    } else {
      app.listen(PORT, () => {
        logger.info('SERVER', `Noteer backend running on http://localhost:${PORT}`);
      });
    }
  } catch (error) {
    logger.fatal('SERVER', 'Failed to start server', error);
    process.exit(1);
  }
}

start();
