# Fix: Shopify 403 Forbidden Error on Order Fetch

## Current Status

✅ Shop domain correct: `autosupport-ai-dev.myshopify.com`
✅ API endpoint format correct: `https://autosupport-ai-dev.myshopify.com/admin/api/2024-01/orders.json`
❌ **Token is test token, not real Shopify token**

## The Root Cause

You're getting **401 Unauthorized** (not 403), which means:
- The access token is invalid, fake, or expired
- Current token: `shpat_test_token_for_dev` (not a real Shopify token)

Real Shopify tokens start with: `shpat_` (access token) or `shpua_` (user token)

## 403 vs 401 Errors

| Error | Cause | Solution |
|-------|-------|----------|
| **401 Unauthorized** | Token invalid/expired/wrong shop | Get new token from Shopify |
| **403 Forbidden** | Token valid but lacks scope | Update app scopes: read_orders, read_fulfillments |
| **404 Not Found** | Wrong shop domain | Check shop domain format |
| **429 Rate Limit** | Too many requests | Wait and retry |

## Step 1: Get a Real Shopify Access Token

### Option A: Via OAuth (Recommended)

This is the proper production flow:

1. **Ensure app is properly configured:**
   - Go to: https://admin.shopify.com/admin/settings/apps-and-integrations/develop
   - Find "AutoSupport AI" custom app
   - Click to view details

2. **Verify app scopes are set:**
   - Look for "Admin API access scopes"
   - Should have: ✓ `read_orders` ✓ `read_fulfillments`
   - If not, add them and save

3. **Reveal the access token:**
   - Look for "Admin API credentials" section
   - Find "Admin API access token"
   - Copy it (starts with `shpat_`)

4. **Update the database:**
   ```bash
   cd backend-v2
   node update_shop_token.js shpat_YOUR_REAL_TOKEN_HERE
   ```
   Replace `shpat_YOUR_REAL_TOKEN_HERE` with your actual token

### Option B: Manual Private App (For Dev/Testing)

1. Go to: https://admin.shopify.com/admin/settings/apps-and-integrations/develop
2. Click "Create app"
3. Choose "Create an app manually"
4. Name: "AutoSupport AI Dev"
5. Configuration:
   - Admin API access scopes:
     - ✓ `read_orders`
     - ✓ `read_fulfillments`
   - Save app

6. In API credentials:
   - Click "Reveal token"
   - Copy the token
   - Should look like: `shpat_abc123def456...`

7. Update database:
   ```bash
   node update_shop_token.js shpat_abc123def456...
   ```

## Step 2: Verify the Token Works

```bash
cd backend-v2

# Check token
node check-shop-domain.js
```

Expected output:
```
🌐 API ENDPOINTS THAT WILL BE USED
2024-01: https://autosupport-ai-dev.myshopify.com/admin/api/2024-01/orders.json

✓ Status: 200 OK
✓ Orders found: 5
```

If still getting 401:
- Token is still fake/invalid
- Get a new one from Shopify
- Ensure it starts with `shpat_` or `shpua_`

If getting 403:
- Token is valid but lacks required scopes
- Add `read_orders` and `read_fulfillments` scopes in Shopify
- Regenerate token after updating scopes

## Step 3: Test the Full Flow

```bash
# Start backend
npm start

# In another terminal, test
curl -X POST http://localhost:3000/resolve-order \
  -H "Content-Type: application/json" \
  -d '{
    "shop_id": "1",
    "customer_message": "where is my order?",
    "order_number": "#1001",
    "customer_email": "test@example.com"
  }'
```

Expected response:
```json
{
  "action": "respond",
  "message": "Your order #1001 is currently unfulfilled. You'll receive a tracking update once it ships.",
  "confidence": 82
}
```

Backend logs should show:
```
[Resolve] ========== STARTING RESOLUTION FLOW ==========
[Resolve] Step 2.5: Validating access token...
[Resolve] Token decryption successful: shpat_xxxxx...xxxxx
[Order Lookup] Page 1: API call successful
[Order Lookup] ✓ MATCH FOUND! Order: #1001
[Resolve] ========== AUTO-RESOLVED (confidence: 82%) ==========
```

## What Each Error Means

### 401 Unauthorized
```
❌ UNAUTHORIZED (401)
Token is invalid or expired
```

**Fixes:**
1. Get real token from Shopify (not test token)
2. Make sure token starts with `shpat_` or `shpua_`
3. Update: `node update_shop_token.js shpat_real_token`
4. Verify: `node check-shop-domain.js`

### 403 Forbidden
```
❌ PERMISSION ERROR (403)
Possible causes:
  1. Token doesn't have read_orders scope
  2. Token is not for this shop
  3. API endpoint format is wrong
```

**Fixes:**
1. Open Shopify Admin → Apps and integrations
2. Edit "AutoSupport AI" app
3. Verify scopes: `read_orders` ✓ `read_fulfillments` ✓
4. If missing, add them and save
5. Regenerate token
6. Update database: `node update_shop_token.js shpat_new_token`

### 404 Not Found
```
❌ NOT FOUND (404)
The shop or endpoint doesn't exist
Check shop domain and API version
```

**Fixes:**
1. Verify shop domain in database: `node check-shop-domain.js`
2. Should be: `autosupport-ai-dev.myshopify.com`
3. No protocol (http://) or path (/admin)
4. Must end with `.myshopify.com`

## Checklist

- [ ] Got real Shopify access token (starts with `shpat_`)
- [ ] Updated database: `node update_shop_token.js shpat_xxx`
- [ ] Verified token works: `node check-shop-domain.js`
- [ ] See "✓ Status: 200 OK"
- [ ] Have test order in Shopify
- [ ] Know the order number and customer email
- [ ] Backend logs show successful order lookup
- [ ] Resolution returns confidence score 0-100%

## API Endpoints Used

The system uses:
```
GET https://autosupport-ai-dev.myshopify.com/admin/api/2024-01/orders.json
```

Parameters:
- `status: any` - Get all orders (not just specific status)
- `limit: 100` - Fetch up to 100 per page
- `fields: id,name,email,customer,fulfillment_status,...`

Headers:
- `X-Shopify-Access-Token: shpat_xxxx` (MUST be real, valid token)

## Troubleshooting

### Token is still test token
```bash
# See current token
node check-shop-domain.js
# Should show: shpat_REAL_TOKEN, not shpat_test_token_for_dev

# If still test token:
node update_shop_token.js shpat_your_real_token_from_shopify
```

### Can't find token in Shopify
1. Go to: https://admin.shopify.com/admin/settings/apps-and-integrations/develop
2. Look for your app in the list
3. Click it to view settings
4. Scroll to "Admin API credentials"
5. Token should be in a box labeled "Admin API access token"

### Token keeps expiring
Some test apps have short-lived tokens. Use a real private/custom app instead:
1. Create new app at: https://admin.shopify.com/admin/settings/apps-and-integrations/develop
2. Choose "Create an app manually"
3. Make sure to generate a token with the right scopes
4. That token should be stable

### Still getting errors after updating token
1. Run: `node test-token.js`
   - Should show "✓ Real Shopify token detected"
2. Run: `node check-shop-domain.js`
   - Should show "✓ Status: 200 OK"
3. Check backend logs when making request
   - Look for any error messages

## Next Steps

1. **Get real token:**
   - From Shopify Admin → Custom Apps → Your App → API Credentials
   - Copy "Admin API access token"

2. **Update database:**
   ```bash
   cd backend-v2
   node update_shop_token.js shpat_your_real_token
   ```

3. **Verify:**
   ```bash
   node check-shop-domain.js
   # Should show: ✓ Status: 200 OK
   ```

4. **Test:**
   ```bash
   npm start
   # Make API call with order number and customer email
   ```

5. **Check logs:**
   - Should show successful order lookup
   - Should return confidence score
   - Should auto-resolve or escalate (not error out)

**Once token is valid, the 401/403 errors will disappear and you'll see actual order data being fetched from Shopify.**
