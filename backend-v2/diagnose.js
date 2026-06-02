#!/usr/bin/env node
/**
 * Diagnostic script to test Shopify API connection and order lookup
 * Usage: node diagnose.js
 */

require('dotenv').config();
const axios = require('axios');
const db = require('./src/db/db');
const { decryptToken } = require('./src/utils/tokenEncryption');

async function diagnose() {
    console.log('\n🔍 SHOPIFY ORDER LOOKUP DIAGNOSTIC TOOL\n');
    console.log('='.repeat(60));

    try {
        // Check 1: Environment variables
        console.log('\n✓ Step 1: Checking environment variables...');
        const requiredVars = ['GEMINI_API_KEY', 'TOKEN_ENCRYPTION_KEY', 'SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET'];
        const missingVars = requiredVars.filter(v => !process.env[v]);

        if (missingVars.length > 0) {
            console.error(`❌ Missing: ${missingVars.join(', ')}`);
            process.exit(1);
        }
        console.log('✓ All required environment variables present');

        // Check 2: Database connection
        console.log('\n✓ Step 2: Checking database connection...');
        const dbTest = await db.query('SELECT NOW()');
        console.log('✓ Database connected:', new Date(dbTest.rows[0].now).toISOString());

        // Check 3: Get shops from database
        console.log('\n✓ Step 3: Checking shops in database...');
        const shopsResult = await db.query('SELECT id, shop_domain, is_active FROM shops');
        if (shopsResult.rows.length === 0) {
            console.warn('⚠️  No shops found in database. Run: node insert_test_shop.js');
            process.exit(1);
        }

        const shops = shopsResult.rows;
        console.log(`✓ Found ${shops.length} shop(s):`);
        shops.forEach(shop => {
            console.log(`  - Shop #${shop.id}: ${shop.shop_domain} (active: ${shop.is_active})`);
        });

        // Check 4: Test each shop's access token
        console.log('\n✓ Step 4: Testing access tokens...');
        for (const shop of shops) {
            if (!shop.is_active) {
                console.warn(`⚠️  Shop ${shop.id} is inactive, skipping...`);
                continue;
            }

            const tokenResult = await db.query('SELECT access_token FROM shops WHERE id = $1', [shop.id]);
            const encryptedToken = tokenResult.rows[0]?.access_token;

            if (!encryptedToken) {
                console.error(`❌ Shop ${shop.id} has no access token`);
                continue;
            }

            try {
                console.log(`\n  Testing shop #${shop.id} (${shop.shop_domain}):`);

                // Decrypt token
                const accessToken = decryptToken(encryptedToken);
                const maskedToken = `${accessToken.substring(0, 10)}...${accessToken.substring(accessToken.length - 10)}`;
                console.log(`    - Token decrypted: ${maskedToken}`);

                // Test API call
                console.log(`    - Testing Shopify API call...`);
                const response = await axios.get(
                    `https://${shop.shop_domain}/admin/api/2024-01/orders.json`,
                    {
                        params: {
                            status: 'any',
                            limit: 1,
                            fields: 'id,name,email,customer'
                        },
                        headers: { 'X-Shopify-Access-Token': accessToken },
                        timeout: 10000
                    }
                );

                const orders = response.data.orders || [];
                console.log(`    ✓ API connection successful!`);
                console.log(`    ✓ Found ${orders.length} total order(s) in shop`);

                if (orders.length > 0) {
                    console.log(`    - First order: ${orders[0].name} (customer: ${orders[0].customer?.email || orders[0].email})`);
                } else {
                    console.log(`    ⚠️  Shop has no orders - create test data in Shopify`);
                }

            } catch (tokenError) {
                if (tokenError.response?.status === 401) {
                    console.error(`    ❌ Authentication failed (401)`);
                    console.error(`    ❌ The access token is invalid or expired`);
                    console.error(`    👉 Fix: Update token with: node update_shop_token.js <new_token>`);
                } else if (tokenError.response?.status === 404) {
                    console.error(`    ❌ Shop not found (404)`);
                    console.error(`    ❌ Check if the shop domain is correct`);
                } else if (tokenError.message.includes('timeout')) {
                    console.error(`    ❌ Request timeout - API is slow or unreachable`);
                } else {
                    console.error(`    ❌ API Error: ${tokenError.message}`);
                }
            }
        }

        // Check 5: Test order lookup if shop has orders
        console.log('\n✓ Step 5: Testing order lookup...');
        const activeShop = shops.find(s => s.is_active);
        if (!activeShop) {
            console.warn('⚠️  No active shops to test');
        } else {
            const ordersResult = await axios.get(
                `https://${activeShop.shop_domain}/admin/api/2024-01/orders.json`,
                {
                    params: { status: 'any', limit: 1 },
                    headers: { 'X-Shopify-Access-Token': decryptToken((await db.query('SELECT access_token FROM shops WHERE id = $1', [activeShop.id])).rows[0].access_token) },
                    timeout: 10000
                }
            );

            const orders = ordersResult.data.orders || [];
            if (orders.length > 0) {
                const testOrder = orders[0];
                console.log(`\n  Sample test with order: ${testOrder.name}`);
                console.log(`  Customer email: ${testOrder.customer?.email || testOrder.email}`);

                const { getOrderData } = require('./src/services/orderLookupService');
                const tokenResult = await db.query('SELECT access_token FROM shops WHERE id = $1', [activeShop.id]);
                const result = await getOrderData(
                    activeShop.shop_domain,
                    tokenResult.rows[0].access_token,
                    testOrder.name,
                    testOrder.customer?.email || testOrder.email
                );

                if (result.found) {
                    console.log(`  ✓ Order lookup succeeded!`);
                    console.log(`    - Fulfillment Status: ${result.fulfillment_status}`);
                    console.log(`    - Financial Status: ${result.financial_status}`);
                } else {
                    console.error(`  ❌ Order lookup failed: ${result.error}`);
                }
            } else {
                console.warn('  ⚠️  No orders in shop - create one to test');
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('\n✅ DIAGNOSTIC COMPLETE\n');

    } catch (error) {
        console.error('\n❌ DIAGNOSTIC FAILED:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

diagnose();
