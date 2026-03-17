const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const { authenticateToken } = require('./auth');
const Cart = require('../models/cart');

// ─── Логування ────────────────────────────────────────────────────────────────

const LOG_FILE = path.join(__dirname, 'errors.log');

function logError(context, error) {
  const entry = {
    timestamp: new Date().toISOString(),
    context,
    message: error.message || String(error),
    stack: error.stack || null,
  };
  fs.appendFile(LOG_FILE, JSON.stringify(entry) + '\n', (err) => {
    if (err) console.error('Failed to write log:', err);
  });
  console.error(`[ERROR] [${context}]`, error.message);
}

// ─── Валідація ────────────────────────────────────────────────────────────────

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function isValidQuantity(q) {
  return Number.isInteger(q) && q >= 1;
}

// ─── Хелпери ──────────────────────────────────────────────────────────────────

async function getOrCreateCart(username) {
  return await Cart.findOne({ username }) ?? await Cart.create({ username, items: [] });
}

async function getCart(username, res) {
  const cart = await Cart.findOne({ username });
  if (!cart) res.status(404).json({ error: 'Cart not found' });
  return cart;
}

function findItem(cart, productId) {
  return cart.items.find((i) => i.productId.toString() === productId);
}

// ─── Middleware ───────────────────────────────────────────────────────────────

// Всі маршрути захищені
router.use(authenticateToken);

// ─── Маршрути ─────────────────────────────────────────────────────────────────

// GET /cart
router.get('/', async (req, res) => {
  try {
    res.json(await getOrCreateCart(req.user.username));
  } catch (err) {
    logError('GET /cart', err);
    res.status(500).json({ error: 'Failed to get cart' });
  }
});

// POST /cart/items
router.post('/items', async (req, res) => {
  const { productId, name, price, quantity = 1 } = req.body;

  if (!productId || !name || price == null)
    return res.status(400).json({ error: 'productId, name and price are required' });
  if (!isValidObjectId(productId))
    return res.status(400).json({ error: 'Invalid productId' });
  if (typeof price !== 'number' || price < 0)
    return res.status(400).json({ error: 'price must be a non-negative number' });
  if (!isValidQuantity(quantity))
    return res.status(400).json({ error: 'quantity must be a positive integer' });

  try {
    const cart = await getOrCreateCart(req.user.username);
    const existing = findItem(cart, productId);

    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.items.push({ productId, name, price, quantity });
    }

    await cart.save();
    res.status(201).json(cart);
  } catch (err) {
    logError('POST /cart/items', err);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// PATCH /cart/items/:productId
router.patch('/items/:productId', async (req, res) => {
  const { productId } = req.params;
  const { quantity } = req.body;

  if (!isValidObjectId(productId))
    return res.status(400).json({ error: 'Invalid productId' });
  if (!isValidQuantity(quantity))
    return res.status(400).json({ error: 'quantity must be a positive integer' });

  try {
    const cart = await getCart(req.user.username, res);
    if (!cart) return;

    const item = findItem(cart, productId);
    if (!item) return res.status(404).json({ error: 'Item not found in cart' });

    item.quantity = quantity;
    await cart.save();
    res.json(cart);
  } catch (err) {
    logError('PATCH /cart/items/:productId', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /cart/items/:productId
router.delete('/items/:productId', async (req, res) => {
  const { productId } = req.params;

  if (!isValidObjectId(productId))
    return res.status(400).json({ error: 'Invalid productId' });

  try {
    const cart = await getCart(req.user.username, res);
    if (!cart) return;

    const before = cart.items.length;
    cart.items = cart.items.filter((i) => i.productId.toString() !== productId);
    if (cart.items.length === before)
      return res.status(404).json({ error: 'Item not found in cart' });

    await cart.save();
    res.json(cart);
  } catch (err) {
    logError('DELETE /cart/items/:productId', err);
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

// DELETE /cart
router.delete('/', async (req, res) => {
  try {
    const cart = await getCart(req.user.username, res);
    if (!cart) return;

    cart.items = [];
    await cart.save();
    res.json({ message: 'Cart cleared', cart });
  } catch (err) {
    logError('DELETE /cart', err);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

module.exports = router;