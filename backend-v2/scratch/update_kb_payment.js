require('dotenv').config();
const db = require('../src/db/db');

async function update() {
    try {
        console.log('[Update] Running update query for payment failed KB entry...');
        const result = await db.query(
            `UPDATE merchant_knowledge_base 
             SET answer = $1
             WHERE shop_domain = $2
             AND category = $3`,
            [
                "Don't worry, your money is completely safe! If any amount was deducted, it will be automatically refunded within 5-7 business days. Please try paying again with a different method (UPI, Net Banking, or another card). If the issue persists, please share your order number and we will resolve it immediately.",
                'autosupport-ai-dev.myshopify.com',
                'Payment'
            ]
        );

        console.log(`[Update] Rows affected: ${result.rowCount}`);

        console.log('[Update] Verification: Fetching updated entry...');
        const check = await db.query(
            `SELECT id, category, question, answer, is_active 
             FROM merchant_knowledge_base 
             WHERE shop_domain = $1 AND category = $2`,
            ['autosupport-ai-dev.myshopify.com', 'Payment']
        );
        console.table(check.rows);

        process.exit(0);
    } catch (e) {
        console.error('[Update] Error occurred:', e.message);
        process.exit(1);
    }
}

update();
