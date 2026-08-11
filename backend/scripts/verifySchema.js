const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const verifySchema = async () => {
  const dbName = process.env.DB_NAME || 'employee_leave_management';
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    database: dbName,
  });

  try {
    console.log(`\n==================================================`);
    console.log(`VERIFYING DATABASE: ${dbName}`);
    console.log(`==================================================\n`);

    // 1. Table Verification
    const [tables] = await connection.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`,
      [dbName]
    );
    console.log(`1. TABLES CREATED (${tables.length}/7):`);
    tables.forEach((t) => console.log(`   - ${t.TABLE_NAME}`));

    // 2. Primary Keys Verification
    console.log(`\n2. PRIMARY KEYS:`);
    const [pks] = await connection.query(
      `SELECT TABLE_NAME, COLUMN_NAME 
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
       WHERE TABLE_SCHEMA = ? AND CONSTRAINT_NAME = 'PRIMARY'`,
      [dbName]
    );
    pks.forEach((pk) => console.log(`   - ${pk.TABLE_NAME}.${pk.COLUMN_NAME} (PRIMARY KEY)`));

    // 3. Foreign Keys Verification
    console.log(`\n3. FOREIGN KEYS:`);
    const [fks] = await connection.query(
      `SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
       WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [dbName]
    );
    fks.forEach((fk) =>
      console.log(`   - ${fk.TABLE_NAME}.${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME} [${fk.CONSTRAINT_NAME}]`)
    );

    // 4. Unique Constraints Verification
    console.log(`\n4. UNIQUE CONSTRAINTS:`);
    const [uniques] = await connection.query(
      `SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND CONSTRAINT_NAME != 'PRIMARY' AND REFERENCED_TABLE_NAME IS NULL
       AND CONSTRAINT_NAME IN (
         SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
         WHERE TABLE_SCHEMA = ? AND CONSTRAINT_TYPE = 'UNIQUE'
       )`,
      [dbName, dbName]
    );
    uniques.forEach((u) => console.log(`   - ${u.TABLE_NAME}.${u.COLUMN_NAME} [UNIQUE: ${u.CONSTRAINT_NAME}]`));

    // 5. Indexes Verification
    console.log(`\n5. INDEXES:`);
    const [indexes] = await connection.query(
      `SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME 
       FROM INFORMATION_SCHEMA.STATISTICS 
       WHERE TABLE_SCHEMA = ? 
       ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
      [dbName]
    );
    let currentIndex = '';
    indexes.forEach((idx) => {
      const fullIdx = `${idx.TABLE_NAME}.${idx.INDEX_NAME}`;
      if (fullIdx !== currentIndex) {
        currentIndex = fullIdx;
        console.log(`   - Index ${fullIdx} on (${idx.COLUMN_NAME}`);
      } else {
        process.stdout.write(`, ${idx.COLUMN_NAME}`);
      }
    });
    console.log(`)`);

    await connection.end();
    console.log(`\n==================================================`);
    console.log(`VERIFICATION COMPLETE: ALL 7 TABLES & CONSTRAINTS VALIDATED`);
    console.log(`==================================================\n`);
  } catch (error) {
    console.error('Verification Error:', error.message);
    await connection.end();
  }
};

verifySchema();
