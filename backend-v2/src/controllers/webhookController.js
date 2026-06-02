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

module.exports = {
    registerWebhooks,
    handleOrderCreate,
    handleOrderUpdated,
    handleAppUninstalled
};
