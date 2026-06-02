# Complete Guide: Fix Shopify 403/401 Order Fetch Error

## Current Problem

❌ Getting error when trying to fetch orders from Shopify  
❌ Error code: **401 Unauthorized** (or 403 Forbidden)  
❌ Root cause: **Access token is test token, not real Shopify token**

## Quick Diagnosis

Run this command:
```bash
cd backend-v2
node check-shop-domain.js
```

You'll see:
```
🔴 DETECTED: This is a TEST TOKEN, not a real Shopify access token!
   You MUST get a real token from Shopify Admin.
```

## Solution (3 Simple Steps)

### Step 1: Get Real Access Token from Shopify

1. **Open Shopify Admin:**
   - Go to: https://admin.shopify.com/admin/settings/apps-and-integrations/develop

2. **Find Your App:**
   - Look for "AutoSupport AI" in the list
   - Click it to open app details

3. **Get the Token:**
   - Scroll down to "Admin API credentials"
   - Look for the box labeled "Admin API access token"
   - Copy the token (it starts with `shpat_`)
   - It should look like: `shpat_abc123def456ghi789...`

4. **Save it somewhere safe temporarily** (you'll use it in Step 2)

### Step 2: Update the Database

```bash
cd backend-v2
node update_shop_token.js shpat_abc123def456ghi789
```

Replace `shpat_abc123def456ghi789` with your actual token from Step 1.

You should see:
```
Shop token updated successfully:
{ id: 1, shop_domain: 'autosupport-ai-dev.myshopify.com' }
```

### Step 3: Verify It Works

```bash
cd backend-v2
node check-shop-domain.js
```

**Success output should show:**
```
✓ Status: 200 OK
✓ Orders found: 5
```

**If still getting 401:**
- Token is still fake
- Get a REAL token from Shopify (not test token)
- Make sure it starts with `shpat_` or `shpua_`

**If getting 403:**
- Token is valid but missing scopes
- See "Fix 403 Permission Error" section below

## Test the Full System

Once token is updated:

```bash
# Start backend
npm start

# In another terminal, test:
curl -X POST http://localhost:3000/resolve-order \
  -H "Content-Type: application/json" \
  -d '{
    "shop_id": "1",
    "customer_message": "where is my order?",
    "order_number": "#1001",
    "customer_email": "test@example.com"
  }'
```

**Expected response:**
```json
{
  "action": "respond",
  "message": "Your order #1001 is currently unfulfilled. You'll receive a tracking update once it ships.",
  "confidence": 82
}
```

**Backend logs should show:**
```
[Resolve] Step 2.5: Validating access token...
[Resolve] Token decryption successful: shpat_xxxxx...xxxxx
[Order Lookup] Page 1: API call successful
[Order Lookup] ✓ MATCH FOUND! Order: #1001
[Resolve] ========== AUTO-RESOLVED (confidence: 82%) ==========
```

## Troubleshooting Different Errors

### Error: "401 Unauthorized"

**This means:** Token is invalid, fake, or expired

**To fix:**
```bash
cd backend-v2
node check-shop-domain.js
```

If you see:
```
🔴 DETECTED: This is a TEST TOKEN, not a real Shopify access token!
```

Then:
1. Get real token from Shopify
2. Run: `node update_shop_token.js shpat_REAL_TOKEN`
3. Verify: `node check-shop-domain.js`

### Error: "403 Forbidden"

**This means:** Token is valid but lacks required permissions

**To fix:**
1. Go to: https://admin.shopify.com/admin/settings/apps-and-integrations/develop
2. Click your "AutoSupport AI" app
3. Look for "Admin API access scopes"
4. Make sure you have:
   - ✓ `read_orders`
   - ✓ `read_fulfillments`
5. If missing, add them
6. Click "Save"
7. Regenerate token
8. Update database: `node update_shop_token.js shpat_NEW_TOKEN`

### Error: "404 Not Found"

**This means:** Shop domain is wrong

**To fix:**
```bash
cd backend-v2
node check-shop-domain.js
```

Check the output:
```
Shop Domain: autosupport-ai-dev.myshopify.com
```

Should be:
- ✓ `autosupport-ai-dev.myshopify.com` (correct)
- ✗ `https://autosupport-ai-dev.myshopify.com` (wrong - has https)
- ✗ `autosupport-ai-dev.myshopify.com/admin` (wrong - has /admin)

If wrong, update database directly:
```bash
sqlite3 shopify.db "UPDATE shops SET shop_domain = 'autosupport-ai-dev.myshopify.com' WHERE id = 1;"
```

## Verify Shop Configuration

**Check shop domain is correct:**
```bash
cd backend-v2
node check-shop-domain.js
```

Output should show:
```
📊 SHOP CONFIGURATION
Shop ID: 1
Shop Domain: autosupport-ai-dev.myshopify.com
Is Active: true

✓ Status: 200 OK
✓ Orders found: 5
```

## Complete Checklist

- [ ] Opened https://admin.shopify.com/admin/settings/apps-and-integrations/develop
- [ ] Found "AutoSupport AI" app in the list
- [ ] Clicked to view app details
- [ ] Scrolled to "Admin API credentials"
- [ ] Copied "Admin API access token" (starts with `shpat_`)
- [ ] Ran: `node update_shop_token.js shpat_YOUR_TOKEN`
- [ ] Ran: `node check-shop-domain.js`
- [ ] Saw: "✓ Status: 200 OK"
- [ ] Created test order in Shopify (with an email)
- [ ] Noted order number (e.g., #1001)
- [ ] Noted customer email
- [ ] Started backend: `npm start`
- [ ] Made test API call with order number and email
- [ ] Saw success response with confidence score

## Files That Help Diagnose Issues

1. **`check-shop-domain.js`** - Tests Shopify API connection
   ```bash
   node check-shop-domain.js
   ```

2. **`test-token.js`** - Tests token encryption/decryption
   ```bash
   node test-token.js
   ```

3. **`diagnose.js`** - Full system diagnostic
   ```bash
   node diagnose.js
   ```

4. **`update_shop_token.js`** - Update token in database
   ```bash
   node update_shop_token.js shpat_YOUR_TOKEN
   ```

## API Endpoints Being Used

The system makes calls to:
```
GET https://autosupport-ai-dev.myshopify.com/admin/api/2024-01/orders.json
```

With header:
```
X-Shopify-Access-Token: shpat_YOUR_REAL_TOKEN
```

This is:
- ✓ Correct endpoint format
- ✓ Correct API version (2024-01)
- ✓ Correct shop domain format (no http://, no /admin)
- ✓ Correct header name

If you're getting 403 or 401, it's because:
- ✗ Token is invalid/test token (401)
- ✗ Token lacks scopes (403)
- ✗ Token is expired (401)

## What Happens After Fix

Once the real token is in place:

1. **Backend validates token:**
   - Checks it exists
   - Checks it can be decrypted
   - Checks it looks like Shopify token

2. **Backend calls Shopify API:**
   - Fetches all orders from the shop
   - Searches for matching order by number and email

3. **Backend processes order:**
   - Extracts fulfillment status
   - Generates AI response
   - Calculates confidence score
   - Returns auto-resolved or escalated response

**Logs show:**
```
[Order Lookup] Page 1: API call successful
[Order Lookup] Found 50 orders
[Order Lookup] ✓ MATCH FOUND! Order: #1001
[Resolve] ========== AUTO-RESOLVED (confidence: 82%) ==========
```

## Contact Shopify Support If Needed

If you still can't get the token to work:

1. Verify your shop has the app installed
2. Verify you have access to the "Apps and integrations" settings
3. Try creating a new custom app
4. Ensure scopes are: `read_orders`, `read_fulfillments`
5. Contact Shopify support if the app keeps failing

## Next Steps

1. **Get real token** from Shopify Admin
2. **Update database** with `node update_shop_token.js`
3. **Verify it works** with `node check-shop-domain.js`
4. **Test the full flow** with a curl request
5. **Check backend logs** to see successful order lookup

**Once these 5 steps are done, the order_not_found error will be completely fixed.**
