const request = require('supertest');
const app = require('../index');

describe('Auth', () => {
  test('register -> success and login -> success', async () => {
    const username = `u${Date.now()}`;
    const reg = await request(app).post('/api/register').send({ username, password: 'secret12' });
    expect(reg.statusCode).toBe(201);
    expect(reg.body).toHaveProperty('ok', true);

    const login = await request(app).post('/api/login').send({ username, password: 'secret12' });
    expect(login.statusCode).toBe(200);
    expect(login.body).toHaveProperty('ok', true);
  });

  test('register duplicate -> 400', async () => {
    const username = `dup${Date.now()}`;
    await request(app).post('/api/register').send({ username, password: 'pass1234' });
    const res = await request(app).post('/api/register').send({ username, password: 'pass1234' });
    expect(res.statusCode).toBe(400);
  });

  test('login wrong password -> 401', async () => {
    const username = `login${Date.now()}`;
    await request(app).post('/api/register').send({ username, password: 'goodpass' });
    const res = await request(app).post('/api/login').send({ username, password: 'bad' });
    expect(res.statusCode).toBe(401);
  });
});
