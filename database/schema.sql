-- TaxPro Database Schema
-- PostgreSQL Database Schema for Tax Services Platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (customers and accountants)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'accountant', 'admin')),
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Accountants profile table (additional info for accountants)
CREATE TABLE accountants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    qualification VARCHAR(100),
    experience_years INTEGER,
    specializations TEXT[],
    bio TEXT,
    rating DECIMAL(3,2) DEFAULT 0.00,
    total_reviews INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    hourly_rate DECIMAL(10,2),
    availability_status VARCHAR(20) DEFAULT 'available' CHECK (availability_status IN ('available', 'busy', 'offline')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer profiles table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date_of_birth DATE,
    national_insurance_number VARCHAR(20),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    county VARCHAR(100),
    postcode VARCHAR(20),
    country VARCHAR(100) DEFAULT 'United Kingdom',
    employment_status VARCHAR(50),
    is_first_time_filer BOOLEAN DEFAULT FALSE,
    preferred_contact_method VARCHAR(20) DEFAULT 'email' CHECK (preferred_contact_method IN ('email', 'phone', 'sms')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tax returns table
CREATE TABLE tax_returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    accountant_id UUID REFERENCES accountants(id),
    tax_year VARCHAR(10) NOT NULL, -- e.g., '2023-24'
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'review', 'completed', 'filed', 'cancelled')),
    situation_type VARCHAR(50), -- self-employed, landlord, investor, etc.
    total_income DECIMAL(12,2),
    total_tax_due DECIMAL(12,2),
    total_refund DECIMAL(12,2),
    submission_deadline DATE,
    filed_date TIMESTAMP,
    hmrc_reference VARCHAR(100),
    notes TEXT,
    price DECIMAL(10,2) DEFAULT 169.00,
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'failed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Income sources table
CREATE TABLE income_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_return_id UUID REFERENCES tax_returns(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL, -- employment, self_employment, rental, dividends, etc.
    employer_name VARCHAR(255),
    gross_income DECIMAL(12,2) NOT NULL,
    tax_deducted DECIMAL(12,2) DEFAULT 0.00,
    ni_contributions DECIMAL(12,2) DEFAULT 0.00,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expenses table
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_return_id UUID REFERENCES tax_returns(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL, -- office_costs, travel, professional_fees, etc.
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    expense_date DATE NOT NULL,
    receipt_url VARCHAR(500),
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Documents table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_return_id UUID REFERENCES tax_returns(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES users(id),
    document_type VARCHAR(50) NOT NULL, -- p60, p45, bank_statement, receipt, etc.
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    is_processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages/Communications table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_return_id UUID REFERENCES tax_returns(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id),
    recipient_id UUID REFERENCES users(id),
    subject VARCHAR(255),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    message_type VARCHAR(20) DEFAULT 'general' CHECK (message_type IN ('general', 'query', 'update', 'system')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_return_id UUID REFERENCES tax_returns(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'GBP',
    payment_method VARCHAR(50), -- card, bank_transfer, paypal, etc.
    payment_status VARCHAR(20) NOT NULL CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    stripe_payment_intent_id VARCHAR(255),
    transaction_id VARCHAR(255),
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reviews table
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id),
    accountant_id UUID REFERENCES accountants(id),
    tax_return_id UUID REFERENCES tax_returns(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contact inquiries table
CREATE TABLE contact_inquiries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    inquiry_type VARCHAR(50) DEFAULT 'general',
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
    assigned_to UUID REFERENCES users(id),
    responded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) DEFAULT 'info' CHECK (notification_type IN ('info', 'success', 'warning', 'error')),
    is_read BOOLEAN DEFAULT FALSE,
    action_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit log table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System settings table
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_tax_returns_customer_id ON tax_returns(customer_id);
CREATE INDEX idx_tax_returns_accountant_id ON tax_returns(accountant_id);
CREATE INDEX idx_tax_returns_status ON tax_returns(status);
CREATE INDEX idx_tax_returns_tax_year ON tax_returns(tax_year);
CREATE INDEX idx_messages_tax_return_id ON messages(tax_return_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX idx_documents_tax_return_id ON documents(tax_return_id);
CREATE INDEX idx_payments_customer_id ON payments(customer_id);
CREATE INDEX idx_payments_status ON payments(payment_status);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_accountants_updated_at BEFORE UPDATE ON accountants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tax_returns_updated_at BEFORE UPDATE ON tax_returns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, description, is_public) VALUES
('site_name', 'TaxPro', 'Website name', true),
('default_tax_return_price', '169.00', 'Default price for tax returns in GBP', false),
('max_file_upload_size', '10485760', 'Maximum file upload size in bytes (10MB)', false),
('allowed_file_types', 'pdf,jpg,jpeg,png,doc,docx,xls,xlsx', 'Allowed file types for uploads', false),
('tax_year_deadline', '2024-01-31', 'Self Assessment deadline', true),
('support_email', 'support@taxpro.com', 'Support email address', true),
('support_phone', '+44 20 1234 5678', 'Support phone number', true);

-- Create a view for tax return summary
CREATE VIEW tax_return_summary AS
SELECT 
    tr.id,
    tr.tax_year,
    tr.status,
    tr.created_at,
    tr.updated_at,
    CONCAT(c_user.first_name, ' ', c_user.last_name) as customer_name,
    c_user.email as customer_email,
    CONCAT(a_user.first_name, ' ', a_user.last_name) as accountant_name,
    tr.total_income,
    tr.total_tax_due,
    tr.price,
    tr.payment_status
FROM tax_returns tr
JOIN customers c ON tr.customer_id = c.id
JOIN users c_user ON c.user_id = c_user.id
LEFT JOIN accountants a ON tr.accountant_id = a.id
LEFT JOIN users a_user ON a.user_id = a_user.id;