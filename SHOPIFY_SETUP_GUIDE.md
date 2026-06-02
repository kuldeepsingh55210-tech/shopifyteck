# Shopify API Setup Guide

## Current Status

✅ Database setup: OK  
✅ Shop configured: `autosupport-ai-dev.myshopify.com`  
❌ **Access token: INVALID** (using test token)

The shop has a placeholder token `shpat_test_token_for_dev` which doesn't work with the Shopify API. You need a real access token.

---

## Option 1: Get Token via OAuth (Recommended for Production)

This is the proper way - the app initiates OAuth when a merchant installs it.

### Steps:

1. **Make sure your app is installed in the Shopify store:**
   - Go to https://admin.shopify.com/admin/settings/apps-and-integrations/develop
   - Find "AutoSupport AI" app
   - Install it in your development store

2. **Trigger the OAuth flow:**
   - Visit: `http://localhost:3000/shopify/auth?shop=autosupport-ai-dev.myshopify.com`
   - You'll be redirected to authorize the app
   - After authorization, you'll be redirected to `/success`
   - The token will be automatically saved to the database

3. **Verify it worked:**
   ```bash
   node diagnose.js
   ```
   Should show: ✓ API connection successful!

---

## Option 2: Manual Token for Development (Quick Testing)

If you need to test quickly, you can create a private app and get a token manually.

### Steps:

1. **Create a Private App in Shopify:**
   - Go to: https://admin.shopify.com/admin/settings/apps-and-integrations/develop
   - Click "Create app"
   - Choose "Private app" or "Custom app"
   - Name it: `AutoSupport AI Dev`

2. **Set Required Scopes:**
   - Under "Admin API access scopes", enable:
     - `read_orders` - to fetch order data
     - `read_fulfillments` - to get tracking info
   - Save

3. **Get the Access Token:**
   - In the app settings, find "API Credentials"
   - Copy the "Admin API access token" (starts with `shpat_`)
   - This is your access token

4. **Update the Database:**
   ```bash
   node update_shop_token.js shpat_xxxxx
   ```

5. **Verify:**
   ```bash
   node diagnose.js
   ```

---

## Troubleshooting

### Error: "Authentication failed (401)"

This means the token is:
1. ❌ Invalid/fake token (current issue)
2. ❌ Expired
3. ❌ Wrong shop domain
4. ❌ Missing required scopes

**Solution:**
- Get a fresh token from Shopify
- Update: `node update_shop_token.js <new_token>`
- Re-run: `node diagnose.js`

### Error: "Shop not found (404)"

The domain is wrong or the shop doesn't exist.

**Check:**
```bash
# Verify shop domain is correct
# Should be: autosupport-ai-dev.myshopify.com
node diagnose.js
```

### Error: "Shop has no orders"

You need to create a test order in Shopify to test with.

**Create test order:**
1. Go to Shopify admin: https://autosupport-ai-dev.myshopify.com/admin
2. Orders → Create order
3. Add a customer email and product
4. Note the order number (#1001, etc.)
5. Use it to test the API

---

## Verification Checklist

After setting up the token, run the diagnostic:

```bash
node diagnose.js
```

You should see:

```
✓ Step 1: Checking environment variables...
✓ Step 2: Checking database connection...
✓ Step 3: Checking shops in database...
  - Shop #1: autosupport-ai-dev.myshopify.com (active: true)

✓ Step 4: Testing access tokens...
  Testing shop #1 (autosupport-ai-dev.myshopify.com):
    - Token decrypted: shpat_xxxxx...xxxxx
    - Testing Shopify API call...
    ✓ API connection successful!
    ✓ Found X total order(s) in shop

✓ Step 5: Testing order lookup...
  ✓ Order lookup succeeded!
```

---

## Testing Order Lookup

Once your token is valid, test the order lookup:

```bash
curl -X POST http://localhost:3000/resolve-order \
  -H "Content-Type: application/json" \
  -d '{
    "shop_id": "1",
    "customer_message": "where is my order?",
    "order_number": "#1001",
    "customer_email": "test@example.com"
  }'
```

**Expected output:**
```json
{
  "action": "respond",
  "message": "Your order #1001 is currently unfulfilled. You'll receive a shipping confirmation once it ships.",
  "confidence": 82
}
```

---

## Backend Logs

With the new detailed logging, you'll see exactly what's happening:

```
[Order Lookup] START - Looking for order #1001
[Order Lookup] Step 1: Decrypting access token...
[Order Lookup] Token decrypted successfully: shpat_xxxxx...xxxxx
[Order Lookup] Step 2: Normalized order number: "#1001" → "1001"
[Order Lookup] Step 3: Fetching orders from Shopify API...
[Order Lookup] Page 1: Calling https://autosupport-ai-dev.myshopify.com/admin/api/2024-01/orders.json
[Order Lookup] Page 1: API call successful
[Order Lookup] Page 1: Found 50 orders
[Order Lookup] Sample order: name="#1001", customer_email=test@example.com
[Order Lookup] Total orders fetched: 50
[Order Lookup] ===== ALL ORDERS IN SHOP =====
  [0] name="#1001", email="test@example.com", id=123456, status=unfulfilled
  ...
[Order Lookup] ===== END OF ORDERS =====
[Order Lookup] Step 4: Searching for matching order...
[Order Lookup] ✓ MATCH FOUND! Order: #1001, Customer email: test@example.com
[Order Lookup] SUCCESS - Found order: #1001 with status unfulfilled
```

---

## Next Steps

1. **Get a valid Shopify access token** (OAuth or manual app)
2. **Update database:** `node update_shop_token.js <token>`
3. **Verify:** `node diagnose.js`
4. **Test:** Create an order in Shopify and test the API call
