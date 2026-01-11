import { body, param, query, validationResult } from 'express-validator';

/**
 * Middleware to clean empty strings from request body
 * Converts empty strings to undefined for optional fields
 */
export const cleanEmptyStrings = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach((key) => {
      if (req.body[key] === '') {
        delete req.body[key];
      }
    });
  }
  next();
};

/**
 * Middleware to handle validation errors
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array(),
    });
  }
  next();
};

/**
 * Validation rules for member creation/update
 */
export const validateMember = [
  cleanEmptyStrings,
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('memberId')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Member ID must be less than 50 characters'),
  body('autoGenerateId')
    .optional()
    .isBoolean()
    .withMessage('autoGenerateId must be a boolean value'),
  body().custom((value) => {
    // If autoGenerateId is true, memberId should not be provided
    if (value.autoGenerateId === true && value.memberId) {
      throw new Error('Cannot provide memberId when autoGenerateId is enabled');
    }
    return true;
  }),
  body('contact')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Contact must be less than 20 characters'),
  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  body('duesPerMonth')
    .optional({ checkFalsy: true })
    .custom((value) => {
      if (!value) return true;
      const num = Number(value);
      return !isNaN(num) && num >= 0;
    })
    .withMessage('Dues per month must be a positive number'),
  body('joinDate')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Join date must be a valid date'),
  body('subgroupId')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Subgroup ID must be a valid MongoDB ID'),
  handleValidationErrors,
];

/**
 * Validation rules for payment creation
 */
export const validatePayment = [
  body('memberId')
    .notEmpty()
    .withMessage('Member ID is required')
    .isMongoId()
    .withMessage('Member ID must be a valid MongoDB ID'),
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date'),
  body('monthsCovered')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Months covered must be a positive integer'),
  handleValidationErrors,
];

/**
 * Validation rules for expenditure creation/update
 */
export const validateExpenditure = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Title must be between 2 and 200 characters'),
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Category must be less than 50 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  handleValidationErrors,
];

/**
 * Validation rules for login
 */
export const validateLogin = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body().custom((value) => {
    if (!value.username && !value.email) {
      throw new Error('Either username or email is required');
    }
    return true;
  }),
  handleValidationErrors,
];

/**
 * Validation rules for user registration
 */
export const validateRegister = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  body('role')
    .optional()
    .isIn(['admin', 'super'])
    .withMessage('Role must be either admin or super'),
  handleValidationErrors,
];

/**
 * Validation rules for subgroup creation/update
 */
export const validateSubgroup = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Subgroup name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Subgroup name must be between 2 and 100 characters'),
  body('leaderId')
    .optional()
    .isMongoId()
    .withMessage('Leader ID must be a valid MongoDB ID'),
  handleValidationErrors,
];

/**
 * Validation rules for MongoDB ID parameters
 */
export const validateMongoId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  handleValidationErrors,
];

/**
 * Validation rules for query parameters (pagination, filters)
 */
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  handleValidationErrors,
];

