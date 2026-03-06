const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const users = new Map();
const refreshTokenStore = new Set(); // зберігає валідні refresh токени
const SALT_ROUNDS = 12;

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'access_secret_change_me';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'refresh_secret_change_me';
const ACCESS_TOKEN_EXPIRES = '15m';
const REFRESH_TOKEN_EXPIRES = '7d';

// ─── Логування ───────────────────────────────────────────────────────────────

const LOG_FILE = path.join(__dirname, 'errors.log');

function logError(context, error) {
  const entry = {
    timestamp: new Date().toISOString(),
    context,
    message: error.message || String(error),
    stack: error.stack || null,
  };
  const line = JSON.stringify(entry) + '\n';
  // Записуємо у файл асинхронно (не блокуємо сервер)
  fs.appendFile(LOG_FILE, line, (err) => {
    if (err) console.error('Failed to write log:', err);
  });
  console.error(`[ERROR] [${context}]`, error.message);
}

// ─── Mongoose модель ──────────────────────────────────────────────────────────

function getModel() {
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      return require('../models/user');
    }
  } catch (e) {
    logError('getModel', e);
    return null;
  }
  return null;
}

// ─── Паролі ───────────────────────────────────────────────────────────────────

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// ─── JWT токени ───────────────────────────────────────────────────────────────

/**
 * Генерує access token (живе 15 хвилин)
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });
}

/**
 * Генерує refresh token (живе 7 днів)
 */
function generateRefreshToken(payload) {
  const token = jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES });
  refreshTokenStore.add(token); // зберігаємо як валідний
  return token;
}

/**
 * Middleware: перевіряє Bearer access token у заголовку Authorization
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    logError('authenticateToken', err);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token expired' });
    }
    return res.status(403).json({ error: 'Invalid access token' });
  }
}

/**
 * Оновлює access token за допомогою refresh token
 * POST /auth/refresh  { refreshToken: "..." }
 */
function refreshAccessToken(req, res) {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }

  if (!refreshTokenStore.has(refreshToken)) {
    return res.status(403).json({ error: 'Refresh token is invalid or revoked' });
  }

  try {
    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    const newAccessToken = generateAccessToken({ username: decoded.username });
    return res.json({ accessToken: newAccessToken });
  } catch (err) {
    logError('refreshAccessToken', err);
    refreshTokenStore.delete(refreshToken); // видаляємо протухлий токен
    return res.status(403).json({ error: 'Refresh token expired or invalid' });
  }
}

/**
 * Відкликає refresh token (logout)
 */
function revokeRefreshToken(refreshToken) {
  refreshTokenStore.delete(refreshToken);
}

// ─── Реєстрація / Логін ───────────────────────────────────────────────────────

async function registerUser(username, password) {
  try {
    const User = getModel();
    const hashed = await hashPassword(password);

    if (User) {
      const existing = await User.findOne({ username });
      if (existing) throw new Error('User exists');
      const user = await User.create({ username, passwordHash: hashed });
      return { username: user.username };
    }

    if (users.has(username)) throw new Error('User exists');
    users.set(username, { username, passwordHash: hashed });
    return { username };
  } catch (err) {
    logError('registerUser', err);
    throw err;
  }
}

/**
 * Повертає { username, accessToken, refreshToken } або null
 */
async function loginUser(username, password) {
  try {
    const User = getModel();
    let userData = null;

    if (User) {
      const user = await User.findOne({ username });
      if (!user) return null;
      const ok = await comparePassword(password, user.passwordHash);
      if (!ok) return null;
      userData = { username: user.username };
    } else {
      const user = users.get(username);
      if (!user) return null;
      const ok = await comparePassword(password, user.passwordHash);
      if (!ok) return null;
      userData = { username };
    }

    // Видаємо токени
    const accessToken = generateAccessToken(userData);
    const refreshToken = generateRefreshToken(userData);

    return { ...userData, accessToken, refreshToken };
  } catch (err) {
    logError('loginUser', err);
    throw err;
  }
}

function clearUsers() {
  users.clear();
  refreshTokenStore.clear();
}


// routes/auth.js
const {
  registerUser,
  loginUser,
  authenticateToken,
  refreshAccessToken,
  revokeRefreshToken
} = require('./auth'); // імпортуємо з auth.js

// Реєстрація
router.post('/register', async (req, res) => {
  const user = await registerUser(req.body.username, req.body.password);
  res.json(user);
});

// Логін — отримуємо accessToken + refreshToken
router.post('/login', async (req, res) => {
  const result = await loginUser(req.body.username, req.body.password);
  res.json(result);
});