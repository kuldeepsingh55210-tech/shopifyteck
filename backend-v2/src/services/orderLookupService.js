const axios = require('axios');
const { decryptToken } = require('../utils/tokenEncryption');

const getOrderData = async (shopDomain, encryptedAccessToken, orderNumber, customerEmail) => {
    try {
        console.log(`[Order Lookup] START - Looking for order ${orderNumber}`);

        if (!encryptedAccessToken || encryptedAccessToken.trim().length === 0) {
            return { found: false, error: 'Missing access token' };
        }

        let accessToken;
        try {
            accessToken = decryptToken(encryptedAccessToken);
            if (!accessToken || accessToken.trim().length === 0) {
                throw new Error('Decrypted token is empty');
            }
            console.log(`[Order Lookup] Token decrypted successfully`);
        } catch (decryptError) {
            console.error(`[Order Lookup] Decryption failed: ${decryptError.message}`);
            return { found: false, error: 'Token decryption failed' };
        }

        const normalizedOrderNumber = orderNumber.replace('#', '').trim();
        console.log(`[Order Lookup] Looking for order: ${normalizedOrderNumber}`);

        const apiUrl = `https://${shopDomain}/admin/api/2026-01/orders.json`;
        console.log(`[Order Lookup] Calling: ${apiUrl}`);

        let response;
        try {
            response = await axios.get(apiUrl, {
                params: {
                    status: 'any',
                    limit: 250,
                    fields: 'id,name,fulfillment_status,financial_status,fulfillments,line_items'
                },
                headers: { 'X-Shopify-Access-Token': accessToken },
                timeout: 10000
            });
        } catch (apiError) {
            console.error(`[Order Lookup] API Error: ${apiError.response?.status}`);
            console.error(`[Order Lookup] Response: ${JSON.stringify(apiError.response?.data)}`);
            return { found: false, error: `API Error: ${apiError.response?.status}` };
        }

        const orders = response.data.orders || [];
        console.log(`[Order Lookup] Total orders fetched: ${orders.length}`);

        if (orders.length === 0) {
            console.warn(`[Order Lookup] Shop has NO orders!`);
            return { found: false };
        }

        orders.forEach((o, idx) => {
            console.log(`[Order Lookup] Order ${idx}: name=${o.name}`);
        });

        const matchingOrder = orders.find(order => {
            return order.name === `#${normalizedOrderNumber}` ||
                   order.name === normalizedOrderNumber;
        });

        if (!matchingOrder) {
            console.error(`[Order Lookup] Order ${normalizedOrderNumber} not found`);
            return { found: false };
        }

        console.log(`[Order Lookup] Found order: ${matchingOrder.name}`);

        const fulfillment = matchingOrder.fulfillments?.[0];
        const lineItems = matchingOrder.line_items || [];

        return {
            found: true,
            order_number: matchingOrder.name,
            fulfillment_status: matchingOrder.fulfillment_status || 'unfulfilled',
            financial_status: matchingOrder.financial_status || 'pending',
            tracking_number: fulfillment?.tracking_number || null,
            carrier: fulfillment?.tracking_company || null,
            estimated_delivery: fulfillment?.estimated_delivery || null,
            line_items: lineItems.map(item => ({
                title: item.title,
                quantity: item.quantity
            }))
        };

    } catch (error) {
        console.error(`[Order Lookup] Exception: ${error.message}`);
        return { found: false, error: error.message };
    }
};

module.exports = { getOrderData };