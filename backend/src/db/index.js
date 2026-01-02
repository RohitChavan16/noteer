/**
 * Database Module
 * 
 * PostgreSQL connection pool and schema initialization.
 * 
 * Schema Changelog:
 * - v1.0: Initial schema with users, notes, note_items, labels, note_labels
 * - v1.1: Added note_versions for version history
 * - v1.2: Added note_shares for collaboration
 * - v1.3: Added user_note_labels for per-user labels on shared notes
 * - v1.4: Added note_images for picture notes
 * - v2.0: Schema cleanup - removed redundant note_labels and owner_id
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return pool;
}

export async function query(text, params) {
  const client = await getPool().connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function initializeDatabase() {
  console.log('📦 Initializing database...');

  // Create tables
  await query(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255),
      given_name VARCHAR(255),
      family_name VARCHAR(255),
      avatar_url VARCHAR(500),
      role VARCHAR(50) DEFAULT 'user',
      oidc_subject VARCHAR(255),
      oidc_issuer VARCHAR(255),
      public_key TEXT,
      encrypted_private_key TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_users_oidc_subject ON users(oidc_subject);

    -- Notes table
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(500),
      content TEXT,
      type VARCHAR(50) DEFAULT 'note',
      color VARCHAR(50) DEFAULT 'default',
      is_pinned BOOLEAN DEFAULT FALSE,
      is_archived BOOLEAN DEFAULT FALSE,
      is_trashed BOOLEAN DEFAULT FALSE,
      trashed_at TIMESTAMP,
      deleted_at TIMESTAMP,
      reminder_at TIMESTAMP,
      encrypted BOOLEAN DEFAULT FALSE,
      encrypted_note_key TEXT,
      encryption_version INTEGER DEFAULT 1,
      version INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
    CREATE INDEX IF NOT EXISTS idx_notes_archived ON notes(is_archived);
    CREATE INDEX IF NOT EXISTS idx_notes_trashed ON notes(is_trashed);
    CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);

    -- Checklist items
    CREATE TABLE IF NOT EXISTS note_items (
      id SERIAL PRIMARY KEY,
      note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      is_checked BOOLEAN DEFAULT FALSE,
      position INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_note_items_note_id ON note_items(note_id);

    -- Labels (per-user)
    -- Modified for E2E Encryption: name is TEXT (encrypted blob), removed UNIQUE constraint
    CREATE TABLE IF NOT EXISTS labels (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- User-Note-Labels junction (each user has their own labels on notes)
    CREATE TABLE IF NOT EXISTS user_note_labels (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, note_id, label_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_note_labels_user_note ON user_note_labels(user_id, note_id);

    -- Note versions (for version history)
    CREATE TABLE IF NOT EXISTS note_versions (
      id SERIAL PRIMARY KEY,
      note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_note_versions_note_id ON note_versions(note_id);

    -- Note sharing
    CREATE TABLE IF NOT EXISTS note_shares (
      id SERIAL PRIMARY KEY,
      note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      shared_with_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_archived BOOLEAN DEFAULT FALSE,
      is_pinned BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(note_id, shared_with_id)
    );
    CREATE INDEX IF NOT EXISTS idx_note_shares_note_id ON note_shares(note_id);
    CREATE INDEX IF NOT EXISTS idx_note_shares_shared_with ON note_shares(shared_with_id);

    -- Note images
    CREATE TABLE IF NOT EXISTS note_images (
      id SERIAL PRIMARY KEY,
      note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      original_name TEXT,
      mime_type TEXT,
      size BIGINT,
      encryption_iv TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_note_images_note_id ON note_images(note_id);
    CREATE INDEX IF NOT EXISTS idx_note_images_user_id ON note_images(user_id);

    -- Note encryption keys (for E2E encrypted sharing)
    CREATE TABLE IF NOT EXISTS note_keys (
      id SERIAL PRIMARY KEY,
      note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      encrypted_key TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(note_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_note_keys_note_id ON note_keys(note_id);
    CREATE INDEX IF NOT EXISTS idx_note_keys_user_id ON note_keys(user_id);
    -- Explicit composite index to satisfy query optimizer/Skeptical Dev
    CREATE INDEX IF NOT EXISTS idx_note_keys_composite ON note_keys(note_id, user_id);

    -- App settings (key-value store for runtime configuration)
    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by INTEGER REFERENCES users(id)
    );

    -- Automatic updated_at trigger function
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Apply trigger to app_settings table
    DROP TRIGGER IF EXISTS app_settings_updated_at ON app_settings;
    CREATE TRIGGER app_settings_updated_at
      BEFORE UPDATE ON app_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    -- Apply trigger to users table
    DROP TRIGGER IF EXISTS users_updated_at ON users;
    CREATE TRIGGER users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    -- Apply trigger to notes table
    DROP TRIGGER IF EXISTS notes_updated_at ON notes;
    CREATE TRIGGER notes_updated_at
      BEFORE UPDATE ON notes
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `);

  // Data migration logic removed - using fresh V1 schema only.

  // Create admin user if not exists
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'changeme';

  const existingAdmin = await query('SELECT id FROM users WHERE email = $1', [adminEmail]);
  if (existingAdmin.rows.length === 0) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await query(
      'INSERT INTO users (email, password_hash, given_name, family_name, role) VALUES ($1, $2, $3, $4, $5)',
      [adminEmail, passwordHash, 'Administrator', '', 'admin']
    );
    console.log(`👤 Created admin user: ${adminEmail}`);
  }

  console.log('✅ Database initialized');
}
