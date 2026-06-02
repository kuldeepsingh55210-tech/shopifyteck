#!/usr/bin/env node
/**
 * Test script to verify token encryption/decryption flow
 * Usage: node test-token.js
 */

require('dotenv').config();
const { encryptToken, decryptToken } = require('./src/utils/tokenEncryption');

console.log('\n🔐 TOKEN ENCRYPTION/DECRYPTION TEST\n');
console.log('='.repeat(60));

try {
    // Test 1: Encrypt a test Shopify token
    console.log('\n1️⃣  Testing token encryption...');
    const testToken = 'shpat_test1234567890abcdefghijklmnopqrst';
    console.log(`   Original token: ${testToken.substring(0, 20)}...`);

    const encrypted = encryptToken(testToken);
    console.log(`   Encrypted: ${encrypted.substring(0, 16)}:${encrypted.substring(encrypted.indexOf(':') + 1, encrypted.indexOf(':') + 17)}...`);

    if (!encrypted.includes(':')) {
        console.error('   ❌ FAILED: Encrypted token should have colon separator');
        process.exit(1);
    }
    console.log('   ✓ Encryption successful');

    // Test 2: Decrypt the token
    console.log('\n2️⃣  Testing token decryption...');
    const decrypted = decryptToken(encrypted);
    console.log(`   Decrypted: ${decrypted.substring(0, 20)}...`);

    if (decrypted !== testToken) {
        console.error('   ❌ FAILED: Decrypted token does not match original');
        console.error(`   Expected: ${testToken}`);
        console.error(`   Got: ${decrypted}`);
        process.exit(1);
    }
    console.log('   ✓ Decryption successful');

    // Test 3: Verify format validation
    console.log('\n3️⃣  Testing token format validation...');
    if (!decrypted.startsWith('shpat_') && !decrypted.startsWith('shpua_') && !decrypted.startsWith('shppa_')) {
        console.error('   ❌ FAILED: Decrypted token format invalid');
        process.exit(1);
    }
    console.log(`   ✓ Token format valid: ${decrypted.substring(0, 20)}...`);

    // Test 4: Test with actual DB token (if available)
    console.log('\n4️⃣  Testing with database...');
    const db = require('./src/db/db');

    db.query('SELECT access_token FROM shops WHERE id = 1 LIMIT 1')
        .then(result => {
            if (result.rows.length === 0) {
                console.log('   ⚠️  No shop found in database');
                console.log('\n✅ TOKEN TESTS PASSED (no DB shop to test)\n');
                process.exit(0);
            }

            const dbToken = result.rows[0].access_token;
            console.log(`   DB token format: ${dbToken.substring(0, 16)}:${dbToken.substring(dbToken.indexOf(':') + 1, dbToken.indexOf(':') + 17)}...`);

            try {
                const dbDecrypted = decryptToken(dbToken);
                console.log(`   Decrypted: ${dbDecrypted.substring(0, 20)}...`);

                if (dbDecrypted.startsWith('shpat_') || dbDecrypted.startsWith('shpua_') || dbDecrypted.startsWith('shppa_')) {
                    console.log('   ✓ Real Shopify token detected');
                } else {
                    console.warn(`   ⚠️  Token doesn't look like real Shopify token (no shpat_/shpua_/shppa_ prefix)`);
                    console.warn(`   Starts with: ${dbDecrypted.substring(0, 30)}...`);
                }

                console.log('\n✅ TOKEN TESTS PASSED\n');
                process.exit(0);
            } catch (decryptError) {
                console.error(`   ❌ Decryption failed: ${decryptError.message}`);
                console.error(`   This means TOKEN_ENCRYPTION_KEY is wrong or token is corrupted`);
                process.exit(1);
            }
        })
        .catch(err => {
            console.error('   ❌ Database error:', err.message);
            process.exit(1);
        });

} catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
}
