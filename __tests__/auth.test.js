const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../index');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(async () => {
  // clear users collection if exists
  const { collections } = mongoose.connection;
  if (collections && collections.users) await collections.users.deleteMany({});
});

describe('Auth (with in-memory Mongo)', () => {
  test('register then login succeeds', async () => {
    const u = { username: 'bob', password: 'secret123' };
    const r1 = await request(app).post('/api/register').send(u);
    expect(r1.statusCode).toBe(201);
    expect(r1.body).toHaveProperty('ok', true);

    const r2 = await request(app).post('/api/login').send(u);
    expect(r2.statusCode).toBe(200);
    expect(r2.body).toHaveProperty('ok', true);
  });

  test('register duplicate returns 400', async () => {
    const u = { username: 'alice', password: 'pass1234' };
    await request(app).post('/api/register').send(u);
    const r = await request(app).post('/api/register').send(u);
    expect(r.statusCode).toBe(400);
  });

  test('login with wrong password fails', async () => {
    const u = { username: 'k', password: '123456' };
    await request(app).post('/api/register').send({ username: 'k', password: 'abcdef' });
    const r = await request(app).post('/api/login').send(u);
    expect(r.statusCode).toBe(401);
  });
});
