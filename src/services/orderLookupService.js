const axios = require('axios');

const getOrderData = async (shopDomain, accessToken, orderNumber, customerEmail) => {
    try {
        const response = await axios.get(
            `https://${shopDomain}/admin/api/2024-01/orders.json`,
            {
                params: { name: orderNumber, email: customerEmail },
                headers: { 'X-Shopify-Access-Token': accessToken },
                timeout: 10000
            }
        );

        const orders = response.data.orders;
        if (!orders || orders.length === 0) return { found: false };

        const order = orders[0];
        const fulfillment = order.fulfillments?.[0];

        return {
            found: true,
            order_number: order.name,
            fulfillment_status: order.fulfillment_status || 'unfulfilled',
            financial_status: order.financial_status,
            tracking_number: fulfillment?.tracking_number || null,
            carrier: fulfillment?.tracking_company || null,
            estimated_delivery: fulfillment?.estimated_delivery || null,
            line_items: order.line_items.map(item => ({
                title: item.title,
                quantity: item.quantity
            }))
        };

    } catch (error) {
        console.error('Order lookup error:', error.message);
        return { found: false, error: error.message };
    }
};

module.exports = { getOrderData };