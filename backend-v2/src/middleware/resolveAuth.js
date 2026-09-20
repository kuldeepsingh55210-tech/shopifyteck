const verifyAppProxySignature = require('./verifyAppProxySignature');
const verifySessionToken = require('./verifySessionToken');

/**
 * Dual authentication middleware for /resolve-order:
 * 1. If App Proxy signature is present (storefront widget via Shopify App Proxy) -> verifyAppProxySignature
 * 2. If Bearer header is present (Admin Dashboard test simulator & Onboarding wizard) -> verifySessionToken
 * 3. If neither is present -> immediate 401 Unauthorized.
 * 
 * Never trusts raw, unauthenticated client-supplied shop_id or shop_domain.
 */
const resolveAuth = async (req, res, next) => {
    // 1. Shopify App Proxy storefront request
    if (req.query && req.query.signature) {
        return verifyAppProxySignature(req, res, next);
    }

    // 2. Shopify Embedded Admin session token request
    if (req.headers && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        return verifySessionToken(req, res, next);
    }

    // 3. Reject unauthenticated requests
    return res.status(401).json({
        error: 'Unauthorized: Missing valid session token or App Proxy signature'
    });
};

module.exports = resolveAuth;
