const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  authenticateToken,
  refreshAccessToken,
  revokeRefreshToken,
} = require('../auth');

// Реєстрація
router.post('/register', async (req, res) => {
  try {
    const user = await registerUser(req.body.username, req.body.password);
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Логін
router.post('/login', async (req, res) => {
  try {
    const result = await loginUser(req.body.username, req.body.password);
    if (!result) return res.status(401).json({ error: 'Invalid credentials' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Оновлення access token
router.post('/refresh', refreshAccessToken);

// Logout
router.post('/logout', (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) revokeRefreshToken(refreshToken);
  res.json({ message: 'Logged out' });
});

// Захищений маршрут (приклад)
router.get('/profile', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;