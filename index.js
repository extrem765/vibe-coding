// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const { connectDB } = require('./lib/db');

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// validators
const { validateEcho, validateSum, validateRegister, validateLogin, handleValidationErrors } = require('./lib/validators');
const { hashPassword, comparePassword, registerUser, loginUser, clearUsers } = require('./lib/auth');

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

app.post('/api/register', validateRegister, handleValidationErrors, asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await registerUser(username, password);
    res.status(201).json({ ok: true, username: user.username });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

app.post('/api/login', validateLogin, handleValidationErrors, asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const user = await loginUser(username, password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ ok: true, username: user.username });
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

// serve client files (placed after API routes so API endpoints take precedence)
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// Global error handler
app.use((err, req, res, next) => {
  const status = err.status || 500;
  console.log(err && err.stack ? err.stack : err);
  res.status(status).json({ error: err.message || 'Internal Server Error', statusCode: status });
});

// export app for tests
module.exports = app;

if (require.main === module) {
  (async () => {
    try {
      if (MONGO_URI) {
        await connectDB(MONGO_URI);
        console.log('Connected to MongoDB');
      } else {
        console.log('MONGO_URI not set; skipping MongoDB connection');
      }
    } catch (err) {
      console.error('Failed to connect to MongoDB:', err.message || err);
    }

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })();
}