const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to authenticate JWT tokens
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from database to ensure they still exist and are active
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Access denied. User not found.'
        });
      }

      if (!user.isVerified) {
        return res.status(401).json({
          success: false,
          error: 'Access denied. Please verify your email address.'
        });
      }

      // Add user info to request object
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      };

      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Access denied. Token expired.'
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Access denied. Invalid token.'
        });
      } else {
        throw jwtError;
      }
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during authentication.'
    });
  }
};

// Middleware to check if user has required role
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

// Middleware for optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      
      if (user && user.isVerified) {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName
        };
      }
    } catch (jwtError) {
      // Ignore JWT errors for optional auth
    }

    next();
  } catch (error) {
    console.error('Optional authentication error:', error);
    next(); // Continue even if there's an error
  }
};

// Middleware to check if user owns the resource or is admin
const checkOwnership = (getResourceOwnerId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required.'
        });
      }

      // Admins can access everything
      if (req.user.role === 'admin') {
        return next();
      }

      const resourceOwnerId = await getResourceOwnerId(req);
      
      if (!resourceOwnerId) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found.'
        });
      }

      if (req.user.id !== resourceOwnerId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only access your own resources.'
        });
      }

      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error during authorization.'
      });
    }
  };
};

// Middleware to log user actions for audit trail
const auditLog = (action) => {
  return async (req, res, next) => {
    try {
      // Store audit info in request for later use
      req.auditInfo = {
        action,
        userId: req.user ? req.user.id : null,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date()
      };
      
      next();
    } catch (error) {
      console.error('Audit log error:', error);
      next(); // Don't block the request for audit logging errors
    }
  };
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth,
  checkOwnership,
  auditLog
};