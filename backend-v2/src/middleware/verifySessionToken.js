const jwt = require('jsonwebtoken');
const db = require('../db/db');
const verifyShop = require('./verifyShop');

/**
 * Middleware to authenticate requests from the Shopify Embedded App via Session Tokens (JWT).
 * If no Authorization header is provided, it falls back to verifyShop (for testing tools and backwards compatibility).
 */
const verifySessionToken = async (req, res, next) => {
    // Bypass authentication for public endpoint /api/shops (e.g. used by the storefront widget to resolve shop ID)
    if (req.originalUrl && req.originalUrl.split('?')[0] === '/api/shops') {
        return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // Fallback for tools / simulator calls that supply shop_id directly
        console.log('[Auth Middleware] Authorization header missing or invalid. Falling back to verifyShop.');
        return verifyShop(req, res, next);
    }

    const token = authHeader.split(' ')[1];

    try {
        // Shopify Session Tokens are signed using the Client Secret (SHOPIFY_API_SECRET)
        const decoded = jwt.verify(token, process.env.SHOPIFY_API_SECRET, {
            algorithms: ['HS256']
        });

        // Validate Audience claim (App Client API Key)
        if (decoded.aud !== process.env.SHOPIFY_API_KEY) {
            console.error('[Auth Middleware] JWT Audience mismatch:', decoded.aud, 'expected:', process.env.SHOPIFY_API_KEY);
            return res.status(401).json({ error: 'Unauthorized: Audience API Key mismatch' });
        }

        // Validate Destination claim (Shop Domain URL)
        if (!decoded.dest) {
            console.error('[Auth Middleware] JWT destination claim missing');
            return res.status(401).json({ error: 'Unauthorized: Destination claim missing' });
        }

        // Extract clean shop domain name (removes https:// prefix)
        const shopDomain = decoded.dest.replace(/^https:\/\//, '');

        // Lookup shop in PostgreSQL database
        const result = await db.query(
            'SELECT id, shop_domain, access_token, is_active FROM shops WHERE shop_domain = $1',
            [shopDomain]
        );

        if (result.rows.length === 0) {
            console.error(`[Auth Middleware] Shop not registered in database: ${shopDomain}`);
            return res.status(401).json({ error: 'Unauthorized: Shop domain not found. Please install the app.' });
        }

        const shop = result.rows[0];
        if (!shop.is_active) {
            console.error(`[Auth Middleware] Shop is registered but inactive: ${shopDomain}`);
            return res.status(401).json({ error: 'Unauthorized: Shop connection is inactive' });
        }

        // Attach shop information to request context
        req.shopDomain = shop.shop_domain;
        req.shop = {
            id: shop.id,
            domain: shop.shop_domain,
            access_token: shop.access_token
        };

        // Populate query parameters to maintain compatibility with legacy endpoint controllers
        req.query.shop_id = shop.id.toString();
        req.query.shop_domain = shop.shop_domain;

        next();
    } catch (error) {
        console.error('[Auth Middleware] Session token validation error:', error.message);
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired session token' });
    }
};

module.exports = verifySessionToken;
