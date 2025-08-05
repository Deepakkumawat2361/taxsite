const { query, transaction } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class TaxReturn {
  constructor(taxReturnData) {
    this.id = taxReturnData.id;
    this.customerId = taxReturnData.customer_id;
    this.accountantId = taxReturnData.accountant_id;
    this.taxYear = taxReturnData.tax_year;
    this.status = taxReturnData.status;
    this.situationType = taxReturnData.situation_type;
    this.totalIncome = taxReturnData.total_income;
    this.totalTaxDue = taxReturnData.total_tax_due;
    this.totalRefund = taxReturnData.total_refund;
    this.submissionDeadline = taxReturnData.submission_deadline;
    this.filedDate = taxReturnData.filed_date;
    this.hmrcReference = taxReturnData.hmrc_reference;
    this.notes = taxReturnData.notes;
    this.price = taxReturnData.price;
    this.paymentStatus = taxReturnData.payment_status;
    this.createdAt = taxReturnData.created_at;
    this.updatedAt = taxReturnData.updated_at;
  }

  // Create a new tax return
  static async create(taxReturnData) {
    const {
      customerId,
      taxYear,
      situationType,
      submissionDeadline,
      price = 169.00
    } = taxReturnData;

    const queryText = `
      INSERT INTO tax_returns (customer_id, tax_year, situation_type, submission_deadline, price)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [customerId, taxYear, situationType, submissionDeadline, price];

    try {
      const result = await query(queryText, values);
      return new TaxReturn(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  // Find tax return by ID
  static async findById(id) {
    const queryText = 'SELECT * FROM tax_returns WHERE id = $1';
    const result = await query(queryText, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return new TaxReturn(result.rows[0]);
  }

  // Find tax returns by customer ID
  static async findByCustomerId(customerId, filters = {}) {
    let queryText = 'SELECT * FROM tax_returns WHERE customer_id = $1';
    const values = [customerId];
    let paramCount = 2;

    if (filters.status) {
      queryText += ` AND status = $${paramCount}`;
      values.push(filters.status);
      paramCount++;
    }

    if (filters.taxYear) {
      queryText += ` AND tax_year = $${paramCount}`;
      values.push(filters.taxYear);
      paramCount++;
    }

    queryText += ' ORDER BY created_at DESC';

    if (filters.limit) {
      queryText += ` LIMIT $${paramCount}`;
      values.push(filters.limit);
    }

    const result = await query(queryText, values);
    return result.rows.map(row => new TaxReturn(row));
  }

  // Find tax returns by accountant ID
  static async findByAccountantId(accountantId, filters = {}) {
    let queryText = 'SELECT * FROM tax_returns WHERE accountant_id = $1';
    const values = [accountantId];
    let paramCount = 2;

    if (filters.status) {
      queryText += ` AND status = $${paramCount}`;
      values.push(filters.status);
      paramCount++;
    }

    queryText += ' ORDER BY created_at DESC';

    const result = await query(queryText, values);
    return result.rows.map(row => new TaxReturn(row));
  }

  // Get all tax returns with filters (admin only)
  static async getAll(filters = {}) {
    let queryText = 'SELECT * FROM tax_returns WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (filters.status) {
      queryText += ` AND status = $${paramCount}`;
      values.push(filters.status);
      paramCount++;
    }

    if (filters.taxYear) {
      queryText += ` AND tax_year = $${paramCount}`;
      values.push(filters.taxYear);
      paramCount++;
    }

    if (filters.paymentStatus) {
      queryText += ` AND payment_status = $${paramCount}`;
      values.push(filters.paymentStatus);
      paramCount++;
    }

    queryText += ' ORDER BY created_at DESC';

    if (filters.limit) {
      queryText += ` LIMIT $${paramCount}`;
      values.push(filters.limit);
      paramCount++;
    }

    if (filters.offset) {
      queryText += ` OFFSET $${paramCount}`;
      values.push(filters.offset);
    }

    const result = await query(queryText, values);
    return result.rows.map(row => new TaxReturn(row));
  }

  // Assign accountant to tax return
  async assignAccountant(accountantId) {
    const queryText = `
      UPDATE tax_returns 
      SET accountant_id = $1, status = 'in_progress'
      WHERE id = $2
      RETURNING *
    `;

    const result = await query(queryText, [accountantId, this.id]);
    return new TaxReturn(result.rows[0]);
  }

  // Update tax return status
  async updateStatus(newStatus) {
    const validStatuses = ['pending', 'in_progress', 'review', 'completed', 'filed', 'cancelled'];
    
    if (!validStatuses.includes(newStatus)) {
      throw new Error('Invalid status');
    }

    const queryText = `
      UPDATE tax_returns 
      SET status = $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await query(queryText, [newStatus, this.id]);
    return new TaxReturn(result.rows[0]);
  }

  // Update payment status
  async updatePaymentStatus(paymentStatus) {
    const validStatuses = ['pending', 'paid', 'refunded', 'failed'];
    
    if (!validStatuses.includes(paymentStatus)) {
      throw new Error('Invalid payment status');
    }

    const queryText = `
      UPDATE tax_returns 
      SET payment_status = $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await query(queryText, [paymentStatus, this.id]);
    return new TaxReturn(result.rows[0]);
  }

  // Update tax calculations
  async updateCalculations(calculationData) {
    const { totalIncome, totalTaxDue, totalRefund } = calculationData;

    const queryText = `
      UPDATE tax_returns 
      SET total_income = $1, total_tax_due = $2, total_refund = $3
      WHERE id = $4
      RETURNING *
    `;

    const values = [totalIncome, totalTaxDue, totalRefund, this.id];
    const result = await query(queryText, values);
    return new TaxReturn(result.rows[0]);
  }

  // Mark as filed with HMRC
  async markAsFiled(hmrcReference) {
    const queryText = `
      UPDATE tax_returns 
      SET status = 'filed', filed_date = CURRENT_TIMESTAMP, hmrc_reference = $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await query(queryText, [hmrcReference, this.id]);
    return new TaxReturn(result.rows[0]);
  }

  // Add notes
  async addNotes(notes) {
    const queryText = `
      UPDATE tax_returns 
      SET notes = $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await query(queryText, [notes, this.id]);
    return new TaxReturn(result.rows[0]);
  }

  // Get tax return with full details (including customer and accountant info)
  async getFullDetails() {
    const queryText = `
      SELECT 
        tr.*,
        CONCAT(c_user.first_name, ' ', c_user.last_name) as customer_name,
        c_user.email as customer_email,
        c_user.phone as customer_phone,
        CONCAT(a_user.first_name, ' ', a_user.last_name) as accountant_name,
        a_user.email as accountant_email,
        acc.qualification as accountant_qualification,
        acc.experience_years as accountant_experience
      FROM tax_returns tr
      JOIN customers c ON tr.customer_id = c.id
      JOIN users c_user ON c.user_id = c_user.id
      LEFT JOIN accountants acc ON tr.accountant_id = acc.id
      LEFT JOIN users a_user ON acc.user_id = a_user.id
      WHERE tr.id = $1
    `;

    const result = await query(queryText, [this.id]);
    return result.rows[0] || null;
  }

  // Get income sources for this tax return
  async getIncomeSources() {
    const queryText = `
      SELECT * FROM income_sources 
      WHERE tax_return_id = $1 
      ORDER BY created_at ASC
    `;

    const result = await query(queryText, [this.id]);
    return result.rows;
  }

  // Get expenses for this tax return
  async getExpenses() {
    const queryText = `
      SELECT * FROM expenses 
      WHERE tax_return_id = $1 
      ORDER BY expense_date DESC
    `;

    const result = await query(queryText, [this.id]);
    return result.rows;
  }

  // Get documents for this tax return
  async getDocuments() {
    const queryText = `
      SELECT d.*, CONCAT(u.first_name, ' ', u.last_name) as uploaded_by_name
      FROM documents d
      JOIN users u ON d.uploaded_by = u.id
      WHERE d.tax_return_id = $1 
      ORDER BY d.created_at DESC
    `;

    const result = await query(queryText, [this.id]);
    return result.rows;
  }

  // Get messages for this tax return
  async getMessages() {
    const queryText = `
      SELECT 
        m.*,
        CONCAT(sender.first_name, ' ', sender.last_name) as sender_name,
        CONCAT(recipient.first_name, ' ', recipient.last_name) as recipient_name
      FROM messages m
      JOIN users sender ON m.sender_id = sender.id
      JOIN users recipient ON m.recipient_id = recipient.id
      WHERE m.tax_return_id = $1 
      ORDER BY m.created_at ASC
    `;

    const result = await query(queryText, [this.id]);
    return result.rows;
  }

  // Calculate total expenses
  async getTotalExpenses() {
    const queryText = `
      SELECT COALESCE(SUM(amount), 0) as total_expenses
      FROM expenses 
      WHERE tax_return_id = $1 AND is_approved = true
    `;

    const result = await query(queryText, [this.id]);
    return parseFloat(result.rows[0].total_expenses) || 0;
  }

  // Get tax return statistics (for dashboard)
  static async getStatistics(filters = {}) {
    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (filters.accountantId) {
      whereClause += ` AND accountant_id = $${paramCount}`;
      values.push(filters.accountantId);
      paramCount++;
    }

    if (filters.customerId) {
      whereClause += ` AND customer_id = $${paramCount}`;
      values.push(filters.customerId);
      paramCount++;
    }

    if (filters.taxYear) {
      whereClause += ` AND tax_year = $${paramCount}`;
      values.push(filters.taxYear);
      paramCount++;
    }

    const queryText = `
      SELECT 
        COUNT(*) as total_returns,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_returns,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_returns,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_returns,
        COUNT(CASE WHEN status = 'filed' THEN 1 END) as filed_returns,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_returns,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN price END), 0) as total_revenue,
        COALESCE(AVG(CASE WHEN status = 'filed' THEN total_income END), 0) as avg_income
      FROM tax_returns ${whereClause}
    `;

    const result = await query(queryText, values);
    return result.rows[0];
  }

  // Delete tax return (and related data)
  async delete() {
    return await transaction(async (client) => {
      // Delete related records first
      await client.query('DELETE FROM messages WHERE tax_return_id = $1', [this.id]);
      await client.query('DELETE FROM documents WHERE tax_return_id = $1', [this.id]);
      await client.query('DELETE FROM expenses WHERE tax_return_id = $1', [this.id]);
      await client.query('DELETE FROM income_sources WHERE tax_return_id = $1', [this.id]);
      await client.query('DELETE FROM payments WHERE tax_return_id = $1', [this.id]);
      
      // Delete the tax return
      await client.query('DELETE FROM tax_returns WHERE id = $1', [this.id]);
      
      return true;
    });
  }

  // Convert to JSON
  toJSON() {
    return {
      id: this.id,
      customerId: this.customerId,
      accountantId: this.accountantId,
      taxYear: this.taxYear,
      status: this.status,
      situationType: this.situationType,
      totalIncome: this.totalIncome,
      totalTaxDue: this.totalTaxDue,
      totalRefund: this.totalRefund,
      submissionDeadline: this.submissionDeadline,
      filedDate: this.filedDate,
      hmrcReference: this.hmrcReference,
      notes: this.notes,
      price: this.price,
      paymentStatus: this.paymentStatus,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = TaxReturn;