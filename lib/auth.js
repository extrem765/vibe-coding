'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// ─── Конфігурація ─────────────────────────────────────────────────────────────

const CONFIG = {
  saltRounds: 12,
  accessSecret: process.env.ACCESS_TOKEN_SECRET || 'access_secret_change_me',
  refreshSecret: process.env.REFRESH_TOKEN_SECRET || 'refresh_secret_change_me',
  accessExpires: '15m',
  refreshExpires: '7d',
  logFile: path.join(__dirname, 'errors.log'),
};

// ─── Сховища (in-memory fallback) ─────────────────────────────────────────────

/** @type {Map<string, {username: string, passwordHash: string}>} */
const users = new Map();

/** @type {Set<string>} */
const refreshTokenStore = new Set();

// ─── Логування ────────────────────────────────────────────────────────────────

/**
 * Асинхронно записує помилку у файл і виводить у консоль.
 * @param {string} context
 * @param {Error|unknown} error
 */
function logError(context, error) {
  const entry = {
    timestamp: new Date().toISOString(),
    context,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? (error.stack ?? null) : null,
  };
  fs.appendFile(CONFIG.logFile, JSON.stringify(entry) + '\n', (err) => {
    if (err) console.error('Failed to write log:', err);
  });
  console.error(`[ERROR] [${context}]`, entry.stack ?? entry.message);
}

// ─── Mongoose модель (з кешуванням) ──────────────────────────────────────────

/** @type {import('mongoose').Model|null} */
let _UserModel = null;

function getModel() {
  if (_UserModel) return _UserModel;
  try {
    if (mongoose.connection?.readyState === 1) {
      _UserModel = require('../models/user');
      return _UserModel;
    }
  } catch (e) {
    logError('getModel', e);
  }
  return null;
}

// ─── Валідація ────────────────────────────────────────────────────────────────

/**
 * Перевіряє що username і password не порожні.
 * @param {string} username
 * @param {string} password
 */
function validateCredentials(username, password) {
  if (!username?.trim() || !password?.trim()) {
    throw new Error('Username and password are required');
  }
}

// ─── Паролі ───────────────────────────────────────────────────────────────────

/**
 * @param {string} password
 * @returns {Promise<string>}
 */
async function hashPassword(password) {
  return bcrypt.hash(password, CONFIG.saltRounds);
}

/**
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// ─── Пошук користувача ────────────────────────────────────────────────────────

/**
 * Повертає об'єкт користувача з БД або in-memory сховища.
 * @param {string} username
 * @returns {Promise<{username: string, passwordHash: string}|null>}
 */
async function findUser(username) {
  const User = getModel();
  if (User) {
    return User.findOne({ username });
  }
  return users.get(username) ?? null;
}

// ─── JWT токени ───────────────────────────────────────────────────────────────

/**
 * @param {{ username: string }} payload
 * @returns {string}
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, CONFIG.accessSecret, { expiresIn: CONFIG.accessExpires });
}

/**
 * @param {{ username: string }} payload
 * @returns {string}
 */
function generateRefreshToken(payload) {
  const token = jwt.sign(payload, CONFIG.refreshSecret, { expiresIn: CONFIG.refreshExpires });
  refreshTokenStore.add(token);
  return token;
}

/**
 * Middleware: перевіряє Bearer access token у заголовку Authorization.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    req.user = jwt.verify(token, CONFIG.accessSecret);
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
 * Оновлює access token за допомогою refresh token.
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
    const decoded = jwt.verify(refreshToken, CONFIG.refreshSecret);
    const accessToken = generateAccessToken({ username: decoded.username });
    return res.json({ accessToken });
  } catch (err) {
    logError('refreshAccessToken', err);
    refreshTokenStore.delete(refreshToken); // видаляємо протухлий токен
    return res.status(403).json({ error: 'Refresh token expired or invalid' });
  }
}

/**
 * Відкликає refresh token (logout).
 * @param {string} refreshToken
 */
function revokeRefreshToken(refreshToken) {
  refreshTokenStore.delete(refreshToken);
}

// ─── Реєстрація ───────────────────────────────────────────────────────────────

/**
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{username: string}>}
 */
async function registerUser(username, password) {
  try {
    validateCredentials(username, password);

    const existing = await findUser(username);
    if (existing) throw new Error('User exists');

    const passwordHash = await hashPassword(password);
    const User = getModel();

    if (User) {
      const user = await User.create({ username, passwordHash });
      return { username: user.username };
    }

    users.set(username, { username, passwordHash });
    return { username };
  } catch (err) {
    logError('registerUser', err);
    throw err;
  }
}

// ─── Логін ────────────────────────────────────────────────────────────────────

/**
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{username: string, accessToken: string, refreshToken: string}|null>}
 */
async function loginUser(username, password) {
  try {
    validateCredentials(username, password);

    const user = await findUser(username);
    if (!user) return null;

    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) return null;

    const payload = { username: user.username ?? username };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return { ...payload, accessToken, refreshToken };
  } catch (err) {
    logError('loginUser', err);
    throw err;
  }
}

// ─── Утиліти ──────────────────────────────────────────────────────────────────

/** Очищає in-memory сховища (для тестів). */
function clearUsers() {
  users.clear();
  refreshTokenStore.clear();
  _UserModel = null;
}

// ─── Експорт ──────────────────────────────────────────────────────────────────

module.exports = {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  authenticateToken,
  refreshAccessToken,
  revokeRefreshToken,
  registerUser,
  loginUser,
  clearUsers,
};