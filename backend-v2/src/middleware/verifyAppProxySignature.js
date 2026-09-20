const crypto = require('crypto');
const db = require('../db/db');

/**
 * Validates Shopify App Proxy requests using HMAC-SHA256 signature verification.
 * Shopify forwards storefront requests with query parameters:
 * shop, path_prefix, timestamp, [logged_in_customer_id], signature.
 * 
 * Signature calculation according to Shopify specifications:
 * 1. Remove `signature` from parameters.
 * 2. Check timestamp freshness (|now - timestamp| <= 90s).
 * 3. Sort keys alphabetically.
 * 4. Format key=value (arrays joined with commas).
 * 5. Concatenate with NO delimiter (empty string "").
 * 6. Compute HMAC-SHA256 with SHOPIFY_API_SECRET.
 * 7. Constant-time compare with signature.
 */
const verifyAppProxySignature = async (req, res, next) => {
    try {
        const { signature, ...params } = req.query;

        if (!signature) {
            return res.status(401).json({ error: 'Unauthorized: App Proxy signature missing' });
        }

        const shopDomain = req.query.shop;
        if (!shopDomain) {
            return res.status(400).json({ error: 'Bad Request: Missing shop query parameter' });
        }

        // 1. Validate timestamp freshness (prevent replay attacks, 90-second window)
        const timestamp = parseInt(req.query.timestamp, 10);
        if (isNaN(timestamp)) {
            return res.status(400).json({ error: 'Bad Request: Invalid timestamp parameter' });
        }
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - timestamp) > 90) {
            return res.status(401).json({ error: 'Unauthorized: App Proxy request timestamp expired' });
        }

        // 2. Build parameter string: sort keys alphabetically, join key=val with empty string ""
        const sortedKeys = Object.keys(params).sort();
        const paramString = sortedKeys.map(key => {
            const value = params[key];
            if (Array.isArray(value)) {
                return `${key}=${value.join(',')}`;
            }
            return `${key}=${value}`;
        }).join('');

        // 3. Compute HMAC-SHA256 using SHOPIFY_API_SECRET
        const calculatedHmac = crypto
            .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
            .update(paramString)
            .digest('hex');

        // 4. Constant-time comparison
        const signatureBuffer = Buffer.from(signature, 'hex');
        const calculatedBuffer = Buffer.from(calculatedHmac, 'hex');

        if (signatureBuffer.length !== calculatedBuffer.length || 
            !crypto.timingSafeEqual(signatureBuffer, calculatedBuffer)) {
            return res.status(401).json({ error: 'Unauthorized: Invalid App Proxy HMAC signature' });
        }

        // 5. Look up shop in PostgreSQL database
        const shopResult = await db.query(
            'SELECT id, shop_domain, access_token, is_active FROM shops WHERE shop_domain = $1',
            [shopDomain]
        );

        if (shopResult.rows.length === 0) {
            return res.status(404).json({ error: 'Shop not found. Please install the app.' });
        }

        const shop = shopResult.rows[0];
        if (!shop.is_active) {
            return res.status(403).json({ error: 'Shop connection is inactive' });
        }

        // 6. Bind authenticated shop context to request
        req.shopDomain = shop.shop_domain;
        req.shop = {
            id: shop.id,
            domain: shop.shop_domain,
            access_token: shop.access_token
        };
        // Inject shop_id into body and query for controller compatibility
        req.body = req.body || {};
        req.body.shop_id = shop.id;
        req.query.shop_id = shop.id.toString();
        req.query.shop_domain = shop.shop_domain;

        // Capture logged-in customer ID from Shopify proxy if present
        if (req.query.logged_in_customer_id) {
            req.shopifyCustomerId = req.query.logged_in_customer_id;
        }

        next();
    } catch (error) {
        console.error('[AppProxy Auth] Error validating signature:', error.message);
        return res.status(500).json({ error: 'Internal server error during App Proxy validation' });
    }
};

module.exports = verifyAppProxySignature;
