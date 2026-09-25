require('dotenv').config();
const axios = require('axios');
const db = require('../src/db/db');
const { decryptToken } = require('../src/utils/tokenEncryption');

async function inspectCandidateOrders() {
    try {
        console.log('================================================================');
        console.log('  INSPECTING TEST ORDERS (#1004 - #1008) FOR SHIPPING ADDRESS');
        console.log('================================================================\n');

        const shopRes = await db.query('SELECT shop_domain, access_token FROM shops WHERE is_active = true LIMIT 1');
        if (shopRes.rows.length === 0) {
            console.error('❌ No active shop found in database');
            process.exit(1);
        }
        const { shop_domain: shop, access_token } = shopRes.rows[0];
        const decryptedToken = decryptToken(access_token);

        const candidates = ['1004', '1005', '1006', '1007', '1008'];
        const summary = [];

        for (const orderNum of candidates) {
            try {
                const res = await axios.get(`https://${shop}/admin/api/2024-01/orders.json`, {
                    params: { name: `#${orderNum}`, status: 'any' },
                    headers: { 'X-Shopify-Access-Token': decryptedToken }
                });

                const order = res.data.orders?.[0];
                if (!order) {
                    summary.push({
                        Order: `#${orderNum}`,
                        Exists: 'NO',
                        Fulfillment: 'N/A',
                        Cancelled: 'N/A',
                        Email: 'N/A',
                        Address1: 'N/A',
                        City: 'N/A',
                        Zip: 'N/A',
                        Country: 'N/A',
                        RevertSafe: '❌'
                    });
                    continue;
                }

                const addr = order.shipping_address || {};
                const hasAddress1 = Boolean(addr.address1 && addr.address1.trim().length > 0);
                const hasCity = Boolean(addr.city && addr.city.trim().length > 0);
                const hasZip = Boolean(addr.zip && addr.zip.trim().length > 0);
                const hasCountry = Boolean(addr.country || addr.country_code);
                const isComplete = hasAddress1 && hasCity && hasZip && hasCountry;
                const isUnfulfilled = !order.fulfillment_status || order.fulfillment_status === 'unfulfilled';
                const isNotCancelled = !order.cancelled_at;
                const revertSafe = isComplete && isUnfulfilled && isNotCancelled;

                summary.push({
                    Order: `#${orderNum}`,
                    ShopifyId: order.id,
                    Fulfillment: order.fulfillment_status || 'unfulfilled',
                    Cancelled: order.cancelled_at ? 'YES' : 'NO',
                    CustomerEmail: order.email || order.contact_email || order.customer?.email || 'N/A',
                    Address1: addr.address1 || '(blank)',
                    City: addr.city || '(blank)',
                    Province: addr.province || '(blank)',
                    Zip: addr.zip || '(blank)',
                    Country: `${addr.country || ''} (${addr.country_code || ''})`.trim(),
                    RevertSafe: revertSafe ? '✅ YES' : '❌ NO'
                });
            } catch (err) {
                console.error(`Error querying #${orderNum}:`, err.response?.data || err.message);
            }
        }

        console.table(summary);

        const safeOrders = summary.filter(s => s.RevertSafe === '✅ YES');
        if (safeOrders.length > 0) {
            console.log(`\n✅ Recommended Order for Test: ${safeOrders[0].Order} (${safeOrders[0].CustomerEmail})`);
        } else {
            console.log('\n⚠️ No order has a complete original address that is also unfulfilled.');
        }

        process.exit(0);
    } catch (err) {
        console.error('Fatal error:', err.message);
        process.exit(1);
    }
}

inspectCandidateOrders();
