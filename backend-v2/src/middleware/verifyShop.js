const db = require('../db/db');

const verifyShop = async (req, res, next) => {
    try {
        const shop_domain = req.query.shop_domain || req.body.shop_domain;
        const shop_id = req.query.shop_id || req.body.shop_id;

        if (!shop_domain && !shop_id) {
            return res.status(401).json({ error: 'Unauthorized: shop_domain or shop_id required' });
        }

        let shopCheck;
        if (shop_domain) {
            shopCheck = await db.query(
                'SELECT id FROM shops WHERE shop_domain = $1 AND is_active = true',
                [shop_domain]
            );
        } else {
            shopCheck = await db.query(
                'SELECT id FROM shops WHERE id = $1 AND is_active = true',
                [shop_id]
            );
        }

        if (shopCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Forbidden: Shop not found or inactive' });
        }

        next();
    } catch (error) {
        console.error('[Auth] Middleware error:', error.message);
        res.status(500).json({ error: 'Authentication check failed' });
    }
};

module.exports = verifyShop;
