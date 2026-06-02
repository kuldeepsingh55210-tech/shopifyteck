# 🧪 Complete Testing Guide - Shopify OAuth + Webhooks

## Prerequisites
- PostgreSQL running (or Docker: `docker compose up postgres`)
- Node.js 18+
- Active Shopify development store with API credentials
- ngrok tunnel running (`ngrok http 3000`) - already active on your ngrok URL
- `.env` file configured in `backend-v2/`

---

## 🔧 SETUP PHASE

### 1. Verify Environment Variables
```bash
cd backend-v2
cat .env
```

**Required variables:**
```
PORT=3000
DATABASE_URL=postgresql://postgres@localhost:5432/shopify_ai_support
SHOPIFY_API_KEY=your_key
SHOPIFY_API_SECRET=your_secret
GEMINI_API_KEY=your_key
TOKEN_ENCRYPTION_KEY=64_hex_chars
APP_URL=https://manually-prepunctual-leon.ngrok-free.dev
```

✅ Verify `APP_URL` matches your active ngrok URL

---

### 2. Reset Database & Run Migrations
```bash
# Drop old database (optional - full reset)
# psql -U postgres -c "DROP DATABASE IF EXISTS shopify_ai_support;"
# psql -U postgres -c "CREATE DATABASE shopify_ai_support;"

# Run migrations
cd backend-v2
node scripts/migrate.js
```

**Expected output:**
```
📦 Running database migrations...
Executing: CREATE TABLE IF NOT EXISTS shops ...
...
✅ Database migrations completed successfully!

📋 Created tables:
   - automation_logs
   - orders
   - shops
   - tickets
   - webhooks
```

---

### 3. Start Backend Server
```bash
cd backend-v2
npm install  # if needed
node index.js
```

**Expected output:**
```
Server is running on port 3000
```

Test health endpoint:
```bash
curl http://localhost:3000/health
# Response: {"status":"ok","timestamp":"2026-04-03T..."}
```

---

## 🔑 OAUTH PHASE

### Step 1: Trigger OAuth Flow
Open in browser or use curl:

```bash
curl "http://localhost:3000/shopify/auth?shop=your-test-store.myshopify.com"
```

This redirects to Shopify's OAuth authorization page. You'll be prompted to:
- Allow the app to read orders and fulfillments
- Accept the request

---

### Step 2: OAuth Callback & Token Storage
After authorizing, Shopify redirects to:
```
http://localhost:3000/shopify/callback?code=xxx&hmac=xxx&shop=your-test-store.myshopify.com
```

**What happens internally:**
1. HMAC validated ✓
2. Access token requested from Shopify ✓
3. Token encrypted with `TOKEN_ENCRYPTION_KEY` ✓
4. Encrypted token stored in `shops` table ✓

**Verify in database:**
```bash
psql -U postgres -d shopify_ai_support

SELECT id, shop_domain, is_active, created_at FROM shops;
```

**Expected output:**
```
 id |          shop_domain           | is_active |          created_at
----+--------------------------------+-----------+-------------------------------
  1 | your-test-store.myshopify.com | t         | 2026-04-03 10:15:32.123456
```

Save the `id` (shop_id) - you'll need it for the next step.

---

## 🪝 WEBHOOK REGISTRATION PHASE

### Step 3: Register Webhooks
```bash
curl -X POST http://localhost:3000/shopify/webhooks/register \
  -H "Content-Type: application/json" \
  -d '{"shop_id": 1}'
```

Replace `1` with your actual shop_id from previous step.

**Expected response:**
```json
{
  "shop_domain": "your-test-store.myshopify.com",
  "webhooks": [
    {
      "topic": "orders/create",
      "webhookId": "123456789",
      "status": "success"
    },
    {
      "topic": "orders/updated",
      "webhookId": "123456790",
      "status": "success"
    },
    {
      "topic": "app/uninstalled",
      "webhookId": "123456791",
      "status": "success"
    }
  ]
}
```

**Verify in database:**
```bash
SELECT shop_id, topic, webhook_id, address FROM webhooks;
```

**Verify in Shopify Admin:**
- Go to Settings → Apps and Integrations → Develop Apps
- Click on your app
- Scroll to "Configuration"
- You should see 3 webhook subscriptions registered

---

## 📦 WEBHOOK TESTING PHASE

### Step 4a: Test with Shopify's Webhook Tester (Recommended)

In Shopify Admin:
1. Go to Settings → Apps and Integrations → Develop Apps
2. Click your app → Configuration
3. Find each webhook subscription (orders/create, orders/updated)
4. Click the "..." menu → "Send test data"

**Watch backend logs** - you should see:
```
Order create webhook received for shop: your-test-store.myshopify.com
```

**Verify webhook data in database:**
```bash
SELECT id, shop_id, order_number, customer_email, fulfillment_status FROM orders;
```

---

### Step 4b: Test with Real Order Creation

1. In your test store, place a test order (as customer or via admin)
2. Complete payment
3. **Check backend logs** for webhook delivery confirmation
4. **Check database** - order should appear in `orders` table immediately

**Verify:**
```bash
SELECT id, order_number, customer_email, financial_status, fulfillment_status 
FROM orders 
WHERE shop_id = 1 
ORDER BY created_at DESC;
```

---

### Step 4c: Manual Webhook Simulation (For Development)

If webhooks aren't delivering, test signature validation directly:

```bash
# Generate a valid webhook signature
cat > /tmp/test_webhook.json << 'EOF'
{
  "id": 4388100038000,
  "email": "test@example.com",
  "created_at": "2026-04-03T10:00:00-05:00",
  "updated_at": "2026-04-03T10:00:00-05:00",
  "number": 1234,
  "note": null,
  "token": "example_token",
  "gateway": "shopify_payments",
  "test": true,
  "total_price": "99.99",
  "subtotal_price": "99.99",
  "total_weight": 0,
  "currency": "USD",
  "financial_status": "paid",
  "fulfillment_status": "unfulfilled",
  "customer": {
    "id": 1,
    "email": "test@example.com",
    "first_name": "Test",
    "last_name": "Customer"
  }
}
EOF

# Calculate HMAC
PAYLOAD=$(cat /tmp/test_webhook.json)
SECRET="your-shopify-api-secret"  # Replace with your secret
HMAC=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64)

# Send webhook
curl -X POST http://localhost:3000/webhooks/orders_create \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-SHA256: $HMAC" \
  -H "X-Shopify-Topic: orders/create" \
  -H "X-Shopify-Shop-API-Shop-Domain: your-test-store.myshopify.com" \
  -d "$PAYLOAD"
```

**Expected response:**
```json
{"success": true}
```

---

## ✅ VERIFICATION CHECKLIST

After completing all steps, verify:

### OAuth ✓
- [ ] Shop record exists in `shops` table
- [ ] `access_token` is encrypted (starts with hex:hex format)
- [ ] `is_active = true`

### Webhooks ✓
- [ ] 3 webhook records exist in `webhooks` table
- [ ] Each has a `webhook_id`, `topic`, and `address`
- [ ] Webhooks visible in Shopify admin

### Order Data ✓
- [ ] Order created: `orders` table has records
- [ ] Order updated: `orders.updated_at` changes when order modified
- [ ] Data includes: `order_number`, `customer_email`, `financial_status`, `fulfillment_status`
- [ ] Full order JSON stored in `order_data` (JSONB column)

### App Uninstall ✓
- [ ] Uninstall app from test store
- [ ] Check backend logs for uninstall webhook
- [ ] Verify `shops.is_active = false` in database
- [ ] Verify `webhooks` records deleted for that shop

---

## 🐛 Troubleshooting

### "Invalid HMAC" on OAuth callback
- Verify `SHOPIFY_API_SECRET` in `.env` matches Shopify admin
- Verify `APP_URL` matches ngrok URL exactly

### Webhooks not registered
- Check backend logs for GraphQL errors
- Verify access token is being decrypted correctly
- Ensure `2024-01` API version is available for your store

### Webhooks not being delivered
- Check Shopify admin → Settings → Logs for webhook delivery status
- Verify ngrok URL is still active and forwarding to `localhost:3000`
- Check that `X-Shopify-Hmac-SHA256` matches calculated value

### Token decryption fails
- Verify `TOKEN_ENCRYPTION_KEY` is 64 hex characters (32 bytes)
- Ensure key hasn't changed between OAuth and order lookup

---

## 📊 Sample Queries for Verification

```bash
# Show all shops
SELECT id, shop_domain, is_active FROM shops;

# Show all webhooks
SELECT shop_id, topic, webhook_id FROM webhooks;

# Show all orders
SELECT id, shop_id, order_number, customer_email, financial_status FROM orders;

# Show recent tickets (if testing order resolution)
SELECT id, shop_id, detected_intent, resolution_status FROM tickets ORDER BY created_at DESC;

# Show webhook logs
SELECT action_taken, shopify_data_snapshot FROM automation_logs ORDER BY created_at DESC LIMIT 10;
```

---

## 🎯 Next Steps After Testing

Once all tests pass:
1. Deploy to production environment
2. Register webhooks in production store
3. Monitor webhook delivery and order processing
4. Test AI order lookup and auto-response generation
