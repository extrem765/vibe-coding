const request = require('supertest');
const app = require('../index');

describe('API', () => {
  test('GET / returns status json', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });

  test('POST /api/sum returns sum when valid', async () => {
    const res = await request(app).post('/api/sum').send({ a: 2, b: 3 });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('result', 5);
  });

  test('POST /api/sum returns 400 when invalid', async () => {
    const res = await request(app).post('/api/sum').send({ a: 'x', b: 3 });
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('errors');
  });

  test('POST /api/echo returns 400 when body missing', async () => {
    const res = await request(app).post('/api/echo').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('errors');
  });
});
