# ⚡ Quick Start - Testing Shopify Integration

## 5-Minute Setup

### 1. Reset Database
```bash
cd backend-v2
node scripts/migrate.js
```

### 2. Start Server
```bash
npm start
# Server running on port 3000
```

### 3. Test Health
```bash
curl http://localhost:3000/health
# Response: {"status":"ok","timestamp":"..."}
```

---

## OAuth Test (2 min)

```bash
# Open in browser or click link:
http://localhost:3000/shopify/auth?shop=your-test-store.myshopify.com

# Authorize the app → You'll be redirected to success page
# Verify shop stored in database:
psql -U postgres -d shopify_ai_support -c "SELECT id, shop_domain, is_active FROM shops"
```

**Save the `id` (shop_id) from output** - you'll need it next.

---

## Webhook Registration (1 min)

```bash
curl -X POST http://localhost:3000/shopify/webhooks/register \
  -H "Content-Type: application/json" \
  -d '{"shop_id": 1}'  # Replace 1 with your shop_id

# Response should show 3 successful webhook registrations
```

**Verify in Shopify Admin:**
- Settings → Apps and Integrations → Develop Apps → Your App → Configuration
- Should see 3 webhook subscriptions

---

## Test Order Webhook (1 min)

### Option A: Use Shopify's Test Tool (Easiest)
1. Go to Shopify Admin → Settings → Apps → Develop Apps → Your App → Configuration
2. Find "orders/create" webhook → Click "..." → "Send test data"
3. **Check backend logs** - should see order received

**Verify in database:**
```bash
psql -U postgres -d shopify_ai_support -c "SELECT order_number, customer_email, financial_status FROM orders"
```

### Option B: Create Real Test Order
1. In your test store, place a test order
2. Complete payment
3. **Watch backend logs** for webhook delivery
4. **Check database** - order appears immediately

---

## 🐛 Troubleshooting (Common Issues)

| Problem | Solution |
|---------|----------|
| Database connection error | Start PostgreSQL or Docker Compose: `docker compose up postgres` |
| "Invalid HMAC" on OAuth | Verify `SHOPIFY_API_SECRET` in `.env` matches Shopify admin |
| Webhooks not registering | Check backend logs for GraphQL errors; verify token decryption works |
| Webhooks not delivered | Verify ngrok URL matches `APP_URL` in `.env`; check Shopify admin logs |
| Token decryption fails | Ensure `TOKEN_ENCRYPTION_KEY` is 64 hex characters |

---

## 📚 Full Documentation

- **Complete Guide**: See `TESTING_GUIDE.md`
- **Implementation Details**: See `IMPLEMENTATION_SUMMARY.md`
- **Troubleshooting**: See `TESTING_GUIDE.md#troubleshooting`

---

## ✅ What Works Now

- ✅ OAuth authentication with Shopify
- ✅ Secure token encryption/storage
- ✅ Webhook registration (REST API)
- ✅ Webhook signature validation
- ✅ Order creation/update tracking
- ✅ App uninstall handling
- ✅ Full order data persistence

---

## 🚀 Next Steps

1. **Verify all tests pass** using this guide
2. **Test AI order lookup** - `/resolve-order` endpoint
3. **Deploy to production** environment
4. **Monitor webhook delivery** in Shopify admin

Questions? Check `TESTING_GUIDE.md` or `IMPLEMENTATION_SUMMARY.md`
