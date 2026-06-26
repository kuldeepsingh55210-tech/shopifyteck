require('dotenv').config();
const db = require('../src/db/db');

const entries = [
    {
        category: 'Returns & Refunds',
        question: 'What is your return policy?',
        answer: 'We accept returns within 30 days of purchase. Items must be unused and in original packaging. Please share your order number to initiate a return.'
    },
    {
        category: 'Shipping',
        question: 'How long does shipping take?',
        answer: 'Standard shipping takes 5-7 business days. Express shipping takes 2-3 business days. Free shipping on orders above $50.'
    },
    {
        category: 'Returns & Refunds',
        question: 'How do I get a refund?',
        answer: 'Refunds are processed within 5-7 business days after we receive the returned item. Amount will be credited back to your original payment method.'
    },
    {
        category: 'Wrong Item',
        question: 'I received a wrong item',
        answer: 'We sincerely apologize! Please share your order number and a photo of the wrong item. We will arrange an immediate replacement or full refund within 24 hours.'
    },
    {
        category: 'Order Cancellation',
        question: 'How do I cancel my order?',
        answer: 'Orders can be cancelled within 24 hours of placing. Please share your order number and we will process the cancellation immediately. After 24 hours, orders cannot be cancelled.'
    },
    {
        category: 'Discount & Coupons',
        question: 'My coupon code is not working',
        answer: 'Common reasons: code expired, minimum order value not met, or already used once. Please share the coupon code and we will verify it.'
    },
    {
        category: 'Payment',
        question: 'My payment failed',
        answer: 'Your money is safe - failed payments are automatically refunded in 5-7 business days. Please try a different payment method or contact your bank.'
    },
    {
        category: 'Size & Fit',
        question: 'How do I find the right size?',
        answer: 'Please check the size chart on the product page. For personalized help, share your measurements (chest, waist, height) and the product name.'
    },
    {
        category: 'Tracking',
        question: 'How do I track my order?',
        answer: 'Once your order ships, you will receive a tracking email with your tracking number. You can also share your order number here and we will check the status for you.'
    },
    {
        category: 'General',
        question: 'What payment methods do you accept?',
        answer: 'We accept all major credit/debit cards, UPI, Net Banking, and Cash on Delivery for eligible orders.'
    }
];

async function cleanup() {
    const shop = 'autosupport-ai-dev.myshopify.com';
    try {
        console.log(`[Cleanup] Deleting existing RAG knowledge entries for ${shop}...`);
        await db.query('DELETE FROM merchant_knowledge_base WHERE shop_domain = $1', [shop]);

        console.log(`[Cleanup] Inserting 10 clean entries...`);
        for (const entry of entries) {
            await db.query(
                `INSERT INTO merchant_knowledge_base (shop_domain, category, question, answer, is_active) 
                 VALUES ($1, $2, $3, $4, true)`,
                [shop, entry.category, entry.question, entry.answer]
            );
        }

        console.log(`[Cleanup] Verification: Fetching inserted entries for ${shop}...`);
        const result = await db.query(
            `SELECT id, category, question, is_active 
             FROM merchant_knowledge_base 
             WHERE shop_domain = $1 
             ORDER BY id`,
            [shop]
        );

        console.log(`\nVerification Query Results (Total: ${result.rows.length}):`);
        console.table(result.rows);

        if (result.rows.length === 10) {
            console.log('[Cleanup] SUCCESS: All 10 entries inserted successfully.');
        } else {
            console.error(`[Cleanup] ERROR: Expected 10 entries, but found ${result.rows.length}.`);
        }

        process.exit(0);
    } catch (error) {
        console.error('[Cleanup] Exception occurred:', error.message);
        process.exit(1);
    }
}

cleanup();
