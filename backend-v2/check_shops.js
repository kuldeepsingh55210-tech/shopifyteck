require('dotenv').config();
const db = require('./src/db/db');

async function checkShops() {
    try {
        const result = await db.query('SELECT id, shop_domain, is_active FROM shops');
        console.log('Shops in database:');
        console.log(result.rows);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkShops();
