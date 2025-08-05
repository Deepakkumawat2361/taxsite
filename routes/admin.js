const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('../config/database');
const User = require('../models/User');
const TaxReturn = require('../models/TaxReturn');

const router = express.Router();

// All admin routes require admin authentication
router.use(authenticate, authorize('admin'));

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private (Admin)
router.get('/dashboard', async (req, res, next) => {
  try {
    // Get overall statistics
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE role = 'customer') as total_customers,
        (SELECT COUNT(*) FROM users WHERE role = 'accountant') as total_accountants,
        (SELECT COUNT(*) FROM users WHERE is_verified = true) as verified_users,
        (SELECT COUNT(*) FROM tax_returns) as total_tax_returns,
        (SELECT COUNT(*) FROM tax_returns WHERE status = 'pending') as pending_returns,
        (SELECT COUNT(*) FROM tax_returns WHERE status = 'in_progress') as in_progress_returns,
        (SELECT COUNT(*) FROM tax_returns WHERE status = 'completed') as completed_returns,
        (SELECT COUNT(*) FROM tax_returns WHERE status = 'filed') as filed_returns,
        (SELECT COUNT(*) FROM tax_returns WHERE payment_status = 'paid') as paid_returns,
        (SELECT COALESCE(SUM(price), 0) FROM tax_returns WHERE payment_status = 'paid') as total_revenue,
        (SELECT COUNT(*) FROM contact_inquiries) as total_inquiries,
        (SELECT COUNT(*) FROM contact_inquiries WHERE status = 'new') as new_inquiries
    `;

    const statsResult = await query(statsQuery);
    const stats = statsResult.rows[0];

    // Get recent activity
    const recentActivityQuery = `
      SELECT 
        'user_registration' as type,
        CONCAT(first_name, ' ', last_name) as description,
        created_at as timestamp
      FROM users 
      WHERE created_at >= NOW() - INTERVAL '7 days'
      
      UNION ALL
      
      SELECT 
        'tax_return_created' as type,
        CONCAT('Tax return for ', tax_year) as description,
        created_at as timestamp
      FROM tax_returns 
      WHERE created_at >= NOW() - INTERVAL '7 days'
      
      UNION ALL
      
      SELECT 
        'contact_inquiry' as type,
        CONCAT('Inquiry: ', subject) as description,
        created_at as timestamp
      FROM contact_inquiries 
      WHERE created_at >= NOW() - INTERVAL '7 days'
      
      ORDER BY timestamp DESC
      LIMIT 10
    `;

    const activityResult = await query(recentActivityQuery);

    // Get monthly revenue data for chart
    const revenueQuery = `
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as returns_count,
        COALESCE(SUM(price), 0) as revenue
      FROM tax_returns 
      WHERE payment_status = 'paid' 
        AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month ASC
    `;

    const revenueResult = await query(revenueQuery);

    res.json({
      success: true,
      data: {
        overview: stats,
        recentActivity: activityResult.rows,
        monthlyRevenue: revenueResult.rows
      }
    });

  } catch (error) {
    next(error);
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with advanced filtering
// @access  Private (Admin)
router.get('/users', async (req, res, next) => {
  try {
    const {
      role = 'all',
      isVerified = 'all',
      search = '',
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 1;

    // Filter by role
    if (role !== 'all') {
      whereClause += ` AND role = $${paramCount}`;
      values.push(role);
      paramCount++;
    }

    // Filter by verification status
    if (isVerified !== 'all') {
      whereClause += ` AND is_verified = $${paramCount}`;
      values.push(isVerified === 'true');
      paramCount++;
    }

    // Search filter
    if (search) {
      whereClause += ` AND (first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      values.push(`%${search}%`);
      paramCount++;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
    const countResult = await query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);

    // Get users with pagination
    const usersQuery = `
      SELECT 
        id, email, first_name, last_name, phone, role, is_verified, last_login, created_at
      FROM users 
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    values.push(limit, offset);
    const usersResult = await query(usersQuery, values);

    res.json({
      success: true,
      data: {
        users: usersResult.rows,
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

// @route   GET /api/admin/tax-returns
// @desc    Get all tax returns with advanced filtering
// @access  Private (Admin)
router.get('/tax-returns', async (req, res, next) => {
  try {
    const {
      status = 'all',
      paymentStatus = 'all',
      taxYear = 'all',
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
      whereClause += ` AND tr.status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }

    // Filter by payment status
    if (paymentStatus !== 'all') {
      whereClause += ` AND tr.payment_status = $${paramCount}`;
      values.push(paymentStatus);
      paramCount++;
    }

    // Filter by tax year
    if (taxYear !== 'all') {
      whereClause += ` AND tr.tax_year = $${paramCount}`;
      values.push(taxYear);
      paramCount++;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM tax_returns tr ${whereClause}`;
    const countResult = await query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);

    // Get tax returns with customer and accountant info
    const returnsQuery = `
      SELECT 
        tr.*,
        CONCAT(c_user.first_name, ' ', c_user.last_name) as customer_name,
        c_user.email as customer_email,
        CONCAT(a_user.first_name, ' ', a_user.last_name) as accountant_name,
        a_user.email as accountant_email
      FROM tax_returns tr
      JOIN customers c ON tr.customer_id = c.id
      JOIN users c_user ON c.user_id = c_user.id
      LEFT JOIN accountants a ON tr.accountant_id = a.id
      LEFT JOIN users a_user ON a.user_id = a_user.id
      ${whereClause}
      ORDER BY tr.${sortBy} ${sortOrder}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    values.push(limit, offset);
    const returnsResult = await query(returnsQuery, values);

    res.json({
      success: true,
      data: {
        taxReturns: returnsResult.rows,
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

// @route   GET /api/admin/accountants
// @desc    Get all accountants with their statistics
// @access  Private (Admin)
router.get('/accountants', async (req, res, next) => {
  try {
    const accountantsQuery = `
      SELECT 
        a.*,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.is_verified,
        u.created_at as user_created_at,
        COUNT(tr.id) as total_returns,
        COUNT(CASE WHEN tr.status = 'completed' OR tr.status = 'filed' THEN 1 END) as completed_returns,
        AVG(CASE WHEN tr.status = 'filed' THEN EXTRACT(EPOCH FROM (tr.filed_date - tr.created_at))/86400 END) as avg_completion_days
      FROM accountants a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN tax_returns tr ON a.id = tr.accountant_id
      GROUP BY a.id, u.id
      ORDER BY a.rating DESC, total_returns DESC
    `;

    const result = await query(accountantsQuery);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/admin/accountants/:id/status
// @desc    Update accountant active status
// @access  Private (Admin)
router.put('/accountants/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const queryText = `
      UPDATE accountants 
      SET is_active = $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await query(queryText, [isActive, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Accountant not found'
      });
    }

    res.json({
      success: true,
      message: `Accountant ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: result.rows[0]
    });

  } catch (error) {
    next(error);
  }
});

// @route   GET /api/admin/analytics/revenue
// @desc    Get revenue analytics
// @access  Private (Admin)
router.get('/analytics/revenue', async (req, res, next) => {
  try {
    const { period = '12months' } = req.query;

    let interval, dateFormat;
    switch (period) {
      case '7days':
        interval = '7 days';
        dateFormat = 'day';
        break;
      case '30days':
        interval = '30 days';
        dateFormat = 'day';
        break;
      case '12months':
        interval = '12 months';
        dateFormat = 'month';
        break;
      default:
        interval = '12 months';
        dateFormat = 'month';
    }

    const revenueQuery = `
      SELECT 
        DATE_TRUNC('${dateFormat}', created_at) as period,
        COUNT(*) as returns_count,
        COALESCE(SUM(price), 0) as revenue,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_count,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN price END), 0) as paid_revenue
      FROM tax_returns 
      WHERE created_at >= NOW() - INTERVAL '${interval}'
      GROUP BY DATE_TRUNC('${dateFormat}', created_at)
      ORDER BY period ASC
    `;

    const result = await query(revenueQuery);

    // Get totals
    const totalsQuery = `
      SELECT 
        COUNT(*) as total_returns,
        COALESCE(SUM(price), 0) as total_revenue,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as total_paid,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN price END), 0) as total_paid_revenue
      FROM tax_returns 
      WHERE created_at >= NOW() - INTERVAL '${interval}'
    `;

    const totalsResult = await query(totalsQuery);

    res.json({
      success: true,
      data: {
        period: period,
        chart: result.rows,
        totals: totalsResult.rows[0]
      }
    });

  } catch (error) {
    next(error);
  }
});

// @route   GET /api/admin/analytics/performance
// @desc    Get system performance analytics
// @access  Private (Admin)
router.get('/analytics/performance', async (req, res, next) => {
  try {
    // Get completion times
    const performanceQuery = `
      SELECT 
        AVG(CASE WHEN status = 'filed' THEN EXTRACT(EPOCH FROM (filed_date - created_at))/86400 END) as avg_completion_days,
        MIN(CASE WHEN status = 'filed' THEN EXTRACT(EPOCH FROM (filed_date - created_at))/86400 END) as min_completion_days,
        MAX(CASE WHEN status = 'filed' THEN EXTRACT(EPOCH FROM (filed_date - created_at))/86400 END) as max_completion_days,
        COUNT(CASE WHEN status = 'filed' AND filed_date <= submission_deadline THEN 1 END) as on_time_filings,
        COUNT(CASE WHEN status = 'filed' THEN 1 END) as total_filings,
        COUNT(CASE WHEN status = 'pending' AND created_at < NOW() - INTERVAL '7 days' THEN 1 END) as overdue_pending
      FROM tax_returns
    `;

    const performanceResult = await query(performanceQuery);

    // Get customer satisfaction (based on reviews)
    const satisfactionQuery = `
      SELECT 
        AVG(rating) as avg_rating,
        COUNT(*) as total_reviews,
        COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive_reviews
      FROM reviews
      WHERE is_approved = true
    `;

    const satisfactionResult = await query(satisfactionQuery);

    res.json({
      success: true,
      data: {
        performance: performanceResult.rows[0],
        satisfaction: satisfactionResult.rows[0]
      }
    });

  } catch (error) {
    next(error);
  }
});

// @route   GET /api/admin/system/settings
// @desc    Get system settings
// @access  Private (Admin)
router.get('/system/settings', async (req, res, next) => {
  try {
    const settingsQuery = `
      SELECT setting_key, setting_value, description, is_public
      FROM system_settings
      ORDER BY setting_key
    `;

    const result = await query(settingsQuery);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/admin/system/settings/:key
// @desc    Update system setting
// @access  Private (Admin)
router.put('/system/settings/:key', async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const queryText = `
      UPDATE system_settings 
      SET setting_value = $1
      WHERE setting_key = $2
      RETURNING *
    `;

    const result = await query(queryText, [value, key]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Setting not found'
      });
    }

    res.json({
      success: true,
      message: 'Setting updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;