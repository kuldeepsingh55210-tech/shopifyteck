const axios = require('axios');
const { decryptToken } = require('../utils/tokenEncryption');

const getOrderData = async (shopDomain, encryptedAccessToken, orderNumber, customerEmail, customerPhone) => {
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
                    fields: 'id,name,email,phone,contact_email,fulfillment_status,financial_status,fulfillments,line_items,created_at,customer,total_price,shipping_address'
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
            return { found: false, verified: false, reason: 'not_found' };
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
            return { found: false, verified: false, reason: 'not_found' };
        }

        console.log(`[Order Lookup] Found candidate order: ${matchingOrder.name}. Verifying ownership...`);

        // Collect and normalize all valid email addresses associated with this order
        const orderEmails = [
            matchingOrder.email,
            matchingOrder.contact_email,
            matchingOrder.customer?.email
        ].filter(Boolean).map(e => e.toLowerCase().trim());

        // Collect and normalize all valid phone numbers associated with this order (digits only)
        const orderPhones = [
            matchingOrder.phone,
            matchingOrder.customer?.phone,
            matchingOrder.shipping_address?.phone
        ].filter(Boolean).map(p => p.replace(/\D/g, ''));

        // Normalize requester email - dummy placeholder 'guest@customer.com' NEVER matches
        const normalizedRequesterEmail = (customerEmail || '').toLowerCase().trim();
        const isDummyGuest = normalizedRequesterEmail === 'guest@customer.com';
        const emailMatches = Boolean(
            normalizedRequesterEmail &&
            !isDummyGuest &&
            orderEmails.some(e => e === normalizedRequesterEmail)
        );

        // Normalize requester phone - minimum 7 digits required
        const normalizedRequesterPhone = (customerPhone || '').replace(/\D/g, '');
        const phoneMatches = Boolean(
            normalizedRequesterPhone.length >= 7 &&
            orderPhones.some(p => {
                if (p === normalizedRequesterPhone) return true;
                if (p.endsWith(normalizedRequesterPhone) || normalizedRequesterPhone.endsWith(p)) {
                    const minLen = Math.min(p.length, normalizedRequesterPhone.length);
                    return minLen >= 10;
                }
                return false;
            })
        );

        if (!emailMatches && !phoneMatches) {
            console.warn(`[Order Lookup] Ownership verification failed for order ${matchingOrder.name}. Requester email="${customerEmail}", phone="${customerPhone}". Candidate emails=[${orderEmails.join(', ')}], candidate phones=[${orderPhones.join(', ')}]`);
            return { found: false, verified: false, reason: 'unverified' };
        }

        console.log(`[Order Lookup] Ownership successfully verified for order ${matchingOrder.name}`);

        const fulfillment = matchingOrder.fulfillments?.[0];
        const lineItems = matchingOrder.line_items || [];
        const customerName = matchingOrder.customer ? 
            `${matchingOrder.customer.first_name || ''} ${matchingOrder.customer.last_name || ''}`.trim() : 
            null;

        return {
            found: true,
            verified: true,
            id: matchingOrder.id,
            order_number: matchingOrder.name,
            fulfillment_status: matchingOrder.fulfillment_status || 'unfulfilled',
            financial_status: matchingOrder.financial_status || 'pending',
            total_price: matchingOrder.total_price || null,
            shipping_address: matchingOrder.shipping_address || null,
            tracking_number: fulfillment?.tracking_number || null,
            tracking_company: fulfillment?.tracking_company || null,
            carrier: fulfillment?.tracking_company || null,
            tracking_url: fulfillment?.tracking_url || null,
            estimated_delivery: fulfillment?.estimated_delivery || null,
            line_items: lineItems.map(item => ({
                title: item.title,
                quantity: item.quantity
            })),
            created_at: matchingOrder.created_at || null,
            customer_name: customerName
        };

    } catch (error) {
        console.error(`[Order Lookup] Exception: ${error.message}`);
        return { found: false, error: error.message };
    }
};

module.exports = { getOrderData };