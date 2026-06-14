const fs = require('fs');
const path = require('path');
const db = require('./db');

const runMigration = async () => {
    try {
        const sqlPath = path.join(__dirname, 'migrations', 'add_merchants_table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('[Migration] Running migrations...');
        await db.query(sql);
        console.log('[Migration] Successfully executed add_merchants_table.sql migration.');
        process.exit(0);
    } catch (error) {
        console.error('[Migration] Failed to execute database migration:', error.message);
        process.exit(1);
    }
};

runMigration();
