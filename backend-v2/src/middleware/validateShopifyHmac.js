const crypto = require('crypto');

const validateShopifyHmac = (query) => {
    const { hmac, ...rest } = query;
    const message = Object.keys(rest)
        .sort()
        .map(key => `${key}=${rest[key]}`)
        .join('&');

    const generatedHmac = crypto
        .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
        .update(message)
        .digest('hex');

    try {
        return crypto.timingSafeEqual(
            Buffer.from(generatedHmac),
            Buffer.from(hmac)
        );
    } catch (err) {
        console.error('HMAC validation error:', err.message);
        return false;
    }
};

module.exports = validateShopifyHmac;