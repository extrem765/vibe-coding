const { body, validationResult } = require('express-validator');

const validateEcho = [
  body().custom((value, { req }) => {
    if (!req.body || Object.keys(req.body).length === 0) {
      throw new Error('Request body is required');
    }
    return true;
  }),
];

const validateSum = [
  body('a').exists().withMessage('`a` is required').isNumeric().withMessage('`a` must be a number').toFloat(),
  body('b').exists().withMessage('`b` is required').isNumeric().withMessage('`b` must be a number').toFloat(),
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// additional validators for auth
const validateRegister = [
  body('username').exists().withMessage('username required').isAlphanumeric().withMessage('username must be alphanumeric').isLength({ min: 3 }).withMessage('username too short'),
  body('password').exists().withMessage('password required').isLength({ min: 6 }).withMessage('password must be at least 6 chars'),
];

const validateLogin = [
  body('username').exists().withMessage('username required'),
  body('password').exists().withMessage('password required'),
];

module.exports = { validateEcho, validateSum, validateRegister, validateLogin, handleValidationErrors };

