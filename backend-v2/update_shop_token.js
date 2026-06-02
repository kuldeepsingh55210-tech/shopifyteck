require('dotenv').config();
const db = require('./src/db/db');
const { encryptToken } = require('./src/utils/tokenEncryption');

async function updateShopToken(realAccessToken) {
    try {
        const encryptedToken = encryptToken(realAccessToken);
        
        const result = await db.query(
            `UPDATE shops SET access_token = $1, updated_at = NOW() 
             WHERE shop_domain = $2 
             RETURNING id, shop_domain`,
            [encryptedToken, 'autosupport-ai-dev.myshopify.com']
        );
        
        if (result.rows.length === 0) {
            console.log('Shop not found');
            process.exit(1);
        }
        
        console.log('Shop token updated successfully:');
        console.log(result.rows[0]);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

const token = process.argv[2];
if (!token) {
    console.error('Usage: node update_shop_token.js <actual_shopify_access_token>');
    process.exit(1);
}

updateShopToken(token);
