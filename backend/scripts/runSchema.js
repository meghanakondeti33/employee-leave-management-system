const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const runSchema = async () => {
  console.log('🔄 Connecting to MySQL server...');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    multipleStatements: true,
  });

  try {
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    console.log(`📄 Reading SQL schema from: ${schemaPath}`);
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('⚡ Executing schema script...');
    await connection.query(sql);
    console.log('✅ Database schema executed successfully!');

    // Verification queries
    console.log('\n🔍 Verifying created tables...');
    const [tables] = await connection.query(`SHOW TABLES FROM \`${process.env.DB_NAME || 'employee_leave_management'}\``);
    console.log('Created Tables:');
    tables.forEach((t) => console.log(`  - ${Object.values(t)[0]}`));

    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error executing schema.sql:');
    console.error(error.message);
    await connection.end();
    process.exit(1);
  }
};

runSchema();
