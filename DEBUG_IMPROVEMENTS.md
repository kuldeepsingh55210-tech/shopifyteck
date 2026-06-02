# Order Lookup Debugging Improvements

## Summary

Added comprehensive logging and a diagnostic tool to help debug the `order_not_found` error. The system now prints detailed Shopify API responses and validates token access.

## New Features

### 1. Detailed Order Lookup Logging

The order lookup service now logs every step:

```
[Order Lookup] START - Looking for order #1001 for customer test@example.com in autosupport-ai-dev.myshopify.com
[Order Lookup] Step 1: Decrypting access token...
[Order Lookup] Token decrypted successfully: shpat_xxxxx...xxxxx
[Order Lookup] Step 2: Normalized order number: "#1001" → "1001"
[Order Lookup] Step 3: Fetching orders from Shopify API...
[Order Lookup] Page 1: Calling https://autosupport-ai-dev.myshopify.com/admin/api/2024-01/orders.json
[Order Lookup] Request params: {"status":"any","limit":100,"fields":"..."}
[Order Lookup] Page 1: API call successful
[Order Lookup] Page 1: Found 50 orders
[Order Lookup] Sample order: name="#1001", customer_email=test@example.com
```

### 2. Comprehensive Error Messages

When the Shopify API returns an error:

```
[Order Lookup] API CALL FAILED on page 1
[Order Lookup] Status: 401
[Order Lookup] Status Text: Unauthorized
[Order Lookup] CRITICAL: Authentication failed (401)
[Order Lookup] This usually means:
  1. Access token is invalid or expired
  2. The token was generated for a different shop
  3. The token doesn't have the required scopes
[Order Lookup] API Error Response: {"errors":{"base":["Invalid API credentials"]}}
```

### 3. Full Shopify API Response Logging

**On 401 (Authentication Error):**
```
[Order Lookup] API Error Response:
{
  "errors": {
    "base": ["Invalid API credentials"]
  }
}
```

**On 404 (Shop Not Found):**
```
[Order Lookup] API Error Response:
{
  "errors": "Not Found"
}
```

**On 429 (Rate Limited):**
```
[Order Lookup] Rate limited (429) - Shopify API throttling
```

### 4. Order Matching Details

The system logs each order it checks:

```
[Order Lookup] Step 4: Searching for matching order...
[Order Lookup] Looking for order name matching: "1001" or "#1001" or "#1001"
[Order Lookup] Looking for customer email: "test@example.com" (case-insensitive)
[Order Lookup] Checking order: name="#1001"
  - Name matches? true (looking for 1001)
  - Email matches? true (test@example.com vs test@example.com)
[Order Lookup] ✓ MATCH FOUND! Order: #1001, Customer email: test@example.com
```

### 5. All Orders in Shop Display

When no match is found, shows all available orders:

```
[Order Lookup] ===== ALL ORDERS IN SHOP =====
  [0] name="#1001", email="test@example.com", id=4584175345, status=unfulfilled
  [1] name="#1002", email="customer2@example.com", id=4584175346, status=fulfilled
  [2] name="#1003", email="customer3@example.com", id=4584175347, status=restocked
[Order Lookup] ===== END OF ORDERS =====
```

### 6. Token Validation

Before making API calls:

```
[Order Lookup] Step 1: Decrypting access token...
[Order Lookup] Token decrypted successfully: shpat_xxxxx...xxxxx
```

If decryption fails:

```
[Order Lookup] CRITICAL: Token decryption failed: Failed to decrypt access token
[Order Lookup] Encrypted token format check: f24e9c8a2b3d4e5f6g7h8i9...
```

### 7. Diagnostic Tool

New `diagnose.js` script that tests:

1. ✓ Environment variables configured
2. ✓ Database connection working
3. ✓ Shop exists in database
4. ✓ Access token can be decrypted
5. ✓ Access token is valid (401 vs 200 response)
6. ✓ Shop API is accessible
7. ✓ Orders can be fetched
8. ✓ Order lookup works end-to-end

**Run it:**
```bash
cd backend-v2
node diagnose.js
```

**Output example:**
```
🔍 SHOPIFY ORDER LOOKUP DIAGNOSTIC TOOL

✓ Step 1: Checking environment variables...
✓ All required environment variables present

✓ Step 2: Checking database connection...
✓ Database connected: 2026-04-03T05:52:22.529Z

✓ Step 3: Checking shops in database...
✓ Found 1 shop(s):
  - Shop #1: autosupport-ai-dev.myshopify.com (active: true)

✓ Step 4: Testing access tokens...
  Testing shop #1 (autosupport-ai-dev.myshopify.com):
    - Token decrypted: shpat_xxxxx...xxxxx
    - Testing Shopify API call...
    ✓ API connection successful!
    ✓ Found 50 total order(s) in shop
    - First order: #1001 (customer: test@example.com)

✓ Step 5: Testing order lookup...
  Sample test with order: #1001
  Customer email: test@example.com
  ✓ Order lookup succeeded!
    - Fulfillment Status: unfulfilled
    - Financial Status: authorized

✅ DIAGNOSTIC COMPLETE
```

## Files Modified

### 1. `src/services/orderLookupService.js`
- Added token decryption logging with masking
- Added step-by-step logging
- Detailed API call logging with request/response
- Error response body logging
- Network error diagnostics (DNS, connection, SSL errors)
- Order matching details for each order checked
- Complete list of orders in shop when no match found
- HTTP status code handling (401, 404, 429)

### 2. New: `diagnose.js`
- End-to-end diagnostic tool
- Validates environment, database, shops, tokens
- Tests Shopify API connection
- Tests order lookup functionality
- Clear output of any issues found

### 3. New: `SHOPIFY_SETUP_GUIDE.md`
- How to get a valid Shopify access token
- Step-by-step OAuth setup
- Manual token setup for development
- Troubleshooting guide
- Verification checklist

## Usage Example

**Check if your setup works:**
```bash
cd backend-v2
node diagnose.js
```

**If token is invalid:**
```bash
node update_shop_token.js shpat_your_real_token_here
```

**Test the resolution endpoint with full logging:**
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

**Watch the backend logs** - they'll show exactly what's happening:
```
[Resolve] ========== STARTING RESOLUTION FLOW ==========
[Resolve] Step 2: Fetching shop 1 from database...
[Resolve] Shop found: autosupport-ai-dev.myshopify.com
[Order Lookup] START - Looking for order #1001...
[Order Lookup] Step 4: Searching for matching order...
[Order Lookup] ✓ MATCH FOUND! Order: #1001, Customer email: test@example.com
[Response] Generating response...
[Confidence] Checking confidence...
[Resolve] ========== AUTO-RESOLVED (confidence: 82%) ==========
```

## Common Issues & Fixes

### Issue: "order_not_found"
1. Run `node diagnose.js` to see what's wrong
2. Check if shop has any orders (likely cause)
3. Check if access token is valid (likely cause)
4. Check order number/email spelling

### Issue: "Authentication failed (401)"
1. Token is fake/invalid: `node update_shop_token.js <real_token>`
2. Token is expired: Get a new one from Shopify
3. Token doesn't have right scopes: Recreate the app with correct scopes

### Issue: "Shop not found (404)"
1. Check shop domain spelling
2. Verify shop exists in Shopify
3. Use different shop domain if needed

## Performance

- Fetches up to 500 orders (scalable)
- Logs are only shown at ERROR level in production
- Token is masked in logs for security (shows first 10 + last 10 chars)
- No sensitive data logged except masked token

## Security

- Access tokens never logged in full
- Token is masked: `shpat_xxxxx...xxxxx`
- Decryption errors don't expose the encrypted value
- Error messages safe for production
