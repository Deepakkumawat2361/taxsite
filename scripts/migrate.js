const fs = require('fs').promises;
const path = require('path');
const { testConnection, query, closePool } = require('../config/database');

async function runMigration() {
  try {
    console.log('🔄 Starting database migration...');
    
    // Test database connection
    await testConnection();
    
    // Read and execute schema file
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schemaSQL = await fs.readFile(schemaPath, 'utf8');
    
    console.log('📝 Executing database schema...');
    await query(schemaSQL);
    
    console.log('✅ Database migration completed successfully!');
    console.log('📊 Database schema has been created with all tables, indexes, and triggers.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  runMigration();
}

module.exports = runMigration;