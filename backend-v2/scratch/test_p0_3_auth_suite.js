const path = require('path');
const crypto = require('crypto');

// Setup environment variables for testing
process.env.SHOPIFY_API_KEY = 'test_api_key_123';
process.env.SHOPIFY_API_SECRET = 'test_api_secret_456_very_secure';

// Mock DB
const mockShops = {
    'test-store.myshopify.com': {
        id: 1,
        shop_domain: 'test-store.myshopify.com',
        access_token: 'encrypted_access_token_1',
        is_active: true
    },
    'inactive-store.myshopify.com': {
        id: 2,
        shop_domain: 'inactive-store.myshopify.com',
        access_token: 'encrypted_access_token_2',
        is_active: false
    }
};

const mockDb = {
    query: async (sql, params) => {
        if (sql.includes('FROM shops WHERE shop_domain = $1')) {
            const domain = params[0];
            const shop = mockShops[domain];
            return { rows: shop ? [shop] : [] };
        }
        if (sql.includes('FROM shops WHERE id = $1')) {
            const id = params[0];
            const shop = Object.values(mockShops).find(s => s.id === parseInt(id, 10));
            return { rows: shop ? [shop] : [] };
        }
        return { rows: [] };
    }
};

// Mock jsonwebtoken
const mockJwt = {
    verify: (token, secret, options) => {
        if (secret !== process.env.SHOPIFY_API_SECRET) {
            throw new Error('invalid signature');
        }
        if (token === 'valid-admin-token') {
            return {
                aud: process.env.SHOPIFY_API_KEY,
                dest: 'https://test-store.myshopify.com',
                sub: 'user_123',
                exp: Math.floor(Date.now() / 1000) + 3600
            };
        }
        if (token === 'wrong-aud-token') {
            return {
                aud: 'attacker_fake_api_key',
                dest: 'https://test-store.myshopify.com'
            };
        }
        if (token === 'missing-dest-token') {
            return {
                aud: process.env.SHOPIFY_API_KEY
            };
        }
        if (token === 'inactive-shop-token') {
            return {
                aud: process.env.SHOPIFY_API_KEY,
                dest: 'https://inactive-store.myshopify.com'
            };
        }
        if (token === 'unregistered-shop-token') {
            return {
                aud: process.env.SHOPIFY_API_KEY,
                dest: 'https://unknown-store.myshopify.com'
            };
        }
        throw new Error('jwt malformed or invalid');
    }
};

// Register mocks in Node require.cache
const dbPath = path.resolve(__dirname, '../src/db/db.js');
const jwtPath = 'jsonwebtoken';

require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: mockDb
};

require.cache[require.resolve('path')] = require.cache[require.resolve('path')];
try {
    // If jsonwebtoken resolution is needed, cache it
    const resolvedJwt = require.resolve('jsonwebtoken');
    require.cache[resolvedJwt] = { id: resolvedJwt, filename: resolvedJwt, loaded: true, exports: mockJwt };
} catch (e) {
    // Intercept require('jsonwebtoken') via Module prototype
    const Module = require('module');
    const originalRequire = Module.prototype.require;
    Module.prototype.require = function (id) {
        if (id === 'jsonwebtoken') return mockJwt;
        if (id === '../db/db' || id.endsWith('/db/db')) return mockDb;
        return originalRequire.apply(this, arguments);
    };
}

// Load middlewares
const verifySessionToken = require('../src/middleware/verifySessionToken');
const verifyAppProxySignature = require('../src/middleware/verifyAppProxySignature');
const resolveAuth = require('../src/middleware/resolveAuth');

// Helper to create mock Express response object
function createMockRes() {
    return {
        statusCode: 200,
        headers: {},
        jsonData: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.jsonData = data;
            return this;
        },
        send(data) {
            this.jsonData = data;
            return this;
        }
    };
}

// Helper to generate a valid Shopify App Proxy HMAC signature
function generateAppProxySignature(params, secret = process.env.SHOPIFY_API_SECRET) {
    const sortedKeys = Object.keys(params).sort();
    const paramString = sortedKeys.map(key => {
        const val = params[key];
        if (Array.isArray(val)) return `${key}=${val.join(',')}`;
        return `${key}=${val}`;
    }).join('');

    return crypto.createHmac('sha256', secret).update(paramString).digest('hex');
}

async function runTests() {
    console.log('================================================================');
    console.log('   P0-3 AUTHENTICATION VERIFICATION SUITE                       ');
    console.log('   (Strict Bearer JWT, App Proxy Signature, Fallback Removal)  ');
    console.log('================================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(desc, condition) {
        if (condition) {
            console.log(`[PASS] ${desc}`);
            passed++;
        } else {
            console.error(`[FAIL] ${desc}`);
            failed++;
        }
    }

    // -------------------------------------------------------------------------
    // PART A: verifySessionToken (Strict Bearer JWT, No Fallback)
    // -------------------------------------------------------------------------
    console.log('--- PART A: verifySessionToken (Embedded Admin /api/*) ---');

    // TEST 1: Request with missing Authorization header (formerly fell back to verifyShop)
    const req1 = { headers: {}, query: { shop_id: '1' }, body: {} };
    const res1 = createMockRes();
    let next1Called = false;
    await verifySessionToken(req1, res1, () => { next1Called = true; });
    assert('TEST 1: Missing Authorization header is rejected with 401', res1.statusCode === 401);
    assert('TEST 1: Returns explicit unauthorized message', res1.jsonData?.error?.includes('Missing or invalid Authorization header'));
    assert('TEST 1: Fallback to verifyShop is completely removed (next() not called)', !next1Called);

    // TEST 2: Request with non-Bearer Authorization header
    const req2 = { headers: { authorization: 'Basic dXNlcjpwYXNz' }, query: { shop_id: '1' } };
    const res2 = createMockRes();
    let next2Called = false;
    await verifySessionToken(req2, res2, () => { next2Called = true; });
    assert('TEST 2: Non-Bearer header is rejected with 401', res2.statusCode === 401);
    assert('TEST 2: Fallback not triggered (next() not called)', !next2Called);

    // TEST 3: Valid Session Token (JWT)
    const req3 = { headers: { authorization: 'Bearer valid-admin-token' }, query: {} };
    const res3 = createMockRes();
    let next3Called = false;
    await verifySessionToken(req3, res3, () => { next3Called = true; });
    assert('TEST 3: Valid session token calls next()', next3Called);
    assert('TEST 3: Attaches verified req.shop.id = 1', req3.shop?.id === 1);
    assert('TEST 3: Attaches verified req.shopDomain = test-store.myshopify.com', req3.shopDomain === 'test-store.myshopify.com');
    assert('TEST 3: Populates req.query.shop_id and shop_domain for controller compatibility', 
        req3.query.shop_id === '1' && req3.query.shop_domain === 'test-store.myshopify.com');

    // TEST 4: Invalid/Tampered JWT
    const req4 = { headers: { authorization: 'Bearer invalid-garbage-token' }, query: {} };
    const res4 = createMockRes();
    let next4Called = false;
    await verifySessionToken(req4, res4, () => { next4Called = true; });
    assert('TEST 4: Tampered/invalid JWT returns 401', res4.statusCode === 401);
    assert('TEST 4: next() not called on invalid JWT', !next4Called);

    // TEST 5: Audience mismatch
    const req5 = { headers: { authorization: 'Bearer wrong-aud-token' }, query: {} };
    const res5 = createMockRes();
    await verifySessionToken(req5, res5, () => {});
    assert('TEST 5: Audience mismatch returns 401', res5.statusCode === 401);

    // TEST 6: Inactive shop
    const req6 = { headers: { authorization: 'Bearer inactive-shop-token' }, query: {} };
    const res6 = createMockRes();
    await verifySessionToken(req6, res6, () => {});
    assert('TEST 6: Inactive shop returns 401', res6.statusCode === 401);

    // TEST 7: /api/shops public bypass
    const req7 = { originalUrl: '/api/shops?domain=test-store.myshopify.com', headers: {}, query: {} };
    const res7 = createMockRes();
    let next7Called = false;
    await verifySessionToken(req7, res7, () => { next7Called = true; });
    assert('TEST 7: /api/shops bypass is preserved for initial domain lookup', next7Called);


    // -------------------------------------------------------------------------
    // PART B: verifyAppProxySignature (Storefront Widget /resolve-order)
    // -------------------------------------------------------------------------
    console.log('\n--- PART B: verifyAppProxySignature (Storefront App Proxy) ---');

    const validTimestamp = Math.floor(Date.now() / 1000) - 10; // 10 seconds ago (fresh)

    // TEST 8: Valid App Proxy signature
    const proxyParams8 = {
        shop: 'test-store.myshopify.com',
        path_prefix: '/apps/oryqx-support',
        timestamp: validTimestamp.toString(),
        logged_in_customer_id: 'cust_98765'
    };
    const signature8 = generateAppProxySignature(proxyParams8);
    const req8 = {
        query: { ...proxyParams8, signature: signature8 },
        body: { customer_message: 'Where is my order?' }
    };
    const res8 = createMockRes();
    let next8Called = false;
    await verifyAppProxySignature(req8, res8, () => { next8Called = true; });
    assert('TEST 8: Valid App Proxy signature calls next()', next8Called);
    assert('TEST 8: Correctly binds req.shop.id = 1', req8.shop?.id === 1);
    assert('TEST 8: Correctly binds req.shop.domain', req8.shop?.domain === 'test-store.myshopify.com');
    assert('TEST 8: Injects authenticated shop_id into req.body for resolveOrder', req8.body.shop_id === 1);
    assert('TEST 8: Captures logged_in_customer_id on req', req8.shopifyCustomerId === 'cust_98765');

    // TEST 9: Tampered query parameter (signature mismatch)
    const proxyParams9 = {
        shop: 'test-store.myshopify.com',
        path_prefix: '/apps/oryqx-support',
        timestamp: validTimestamp.toString()
    };
    const signature9 = generateAppProxySignature(proxyParams9);
    // Attacker modifies shop to another store
    const req9 = {
        query: { ...proxyParams9, shop: 'victim-store.myshopify.com', signature: signature9 },
        body: {}
    };
    const res9 = createMockRes();
    let next9Called = false;
    await verifyAppProxySignature(req9, res9, () => { next9Called = true; });
    assert('TEST 9: Tampered parameter is rejected with 401', res9.statusCode === 401);
    assert('TEST 9: Returns invalid signature error', res9.jsonData?.error?.includes('Invalid App Proxy HMAC signature'));
    assert('TEST 9: next() not called on signature mismatch', !next9Called);

    // TEST 10: Expired timestamp (>90 seconds old, replay attack)
    const staleTimestamp = Math.floor(Date.now() / 1000) - 150; // 150 seconds ago
    const proxyParams10 = {
        shop: 'test-store.myshopify.com',
        path_prefix: '/apps/oryqx-support',
        timestamp: staleTimestamp.toString()
    };
    const signature10 = generateAppProxySignature(proxyParams10);
    const req10 = {
        query: { ...proxyParams10, signature: signature10 },
        body: {}
    };
    const res10 = createMockRes();
    let next10Called = false;
    await verifyAppProxySignature(req10, res10, () => { next10Called = true; });
    assert('TEST 10: Replay attack with expired timestamp (>90s) rejected with 401', res10.statusCode === 401);
    assert('TEST 10: Error indicates timestamp expired', res10.jsonData?.error?.includes('timestamp expired'));
    assert('TEST 10: next() not called on expired timestamp', !next10Called);

    // TEST 11: Missing signature parameter
    const req11 = {
        query: { shop: 'test-store.myshopify.com', timestamp: validTimestamp.toString() },
        body: {}
    };
    const res11 = createMockRes();
    let next11Called = false;
    await verifyAppProxySignature(req11, res11, () => { next11Called = true; });
    assert('TEST 11: Missing signature rejected with 401', res11.statusCode === 401);
    assert('TEST 11: next() not called when signature is missing', !next11Called);

    // TEST 12: Inactive shop in App Proxy
    const proxyParams12 = {
        shop: 'inactive-store.myshopify.com',
        timestamp: validTimestamp.toString()
    };
    const signature12 = generateAppProxySignature(proxyParams12);
    const req12 = {
        query: { ...proxyParams12, signature: signature12 },
        body: {}
    };
    const res12 = createMockRes();
    await verifyAppProxySignature(req12, res12, () => {});
    assert('TEST 12: Inactive shop in App Proxy rejected with 403', res12.statusCode === 403);


    // -------------------------------------------------------------------------
    // PART C: resolveAuth Dual-Authentication on /resolve-order
    // -------------------------------------------------------------------------
    console.log('\n--- PART C: resolveAuth Middleware on /resolve-order ---');

    // TEST 13: Storefront App Proxy request to /resolve-order
    const req13 = {
        query: { ...proxyParams8, signature: signature8 },
        headers: {},
        body: { customer_message: 'Track my package' }
    };
    const res13 = createMockRes();
    let next13Called = false;
    await resolveAuth(req13, res13, () => { next13Called = true; });
    assert('TEST 13: resolveAuth routes valid App Proxy request to next()', next13Called);
    assert('TEST 13: Injects authenticated shop_id into req.body', req13.body.shop_id === 1);

    // TEST 14: Embedded Admin test simulator request (Bearer JWT)
    const req14 = {
        query: {},
        headers: { authorization: 'Bearer valid-admin-token' },
        body: { customer_message: 'Testing AI response' }
    };
    const res14 = createMockRes();
    let next14Called = false;
    await resolveAuth(req14, res14, () => { next14Called = true; });
    assert('TEST 14: resolveAuth routes valid Bearer JWT request to next()', next14Called);
    assert('TEST 14: Binds req.shop context from session token', req14.shop?.id === 1);

    // TEST 15: Unauthenticated attacker sending raw shop_id without JWT or signature
    const req15 = {
        query: { shop_id: '1' },
        headers: {},
        body: { shop_id: 1, customer_message: 'Malicious order inspection' }
    };
    const res15 = createMockRes();
    let next15Called = false;
    await resolveAuth(req15, res15, () => { next15Called = true; });
    assert('TEST 15: Unauthenticated caller sending raw shop_id rejected with 401', res15.statusCode === 401);
    assert('TEST 15: Rejection message specifies missing token or signature', 
        res15.jsonData?.error?.includes('Missing valid session token or App Proxy signature'));
    assert('TEST 15: next() NOT called (exploit prevented)', !next15Called);

    // TEST 16: JWT caller attempting cross-tenant body tampering (body shop_id: 999 with Shop 1 JWT)
    const req16 = {
        query: { shop_id: '999' },
        headers: { authorization: 'Bearer valid-admin-token' }, // Belongs to Shop 1
        body: { shop_id: 999, customer_message: 'Cross tenant attempt' }
    };
    const res16 = createMockRes();
    let next16Called = false;
    await resolveAuth(req16, res16, () => { next16Called = true; });
    assert('TEST 16: resolveAuth processes valid JWT session', next16Called);
    assert('TEST 16: req.shop.id is 1 from verified session', req16.shop?.id === 1);
    assert('TEST 16: Tampered body shop_id is overwritten with authenticated shop_id (1)', req16.body.shop_id === 1);
    assert('TEST 16: Tampered query shop_id is overwritten with authenticated shop_id (1)', req16.query.shop_id === '1');

    console.log('\n================================================================');
    console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Fatal error running tests:', err);
    process.exit(1);
});
