const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_PATH || './uploads';
    
    // Create uploads directory if it doesn't exist
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'pdf,jpg,jpeg,png,doc,docx,xls,xlsx').split(',');
  const fileExtension = path.extname(file.originalname).toLowerCase().substring(1);
  
  if (allowedTypes.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`File type .${fileExtension} is not allowed. Allowed types: ${allowedTypes.join(', ')}`), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: 5 // Maximum 5 files per request
  },
  fileFilter: fileFilter
});

// @route   POST /api/uploads/documents/:taxReturnId
// @desc    Upload documents for a tax return
// @access  Private
router.post('/documents/:taxReturnId', authenticate, upload.array('documents', 5), async (req, res, next) => {
  try {
    const { taxReturnId } = req.params;

    // Verify tax return exists and user has access
    const taxReturnCheck = await query(`
      SELECT tr.id, tr.customer_id, tr.accountant_id 
      FROM tax_returns tr
      LEFT JOIN customers c ON tr.customer_id = c.id
      LEFT JOIN accountants a ON tr.accountant_id = a.id
      WHERE tr.id = $1
    `, [taxReturnId]);

    if (taxReturnCheck.rows.length === 0) {
      // Clean up uploaded files
      if (req.files) {
        for (const file of req.files) {
          await fs.unlink(file.path).catch(() => {});
        }
      }
      return res.status(404).json({
        success: false,
        error: 'Tax return not found'
      });
    }

    const taxReturn = taxReturnCheck.rows[0];

    // Check access permissions
    let hasAccess = false;
    if (req.user.role === 'admin') {
      hasAccess = true;
    } else if (req.user.role === 'customer') {
      const customerCheck = await query('SELECT id FROM customers WHERE user_id = $1', [req.user.id]);
      hasAccess = customerCheck.rows[0]?.id === taxReturn.customer_id;
    } else if (req.user.role === 'accountant') {
      const accountantCheck = await query('SELECT id FROM accountants WHERE user_id = $1', [req.user.id]);
      hasAccess = accountantCheck.rows[0]?.id === taxReturn.accountant_id;
    }

    if (!hasAccess) {
      // Clean up uploaded files
      if (req.files) {
        for (const file of req.files) {
          await fs.unlink(file.path).catch(() => {});
        }
      }
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    // Save document records to database
    const uploadedDocuments = [];
    
    for (const file of req.files) {
      const documentType = req.body.documentType || 'other';
      
      const queryText = `
        INSERT INTO documents (tax_return_id, uploaded_by, document_type, original_name, file_path, file_size, mime_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const values = [
        taxReturnId,
        req.user.id,
        documentType,
        file.originalname,
        file.path,
        file.size,
        file.mimetype
      ];

      const result = await query(queryText, values);
      uploadedDocuments.push(result.rows[0]);
    }

    res.status(201).json({
      success: true,
      message: `${uploadedDocuments.length} document(s) uploaded successfully`,
      data: uploadedDocuments
    });

  } catch (error) {
    // Clean up uploaded files on error
    if (req.files) {
      for (const file of req.files) {
        await fs.unlink(file.path).catch(() => {});
      }
    }
    next(error);
  }
});

// @route   GET /api/uploads/documents/:id
// @desc    Download a document
// @access  Private
router.get('/documents/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get document details
    const queryText = `
      SELECT d.*, tr.customer_id, tr.accountant_id
      FROM documents d
      JOIN tax_returns tr ON d.tax_return_id = tr.id
      WHERE d.id = $1
    `;

    const result = await query(queryText, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    const document = result.rows[0];

    // Check access permissions
    let hasAccess = false;
    if (req.user.role === 'admin') {
      hasAccess = true;
    } else if (req.user.role === 'customer') {
      const customerCheck = await query('SELECT id FROM customers WHERE user_id = $1', [req.user.id]);
      hasAccess = customerCheck.rows[0]?.id === document.customer_id;
    } else if (req.user.role === 'accountant') {
      const accountantCheck = await query('SELECT id FROM accountants WHERE user_id = $1', [req.user.id]);
      hasAccess = accountantCheck.rows[0]?.id === document.accountant_id;
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Check if file exists
    try {
      await fs.access(document.file_path);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: 'File not found on server'
      });
    }

    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${document.original_name}"`);
    res.setHeader('Content-Type', document.mime_type);

    // Send file
    res.sendFile(path.resolve(document.file_path));

  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/uploads/documents/:id
// @desc    Delete a document
// @access  Private
router.delete('/documents/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get document details
    const queryText = `
      SELECT d.*, tr.customer_id, tr.accountant_id
      FROM documents d
      JOIN tax_returns tr ON d.tax_return_id = tr.id
      WHERE d.id = $1
    `;

    const result = await query(queryText, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    const document = result.rows[0];

    // Check access permissions (only uploader, assigned accountant, or admin can delete)
    let hasAccess = false;
    if (req.user.role === 'admin' || document.uploaded_by === req.user.id) {
      hasAccess = true;
    } else if (req.user.role === 'accountant') {
      const accountantCheck = await query('SELECT id FROM accountants WHERE user_id = $1', [req.user.id]);
      hasAccess = accountantCheck.rows[0]?.id === document.accountant_id;
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Delete file from filesystem
    try {
      await fs.unlink(document.file_path);
    } catch (error) {
      console.error('Error deleting file:', error);
      // Continue with database deletion even if file deletion fails
    }

    // Delete document record from database
    await query('DELETE FROM documents WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    next(error);
  }
});

// @route   GET /api/uploads/documents
// @desc    Get documents for a tax return
// @access  Private
router.get('/documents', authenticate, async (req, res, next) => {
  try {
    const { taxReturnId } = req.query;

    if (!taxReturnId) {
      return res.status(400).json({
        success: false,
        error: 'Tax return ID is required'
      });
    }

    // Verify access to tax return
    const accessCheck = await query(`
      SELECT tr.id, tr.customer_id, tr.accountant_id
      FROM tax_returns tr
      WHERE tr.id = $1
    `, [taxReturnId]);

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tax return not found'
      });
    }

    const taxReturn = accessCheck.rows[0];

    // Check access permissions
    let hasAccess = false;
    if (req.user.role === 'admin') {
      hasAccess = true;
    } else if (req.user.role === 'customer') {
      const customerCheck = await query('SELECT id FROM customers WHERE user_id = $1', [req.user.id]);
      hasAccess = customerCheck.rows[0]?.id === taxReturn.customer_id;
    } else if (req.user.role === 'accountant') {
      const accountantCheck = await query('SELECT id FROM accountants WHERE user_id = $1', [req.user.id]);
      hasAccess = accountantCheck.rows[0]?.id === taxReturn.accountant_id;
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get documents
    const documentsQuery = `
      SELECT 
        d.id,
        d.document_type,
        d.original_name,
        d.file_size,
        d.mime_type,
        d.is_processed,
        d.created_at,
        CONCAT(u.first_name, ' ', u.last_name) as uploaded_by_name
      FROM documents d
      JOIN users u ON d.uploaded_by = u.id
      WHERE d.tax_return_id = $1
      ORDER BY d.created_at DESC
    `;

    const documentsResult = await query(documentsQuery, [taxReturnId]);

    res.json({
      success: true,
      data: documentsResult.rows
    });

  } catch (error) {
    next(error);
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 10MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files. Maximum is 5 files per upload.'
      });
    }
  }
  next(error);
});

module.exports = router;