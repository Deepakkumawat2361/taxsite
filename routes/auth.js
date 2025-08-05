const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

// Validation helper
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('phone')
    .optional()
    .isMobilePhone('en-GB')
    .withMessage('Please provide a valid UK phone number'),
  body('role')
    .optional()
    .isIn(['customer', 'accountant'])
    .withMessage('Role must be either customer or accountant')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Create user
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      phone,
      role: role || 'customer'
    });

    // Create customer or accountant profile
    if (user.role === 'customer') {
      await query(
        'INSERT INTO customers (user_id) VALUES ($1)',
        [user.id]
      );
    } else if (user.role === 'accountant') {
      await query(
        'INSERT INTO accountants (user_id) VALUES ($1)',
        [user.id]
      );
    }

    // Generate token
    const token = user.generateToken();

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email to verify your account.',
      data: {
        user: user.toJSON(),
        token
      }
    });

  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check password
    const isValidPassword = await user.verifyPassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Update last login
    await user.updateLastLogin();

    // Generate token
    const token = user.generateToken();

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toJSON(),
        token
      }
    });

  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/verify-email
// @desc    Verify user email
// @access  Public
router.post('/verify-email', [
  body('token')
    .notEmpty()
    .withMessage('Verification token is required')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { token } = req.body;

    // Find user by verification token
    const user = await User.findByVerificationToken(token);
    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification token'
      });
    }

    // Verify email
    await user.verifyEmail();

    res.json({
      success: true,
      message: 'Email verified successfully'
    });

  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists or not
      return res.json({
        success: true,
        message: 'If an account with that email exists, we have sent a password reset link.'
      });
    }

    // Generate reset token
    const resetToken = await user.setResetPasswordToken();

    // TODO: Send email with reset link
    // For now, we'll just return the token (remove this in production)
    res.json({
      success: true,
      message: 'Password reset link sent to your email',
      ...(process.env.NODE_ENV === 'development' && { resetToken })
    });

  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { token, password } = req.body;

    // Find user by reset token
    const user = await User.findByResetToken(token);
    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
    }

    // Update password
    await user.updatePassword(password);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/change-password
// @desc    Change password (authenticated user)
// @access  Private
router.post('/change-password', authenticate, [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get current user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify current password
    const isValidPassword = await user.verifyPassword(currentPassword);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password
    await user.updatePassword(newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    next(error);
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const profile = await user.getProfile();

    res.json({
      success: true,
      data: profile
    });

  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/refresh
// @desc    Refresh JWT token
// @access  Private
router.post('/refresh', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Generate new token
    const token = user.generateToken();

    res.json({
      success: true,
      data: {
        token
      }
    });

  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', authenticate, (req, res) => {
  // Since we're using stateless JWT, logout is handled client-side
  // This endpoint exists for consistency and potential future server-side logout logic
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router;