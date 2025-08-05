const { testConnection, query, closePool } = require('../config/database');
const User = require('../models/User');

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Test database connection
    await testConnection();
    
    // Create admin user
    console.log('👤 Creating admin user...');
    const adminUser = await User.create({
      email: 'admin@taxpro.com',
      password: 'Admin123!',
      firstName: 'Admin',
      lastName: 'User',
      phone: '+44 20 1234 5678',
      role: 'admin'
    });
    
    // Verify admin user email
    await adminUser.verifyEmail();
    console.log('✅ Admin user created and verified');
    
    // Create sample accountant
    console.log('🧮 Creating sample accountant...');
    const accountantUser = await User.create({
      email: 'accountant@taxpro.com',
      password: 'Accountant123!',
      firstName: 'Sarah',
      lastName: 'Johnson',
      phone: '+44 20 1234 5679',
      role: 'accountant'
    });
    
    await accountantUser.verifyEmail();
    
    // Create accountant profile
    await query(`
      INSERT INTO accountants (user_id, qualification, experience_years, specializations, bio, rating, total_reviews, hourly_rate)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      accountantUser.id,
      'ACCA Qualified',
      15,
      ['Self Assessment', 'Corporation Tax', 'VAT'],
      'Experienced tax professional with 15+ years helping individuals and businesses with their tax obligations.',
      4.8,
      127,
      75.00
    ]);
    
    console.log('✅ Sample accountant created');
    
    // Create sample customer
    console.log('👥 Creating sample customer...');
    const customerUser = await User.create({
      email: 'customer@taxpro.com',
      password: 'Customer123!',
      firstName: 'John',
      lastName: 'Smith',
      phone: '+44 20 1234 5680',
      role: 'customer'
    });
    
    await customerUser.verifyEmail();
    
    // Create customer profile
    const customerResult = await query(`
      INSERT INTO customers (user_id, employment_status, is_first_time_filer, preferred_contact_method)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [
      customerUser.id,
      'self-employed',
      false,
      'email'
    ]);
    
    const customerId = customerResult.rows[0].id;
    console.log('✅ Sample customer created');
    
    // Create sample tax return
    console.log('📊 Creating sample tax return...');
    const accountantResult = await query('SELECT id FROM accountants WHERE user_id = $1', [accountantUser.id]);
    const accountantId = accountantResult.rows[0].id;
    
    await query(`
      INSERT INTO tax_returns (customer_id, accountant_id, tax_year, status, situation_type, submission_deadline, price, payment_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      customerId,
      accountantId,
      '2023-24',
      'in_progress',
      'self-employed',
      '2024-01-31',
      169.00,
      'paid'
    ]);
    
    console.log('✅ Sample tax return created');
    
    // Create sample contact inquiry
    console.log('📧 Creating sample contact inquiry...');
    await query(`
      INSERT INTO contact_inquiries (first_name, last_name, email, phone, subject, message, inquiry_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      'Jane',
      'Doe',
      'jane.doe@example.com',
      '+44 20 1234 5681',
      'Question about tax return process',
      'Hi, I would like to know more about how your tax return service works. I am self-employed and this would be my first time using a professional service.',
      'general'
    ]);
    
    console.log('✅ Sample contact inquiry created');
    
    // Update system settings with sample data
    console.log('⚙️ Updating system settings...');
    await query(`
      UPDATE system_settings 
      SET setting_value = $1 
      WHERE setting_key = 'tax_year_deadline'
    `, ['2024-01-31']);
    
    console.log('✅ System settings updated');
    
    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📋 Sample accounts created:');
    console.log('👑 Admin: admin@taxpro.com / Admin123!');
    console.log('🧮 Accountant: accountant@taxpro.com / Accountant123!');
    console.log('👤 Customer: customer@taxpro.com / Customer123!');
    console.log('\n🔐 All accounts are email verified and ready to use.');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;