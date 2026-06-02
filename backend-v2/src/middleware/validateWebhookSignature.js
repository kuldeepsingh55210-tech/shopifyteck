const crypto = require('crypto');

const validateWebhookSignature = (req, res, next) => {
    const hmac = req.headers['x-shopify-hmac-sha256'];
    const topic = req.headers['x-shopify-topic'];

    if (!hmac) {
        return res.status(401).json({ error: 'Missing X-Shopify-Hmac-SHA256 header' });
    }

    // Get raw body (must be buffered by express.raw middleware)
    const rawBody = req.rawBody || JSON.stringify(req.body);

    try {
        const generatedHmac = crypto
            .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
            .update(rawBody, 'utf8')
            .digest('base64');

        if (!crypto.timingSafeEqual(
            Buffer.from(generatedHmac),
            Buffer.from(hmac)
        )) {
            return res.status(401).json({ error: 'Invalid webhook signature' });
        }

        req.webhookTopic = topic;
        next();
    } catch (error) {
        console.error('Webhook signature validation error:', error.message);
        res.status(401).json({ error: 'Invalid webhook signature' });
    }
};

module.exports = validateWebhookSignature;
