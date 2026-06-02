const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db/db');
const validateShopifyHmac = require('../middleware/validateShopifyHmac');
const axios = require('axios');

// Step 1: Auth redirect
router.get('/auth', (req, res) => {
    const { shop } = req.query;
    if (!shop) return res.status(400).json({ error: 'Shop parameter required' });

    const redirectUri = `${process.env.APP_URL}/shopify/callback`;
    const scopes = 'read_orders,read_fulfillments';
    const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${scopes}&redirect_uri=${redirectUri}`;

    res.redirect(authUrl);
});

// Step 2: OAuth callback
router.get('/callback', async (req, res) => {
    const { shop, code, hmac } = req.query;

    // Validate HMAC
    if (!validateShopifyHmac(req.query)) {
        return res.status(403).json({ error: 'Invalid HMAC' });
    }

    // Exchange code for access token
    const tokenResponse = await axios.post(`https://${shop}/admin/oauth/access_token`, {
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code
    });

    const accessToken = tokenResponse.data.access_token;

    // Encrypt token
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc',
        Buffer.from(process.env.TOKEN_ENCRYPTION_KEY.slice(0, 32)),
        iv
    );
    const encryptedToken = Buffer.concat([cipher.update(accessToken), cipher.final()]);
    const tokenToStore = iv.toString('hex') + ':' + encryptedToken.toString('hex');

    // Save to DB
    await db.query(
        `INSERT INTO shops (shop_domain, access_token) 
         VALUES ($1, $2) 
         ON CONFLICT (shop_domain) 
         DO UPDATE SET access_token = $2, is_active = true`,
        [shop, tokenToStore]
    );

    res.redirect(`${process.env.APP_URL}/success?shop=${shop}`);
});

module.exports = router;