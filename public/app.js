const express = require('express');
const session = require('express-session');
const app = express();

app.use(express.json());
app.use(express.static('public'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'session_secret_change_me',
  resave: false,
  saveUninitialized: false,
}));

app.use('/cart', require('./routes/cart'));

app.listen(3000, () => console.log('Server running on port 3000'));

module.exports = app;