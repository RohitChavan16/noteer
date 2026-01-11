import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import notesRouter from './notes.js';
import { setMockQueryHandler } from '../db/index.js';

// Required for JWT verification in auth middleware during tests
process.env.JWT_SECRET = 'test-secret';

const token = jwt.sign(
  { id: 1, role: 'user' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

const app = express();
app.use(express.json());
app.use('/api/notes', notesRouter);

// Mock Data
const mockNote = {
  id: 1,
  user_id: 1,
  title: 'Test Note',
  content: 'Content',
  type: 'note',
  is_trashed: false,
  is_archived: false,
  is_pinned: false,
  is_owner: true,
  labels: [],
  items: [],
  images: [],
  collaborators: []
};

// Setup Mock Query Handler
before(() => {
  setMockQueryHandler(async (text, params) => {
    const sql = text.trim().toUpperCase();
    
    // GET / (List)
    if (sql.includes('FROM NOTE_DATA ND')) {
        return { rows: [mockNote] };
    }
    
    // GET /:id
    if (sql.includes('SELECT N.*, ARRAY_AGG(L.NAME)')) {
        return { rows: [mockNote] };
    }
    
    // Subqueries for items/images in GET /:id
    if (sql.includes('FROM NOTE_ITEMS WHERE NOTE_ID')) {
        return { rows: [] };
    }
    if (sql.includes('FROM NOTE_IMAGES WHERE NOTE_ID')) {
        return { rows: [] };
    }

    // POST / (Create)
    if (sql.startsWith('INSERT INTO NOTES')) {
        return { rows: [{ ...mockNote, id: 2, title: params[1], content: params[2] }] };
    }
    // Bulk inserts (helper functions)
    if (sql.includes('UNNEST')) {
        return { rows: [] };
    }

    // PATCH /:id (Update)
    // Check ownership
    if (sql.includes('CASE WHEN N.USER_ID')) {
        return { rows: [{ ...mockNote, is_owner: true, is_trashed: false }] };
    }
    // Update query
    if (sql.startsWith('UPDATE NOTES SET')) {
         // Return updated mock
         return { rows: [{ ...mockNote, title: 'Updated' }] };
    }
    // Re-fetch after update (if needed)
    if (sql.startsWith('SELECT * FROM NOTES WHERE ID')) {
        return { rows: [mockNote] };
    }
    // Update note_shares
    if (sql.startsWith('UPDATE NOTE_SHARES SET')) {
        return { rowCount: 1 };
    }

    // DELETE /:id
    if (sql.startsWith('DELETE FROM NOTES')) {
        return { rows: [{ id: 1 }] };
    }

    // Helper: saveNoteVersion
    if (sql.startsWith('INSERT INTO NOTE_VERSIONS')) {
        return { rows: [] };
    }
    
    // Fallback for subqueries or others
    return { rows: [] };
  });
});

after(() => {
  setMockQueryHandler(null);
});

describe('Notes Routes – Auth Enforcement', () => {

  it('GET /api/notes → requires authentication', async () => {
    const res = await request(app).get('/api/notes');
    assert.strictEqual(res.statusCode, 401);
  });

  it('POST /api/notes → requires authentication', async () => {
    const res = await request(app)
      .post('/api/notes')
      .send({ title: 'Test note' });

    assert.strictEqual(res.statusCode, 401);
  });

  it('PATCH /api/notes/:id → requires authentication', async () => {
    const res = await request(app)
      .patch('/api/notes/1')
      .send({ title: 'Updated' });

    assert.strictEqual(res.statusCode, 401);
  });

  it('DELETE /api/notes/:id → requires authentication', async () => {
    const res = await request(app).delete('/api/notes/1');
    assert.strictEqual(res.statusCode, 401);
  });
});

// VALIDATION TESTS
describe('Notes Routes – Validation', () => {

  it('POST /api/notes → returns 400 for oversized content', async () => {
    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'x'.repeat(70000) });

    assert.strictEqual(res.statusCode, 400);
    assert.ok(Array.isArray(res.body.errors));
  });
});


describe('Notes Routes – Success Path', () => {

  it('GET /api/notes → returns notes list (200)', async () => {
    const res = await request(app)
      .get('/api/notes')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.statusCode, 200, `Expected 200 OK, got ${res.statusCode}`);
    assert.ok(Array.isArray(res.body));
    assert.strictEqual(res.body.length, 1);
  });

  it('GET /api/notes/:id → returns single note (200)', async () => {
    const res = await request(app)
        .get('/api/notes/1')
        .set('Authorization', `Bearer ${token}`);
    
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.id, 1);
  });

  it('POST /api/notes → creates a note (201)', async () => {
    const res = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'New Note', content: 'New Content' });
    
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.title, 'New Note');
  });

  it('PATCH /api/notes/:id → updates a note (200)', async () => {
    const res = await request(app)
        .patch('/api/notes/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated' });
    
    assert.strictEqual(res.statusCode, 200);
  });

  it('DELETE /api/notes/:id → deletes a note (204)', async () => {
    const res = await request(app)
        .delete('/api/notes/1')
        .set('Authorization', `Bearer ${token}`);
    
    assert.strictEqual(res.statusCode, 204);
  });
});
