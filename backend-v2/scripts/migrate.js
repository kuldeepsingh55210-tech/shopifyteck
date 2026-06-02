require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../src/db/db');

const runMigrations = async () => {
    try {
        console.log('📦 Running database migrations...\n');

        // Read schema file
        const schemaPath = path.join(__dirname, '../src/db/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf-8');

        // Split by semicolon and execute each statement
        const statements = schema.split(';').filter(s => s.trim());

        for (const statement of statements) {
            if (statement.trim()) {
                console.log(`Executing: ${statement.substring(0, 50)}...`);
                await db.query(statement);
            }
        }

        console.log('\n✅ Database migrations completed successfully!\n');

        // Show table info
        const tables = await db.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);

        console.log('📋 Created tables:');
        tables.rows.forEach(row => console.log(`   - ${row.table_name}`));

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
};

runMigrations();
