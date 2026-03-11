const express = require('express');
const router = express.Router();

// Кошик зберігається в сесії
// GET /cart — отримати кошик
router.get('/', (req, res) => {
  const cart = req.session.cart || [];
  res.json({ cart });
});

// POST /cart — додати товар
router.post('/', (req, res) => {
  const { id, name, price, quantity = 1 } = req.body;
  if (!id || !name || !price) {
    return res.status(400).json({ error: 'id, name and price are required' });
  }

  if (!req.session.cart) req.session.cart = [];

  const existing = req.session.cart.find(item => item.id === id);
  if (existing) {
    existing.quantity += quantity;
  } else {
    req.session.cart.push({ id, name, price, quantity });
  }

  res.json({ cart: req.session.cart });
});

// DELETE /cart/:id — видалити товар
router.delete('/:id', (req, res) => {
  if (!req.session.cart) return res.json({ cart: [] });

  req.session.cart = req.session.cart.filter(item => item.id !== req.params.id);
  res.json({ cart: req.session.cart });
});

// DELETE /cart — очистити кошик
router.delete('/', (req, res) => {
  req.session.cart = [];
  res.json({ cart: [] });
});

module.exports = router;