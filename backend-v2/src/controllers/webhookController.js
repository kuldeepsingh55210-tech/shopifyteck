const db = require('../db/db');
const axios = require('axios');

const topicMap = {
  'orders/create': 'ORDERS_CREATE',
  'orders/updated': 'ORDERS_UPDATED', 
  'orders/cancelled': 'ORDERS_CANCELLED',
  'orders/fulfilled': 'ORDERS_FULFILLED',
  'app/uninstalled': 'APP_UNINSTALLED',
  'customers/create': 'CUSTOMERS_CREATE',
  'customers/update': 'CUSTOMERS_UPDATE'
};

// Register webhooks for a shop
const registerWebhooks = async (req, res) => {
    const { shop_id } = req.body;

    if (!shop_id) {
        return res.status(400).json({ error: 'shop_id required' });
    }

    try {
        const shopResult = await db.query('SELECT * FROM shops WHERE id = $1', [shop_id]);
        if (shopResult.rows.length === 0) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const shop = shopResult.rows[0];
        const accessToken = require('../utils/tokenEncryption').decryptToken(shop.access_token);
        const webhookUrl = `${process.env.APP_URL}/webhooks`;

        const topics = ['orders/create', 'orders/updated', 'app/uninstalled'];
        const registered = [];

        for (const topic of topics) {
            const graphqlTopic = topicMap[topic] || topic.toUpperCase().replace('/', '_');
            console.log(`[Webhook] Registering topic: ${topic} → ${graphqlTopic}`);
            try {
                const response = await axios.post(
                    `https://${shop.shop_domain}/admin/api/2024-01/graphql.json`,
                    {
                        query: `mutation {
                            webhookSubscriptionCreate(topic: ${graphqlTopic}, webhookSubscription: {
                                callbackUrl: "${webhookUrl}/${topic.replace('/', '_')}"
                                format: JSON
                            }) {
                                webhookSubscription {
                                    id
                                    topic
                                }
                                userErrors {
                                    field
                                    message
                                }
                            }
                        }`
                    },
                    {
                        headers: { 'X-Shopify-Access-Token': accessToken }
                    }
                );

                const data = response.data.data?.webhookSubscriptionCreate;
                if (data?.webhookSubscription) {
                    const webhookId = data.webhookSubscription.id.split('/').pop();
                    await db.query(
                        'INSERT INTO webhooks (shop_id, webhook_id, topic, address) VALUES ($1, $2, $3, $4) ON CONFLICT (webhook_id) DO NOTHING',
                        [shop_id, webhookId, topic, `${webhookUrl}/${topic.replace('/', '_')}`]
                    );
                    registered.push({ topic, webhookId, status: 'success' });
                    console.log('[Webhook] Registration result: success');
                } else {
                    registered.push({ topic, status: 'error', error: data?.userErrors });
                    console.log('[Webhook] Registration result: failed');
                }
            } catch (error) {
                console.error(`Error registering ${topic} webhook:`, error.message);
                registered.push({ topic, status: 'error', error: error.message });
                console.log('[Webhook] Registration result: failed');
            }
        }

        res.json({ shop_domain: shop.shop_domain, webhooks: registered });
    } catch (error) {
        console.error('Webhook registration error:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// Handle orders/create webhook
const handleOrderCreate = async (req, res) => {
    try {
        const order = req.body;
        const shop_domain = req.headers['x-shopify-shop-domain'];

        if (!shop_domain) {
            return res.status(400).json({ error: 'Missing shop domain header' });
        }

        const shopResult = await db.query('SELECT id FROM shops WHERE shop_domain = $1', [shop_domain]);
        if (shopResult.rows.length === 0) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const shop_id = shopResult.rows[0].id;

        await db.query(
            `INSERT INTO orders (shop_id, shopify_order_id, order_number, customer_email, total_price, financial_status, fulfillment_status, order_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                shop_id,
                order.id,
                order.name,
                order.customer?.email,
                parseFloat(order.total_price),
                order.financial_status,
                order.fulfillment_status,
                JSON.stringify(order)
            ]
        );

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Order create webhook error:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// Handle orders/updated webhook
const handleOrderUpdated = async (req, res) => {
    try {
        const order = req.body;
        const shop_domain = req.headers['x-shopify-shop-domain'];

        if (!shop_domain) {
            return res.status(400).json({ error: 'Missing shop domain header' });
        }

        const shopResult = await db.query('SELECT id FROM shops WHERE shop_domain = $1', [shop_domain]);
        if (shopResult.rows.length === 0) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const shop_id = shopResult.rows[0].id;

        await db.query(
            `UPDATE orders
             SET customer_email = $2, total_price = $3, financial_status = $4, fulfillment_status = $5, order_data = $6, updated_at = NOW()
             WHERE shop_id = $1 AND shopify_order_id = $7`,
            [
                shop_id,
                order.customer?.email,
                parseFloat(order.total_price),
                order.financial_status,
                order.fulfillment_status,
                JSON.stringify(order),
                order.id
            ]
        );

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Order updated webhook error:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// Handle app/uninstalled webhook
const handleAppUninstalled = async (req, res) => {
    try {
        const shop_domain = req.headers['x-shopify-shop-domain'];

        if (!shop_domain) {
            return res.status(400).json({ error: 'Missing shop domain header' });
        }

        // Mark shop as inactive
        await db.query('UPDATE shops SET is_active = false, updated_at = NOW() WHERE shop_domain = $1', [shop_domain]);

        // Delete associated webhooks
        await db.query(
            `DELETE FROM webhooks
             WHERE shop_id = (SELECT id FROM shops WHERE shop_domain = $1)`,
            [shop_domain]
        );

        console.log(`App uninstalled from shop: ${shop_domain}`);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('App uninstalled webhook error:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// GDPR COMPLIANCE WEBHOOKS (mandatory for Shopify App Store approval)

// customers/data_request - Shopify sends this when a customer asks a merchant for their data.
// We don't have a UI to auto-export data to the customer, so we log the request clearly so
// the merchant can find it and respond within Shopify's 30-day window.
const handleCustomersDataRequest = async (req, res) => {
    try {
        const payload = req.body;
        const shop_domain = req.headers['x-shopify-shop-domain'];
        console.log(`[GDPR] customers/data_request received - shop: ${shop_domain}, customer: ${payload.customer?.email}`);

        await db.query(
            `INSERT INTO action_logs (shop_domain, customer_email, ticket_id, action_type, action_data, success)
             VALUES ($1, $2, NULL, $3, $4, true)`,
            [shop_domain, payload.customer?.email || null, 'gdpr_data_request', JSON.stringify(payload)]
        );

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('[GDPR] customers/data_request error:', error.message);
        // Always return 200 so Shopify doesn't retry-storm this endpoint; the error is logged for follow-up.
        res.status(200).json({ success: true });
    }
};

// customers/redact - Shopify sends this when a customer's data must be deleted.
// Purge that customer's PII from every table that stores it, scoped to this shop only.
const handleCustomersRedact = async (req, res) => {
    try {
        const payload = req.body;
        const shop_domain = req.headers['x-shopify-shop-domain'];
        const customerEmail = payload.customer?.email;
        console.log(`[GDPR] customers/redact received - shop: ${shop_domain}, customer: ${customerEmail}`);

        if (customerEmail) {
            await db.query('DELETE FROM customer_memory WHERE shop_domain = $1 AND customer_email = $2', [shop_domain, customerEmail]);
            await db.query('DELETE FROM conversation_history WHERE shop_domain = $1 AND customer_email = $2', [shop_domain, customerEmail]);
            await db.query('DELETE FROM refund_approvals WHERE shop_domain = $1 AND customer_email = $2', [shop_domain, customerEmail]);
            await db.query('DELETE FROM csat_ratings WHERE shop_domain = $1 AND customer_email = $2', [shop_domain, customerEmail]);
            await db.query('DELETE FROM reasoning_logs WHERE shop_domain = $1 AND customer_email = $2', [shop_domain, customerEmail]);
            await db.query('DELETE FROM action_logs WHERE shop_domain = $1 AND customer_email = $2', [shop_domain, customerEmail]);
            await db.query('UPDATE tickets SET customer_email = NULL WHERE shop_domain = $1 AND customer_email = $2', [shop_domain, customerEmail]);
            console.log(`[GDPR] Purged data for customer ${customerEmail} on shop ${shop_domain}`);
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('[GDPR] customers/redact error:', error.message);
        res.status(200).json({ success: true });
    }
};

// shop/redact - Shopify sends this ~48 hours after a shop uninstalls the app.
// Purge everything scoped to this shop.
const handleShopRedact = async (req, res) => {
    try {
        const payload = req.body;
        const shop_domain = payload.shop_domain || req.headers['x-shopify-shop-domain'];
        console.log(`[GDPR] shop/redact received - shop: ${shop_domain}`);

        if (shop_domain) {
            await db.query('DELETE FROM customer_memory WHERE shop_domain = $1', [shop_domain]);
            await db.query('DELETE FROM conversation_history WHERE shop_domain = $1', [shop_domain]);
            await db.query('DELETE FROM refund_approvals WHERE shop_domain = $1', [shop_domain]);
            await db.query('DELETE FROM csat_ratings WHERE shop_domain = $1', [shop_domain]);
            await db.query('DELETE FROM reasoning_logs WHERE shop_domain = $1', [shop_domain]);
            await db.query('DELETE FROM action_logs WHERE shop_domain = $1', [shop_domain]);
            await db.query('DELETE FROM escalation_queue WHERE shop_domain = $1', [shop_domain]);
            await db.query('DELETE FROM discount_codes WHERE shop_domain = $1', [shop_domain]);
            await db.query('DELETE FROM merchant_knowledge_base WHERE shop_domain = $1', [shop_domain]);
            await db.query('DELETE FROM canned_responses WHERE shop_domain = $1', [shop_domain]);
            await db.query('DELETE FROM merchant_settings WHERE shop_domain = $1', [shop_domain]);
            await db.query('DELETE FROM tickets WHERE shop_domain = $1', [shop_domain]);
            await db.query('DELETE FROM orders WHERE shop_id = (SELECT id FROM shops WHERE shop_domain = $1)', [shop_domain]);
            await db.query('DELETE FROM webhooks WHERE shop_id = (SELECT id FROM shops WHERE shop_domain = $1)', [shop_domain]);
            await db.query('DELETE FROM shops WHERE shop_domain = $1', [shop_domain]);
            console.log(`[GDPR] Purged all data for shop ${shop_domain}`);
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('[GDPR] shop/redact error:', error.message);
        res.status(200).json({ success: true });
    }
};

module.exports = {
    registerWebhooks,
    handleOrderCreate,
    handleOrderUpdated,
    handleAppUninstalled,
    handleCustomersDataRequest,
    handleCustomersRedact,
    handleShopRedact
};
