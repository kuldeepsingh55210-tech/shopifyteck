const fs = require('fs');
const path = require('path');
const db = require('./db');

const runMigration = async () => {
    try {
        const migrationFile = process.argv[2] || '003_add_confidence_score_to_reasoning_logs.sql';
        const sqlPath = path.join(__dirname, 'migrations', migrationFile);
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log(`[Migration] Running migration from ${migrationFile}...`);
        await db.query(sql);
        console.log(`[Migration] Successfully executed ${migrationFile} migration.`);
        process.exit(0);
    } catch (error) {
        console.error('[Migration] Failed to execute database migration:', error.message);
        process.exit(1);
    }
};

runMigration();
