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
      name VARCHAR(255),
      role VARCHAR(50) DEFAULT 'user',
      oidc_subject VARCHAR(255),
      oidc_issuer VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(500),
      content TEXT,
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
  `);

    // Create admin user if not exists
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'changeme';

    const existingAdmin = await query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (existingAdmin.rows.length === 0) {
        const passwordHash = await bcrypt.hash(adminPassword, 12);
        await query(
            'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4)',
            [adminEmail, passwordHash, 'Administrator', 'admin']
        );
        console.log(`👤 Created admin user: ${adminEmail}`);
    }

    console.log('✅ Database initialized');
}
