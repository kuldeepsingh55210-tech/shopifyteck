require('dotenv').config();
const db = require('../src/db/db');
const ragService = require('../src/services/ragService');

async function seed() {
    const shop = 'autosupport-ai-dev.myshopify.com';
    try {
        console.log(`[Seed] Checking test shop in DB...`);
        const shopResult = await db.query('SELECT id FROM shops WHERE shop_domain = $1', [shop]);
        
        if (shopResult.rows.length === 0) {
            console.log(`[Seed] Shop '${shop}' not found, inserting it...`);
            const { encryptToken } = require('../src/utils/tokenEncryption');
            const testAccessToken = 'shpat_test_token_for_dev';
            const encryptedToken = encryptToken(testAccessToken);
            await db.query(
                `INSERT INTO shops (shop_domain, access_token, is_active, created_at, updated_at) 
                 VALUES ($1, $2, true, NOW(), NOW())`,
                [shop, encryptedToken]
            );
        }

        console.log(`[Seed] Inserting RAG knowledge entries for ${shop}...`);
        
        // Remove existing entries first to avoid duplication
        await db.query('DELETE FROM merchant_knowledge_base WHERE shop_domain = $1', [shop]);

        const entries = [
            {
                category: 'General',
                question: 'What is your return policy?',
                answer: 'Please contact our support team for return policy details.'
            },
            {
                category: 'General',
                question: 'How long does shipping take?',
                answer: 'Standard shipping takes 3-7 business days.'
            },
            {
                category: 'Wrong Item',
                question: 'I received wrong item / galat item aaya',
                answer: 'We sincerely apologize! Please share your order number and a photo of the wrong item received. We will arrange an immediate replacement or full refund within 24 hours.'
            },
            {
                category: 'Cancel Order',
                question: 'How to cancel my order / order cancel karna hai',
                answer: 'Orders can be cancelled within 24 hours of placing. Please share your order number and we will process the cancellation immediately.'
            },
            {
                category: 'Discount/Coupon',
                question: 'My coupon is not working / discount code kaam nahi kar raha',
                answer: 'Please share the coupon code you are trying to use. Common issues: code expired, minimum order value not met, or already used. We will verify and help you right away.'
            },
            {
                category: 'Payment Failed',
                question: 'My payment failed / payment nahi hui',
                answer: 'Sorry for the inconvenience! Your money is safe — failed payments are automatically refunded in 5-7 business days. Please try again with a different payment method or contact your bank.'
            },
            {
                category: 'Size Query',
                question: 'Size guide / sizing help / size kaunsa loon',
                answer: 'Please check our size chart on the product page. For personalized help, share your measurements (chest, waist, height) and we will recommend the perfect size.'
            }
        ];

        for (const entry of entries) {
            const res = await ragService.addKnowledgeEntry(shop, entry.category, entry.question, entry.answer);
            if (res.success) {
                console.log(`[Seed] Added entry: [${entry.category}] - "${entry.question.substring(0, 30)}..."`);
            } else {
                console.error(`[Seed] Failed to add entry:`, res.error);
            }
        }

        console.log('[Seed] Seeding completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('[Seed] Error during seeding:', error.message);
        process.exit(1);
    }
}

seed();
