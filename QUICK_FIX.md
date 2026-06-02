# Quick Fix: order_not_found Error

## The Problem

The backend can't find orders because **the Shopify access token is a test token, not a real one**.

When you try to resolve an order:
```json
{
  "action": "escalate",
  "reason": "order_not_found"
}
```

The backend logs show:
```
[Order Lookup] Authentication failed (401)
```

## The Solution (2 Steps)

### Step 1: Get a Real Shopify Access Token

**Option A: Via OAuth (Recommended)**

1. Make sure the app is installed in your store
2. Visit: `http://localhost:3000/shopify/auth?shop=autosupport-ai-dev.myshopify.com`
3. Click "Install" in Shopify
4. You'll be redirected to `/success`
5. Token is automatically saved! ✓

**Option B: Manual Setup**

1. Go to: https://admin.shopify.com/admin/settings/apps-and-integrations/develop
2. Create a new "Custom app"
3. Name: "AutoSupport AI Dev"
4. Enable scopes: `read_orders`, `read_fulfillments`
5. Save and reveal "Admin API access token"
6. Copy the token (starts with `shpat_`)

### Step 2: Update the Database

```bash
cd backend-v2
node update_shop_token.js shpat_your_real_token_here
```

Replace `shpat_your_real_token_here` with your actual token from Step 1.

## Verify It Works

```bash
cd backend-v2
node diagnose.js
```

You should see:
```
✓ Step 4: Testing access tokens...
  Testing shop #1 (autosupport-ai-dev.myshopify.com):
    ✓ API connection successful!
    ✓ Found 50 total order(s) in shop
```

If you see this, you're good! ✓

## Test It

1. Start the backend:
   ```bash
   cd backend-v2
   npm start
   ```

2. Create a test order in Shopify (if you don't have one)

3. Test the resolution:
   ```bash
   curl -X POST http://localhost:3000/resolve-order \
     -H "Content-Type: application/json" \
     -d '{
       "shop_id": "1",
       "customer_message": "where is my order?",
       "order_number": "#1001",
       "customer_email": "your_test_email@example.com"
     }'
   ```

4. Expected response:
   ```json
   {
     "action": "respond",
     "message": "Your order #1001 is currently unfulfilled...",
     "confidence": 82
   }
   ```

## See What's Happening

The new logging shows everything:

```
[Order Lookup] START - Looking for order #1001
[Order Lookup] Token decrypted successfully: shpat_xxxxx...xxxxx
[Order Lookup] Fetching orders from Shopify API...
[Order Lookup] Page 1: API call successful
[Order Lookup] Found 50 orders
[Order Lookup] ✓ MATCH FOUND! Order: #1001, Customer email: ...
[Order Lookup] SUCCESS - Found order: #1001 with status unfulfilled
```

## Debugging

If it still doesn't work:

1. **Check token is valid:**
   ```bash
   node diagnose.js
   ```

2. **Check you have orders in Shopify:**
   - Look for the exact order number you're testing with
   - Use the exact customer email from the order

3. **Check the logs:**
   ```bash
   npm start  # Start with logging enabled
   # Then make a request
   # Watch the terminal for detailed logs
   ```

4. **Common issues:**
   - Order doesn't exist: Create one in Shopify
   - Email doesn't match: Use the correct customer email
   - Token expired: Get a new one
   - Token doesn't have right scopes: Create new app with `read_orders` scope

## That's It!

Once you update the token, the `order_not_found` error will be fixed and you'll see real order data and confidence scores.

---

**Need help?** Check:
- `SHOPIFY_SETUP_GUIDE.md` - Detailed setup instructions
- `DEBUG_IMPROVEMENTS.md` - How the logging works
- `FIXES_SUMMARY.md` - All the fixes that were made
