const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query, transaction } = require('../config/database');

class User {
  constructor(userData) {
    this.id = userData.id;
    this.email = userData.email;
    this.firstName = userData.first_name;
    this.lastName = userData.last_name;
    this.phone = userData.phone;
    this.role = userData.role;
    this.isVerified = userData.is_verified;
    this.verificationToken = userData.verification_token;
    this.resetPasswordToken = userData.reset_password_token;
    this.resetPasswordExpires = userData.reset_password_expires;
    this.lastLogin = userData.last_login;
    this.createdAt = userData.created_at;
    this.updatedAt = userData.updated_at;
  }

  // Create a new user
  static async create(userData) {
    const { email, password, firstName, lastName, phone, role = 'customer' } = userData;
    
    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Generate verification token
    const verificationToken = uuidv4();
    
    const queryText = `
      INSERT INTO users (email, password_hash, first_name, last_name, phone, role, verification_token)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const values = [email, passwordHash, firstName, lastName, phone, role, verificationToken];
    
    try {
      const result = await query(queryText, values);
      return new User(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new Error('Email already exists');
      }
      throw error;
    }
  }

  // Find user by email
  static async findByEmail(email) {
    const queryText = 'SELECT * FROM users WHERE email = $1';
    const result = await query(queryText, [email]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new User(result.rows[0]);
  }

  // Find user by ID
  static async findById(id) {
    const queryText = 'SELECT * FROM users WHERE id = $1';
    const result = await query(queryText, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new User(result.rows[0]);
  }

  // Find user by verification token
  static async findByVerificationToken(token) {
    const queryText = 'SELECT * FROM users WHERE verification_token = $1';
    const result = await query(queryText, [token]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new User(result.rows[0]);
  }

  // Find user by reset password token
  static async findByResetToken(token) {
    const queryText = `
      SELECT * FROM users 
      WHERE reset_password_token = $1 
      AND reset_password_expires > NOW()
    `;
    const result = await query(queryText, [token]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new User(result.rows[0]);
  }

  // Verify password
  async verifyPassword(password) {
    const queryText = 'SELECT password_hash FROM users WHERE id = $1';
    const result = await query(queryText, [this.id]);
    
    if (result.rows.length === 0) {
      return false;
    }
    
    return await bcrypt.compare(password, result.rows[0].password_hash);
  }

  // Update password
  async updatePassword(newPassword) {
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    
    const queryText = `
      UPDATE users 
      SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await query(queryText, [passwordHash, this.id]);
    return new User(result.rows[0]);
  }

  // Verify email
  async verifyEmail() {
    const queryText = `
      UPDATE users 
      SET is_verified = true, verification_token = NULL
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await query(queryText, [this.id]);
    return new User(result.rows[0]);
  }

  // Set reset password token
  async setResetPasswordToken() {
    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now
    
    const queryText = `
      UPDATE users 
      SET reset_password_token = $1, reset_password_expires = $2
      WHERE id = $3
      RETURNING reset_password_token
    `;
    
    const result = await query(queryText, [resetToken, expiresAt, this.id]);
    return result.rows[0].reset_password_token;
  }

  // Update last login
  async updateLastLogin() {
    const queryText = `
      UPDATE users 
      SET last_login = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    
    await query(queryText, [this.id]);
  }

  // Update user profile
  async update(updateData) {
    const allowedFields = ['first_name', 'last_name', 'phone'];
    const updates = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      return this;
    }

    values.push(this.id);
    const queryText = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(queryText, values);
    return new User(result.rows[0]);
  }

  // Generate JWT token
  generateToken() {
    const payload = {
      id: this.id,
      email: this.email,
      role: this.role
    };
    
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
  }

  // Get user profile with related data
  async getProfile() {
    let profileQuery;
    
    if (this.role === 'customer') {
      profileQuery = `
        SELECT 
          u.*,
          c.date_of_birth,
          c.national_insurance_number,
          c.address_line1,
          c.address_line2,
          c.city,
          c.county,
          c.postcode,
          c.country,
          c.employment_status,
          c.is_first_time_filer,
          c.preferred_contact_method
        FROM users u
        LEFT JOIN customers c ON u.id = c.user_id
        WHERE u.id = $1
      `;
    } else if (this.role === 'accountant') {
      profileQuery = `
        SELECT 
          u.*,
          a.qualification,
          a.experience_years,
          a.specializations,
          a.bio,
          a.rating,
          a.total_reviews,
          a.is_active,
          a.hourly_rate,
          a.availability_status
        FROM users u
        LEFT JOIN accountants a ON u.id = a.user_id
        WHERE u.id = $1
      `;
    } else {
      profileQuery = 'SELECT * FROM users WHERE id = $1';
    }
    
    const result = await query(profileQuery, [this.id]);
    return result.rows[0] || null;
  }

  // Get all users (admin only)
  static async getAll(filters = {}) {
    let queryText = 'SELECT * FROM users WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (filters.role) {
      queryText += ` AND role = $${paramCount}`;
      values.push(filters.role);
      paramCount++;
    }

    if (filters.isVerified !== undefined) {
      queryText += ` AND is_verified = $${paramCount}`;
      values.push(filters.isVerified);
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
    return result.rows.map(row => new User(row));
  }

  // Delete user (soft delete by deactivating)
  async delete() {
    const queryText = `
      UPDATE users 
      SET email = CONCAT(email, '_deleted_', EXTRACT(EPOCH FROM NOW())),
          is_verified = false
      WHERE id = $1
    `;
    
    await query(queryText, [this.id]);
  }

  // Convert to JSON (exclude sensitive data)
  toJSON() {
    return {
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      phone: this.phone,
      role: this.role,
      isVerified: this.isVerified,
      lastLogin: this.lastLogin,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = User;