const jwt = require('jsonwebtoken');

const verifyMerchant = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: Access token required' });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Unauthorized: Access token missing' });
        }

        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
            }

            req.merchant = decoded; // Contains merchantId, email
            next();
        });
    } catch (error) {
        console.error('[Auth Middleware] Verification error:', error.message);
        res.status(500).json({ error: 'Internal server authorization check failed' });
    }
};

module.exports = verifyMerchant;
