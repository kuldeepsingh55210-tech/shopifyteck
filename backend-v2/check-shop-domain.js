require('dotenv').config();
const db = require('./src/db/db');

async function checkShop() {
    try {
        const result = await db.query('SELECT id, shop_domain, is_active FROM shops WHERE id = 1');
        
        if (result.rows.length === 0) {
            console.log('❌ No shop found');
            process.exit(1);
        }

        const shop = result.rows[0];
        console.log('\n📊 SHOP CONFIGURATION');
        console.log('='.repeat(60));
        console.log(`Shop ID: ${shop.id}`);
        console.log(`Shop Domain: ${shop.shop_domain}`);
        console.log(`Is Active: ${shop.is_active}`);

        // Check format
        console.log('\n🔍 DOMAIN FORMAT CHECK');
        console.log('='.repeat(60));
        
        if (!shop.shop_domain) {
            console.error('❌ Shop domain is empty!');
            process.exit(1);
        }

        if (shop.shop_domain.includes('http://') || shop.shop_domain.includes('https://')) {
            console.error('❌ ERROR: Shop domain includes protocol (http/https)');
            console.error(`   Should be: autosupport-ai-dev.myshopify.com`);
            console.error(`   Got: ${shop.shop_domain}`);
            process.exit(1);
        }

        if (!shop.shop_domain.endsWith('.myshopify.com')) {
            console.warn('⚠️  WARNING: Shop domain doesn\'t end with .myshopify.com');
            console.warn(`   Got: ${shop.shop_domain}`);
        }

        // Show API URLs that will be constructed
        console.log('\n🌐 API ENDPOINTS THAT WILL BE USED');
        console.log('='.repeat(60));
        
        const apiVersions = ['2024-01', '2024-04', '2025-01'];
        apiVersions.forEach(version => {
            const url = `https://${shop.shop_domain}/admin/api/${version}/orders.json`;
            console.log(`${version}: ${url}`);
        });

        // Test connection to shop
        console.log('\n🔗 TESTING SHOPIFY CONNECTION');
        console.log('='.repeat(60));
        
        const axios = require('axios');
        const { decryptToken } = require('./src/utils/tokenEncryption');
        
        const tokenResult = await db.query('SELECT access_token FROM shops WHERE id = 1');
        if (tokenResult.rows.length === 0) {
            console.error('❌ No token found in database');
            process.exit(1);
        }

        const encryptedToken = tokenResult.rows[0].access_token;
        const accessToken = decryptToken(encryptedToken);
        
        console.log(`Token (masked): ${accessToken.substring(0, 10)}...${accessToken.substring(accessToken.length - 10)}`);

        const testUrl = `https://${shop.shop_domain}/admin/api/2024-01/orders.json`;
        console.log(`\nAttempting: GET ${testUrl}`);
        console.log(`Header: X-Shopify-Access-Token: ${accessToken.substring(0, 10)}...`);

        try {
            const response = await axios.get(testUrl, {
                params: { limit: 1 },
                headers: { 'X-Shopify-Access-Token': accessToken },
                timeout: 5000
            });
            console.log(`✓ Status: ${response.status} ${response.statusText}`);
            console.log(`✓ Orders found: ${response.data.orders?.length || 0}`);
        } catch (error) {
            console.error(`✗ Status: ${error.response?.status} ${error.response?.statusText}`);

            if (error.response?.status === 403) {
                console.error('\n❌ PERMISSION ERROR (403) - FORBIDDEN');
                console.error('\n✓ Token is VALID but LACKS REQUIRED SCOPES');
                console.error('\n📋 TO FIX:');
                console.error('  1. Go to: https://admin.shopify.com/admin/settings/apps-and-integrations/develop');
                console.error('  2. Find and edit your "AutoSupport AI" app');
                console.error('  3. Under "Admin API access scopes", verify:');
                console.error('     ✓ read_orders');
                console.error('     ✓ read_fulfillments');
                console.error('  4. If missing, add them and save');
                console.error('  5. Regenerate access token');
                console.error('  6. Run: node update_shop_token.js shpat_NEW_TOKEN');
                console.error('  7. Run this script again');

                try {
                    const errorData = error.response.data;
                    console.error('\n📝 API Error Response:', JSON.stringify(errorData, null, 2).substring(0, 500));
                } catch (e) {
                    // ignore
                }
            } else if (error.response?.status === 404) {
                console.error('\n❌ NOT FOUND (404)');
                console.error('\nThe shop or endpoint doesn\'t exist.');
                console.error('\n📋 CHECK:');
                console.error(`  Current domain: ${shop.shop_domain}`);
                console.error('  Expected:      autosupport-ai-dev.myshopify.com');
                console.error('  ❌ Should NOT include: http://, https://, /admin, /api');
                console.error('  ✓ Should ONLY be the domain');
            } else if (error.response?.status === 401) {
                console.error('\n❌ UNAUTHORIZED (401) - INVALID TOKEN');
                console.error('\n✗ The access token is INVALID, FAKE, or EXPIRED');
                console.error('\n📋 TO FIX:');
                console.error('  1. Go to: https://admin.shopify.com/admin/settings/apps-and-integrations/develop');
                console.error('  2. Find your "AutoSupport AI" app and click to view it');
                console.error('  3. Scroll down to "Admin API credentials"');
                console.error('  4. Find "Admin API access token"');
                console.error('  5. Copy the full token (should start with shpat_)');
                console.error('  6. Run: node update_shop_token.js shpat_PASTE_YOUR_TOKEN_HERE');
                console.error('  7. Run this script again to verify');

                console.error(`\n⚠️  Current token starts with: ${accessToken.substring(0, 30)}...`);
                if (accessToken.startsWith('shpat_test') || accessToken === 'test_token_for_dev' || !accessToken.startsWith('shpat_')) {
                    console.error('\n🔴 DETECTED: This is a TEST TOKEN, not a real Shopify access token!');
                    console.error('   You MUST get a real token from Shopify Admin.');
                }
            } else {
                console.error('\n❌ UNEXPECTED ERROR');
                console.error('\nError message:', error.message);
                console.error('Status:', error.response?.status);
                try {
                    const errorData = error.response?.data;
                    if (errorData) {
                        console.error('Response:', JSON.stringify(errorData, null, 2).substring(0, 500));
                    }
                } catch (e) {
                    // ignore
                }
            }
        }

        console.log('\n' + '='.repeat(60) + '\n');
        process.exit(0);
        
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkShop();
