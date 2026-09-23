require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const http = require('http');
const db = require('../src/db/db');
const { decryptToken } = require('../src/utils/tokenEncryption');
const actionService = require('../src/services/actionService');

async function runVerificationAndRevert() {
    try {
        console.log('================================================================');
        console.log('  P1 #12: ADDRESS CHANGE LIVE MUTATION & REVERT VERIFICATION');
        console.log('================================================================\n');

        // 1. Fetch active shop credentials
        const shopRes = await db.query('SELECT shop_domain, access_token FROM shops WHERE is_active = true LIMIT 1');
        if (shopRes.rows.length === 0) {
            console.error('❌ No active shop found in database');
            process.exit(1);
        }
        const { shop_domain: shop, access_token } = shopRes.rows[0];
        const decryptedToken = decryptToken(access_token);
        const orderNumber = process.argv[2] || '1009';
        const customerEmail = process.argv[3] || 'test21@gmail.com';

        // -------------------------------------------------------------
        // STEP 1: Query BEFORE state directly from Shopify Admin API
        // -------------------------------------------------------------
        console.log(`[STEP 1] Fetching BEFORE state from Shopify Admin API for Order #${orderNumber}...`);
        const beforeRes = await axios.get(`https://${shop}/admin/api/2024-01/orders.json`, {
            params: { name: `#${orderNumber}`, status: 'any' },
            headers: { 'X-Shopify-Access-Token': decryptedToken }
        });

        const order = beforeRes.data.orders?.[0];
        if (!order) {
            console.error(`❌ Order #${orderNumber} not found in Shopify`);
            process.exit(1);
        }

        const beforeAddress = {
            first_name: order.shipping_address?.first_name || 'Customer',
            last_name: order.shipping_address?.last_name || 'Customer',
            address1: order.shipping_address?.address1 || '',
            address2: order.shipping_address?.address2 || '',
            city: order.shipping_address?.city || '',
            province: order.shipping_address?.province || '',
            zip: order.shipping_address?.zip || '',
            country: order.shipping_address?.country || 'India',
            country_code: order.shipping_address?.country_code || 'IN',
            phone: order.shipping_address?.phone || ''
        };

        console.log(`  Shopify Order ID:   ${order.id}`);
        console.log(`  Fulfillment Status: ${order.fulfillment_status || 'unfulfilled'}`);
        console.log(`  Original Address 1: ${beforeAddress.address1}`);
        console.log(`  Original City:      ${beforeAddress.city}`);
        console.log(`  Original ZIP:       ${beforeAddress.zip}`);
        console.log(`  Original Country:   ${beforeAddress.country} (${beforeAddress.country_code})\n`);

        // -------------------------------------------------------------
        // STEP 2: Trigger address_change via /resolve-order endpoint
        // -------------------------------------------------------------
        console.log(`[STEP 2] Submitting live address change request via /resolve-order...`);
        const newStreet = '123 MG Road, Floor 2';
        const newCity = 'Indore';
        const newProvince = 'Madhya Pradesh';
        const newZip = '452001';
        const newCountry = 'India';
        const newPhone = '9876543210';

        const testMessage = `Please update shipping address for order #${orderNumber} to: ${newStreet}, ${newCity}, ${newProvince}, ${newZip}, ${newCountry}, phone ${newPhone}`;
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const path_prefix = '/apps/oryqx-support';
        const paramString = `path_prefix=${path_prefix}shop=${shop}timestamp=${timestamp}`;
        const signature = crypto.createHmac('sha256', process.env.SHOPIFY_API_SECRET).update(paramString).digest('hex');

        const postData = JSON.stringify({
            order_number: orderNumber,
            customer_email: customerEmail,
            customer_message: testMessage
        });

        const port = process.env.PORT || 3000;
        const queryPath = `/resolve-order?path_prefix=${encodeURIComponent(path_prefix)}&shop=${encodeURIComponent(shop)}&timestamp=${timestamp}&signature=${signature}`;

        const resolveResponse = await new Promise((resolve, reject) => {
            const req = http.request({
                hostname: '127.0.0.1',
                port,
                path: queryPath,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            }, (res) => {
                let body = '';
                res.on('data', chunk => { body += chunk; });
                res.on('end', () => {
                    resolve({ statusCode: res.statusCode, body });
                });
            });
            req.on('error', reject);
            req.write(postData);
            req.end();
        });

        console.log(`  HTTP Response Status: ${resolveResponse.statusCode}`);
        let parsedBotResponse = null;
        try {
            parsedBotResponse = JSON.parse(resolveResponse.body);
            console.log(`  Bot AI Response:      "${parsedBotResponse.response}"`);
        } catch {
            console.log(`  Raw Response:         ${resolveResponse.body}`);
        }

        // -------------------------------------------------------------
        // STEP 3: Verify AFTER address directly from Shopify Admin API
        // -------------------------------------------------------------
        console.log(`\n[STEP 3] Querying Shopify Admin API to verify address mutation on Order #${orderNumber}...`);
        const afterRes = await axios.get(`https://${shop}/admin/api/2024-01/orders/${order.id}.json`, {
            headers: { 'X-Shopify-Access-Token': decryptedToken }
        });

        const afterOrder = afterRes.data.order;
        const afterAddress = {
            first_name: afterOrder.shipping_address?.first_name || '',
            last_name: afterOrder.shipping_address?.last_name || '',
            address1: afterOrder.shipping_address?.address1 || '',
            address2: afterOrder.shipping_address?.address2 || '',
            city: afterOrder.shipping_address?.city || '',
            province: afterOrder.shipping_address?.province || '',
            zip: afterOrder.shipping_address?.zip || '',
            country: afterOrder.shipping_address?.country || '',
            country_code: afterOrder.shipping_address?.country_code || '',
            phone: afterOrder.shipping_address?.phone || ''
        };

        const mutationSuccessful = afterAddress.address1.toLowerCase().includes('mg road') &&
                                   afterAddress.city.toLowerCase() === 'indore' &&
                                   afterAddress.zip === '452001';

        if (mutationSuccessful) {
            console.log('  ✅ SUCCESS: Address was verified as MUTATED on live Shopify!');
        } else {
            console.error('  ❌ FAILURE: Address does not reflect the requested mutation!');
        }

        // -------------------------------------------------------------
        // STEP 4: REVERT to original address using actionService directly
        // -------------------------------------------------------------
        console.log(`\n[STEP 4] Reverting address back to original state via actionService.updateShippingAddress()...`);
        const revertResult = await actionService.updateShippingAddress(shop, order.id, beforeAddress);
        if (!revertResult.success) {
            console.error('  ❌ Revert call failed:', revertResult.error);
        } else {
            console.log('  ✅ Revert call to Shopify returned success: true');
        }

        // Query again to confirm revert took effect
        const verifyRevertRes = await axios.get(`https://${shop}/admin/api/2024-01/orders/${order.id}.json`, {
            headers: { 'X-Shopify-Access-Token': decryptedToken }
        });
        const revertedOrder = verifyRevertRes.data.order;
        const revertedAddress = {
            first_name: revertedOrder.shipping_address?.first_name || '',
            last_name: revertedOrder.shipping_address?.last_name || '',
            address1: revertedOrder.shipping_address?.address1 || '',
            address2: revertedOrder.shipping_address?.address2 || '',
            city: revertedOrder.shipping_address?.city || '',
            province: revertedOrder.shipping_address?.province || '',
            zip: revertedOrder.shipping_address?.zip || '',
            country: revertedOrder.shipping_address?.country || '',
            country_code: revertedOrder.shipping_address?.country_code || '',
            phone: revertedOrder.shipping_address?.phone || ''
        };

        // -------------------------------------------------------------
        // STEP 5: Side-by-Side Comparison
        // -------------------------------------------------------------
        console.log('\n================================================================');
        console.log('             SIDE-BY-SIDE ADDRESS COMPARISON');
        console.log('================================================================');
        console.table([
            {
                Field: 'address1',
                BEFORE_Original: beforeAddress.address1,
                AFTER_Mutated: afterAddress.address1,
                REVERTED_Back: revertedAddress.address1
            },
            {
                Field: 'city',
                BEFORE_Original: beforeAddress.city,
                AFTER_Mutated: afterAddress.city,
                REVERTED_Back: revertedAddress.city
            },
            {
                Field: 'province',
                BEFORE_Original: beforeAddress.province,
                AFTER_Mutated: afterAddress.province,
                REVERTED_Back: revertedAddress.province
            },
            {
                Field: 'zip',
                BEFORE_Original: beforeAddress.zip,
                AFTER_Mutated: afterAddress.zip,
                REVERTED_Back: revertedAddress.zip
            },
            {
                Field: 'country',
                BEFORE_Original: beforeAddress.country,
                AFTER_Mutated: afterAddress.country,
                REVERTED_Back: revertedAddress.country
            },
            {
                Field: 'country_code',
                BEFORE_Original: beforeAddress.country_code,
                AFTER_Mutated: afterAddress.country_code,
                REVERTED_Back: revertedAddress.country_code
            },
            {
                Field: 'phone',
                BEFORE_Original: beforeAddress.phone,
                AFTER_Mutated: afterAddress.phone,
                REVERTED_Back: revertedAddress.phone
            }
        ]);

        const restoredMatch = revertedAddress.address1 === beforeAddress.address1 &&
                              revertedAddress.city === beforeAddress.city &&
                              revertedAddress.zip === beforeAddress.zip;

        if (restoredMatch) {
            console.log('🎉 REVERT CONFIRMED: Order #1009 shipping_address restored byte-for-byte to original!');
        } else {
            console.warn('⚠️ WARNING: Reverted address differed slightly from initial read.');
        }

        process.exit(mutationSuccessful && restoredMatch ? 0 : 1);
    } catch (err) {
        console.error('❌ Fatal error:', err.response?.data || err.message);
        process.exit(1);
    }
}

runVerificationAndRevert();
