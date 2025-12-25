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
    CREATE TABLE IF NOT EXISTS labels (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, name)
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_note_images_note_id ON note_images(note_id);
    CREATE INDEX IF NOT EXISTS idx_note_images_user_id ON note_images(user_id);

    -- App settings (key-value store for runtime configuration)
    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by INTEGER REFERENCES users(id)
    );

    -- Apply trigger to app_settings table
    DROP TRIGGER IF EXISTS app_settings_updated_at ON app_settings;
    CREATE TRIGGER app_settings_updated_at
      BEFORE UPDATE ON app_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    -- Automatic updated_at trigger function
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

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

  // Migrations
  await query(`
    DO $$
    BEGIN
      -- Migration: drop deprecated note_labels table
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'note_labels') THEN
        -- Migrate existing data to user_note_labels first
        INSERT INTO user_note_labels (user_id, note_id, label_id)
        SELECT l.user_id, nl.note_id, nl.label_id
        FROM note_labels nl
        JOIN labels l ON nl.label_id = l.id
        ON CONFLICT DO NOTHING;
        
        DROP TABLE note_labels;
        RAISE NOTICE 'Migrated note_labels to user_note_labels and dropped table';
      END IF;

      -- Migration: drop redundant owner_id from note_shares
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'note_shares' AND column_name = 'owner_id') THEN
        ALTER TABLE note_shares DROP COLUMN owner_id;
        RAISE NOTICE 'Dropped redundant owner_id from note_shares';
      END IF;

      -- Migration: add deleted_at column for proper soft delete
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notes' AND column_name = 'deleted_at') THEN
        ALTER TABLE notes ADD COLUMN deleted_at TIMESTAMP;
        RAISE NOTICE 'Added deleted_at column to notes';
      END IF;

      -- Migration: add updated_at index for sync API performance
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notes_updated_at') THEN
        CREATE INDEX idx_notes_updated_at ON notes(updated_at);
        RAISE NOTICE 'Added index on notes.updated_at';
      END IF;

      -- Migration: change note_images.id from UUID to SERIAL (if UUID)
      -- Note: This is non-trivial migration, skip for now if data exists
      
      -- Migration: Split name into given_name and family_name (legacy)
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'name') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'given_name') THEN
          ALTER TABLE users ADD COLUMN given_name VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'family_name') THEN
          ALTER TABLE users ADD COLUMN family_name VARCHAR(255);
        END IF;
        UPDATE users SET 
          given_name = split_part(name, ' ', 1),
          family_name = NULLIF(substring(name from length(split_part(name, ' ', 1)) + 2), '')
        WHERE name IS NOT NULL AND given_name IS NULL;
        ALTER TABLE users DROP COLUMN name;
      END IF;

      -- Migration: ensure avatar_url exists
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'avatar_url') THEN
        ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500);
      END IF;

      -- Migration: ensure type column exists on notes
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notes' AND column_name = 'type') THEN
        ALTER TABLE notes ADD COLUMN type VARCHAR(50) DEFAULT 'note';
        UPDATE notes SET type = 'checklist' WHERE id IN (SELECT DISTINCT note_id FROM note_items);
      END IF;
    END $$;
  `);

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
