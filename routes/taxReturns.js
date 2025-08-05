const express = require('express');
const { body, validationResult } = require('express-validator');
const TaxReturn = require('../models/TaxReturn');
const { authenticate, authorize, checkOwnership } = require('../middleware/auth');
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

// Helper function to get customer ID from user
const getCustomerIdFromUser = async (userId) => {
  const result = await query('SELECT id FROM customers WHERE user_id = $1', [userId]);
  return result.rows[0]?.id || null;
};

// @route   POST /api/tax-returns
// @desc    Create a new tax return
// @access  Private (Customer)
router.post('/', authenticate, authorize('customer'), [
  body('taxYear')
    .matches(/^\d{4}-\d{2}$/)
    .withMessage('Tax year must be in format YYYY-YY (e.g., 2023-24)'),
  body('situationType')
    .isIn(['self-employed', 'freelancer', 'landlord', 'investor', 'high-earner', 'first-time', 'other'])
    .withMessage('Invalid situation type'),
  body('submissionDeadline')
    .optional()
    .isISO8601()
    .withMessage('Invalid submission deadline format')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { taxYear, situationType, submissionDeadline } = req.body;

    // Get customer ID
    const customerId = await getCustomerIdFromUser(req.user.id);
    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'Customer profile not found'
      });
    }

    // Check if tax return already exists for this year
    const existingReturns = await TaxReturn.findByCustomerId(customerId, { taxYear });
    if (existingReturns.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Tax return for this year already exists'
      });
    }

    // Set default deadline if not provided
    const deadline = submissionDeadline || new Date('2024-01-31');

    const taxReturn = await TaxReturn.create({
      customerId,
      taxYear,
      situationType,
      submissionDeadline: deadline
    });

    res.status(201).json({
      success: true,
      message: 'Tax return created successfully',
      data: taxReturn.toJSON()
    });

  } catch (error) {
    next(error);
  }
});

// @route   GET /api/tax-returns
// @desc    Get user's tax returns
// @access  Private
router.get('/', authenticate, async (req, res, next) => {
  try {
    let taxReturns;

    if (req.user.role === 'customer') {
      const customerId = await getCustomerIdFromUser(req.user.id);
      if (!customerId) {
        return res.status(400).json({
          success: false,
          error: 'Customer profile not found'
        });
      }
      taxReturns = await TaxReturn.findByCustomerId(customerId, req.query);
    } else if (req.user.role === 'accountant') {
      const accountantResult = await query('SELECT id FROM accountants WHERE user_id = $1', [req.user.id]);
      const accountantId = accountantResult.rows[0]?.id;
      if (!accountantId) {
        return res.status(400).json({
          success: false,
          error: 'Accountant profile not found'
        });
      }
      taxReturns = await TaxReturn.findByAccountantId(accountantId, req.query);
    } else if (req.user.role === 'admin') {
      taxReturns = await TaxReturn.getAll(req.query);
    }

    res.json({
      success: true,
      data: taxReturns.map(tr => tr.toJSON())
    });

  } catch (error) {
    next(error);
  }
});

// @route   GET /api/tax-returns/:id
// @desc    Get single tax return with full details
// @access  Private
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const taxReturn = await TaxReturn.findById(req.params.id);
    if (!taxReturn) {
      return res.status(404).json({
        success: false,
        error: 'Tax return not found'
      });
    }

    // Check ownership or admin access
    if (req.user.role === 'customer') {
      const customerId = await getCustomerIdFromUser(req.user.id);
      if (taxReturn.customerId !== customerId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    } else if (req.user.role === 'accountant') {
      const accountantResult = await query('SELECT id FROM accountants WHERE user_id = $1', [req.user.id]);
      const accountantId = accountantResult.rows[0]?.id;
      if (taxReturn.accountantId !== accountantId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }

    // Get full details
    const fullDetails = await taxReturn.getFullDetails();
    const incomeSources = await taxReturn.getIncomeSources();
    const expenses = await taxReturn.getExpenses();
    const documents = await taxReturn.getDocuments();
    const messages = await taxReturn.getMessages();

    res.json({
      success: true,
      data: {
        taxReturn: fullDetails,
        incomeSources,
        expenses,
        documents,
        messages
      }
    });

  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/tax-returns/:id/status
// @desc    Update tax return status
// @access  Private (Accountant/Admin)
router.put('/:id/status', authenticate, authorize('accountant', 'admin'), [
  body('status')
    .isIn(['pending', 'in_progress', 'review', 'completed', 'filed', 'cancelled'])
    .withMessage('Invalid status')
], handleValidationErrors, async (req, res, next) => {
  try {
    const taxReturn = await TaxReturn.findById(req.params.id);
    if (!taxReturn) {
      return res.status(404).json({
        success: false,
        error: 'Tax return not found'
      });
    }

    // Check if accountant is assigned to this return
    if (req.user.role === 'accountant') {
      const accountantResult = await query('SELECT id FROM accountants WHERE user_id = $1', [req.user.id]);
      const accountantId = accountantResult.rows[0]?.id;
      if (taxReturn.accountantId !== accountantId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }

    const updatedTaxReturn = await taxReturn.updateStatus(req.body.status);

    res.json({
      success: true,
      message: 'Tax return status updated successfully',
      data: updatedTaxReturn.toJSON()
    });

  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/tax-returns/:id/assign
// @desc    Assign accountant to tax return
// @access  Private (Admin)
router.put('/:id/assign', authenticate, authorize('admin'), [
  body('accountantId')
    .isUUID()
    .withMessage('Invalid accountant ID')
], handleValidationErrors, async (req, res, next) => {
  try {
    const taxReturn = await TaxReturn.findById(req.params.id);
    if (!taxReturn) {
      return res.status(404).json({
        success: false,
        error: 'Tax return not found'
      });
    }

    // Verify accountant exists and is active
    const accountantCheck = await query(
      'SELECT id FROM accountants WHERE id = $1 AND is_active = true',
      [req.body.accountantId]
    );

    if (accountantCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or inactive accountant'
      });
    }

    const updatedTaxReturn = await taxReturn.assignAccountant(req.body.accountantId);

    res.json({
      success: true,
      message: 'Accountant assigned successfully',
      data: updatedTaxReturn.toJSON()
    });

  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/tax-returns/:id/calculations
// @desc    Update tax calculations
// @access  Private (Accountant/Admin)
router.put('/:id/calculations', authenticate, authorize('accountant', 'admin'), [
  body('totalIncome')
    .isFloat({ min: 0 })
    .withMessage('Total income must be a positive number'),
  body('totalTaxDue')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Total tax due must be a positive number'),
  body('totalRefund')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Total refund must be a positive number')
], handleValidationErrors, async (req, res, next) => {
  try {
    const taxReturn = await TaxReturn.findById(req.params.id);
    if (!taxReturn) {
      return res.status(404).json({
        success: false,
        error: 'Tax return not found'
      });
    }

    // Check if accountant is assigned to this return
    if (req.user.role === 'accountant') {
      const accountantResult = await query('SELECT id FROM accountants WHERE user_id = $1', [req.user.id]);
      const accountantId = accountantResult.rows[0]?.id;
      if (taxReturn.accountantId !== accountantId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }

    const updatedTaxReturn = await taxReturn.updateCalculations(req.body);

    res.json({
      success: true,
      message: 'Tax calculations updated successfully',
      data: updatedTaxReturn.toJSON()
    });

  } catch (error) {
    next(error);
  }
});

// @route   POST /api/tax-returns/:id/file
// @desc    Mark tax return as filed with HMRC
// @access  Private (Accountant/Admin)
router.post('/:id/file', authenticate, authorize('accountant', 'admin'), [
  body('hmrcReference')
    .notEmpty()
    .withMessage('HMRC reference is required')
], handleValidationErrors, async (req, res, next) => {
  try {
    const taxReturn = await TaxReturn.findById(req.params.id);
    if (!taxReturn) {
      return res.status(404).json({
        success: false,
        error: 'Tax return not found'
      });
    }

    // Check if accountant is assigned to this return
    if (req.user.role === 'accountant') {
      const accountantResult = await query('SELECT id FROM accountants WHERE user_id = $1', [req.user.id]);
      const accountantId = accountantResult.rows[0]?.id;
      if (taxReturn.accountantId !== accountantId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }

    const updatedTaxReturn = await taxReturn.markAsFiled(req.body.hmrcReference);

    res.json({
      success: true,
      message: 'Tax return filed successfully',
      data: updatedTaxReturn.toJSON()
    });

  } catch (error) {
    next(error);
  }
});

// @route   POST /api/tax-returns/:id/income
// @desc    Add income source to tax return
// @access  Private (Customer/Accountant)
router.post('/:id/income', authenticate, [
  body('sourceType')
    .isIn(['employment', 'self_employment', 'rental', 'dividends', 'interest', 'other'])
    .withMessage('Invalid income source type'),
  body('grossIncome')
    .isFloat({ min: 0 })
    .withMessage('Gross income must be a positive number'),
  body('taxDeducted')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Tax deducted must be a positive number'),
  body('employerName')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Employer name too long')
], handleValidationErrors, async (req, res, next) => {
  try {
    const taxReturn = await TaxReturn.findById(req.params.id);
    if (!taxReturn) {
      return res.status(404).json({
        success: false,
        error: 'Tax return not found'
      });
    }

    // Check access permissions
    if (req.user.role === 'customer') {
      const customerId = await getCustomerIdFromUser(req.user.id);
      if (taxReturn.customerId !== customerId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    } else if (req.user.role === 'accountant') {
      const accountantResult = await query('SELECT id FROM accountants WHERE user_id = $1', [req.user.id]);
      const accountantId = accountantResult.rows[0]?.id;
      if (taxReturn.accountantId !== accountantId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }

    const { sourceType, grossIncome, taxDeducted, employerName, startDate, endDate } = req.body;

    const queryText = `
      INSERT INTO income_sources (tax_return_id, source_type, gross_income, tax_deducted, employer_name, start_date, end_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [req.params.id, sourceType, grossIncome, taxDeducted, employerName, startDate, endDate];
    const result = await query(queryText, values);

    res.status(201).json({
      success: true,
      message: 'Income source added successfully',
      data: result.rows[0]
    });

  } catch (error) {
    next(error);
  }
});

// @route   GET /api/tax-returns/stats
// @desc    Get tax return statistics
// @access  Private
router.get('/stats', authenticate, async (req, res, next) => {
  try {
    let filters = {};

    if (req.user.role === 'customer') {
      const customerId = await getCustomerIdFromUser(req.user.id);
      filters.customerId = customerId;
    } else if (req.user.role === 'accountant') {
      const accountantResult = await query('SELECT id FROM accountants WHERE user_id = $1', [req.user.id]);
      const accountantId = accountantResult.rows[0]?.id;
      filters.accountantId = accountantId;
    }

    const stats = await TaxReturn.getStatistics(filters);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/tax-returns/:id
// @desc    Delete tax return
// @access  Private (Admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const taxReturn = await TaxReturn.findById(req.params.id);
    if (!taxReturn) {
      return res.status(404).json({
        success: false,
        error: 'Tax return not found'
      });
    }

    await taxReturn.delete();

    res.json({
      success: true,
      message: 'Tax return deleted successfully'
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;