'use strict';

const { body, validationResult } = require('express-validator');

// ─── Middleware: обробка помилок валідації ────────────────────────────────────

/**
 * Повертає 400 з масивом помилок, якщо валідація не пройшла.
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ─── Хелпери ──────────────────────────────────────────────────────────────────

/**
 * Створює валідатор числового поля.
 * @param {string} field
 */
const numericField = (field) =>
  body(field)
    .exists().withMessage(`\`${field}\` is required`)
    .isNumeric().withMessage(`\`${field}\` must be a number`)
    .toFloat();

/**
 * Перевіряє що поле існує (не порожнє).
 * @param {string} field
 */
const requiredField = (field) =>
  body(field).exists().withMessage(`${field} required`);

// ─── Валідатори ───────────────────────────────────────────────────────────────

const validateEcho = [
  body().custom((_, { req }) => {
    if (!req.body || Object.keys(req.body).length === 0) {
      throw new Error('Request body is required');
    }
    return true;
  }),
];

const validateSum = [
  numericField('a'),
  numericField('b'),
];

const validateRegister = [
  body('username')
    .exists().withMessage('username required')
    .isAlphanumeric().withMessage('username must be alphanumeric')
    .isLength({ min: 3 }).withMessage('username must be at least 3 characters'),
  body('password')
    .exists().withMessage('password required')
    .isLength({ min: 6 }).withMessage('password must be at least 6 characters'),
];

const validateLogin = [
  requiredField('username'),
  requiredField('password'),
];

const validateAdmin = [
  body('role')
    .exists().withMessage('role required')
    .custom((value) => {
      if (value !== 'admin') throw new Error('admin role required');
      return true;
    }),
  body('adminCode')
    .optional()
    .isString()
    .isLength({ min: 6 }).withMessage('adminCode must be at least 6 characters'),
];

// ─── Експорт ──────────────────────────────────────────────────────────────────

module.exports = {
  validateEcho,
  validateSum,
  validateRegister,
  validateLogin,
  validateAdmin,
  handleValidationErrors,
};