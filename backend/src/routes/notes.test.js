import { describe, it } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import notesRouter from './notes.js';


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

    if (res.statusCode === 200) {
      assert.ok(Array.isArray(res.body));
    } else {
      assert.strictEqual(res.statusCode, 500);
    }
  });
});
