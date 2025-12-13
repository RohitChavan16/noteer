import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import https from 'https';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import authRoutes from './routes/auth.js';
import notesRoutes from './routes/notes.js';
import usersRoutes from './routes/users.js';
import { errorHandler } from './middleware/errorHandler.js';
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
        console.log('🔑 Loaded JWT secret from file');
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
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(JWT_SECRET_FILE, newSecret, { mode: 0o600 });
    console.log('🔑 Generated and saved new JWT secret');
  } catch (_err) {
    console.warn('⚠️ Could not save JWT secret to file, using ephemeral secret');
  }

  return newSecret;
}

// Set JWT_SECRET in process.env for use by other modules
process.env.JWT_SECRET = getOrGenerateJwtSecret();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Let frontend handle CSP
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../../frontend/dist')));
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/users', usersRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// SPA fallback for production (Express 5.x syntax)
if (process.env.NODE_ENV === 'production') {
  app.get('/{*path}', (req, res) => {
    res.sendFile(join(__dirname, '../../frontend/dist/index.html'));
  });
}

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
        console.log(`🔒 Noteer backend running on https://localhost:${PORT}`);
      });
    } else {
      app.listen(PORT, () => {
        console.log(`📝 Noteer backend running on http://localhost:${PORT}`);
      });
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
