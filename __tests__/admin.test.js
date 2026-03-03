const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const { validateAdmin, handleValidationErrors } = require('../lib/validators');

describe('validateAdmin middleware', () => {
  let app;
  beforeAll(() => {
    app = express();
    app.use(bodyParser.json());
    app.post('/admin', validateAdmin, handleValidationErrors, (req, res) => {
      res.status(200).json({ ok: true });
    });
  });

  test('rejects when role is missing', async () => {
    const res = await request(app).post('/admin').send({});
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].msg).toMatch(/role required/);
  });

  test('rejects when role is not admin', async () => {
    const res = await request(app).post('/admin').send({ role: 'user' });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].msg).toMatch(/admin role required/);
  });

  test('accepts when role is admin', async () => {
    const res = await request(app).post('/admin').send({ role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('validates optional adminCode when present', async () => {
    const res = await request(app).post('/admin').send({ role: 'admin', adminCode: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].msg).toMatch(/adminCode must be at least 6 characters/);

    const res2 = await request(app).post('/admin').send({ role: 'admin', adminCode: 'long-enough' });
    expect(res2.status).toBe(200);
  });
});
