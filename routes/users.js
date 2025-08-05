const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');

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

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', authenticate, async (req, res, next) => {
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

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authenticate, [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('phone')
    .optional()
    .isMobilePhone('en-GB')
    .withMessage('Please provide a valid UK phone number')
], handleValidationErrors, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const updateData = {
      first_name: req.body.firstName,
      last_name: req.body.lastName,
      phone: req.body.phone
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const updatedUser = await user.update(updateData);
    const profile = await updatedUser.getProfile();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: profile
    });

  } catch (error) {
    next(error);
  }
});

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Private (Admin)
router.get('/', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const {
      role = 'all',
      isVerified = 'all',
      page = 1,
      limit = 20
    } = req.query;

    const filters = {
      limit: parseInt(limit),
      offset: (page - 1) * limit
    };

    if (role !== 'all') {
      filters.role = role;
    }

    if (isVerified !== 'all') {
      filters.isVerified = isVerified === 'true';
    }

    const users = await User.getAll(filters);

    // Get total count for pagination
    const countFilters = { ...filters };
    delete countFilters.limit;
    delete countFilters.offset;
    const allUsers = await User.getAll(countFilters);
    const total = allUsers.length;

    res.json({
      success: true,
      data: {
        users: users.map(user => user.toJSON()),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID (admin only)
// @access  Private (Admin)
router.get('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
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

// @route   DELETE /api/users/:id
// @desc    Delete user (admin only)
// @access  Private (Admin)
router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Prevent admin from deleting themselves
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'You cannot delete your own account'
      });
    }

    await user.delete();

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;