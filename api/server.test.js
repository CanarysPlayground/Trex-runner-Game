/**
 * Unit tests for the T-Rex Runner high-score API.
 *
 * Test suites:
 *   1. Happy Path           — normal score updates and reads
 *   2. Edge Cases & Boundary Conditions — zero, negative, NaN, large values
 *
 * Run: cd api && npx jest server.test.js --verbose
 */

const request = require('supertest');
const { app, reset } = require('./server');

beforeEach(() => {
  reset();
});

// ── Happy Path ───────────────────────────────────────────────
describe('Happy Path', () => {
  it('GET /score returns { highScore: 0 } on startup', async () => {
    const res = await request(app).get('/score');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ highScore: 0 });
  });

  it('POST /score/100 sets highScore to 100', async () => {
    const res = await request(app).post('/score/100');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ highScore: 100 });
  });

  it('POST /score/50 does NOT lower highScore below 100', async () => {
    await request(app).post('/score/100');
    const res = await request(app).post('/score/50');
    expect(res.body).toEqual({ highScore: 100 });
  });

  it('GET /score after POST returns the updated value', async () => {
    await request(app).post('/score/250');
    const res = await request(app).get('/score');
    expect(res.body).toEqual({ highScore: 250 });
  });
});

// ── Edge Cases & Boundary Conditions ────────────────────────
describe('Edge Cases & Boundary Conditions', () => {
  it('POST /score/0 does not update highScore (0 is not > 0)', async () => {
    const res = await request(app).post('/score/0');
    expect(res.body).toEqual({ highScore: 0 });
  });

  it('POST /score/-1 does not update highScore (negative value)', async () => {
    const res = await request(app).post('/score/-1');
    expect(res.body.highScore).toBe(0);
  });

  it('POST /score/abc handles non-numeric value gracefully (no crash)', async () => {
    const res = await request(app).post('/score/abc');
    expect(res.status).toBeLessThan(500);
    expect(res.body).toHaveProperty('highScore');
  });

  it('POST /score/99999999 sets highScore to a very large number', async () => {
    const res = await request(app).post('/score/99999999');
    expect(res.body).toEqual({ highScore: 99999999 });
  });

  it('Two rapid POSTs: /score/200 then /score/150 — highScore stays 200', async () => {
    await request(app).post('/score/200');
    const res = await request(app).post('/score/150');
    expect(res.body).toEqual({ highScore: 200 });
  });
});
