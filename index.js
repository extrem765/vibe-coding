// server.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const path = require('path');
// serve client files
app.use(express.static(path.join(__dirname, 'public')));

// validators
const { validateEcho, validateSum, validateRegister, validateLogin, handleValidationErrors } = require('./lib/validators');
const { hashPassword, comparePassword } = require('./lib/auth');

// small helper to catch async errors
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Server is working 🚀' });
});

app.get('/health', (req, res) => {
  res.json({ ok: true, status: 'UP', ts: new Date().toISOString() });
});

app.get('/api/hello', (req, res) => {
  const name = req.query.name || 'world';
  res.json({ message: `Hello, ${name}!` });
});

app.post('/api/echo', validateEcho, handleValidationErrors, (req, res) => {
  res.json({ received: req.body });
});

// simple in-memory user store for demo purposes
const users = [];

app.post('/api/register', validateRegister, handleValidationErrors, asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const existing = users.find(u => u.username === username);
  if (existing) {
    return res.status(400).json({ error: 'User already exists' });
  }
  const pwHash = await hashPassword(password);
  users.push({ username, passwordHash: pwHash });
  res.status(201).json({ ok: true, username });
}));

app.post('/api/login', validateLogin, handleValidationErrors, asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ ok: true, username });
}));

// Example route with validation and async handler
app.post('/api/sum', validateSum, handleValidationErrors, asyncHandler(async (req, res) => {
  const { a, b } = req.body;
  await new Promise((r) => setTimeout(r, 10));
  res.json({ result: a + b });
}));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Global error handler
app.use((err, req, res, next) => {
  const status = err.status || 500;
  console.error(err && err.stack ? err.stack : err);
  res.status(status).json({ error: err.message || 'Internal Server Error', statusCode: status });
});

// export app for tests
module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}