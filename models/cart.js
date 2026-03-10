const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const { authenticateToken } = require('./auth');

// ─── Логування (той самий підхід, що в auth.js) ───────────────────────────────

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

// ─── Модель ───────────────────────────────────────────────────────────────────

const Cart = require('../models/cart');

// ─── Хелпер: отримати або створити кошик ─────────────────────────────────────

async function getOrCreateCart(username) {
  let cart = await Cart.findOne({ username });
  if (!cart) cart = await Cart.create({ username, items: [] });
  return cart;
}

// ─── Маршрути (всі захищені authenticateToken) ────────────────────────────────

/**
 * GET /cart
 * Повертає поточний кошик користувача
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const cart = await getOrCreateCart(req.user.username);
    res.json(cart);
  } catch (err) {
    logError('GET /cart', err);
    res.status(500).json({ error: 'Failed to get cart' });
  }
});

/**
 * POST /cart/items
 * Додає товар або збільшує кількість, якщо вже є
 * Body: { productId, name, price, quantity? }
 */
router.post('/items', authenticateToken, async (req, res) => {
  const { productId, name, price, quantity = 1 } = req.body;

  if (!productId || !name || price == null) {
    return res.status(400).json({ error: 'productId, name and price are required' });
  }
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ error: 'Invalid productId' });
  }
  if (typeof price !== 'number' || price < 0) {
    return res.status(400).json({ error: 'price must be a non-negative number' });
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ error: 'quantity must be a positive integer' });
  }

  try {
    const cart = await getOrCreateCart(req.user.username);
    const existing = cart.items.find(
      (i) => i.productId.toString() === productId
    );

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

/**
 * PATCH /cart/items/:productId
 * Оновлює кількість товару
 * Body: { quantity }
 */
router.patch('/items/:productId', authenticateToken, async (req, res) => {
  const { productId } = req.params;
  const { quantity } = req.body;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ error: 'Invalid productId' });
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ error: 'quantity must be a positive integer' });
  }

  try {
    const cart = await Cart.findOne({ username: req.user.username });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    const item = cart.items.find((i) => i.productId.toString() === productId);
    if (!item) return res.status(404).json({ error: 'Item not found in cart' });

    item.quantity = quantity;
    await cart.save();
    res.json(cart);
  } catch (err) {
    logError('PATCH /cart/items/:productId', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

/**
 * DELETE /cart/items/:productId
 * Видаляє товар з кошика
 */
router.delete('/items/:productId', authenticateToken, async (req, res) => {
  const { productId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ error: 'Invalid productId' });
  }

  try {
    const cart = await Cart.findOne({ username: req.user.username });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    const before = cart.items.length;
    cart.items = cart.items.filter((i) => i.productId.toString() !== productId);
    if (cart.items.length === before) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }

    await cart.save();
    res.json(cart);
  } catch (err) {
    logError('DELETE /cart/items/:productId', err);
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

/**
 * DELETE /cart
 * Очищає весь кошик
 */
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const cart = await Cart.findOne({ username: req.user.username });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    cart.items = [];
    await cart.save();
    res.json({ message: 'Cart cleared', cart });
  } catch (err) {
    logError('DELETE /cart', err);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

module.exports = router;
