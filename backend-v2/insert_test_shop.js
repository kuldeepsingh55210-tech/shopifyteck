require('dotenv').config();
const db = require('./src/db/db');
const { encryptToken } = require('./src/utils/tokenEncryption');

async function insertShop() {
    try {
        // For testing, we'll use a placeholder access token
        // In production, this would come from the Shopify OAuth flow
        const testAccessToken = 'shpat_test_token_for_dev';
        const encryptedToken = encryptToken(testAccessToken);
        
        const result = await db.query(
            `INSERT INTO shops (shop_domain, access_token, is_active, created_at, updated_at) 
             VALUES ($1, $2, $3, NOW(), NOW()) 
             RETURNING id, shop_domain, is_active`,
            ['autosupport-ai-dev.myshopify.com', encryptedToken, true]
        );
        
        console.log('Shop inserted successfully:');
        console.log(result.rows[0]);
        console.log(`\nUse shop_id: ${result.rows[0].id}`);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

insertShop();
