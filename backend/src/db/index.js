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
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255),
      given_name VARCHAR(255),
      family_name VARCHAR(255),
      role VARCHAR(50) DEFAULT 'user',
      oidc_subject VARCHAR(255),
      oidc_issuer VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_oidc_subject ON users(oidc_subject);

    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(500),
      content TEXT,
      type VARCHAR(50) DEFAULT 'note',
      color VARCHAR(50) DEFAULT 'default',
      is_pinned BOOLEAN DEFAULT FALSE,
      is_archived BOOLEAN DEFAULT FALSE,
      is_trashed BOOLEAN DEFAULT FALSE,
      trashed_at TIMESTAMP,
      reminder_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS note_items (
      id SERIAL PRIMARY KEY,
      note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      is_checked BOOLEAN DEFAULT FALSE,
      position INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS labels (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, name)
    );

    CREATE TABLE IF NOT EXISTS note_labels (
      note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
      label_id INTEGER REFERENCES labels(id) ON DELETE CASCADE,
      PRIMARY KEY (note_id, label_id)
    );

    CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
    CREATE INDEX IF NOT EXISTS idx_notes_archived ON notes(is_archived);
    CREATE INDEX IF NOT EXISTS idx_notes_trashed ON notes(is_trashed);
    CREATE INDEX IF NOT EXISTS idx_note_items_note_id ON note_items(note_id);

    CREATE TABLE IF NOT EXISTS note_versions (
      id SERIAL PRIMARY KEY,
      note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_note_versions_note_id ON note_versions(note_id);

    CREATE TABLE IF NOT EXISTS note_shares (
      id SERIAL PRIMARY KEY,
      note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shared_with_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_archived BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(note_id, shared_with_id)
    );
    CREATE INDEX IF NOT EXISTS idx_note_shares_note_id ON note_shares(note_id);
    CREATE INDEX IF NOT EXISTS idx_note_shares_shared_with ON note_shares(shared_with_id);

    -- Per-user note labels: allows each user to have their own labels on any note they can access
    CREATE TABLE IF NOT EXISTS user_note_labels (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, note_id, label_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_note_labels_user_note ON user_note_labels(user_id, note_id);

    CREATE TABLE IF NOT EXISTS note_images (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      original_name TEXT,
      mime_type TEXT,
      size BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_note_images_note_id ON note_images(note_id);
    CREATE INDEX IF NOT EXISTS idx_note_images_user_id ON note_images(user_id);
  `);

  // Migration: Split name into given_name and family_name
  await query(`
      DO $$
      BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'name'
        ) THEN
            -- Add new columns if they don't exist
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'given_name') THEN
                ALTER TABLE users ADD COLUMN given_name VARCHAR(255);
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'family_name') THEN
                ALTER TABLE users ADD COLUMN family_name VARCHAR(255);
            END IF;

            -- Migrate data (simple split by first space)
            UPDATE users 
            SET 
                given_name = split_part(name, ' ', 1),
                family_name = NULLIF(substring(name from length(split_part(name, ' ', 1)) + 2), '')
            WHERE name IS NOT NULL AND given_name IS NULL;

            -- Drop old column
            ALTER TABLE users DROP COLUMN name;
        END IF;

        -- Ensure type column exists (previous migration)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'notes' AND column_name = 'type'
        ) THEN
          ALTER TABLE notes ADD COLUMN type VARCHAR(50) DEFAULT 'note';
          UPDATE notes SET type = 'checklist'
          WHERE id IN (SELECT DISTINCT note_id FROM note_items);
        END IF;

        -- Add avatar_url column for OIDC profile pictures
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'avatar_url'
        ) THEN
          ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500);
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
