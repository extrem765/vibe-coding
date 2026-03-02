const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const users = new Map();
const SALT_ROUNDS = 12;

function getModel() {
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      return require('../models/user');
    }
  } catch (e) {
    return null;
  }
  return null;
}

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

async function registerUser(username, password) {
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
}

async function loginUser(username, password) {
  const User = getModel();
  if (User) {
    const user = await User.findOne({ username });
    if (!user) return null;
    const ok = await comparePassword(password, user.passwordHash);
    return ok ? { username: user.username } : null;
  }
  const user = users.get(username);
  if (!user) return null;
  const ok = await comparePassword(password, user.passwordHash);
  return ok ? { username } : null;
}

function clearUsers() { users.clear(); }

module.exports = { hashPassword, comparePassword, registerUser, loginUser, clearUsers };