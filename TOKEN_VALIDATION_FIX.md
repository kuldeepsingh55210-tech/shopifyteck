# Permanent Fix: Token Validation and Decryption

## Problem

The `order_not_found` error was happening because the encrypted access token from the database wasn't being properly validated before being used in the Shopify API call. This made it hard to diagnose whether the issue was:
1. Missing token
2. Corrupted token
3. Wrong encryption key
4. Invalid Shopify token
5. Token never decrypted

## Solution: Multi-Layer Token Validation

Added comprehensive token validation at every stage of the flow:

### 1. Validation in resolveController.js (After fetching shop from DB)

```javascript
// Check token exists
if (!shop.access_token || shop.access_token.trim().length === 0) {
    // Return error: missing_access_token
}

// Check token format (should be encrypted: "hexstring:hexstring")
if (!shop.access_token.includes(':')) {
    // Warning: token format unexpected
}

// Try to decrypt to verify it's valid
try {
    decryptionTest = decryptToken(shop.access_token);
    if (!decryptionTest || decryptionTest.trim().length === 0) {
        // Error: decrypted token is empty
    }
    // Success: log masked token
} catch (decryptError) {
    // Error: TOKEN_ENCRYPTION_KEY is wrong or token is corrupted
}
```

**Logs:**
```
[Resolve] Step 2.5: Validating access token...
[Resolve] Access token format valid: encrypted (4ba060fcf64bb616:2ead95cea9ed...)
[Resolve] Token decryption successful: shpat_xxxxx...xxxxx
```

### 2. Validation in orderLookupService.js (Step 1: Decrypt)

```javascript
// Check token is not empty
if (!encryptedAccessToken || encryptedAccessToken.trim().length === 0) {
    // Error: missing_access_token
}

// Check encrypted format
if (!encryptedAccessToken.includes(':')) {
    // Warning: token doesn't have expected encrypted format
}

// Decrypt token
try {
    accessToken = decryptToken(encryptedAccessToken);
    
    // Validate decrypted token
    if (!accessToken || accessToken.trim().length === 0) {
        // Error: decrypted token is empty
    }
    
    // Verify it looks like Shopify token
    if (!accessToken.startsWith('shpat_') && !accessToken.startsWith('shpua_') && !accessToken.startsWith('shppa_')) {
        // Warning: doesn't look like Shopify token
    }
} catch (decryptError) {
    // Error with detailed cause analysis
}
```

**Logs:**
```
[Order Lookup] Step 1: Validating encrypted token...
[Order Lookup] Encrypted token format: 4ba060fcf64bb616:2ead95cea9ed...
[Order Lookup] Attempting to decrypt token...
[Order Lookup] ✓ Token decrypted successfully: shpat_xxxxx...xxxxx
```

### 3. Critical Safety Check Before Shopify API Call

```javascript
// CRITICAL: Verify token is not encrypted before using
if (accessToken.includes(':')) {
    // This will cause 401 from Shopify - token is still encrypted
}

// Verify token format
if (!accessToken.startsWith('shpat_') && !accessToken.startsWith('shpua_') && !accessToken.startsWith('shppa_')) {
    // Warning: doesn't match Shopify format
}

// NOW safe to use in Shopify API
headers: { 'X-Shopify-Access-Token': accessToken }
```

**Logs:**
```
[Order Lookup] ✓ Token format valid: shpat_xxxxx...xxxxx
[Order Lookup] Page 1: Calling https://.../orders.json
[Order Lookup] Page 1: API call successful
```

## Error Messages Now

### Error 1: Missing Token
```
[Resolve] CRITICAL: Shop 1 has no access token in database
[Resolve] Action: escalate, reason: shop_configuration_error
```

### Error 2: Token Decryption Failed
```
[Resolve] CRITICAL: Token decryption failed
[Resolve] Error: Failed to decrypt access token
[Resolve] Possible causes:
  1. TOKEN_ENCRYPTION_KEY environment variable is wrong
  2. Token was encrypted with different key
  3. Token data is corrupted
[Resolve] Action: escalate, reason: shop_configuration_error
```

### Error 3: Invalid Shopify Token Format
```
[Order Lookup] WARNING: Decrypted token doesn't look like a Shopify token
[Order Lookup] Expected format: shpat_*, shpua_*, or shppa_*
[Order Lookup] Got: test_token_for_dev
[Order Lookup] This will likely result in 401 Unauthorized from Shopify
```

### Error 4: Token Still Encrypted at API Call (Safety Check)
```
[Order Lookup] CRITICAL: Token still appears to be encrypted (contains colon)
[Order Lookup] This will cause 401 Unauthorized from Shopify
[Order Lookup] Token: b894e768b6374131:326b420843b860...
[Order Lookup] Error: Token is still encrypted - decryption may have failed silently
```

## Validation Flow Diagram

```
resolveController.js
    ↓
[Step 2.5: Validate Token]
    ├─ Check: token exists? → if no, escalate with shop_configuration_error
    ├─ Check: encrypted format (has colon)? → if no, warning
    ├─ Try: decrypt token → if fails, escalate with detailed error
    └─ Check: decrypted token not empty? → if empty, escalate
    ↓
getOrderData() in orderLookupService.js
    ↓
[Step 1: Validate and Decrypt]
    ├─ Check: encrypted token not empty? → if empty, error
    ├─ Check: encrypted format? → warning if missing colon
    ├─ Try: decrypt token → if fails, return detailed error
    ├─ Check: decrypted token not empty? → if empty, error
    ├─ Check: token format (shpat_/shpua_/shppa_)? → warning if wrong
    └─ Masked token logged
    ↓
[Before Shopify API Call]
    ├─ CRITICAL CHECK: token NOT encrypted? → if still has colon, error
    ├─ CRITICAL CHECK: token format valid? → warning if wrong
    └─ Safe to use in Shopify API
    ↓
Shopify API Request
    └─ X-Shopify-Access-Token: [decrypted token]
```

## Files Modified

1. **`src/controllers/resolveController.js`**
   - Added import: `const { decryptToken } = require('../utils/tokenEncryption');`
   - Added Step 2.5: Token validation with test decryption
   - Added logging before getOrderData call

2. **`src/services/orderLookupService.js`**
   - Enhanced Step 1: Token validation with format checks
   - Added token format verification (shpat_, shpua_, shppa_)
   - Added CRITICAL safety check before API call
   - Detailed error messages for decryption failures
   - Logs token format at every stage

3. **New: `test-token.js`**
   - Test script for token encryption/decryption
   - Tests encryption and decryption round-trip
   - Tests format validation
   - Tests with real DB token

## Testing

### 1. Test Token Encryption/Decryption
```bash
cd backend-v2
node test-token.js
```

**Expected output:**
```
✓ Encryption successful
✓ Decryption successful
✓ Token format valid
✓ Real Shopify token detected
✅ TOKEN TESTS PASSED
```

### 2. Run Full Diagnostics
```bash
node diagnose.js
```

**Expected output:**
```
✓ Step 4: Testing access tokens...
  ❌ Authentication failed (401)
  ❌ The access token is invalid or expired
  👉 Fix: node update_shop_token.js <new_token>
```

### 3. Test with Real Shopify Token

Once you update with a real token:
```bash
node update_shop_token.js shpat_xxxxx
node test-token.js
# Should show: ✓ Real Shopify token detected
node diagnose.js
# Should show: ✓ API connection successful!
```

### 4. Test the Resolution Flow
```bash
npm start  # Start backend
# In another terminal:
curl -X POST http://localhost:3000/resolve-order \
  -H "Content-Type: application/json" \
  -d '{
    "shop_id": "1",
    "customer_message": "where is my order?",
    "order_number": "#1001",
    "customer_email": "test@example.com"
  }'
```

**Watch backend logs:**
```
[Resolve] Step 2.5: Validating access token...
[Resolve] Token decryption successful: shpat_xxxxx...xxxxx
[Order Lookup] Step 1: Validating encrypted token...
[Order Lookup] Token decrypted successfully: shpat_xxxxx...xxxxx
[Order Lookup] CRITICAL CHECK: Token format valid
[Order Lookup] Page 1: API call successful
[Order Lookup] ✓ MATCH FOUND! Order: #1001
[Resolve] ========== AUTO-RESOLVED (confidence: 82%) ==========
```

## Common Issues and Fixes

### Issue: Token Decryption Failed
```
[Resolve] CRITICAL: Token decryption failed
[Resolve] Error: Failed to decrypt access token
```

**Cause:** TOKEN_ENCRYPTION_KEY is wrong or token is corrupted

**Fix:**
1. Check `.env` file has valid TOKEN_ENCRYPTION_KEY
2. Regenerate token: `node update_shop_token.js <new_token>`
3. Run test: `node test-token.js`

### Issue: Token Format Invalid
```
[Order Lookup] WARNING: Decrypted token doesn't look like a Shopify token
[Order Lookup] Expected format: shpat_*, shpua_*, or shppa_*
[Order Lookup] Got: test_token_for_dev
```

**Cause:** Token is a test/placeholder, not real Shopify token

**Fix:**
1. Get real token from Shopify
2. Update: `node update_shop_token.js shpat_xxxxx`

### Issue: Token Still Encrypted at API Call
```
[Order Lookup] CRITICAL: Token still appears to be encrypted (contains colon)
```

**Cause:** Decryption failed silently or returned encrypted value

**Fix:**
1. Check TOKEN_ENCRYPTION_KEY
2. Regenerate token with: `node update_shop_token.js <token>`
3. Run diagnostic: `node diagnose.js`

## Security

- Tokens are never logged in full
- Masked format in logs: `shpat_xxxxx...xxxxx`
- Encryption key never exposed
- Safe error messages that don't leak token data
- Multiple validation layers prevent accidental encrypted token usage

## Summary

This fix ensures that:
1. ✅ Token exists before trying to use it
2. ✅ Token can be decrypted (validates encryption key)
3. ✅ Decrypted token is valid (not empty)
4. ✅ Token looks like Shopify token (format validation)
5. ✅ Token is not encrypted when passed to API (safety check)
6. ✅ Clear error messages at each validation point
7. ✅ Comprehensive logging for debugging
8. ✅ No sensitive data exposed in logs
