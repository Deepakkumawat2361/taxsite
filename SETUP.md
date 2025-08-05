# TaxPro Setup Guide

This guide will help you set up the complete TaxPro tax services platform with backend API and frontend interface.

## 📋 Prerequisites

Before starting, ensure you have the following installed:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **PostgreSQL** (v12 or higher) - [Download here](https://www.postgresql.org/download/)
- **Git** - [Download here](https://git-scm.com/downloads)

## 🗄️ Database Setup

### 1. Install PostgreSQL
Follow the installation instructions for your operating system from the PostgreSQL website.

### 2. Create Database and User
Connect to PostgreSQL as a superuser and run:

```sql
-- Create database
CREATE DATABASE taxpro_db;

-- Create user
CREATE USER taxpro_user WITH PASSWORD 'your_secure_password_here';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE taxpro_db TO taxpro_user;

-- Connect to the database
\c taxpro_db;

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO taxpro_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO taxpro_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO taxpro_user;
```

## 🚀 Backend Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit the `.env` file with your settings:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taxpro_db
DB_USER=taxpro_user
DB_PASSWORD=your_secure_password_here

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-random-32-chars-min
JWT_EXPIRES_IN=7d

# Email Configuration (optional for development)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@taxpro.com
FROM_NAME=TaxPro Support

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3001
```

### 3. Database Migration
Run the database migration to create all tables:

```bash
npm run migrate
```

### 4. Seed Database (Optional)
Populate the database with sample data:

```bash
npm run seed
```

This creates the following test accounts:
- **Admin**: admin@taxpro.com / Admin123!
- **Accountant**: accountant@taxpro.com / Accountant123!
- **Customer**: customer@taxpro.com / Customer123!

### 5. Start the Backend Server
```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

The API will be available at `http://localhost:3000`

## 🌐 Frontend Setup

The frontend is built with vanilla HTML, CSS, and JavaScript and can be served in multiple ways:

### Option 1: Simple HTTP Server (Recommended for Development)

Using Python (if installed):
```bash
# Python 3
python -m http.server 3001

# Python 2
python -M SimpleHTTPServer 3001
```

Using Node.js:
```bash
# Install http-server globally
npm install -g http-server

# Serve the frontend
http-server -p 3001 -c-1
```

### Option 2: Live Server (VS Code Extension)
1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"

### Option 3: Production Deployment
For production, serve the static files through a web server like Nginx or Apache, or use the Express server to serve static files.

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/me` - Get current user profile

### Tax Returns
- `GET /api/tax-returns` - Get user's tax returns
- `POST /api/tax-returns` - Create new tax return
- `GET /api/tax-returns/:id` - Get tax return details
- `PUT /api/tax-returns/:id/status` - Update tax return status
- `POST /api/tax-returns/:id/income` - Add income source

### Contact
- `POST /api/contact` - Submit contact form
- `GET /api/contact/inquiries` - Get all inquiries (admin)
- `PUT /api/contact/inquiries/:id/status` - Update inquiry status

### File Uploads
- `POST /api/uploads/documents/:taxReturnId` - Upload documents
- `GET /api/uploads/documents/:id` - Download document
- `DELETE /api/uploads/documents/:id` - Delete document

### Admin
- `GET /api/admin/dashboard` - Admin dashboard stats
- `GET /api/admin/users` - Get all users
- `GET /api/admin/tax-returns` - Get all tax returns
- `GET /api/admin/analytics/revenue` - Revenue analytics

## 🧪 Testing the Setup

### 1. Test Backend API
```bash
# Health check
curl http://localhost:3000/health

# Test registration
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "firstName": "Test",
    "lastName": "User",
    "phone": "+44 20 1234 5678"
  }'
```

### 2. Test Frontend
1. Open `http://localhost:3001` in your browser
2. Click "Get Started" to test user registration
3. Try the contact form
4. Test the login functionality

## 📁 Project Structure

```
taxpro/
├── config/
│   └── database.js          # Database configuration
├── database/
│   └── schema.sql           # Database schema
├── middleware/
│   ├── auth.js              # Authentication middleware
│   ├── errorHandler.js      # Error handling
│   └── notFound.js          # 404 handler
├── models/
│   ├── User.js              # User model
│   └── TaxReturn.js         # Tax return model
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── users.js             # User management routes
│   ├── taxReturns.js        # Tax return routes
│   ├── contact.js           # Contact form routes
│   ├── uploads.js           # File upload routes
│   └── admin.js             # Admin routes
├── scripts/
│   ├── migrate.js           # Database migration
│   └── seed.js              # Database seeding
├── uploads/                 # File upload directory
├── index.html               # Main homepage
├── about.html               # About page
├── contact.html             # Contact page
├── styles.css               # Main stylesheet
├── script.js                # Frontend JavaScript
├── server.js                # Express server
├── package.json             # Dependencies
├── .env.example             # Environment template
└── README.md                # Project documentation
```

## 🔒 Security Considerations

### For Development
- Use strong JWT secrets
- Enable CORS only for trusted domains
- Validate all input data
- Use HTTPS in production

### For Production
- Set `NODE_ENV=production`
- Use environment variables for secrets
- Enable rate limiting
- Set up proper logging
- Use a reverse proxy (Nginx)
- Enable SSL/TLS certificates

## 🚀 Deployment

### Backend Deployment (Heroku Example)
```bash
# Install Heroku CLI and login
heroku login

# Create app
heroku create taxpro-api

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:hobby-dev

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-production-jwt-secret

# Deploy
git push heroku main

# Run migrations
heroku run npm run migrate
```

### Frontend Deployment (Netlify/Vercel)
1. Update API_BASE_URL in script.js to your production API URL
2. Deploy static files to your hosting service
3. Configure redirects for SPA routing if needed

## 🐛 Troubleshooting

### Common Issues

**Database Connection Error**
- Check PostgreSQL is running
- Verify database credentials in `.env`
- Ensure database and user exist

**CORS Errors**
- Check FRONTEND_URL in `.env` matches your frontend URL
- Verify corsOptions in server.js

**File Upload Issues**
- Check uploads directory exists and is writable
- Verify file size limits
- Check allowed file types

**JWT Token Issues**
- Ensure JWT_SECRET is set and consistent
- Check token expiration settings
- Verify token is being sent in Authorization header

### Logs and Debugging
- Check server logs for error details
- Use browser developer tools for frontend debugging
- Enable debug logging by setting LOG_LEVEL=debug

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review server logs for error details
3. Ensure all prerequisites are properly installed
4. Verify environment configuration

## 🎉 Success!

If everything is set up correctly, you should have:
- ✅ Backend API running on http://localhost:3000
- ✅ Frontend website running on http://localhost:3001
- ✅ Database with all tables created
- ✅ Sample data loaded (if you ran the seed script)
- ✅ All API endpoints functional
- ✅ Frontend forms connected to backend

You can now start using the TaxPro platform!