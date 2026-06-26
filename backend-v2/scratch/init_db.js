require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../src/db/db');

async function init() {
    try {
        const schemaPath = path.join(__dirname, '..', 'src', 'db', 'schema.sql');
        console.log(`[Init] Reading schema from ${schemaPath}...`);
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('[Init] Executing schema SQL on database...');
        // We split the SQL script by semicolon to execute queries or execute the whole block
        // Since schema.sql has PL/pgSQL or multiple CREATE TABLE statements, executing as a block is usually fine.
        // If "CREATE EXTENSION IF NOT EXISTS vector" fails, we'll try catching it and running the rest.
        try {
            await db.query(schemaSql);
            console.log('[Init] Database schema executed successfully!');
        } catch (dbError) {
            console.warn('[Init] Direct execution failed, attempting to run with vector extension ignored/skipped:', dbError.message);
            // If it failed because of the vector extension, let's remove vector parts and run
            let modifiedSql = schemaSql
                .replace(/CREATE EXTENSION IF NOT EXISTS vector;/gi, '-- skipped extension')
                .replace(/embedding vector\(768\),/gi, '-- skipped embedding')
                .replace(/CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx[^;]+;/gi, '-- skipped index');
            
            await db.query(modifiedSql);
            console.log('[Init] Database schema executed successfully with fallback (vector features bypassed)!');
        }
        process.exit(0);
    } catch (error) {
        console.error('[Init] Error initializing database:', error.message);
        process.exit(1);
    }
}

init();
