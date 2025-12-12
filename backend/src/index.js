import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import https from 'https';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import authRoutes from './routes/auth.js';
import notesRoutes from './routes/notes.js';
import usersRoutes from './routes/users.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initializeDatabase } from './db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
