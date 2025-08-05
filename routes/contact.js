const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
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

// @route   POST /api/contact
// @desc    Submit contact form
// @access  Public
router.post('/', [
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('phone')
    .optional()
    .isMobilePhone('en-GB')
    .withMessage('Please provide a valid UK phone number'),
  body('subject')
    .trim()
    .isLength({ min: 5, max: 255 })
    .withMessage('Subject must be between 5 and 255 characters'),
  body('message')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Message must be between 10 and 2000 characters'),
  body('inquiryType')
    .optional()
    .isIn(['general', 'tax-return', 'account', 'billing', 'technical', 'feedback'])
    .withMessage('Invalid inquiry type')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, subject, message, inquiryType } = req.body;

    // Insert contact inquiry into database
    const queryText = `
      INSERT INTO contact_inquiries (first_name, last_name, email, phone, subject, message, inquiry_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [firstName, lastName, email, phone, subject, message, inquiryType || 'general'];
    const result = await query(queryText, values);

    // TODO: Send notification email to admin
    // TODO: Send confirmation email to user

    res.status(201).json({
      success: true,
      message: 'Thank you for your inquiry. We will get back to you within 24 hours.',
      data: {
        id: result.rows[0].id,
        status: result.rows[0].status,
        createdAt: result.rows[0].created_at
      }
    });

  } catch (error) {
    next(error);
  }
});

// @route   GET /api/contact/inquiries
// @desc    Get all contact inquiries (admin only)
// @access  Private (Admin)
router.get('/inquiries', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const {
      status = 'all',
      inquiryType = 'all',
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 1;

    // Filter by status
    if (status !== 'all') {
      whereClause += ` AND status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }

    // Filter by inquiry type
    if (inquiryType !== 'all') {
      whereClause += ` AND inquiry_type = $${paramCount}`;
      values.push(inquiryType);
      paramCount++;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM contact_inquiries ${whereClause}`;
    const countResult = await query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);

    // Get inquiries with pagination
    const inquiriesQuery = `
      SELECT 
        ci.*,
        CONCAT(u.first_name, ' ', u.last_name) as assigned_to_name
      FROM contact_inquiries ci
      LEFT JOIN users u ON ci.assigned_to = u.id
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    values.push(limit, offset);
    const inquiriesResult = await query(inquiriesQuery, values);

    res.json({
      success: true,
      data: {
        inquiries: inquiriesResult.rows,
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

// @route   GET /api/contact/inquiries/:id
// @desc    Get single contact inquiry (admin only)
// @access  Private (Admin)
router.get('/inquiries/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const queryText = `
      SELECT 
        ci.*,
        CONCAT(u.first_name, ' ', u.last_name) as assigned_to_name,
        u.email as assigned_to_email
      FROM contact_inquiries ci
      LEFT JOIN users u ON ci.assigned_to = u.id
      WHERE ci.id = $1
    `;

    const result = await query(queryText, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact inquiry not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/contact/inquiries/:id/status
// @desc    Update inquiry status (admin only)
// @access  Private (Admin)
router.put('/inquiries/:id/status', authenticate, authorize('admin'), [
  body('status')
    .isIn(['new', 'in_progress', 'resolved', 'closed'])
    .withMessage('Invalid status')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const queryText = `
      UPDATE contact_inquiries 
      SET status = $1, responded_at = CASE WHEN $1 != 'new' THEN CURRENT_TIMESTAMP ELSE responded_at END
      WHERE id = $2
      RETURNING *
    `;

    const result = await query(queryText, [status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact inquiry not found'
      });
    }

    res.json({
      success: true,
      message: 'Inquiry status updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/contact/inquiries/:id/assign
// @desc    Assign inquiry to admin user (admin only)
// @access  Private (Admin)
router.put('/inquiries/:id/assign', authenticate, authorize('admin'), [
  body('assignedTo')
    .isUUID()
    .withMessage('Invalid user ID')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    // Verify the assigned user exists and is admin
    const userCheck = await query(
      'SELECT id FROM users WHERE id = $1 AND role = $2',
      [assignedTo, 'admin']
    );

    if (userCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid admin user ID'
      });
    }

    const queryText = `
      UPDATE contact_inquiries 
      SET assigned_to = $1, status = CASE WHEN status = 'new' THEN 'in_progress' ELSE status END
      WHERE id = $2
      RETURNING *
    `;

    const result = await query(queryText, [assignedTo, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact inquiry not found'
      });
    }

    res.json({
      success: true,
      message: 'Inquiry assigned successfully',
      data: result.rows[0]
    });

  } catch (error) {
    next(error);
  }
});

// @route   GET /api/contact/stats
// @desc    Get contact inquiry statistics (admin only)
// @access  Private (Admin)
router.get('/stats', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_inquiries,
        COUNT(CASE WHEN status = 'new' THEN 1 END) as new_inquiries,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_inquiries,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_inquiries,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_inquiries,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as inquiries_last_7_days,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as inquiries_last_30_days,
        AVG(CASE WHEN responded_at IS NOT NULL THEN EXTRACT(EPOCH FROM (responded_at - created_at))/3600 END) as avg_response_time_hours
      FROM contact_inquiries
    `;

    const result = await query(statsQuery);

    // Get inquiries by type
    const typeStatsQuery = `
      SELECT 
        inquiry_type,
        COUNT(*) as count
      FROM contact_inquiries
      GROUP BY inquiry_type
      ORDER BY count DESC
    `;

    const typeResult = await query(typeStatsQuery);

    res.json({
      success: true,
      data: {
        overview: result.rows[0],
        byType: typeResult.rows
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;