const jwt = require('jsonwebtoken');
const db = require('../db/db');
/**
 * Middleware to authenticate requests from the Shopify Embedded App via Session Tokens (JWT).
 * Strictly requires a valid Bearer JWT. Unauthenticated requests are immediately rejected with 401.
 */
const verifySessionToken = async (req, res, next) => {
    // Bypass authentication for public endpoint /api/shops (e.g. used by the storefront widget to resolve shop ID)
    if (req.originalUrl && req.originalUrl.split('?')[0] === '/api/shops') {
        return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
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

        // Populate query and body parameters to enforce verified shop context and prevent tampering
        if (req.body && typeof req.body === 'object') {
            req.body.shop_id = shop.id;
            req.body.shop_domain = shop.shop_domain;
        }
        req.query.shop_id = shop.id.toString();
        req.query.shop_domain = shop.shop_domain;

        next();
    } catch (error) {
        console.error('[Auth Middleware] Session token validation error:', error.message);
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired session token' });
    }
};

module.exports = verifySessionToken;
