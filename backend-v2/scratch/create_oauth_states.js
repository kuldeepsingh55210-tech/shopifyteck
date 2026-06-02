require('dotenv').config();
const db = require('../src/db/db');

const run = async () => {
    try {
        console.log('Creating oauth_states table directly...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS oauth_states (
                id SERIAL PRIMARY KEY,
                shop_domain VARCHAR(255) UNIQUE NOT NULL,
                state VARCHAR(64) NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✅ oauth_states table successfully created!');
        process.exit(0);
    } catch (e) {
        console.error('❌ Failed to create table:', e.message);
        process.exit(1);
    }
};

run();
