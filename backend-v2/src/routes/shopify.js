const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db/db');
const validateShopifyHmac = require('../middleware/validateShopifyHmac');
const axios = require('axios');
const { encryptToken } = require('../utils/tokenEncryption');
const { registerWebhooks } = require('../controllers/webhookController');
const ragService = require('../services/ragService');

// Step 1: Auth redirect
router.get('/auth', async (req, res) => {
    const { shop } = req.query;
    if (!shop) return res.status(400).json({ error: 'Shop parameter required' });

    // Validate shop domain format
    if (!shop.match(/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/)) {
        return res.status(400).json({ error: 'Invalid shop domain. Must be a valid myshopify.com domain.' });
    }

    // Generate state for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');

    // Save state to DB with expiry
    await db.query(
        `INSERT INTO oauth_states (shop_domain, state, expires_at) 
         VALUES ($1, $2, NOW() + INTERVAL '10 minutes')
         ON CONFLICT (shop_domain) DO UPDATE SET state = $2, expires_at = NOW() + INTERVAL '10 minutes'`,
        [shop, state]
    );

    const redirectUri = `${process.env.APP_URL}/shopify/callback`;
    const scopes = 'read_orders,read_fulfillments,write_orders,write_price_rules,read_price_rules,write_discounts,read_discounts';
    const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;

    res.redirect(authUrl);
});

// Step 2: OAuth callback
router.get('/callback', async (req, res) => {
    const { shop, code, hmac, state } = req.query;

    // Validate shop domain format
    if (!shop || !shop.match(/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/)) {
        return res.status(400).json({ error: 'Invalid shop domain' });
    }

    // Validate HMAC
    if (!validateShopifyHmac(req.query)) {
        return res.status(403).json({ error: 'Invalid HMAC' });
    }

    // Validate state (CSRF protection)
    const stateResult = await db.query(
        `SELECT state FROM oauth_states 
         WHERE shop_domain = $1 AND state = $2 AND expires_at > NOW()`,
        [shop, state]
    );

    if (stateResult.rows.length === 0) {
        return res.status(403).json({ error: 'Invalid or expired state parameter' });
    }

    // Delete used state
    await db.query('DELETE FROM oauth_states WHERE shop_domain = $1', [shop]);

    // Exchange code for access token
    let accessToken;
    try {
        const tokenResponse = await axios.post(`https://${shop}/admin/oauth/access_token`, {
            client_id: process.env.SHOPIFY_API_KEY,
            client_secret: process.env.SHOPIFY_API_SECRET,
            code
        });

        if (!tokenResponse.data?.access_token) {
            console.error('[OAuth] Token exchange returned empty token');
            return res.status(500).json({ error: 'Failed to obtain access token from Shopify' });
        }

        accessToken = tokenResponse.data.access_token;
    } catch (tokenError) {
        console.error('[OAuth] Token exchange failed:', tokenError.message);
        return res.status(500).json({ error: 'OAuth token exchange failed. Please try installing again.' });
    }
    const encryptedToken = encryptToken(accessToken);

    // Insert or update shop
    await db.query(
        `INSERT INTO shops (shop_domain, access_token, is_active)
         VALUES ($1, $2, true)
         ON CONFLICT (shop_domain)
         DO UPDATE SET access_token = $2, is_active = true, updated_at = NOW()`,
        [shop, encryptedToken]
    );

    // Get the shop_id for the redirect
    const shopResult = await db.query(
        'SELECT id FROM shops WHERE shop_domain = $1',
        [shop]
    );

    const shopId = shopResult.rows[0]?.id;
    console.log(`[Shopify OAuth] Shop installed: ${shop} (ID: ${shopId})`);

    try {
        const existing = await db.query('SELECT id FROM merchant_knowledge_base WHERE shop_domain = $1 LIMIT 1', [shop]);
        if (existing.rows.length === 0) {
            await ragService.addKnowledgeEntry(
                shop,
                'General',
                'What is your return policy?',
                'Please contact our support team for return policy details.'
            );
            await ragService.addKnowledgeEntry(
                shop,
                'General',
                'How long does shipping take?',
                'Standard shipping takes 3-7 business days.'
            );
        }
    } catch (error) {
        console.warn('[Shopify] Failed to seed default knowledge entries:', error?.message || error);
    }

    try {
        const existingCanned = await db.query('SELECT id FROM canned_responses WHERE shop_domain = $1 LIMIT 1', [shop]);
        if (existingCanned.rows.length === 0) {
            const defaultResponses = [
                {
                    title: 'Order Status Response',
                    intent: 'order_status',
                    message: 'Your order #{order_id} is currently {status}. Expected delivery: {eta}. Thank you for your patience!'
                },
                {
                    title: 'Refund Policy',
                    intent: 'refund_request',
                    message: 'We process refunds within 5-7 business days. Please share your order number and reason for refund and we will assist you.'
                },
                {
                    title: 'Angry Customer Apology',
                    intent: 'angry_customer',
                    message: 'We sincerely apologize for the inconvenience caused. Our team will contact you within 2 hours to resolve this.'
                },
                {
                    title: 'General Greeting',
                    intent: 'general_inquiry',
                    message: 'Thank you for contacting us! How can we help you today?'
                }
            ];

            for (const r of defaultResponses) {
                await db.query(
                    `INSERT INTO canned_responses (shop_domain, title, intent, message)
                     VALUES ($1, $2, $3, $4)`,
                    [shop, r.title, r.intent, r.message]
                );
            }
            console.log(`[Canned] Seeded default canned responses for shop: ${shop}`);
        }
    } catch (cannedError) {
        console.warn('[Canned] Failed to seed default canned responses:', cannedError?.message || cannedError);
    }

    // Redirect to frontend with both shop domain and host (enabling Shopify App Bridge in iframe)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const hostParam = req.query.host ? `&host=${encodeURIComponent(req.query.host)}` : '';
    res.redirect(`${frontendUrl}/?shop=${shop}${hostParam}`);
});

// Step 3: Register webhooks
router.post('/webhooks/register', registerWebhooks);

module.exports = router;