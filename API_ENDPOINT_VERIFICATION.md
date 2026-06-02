# API Endpoint Verification - Order Fetch

## Endpoint Being Used

✅ **The endpoint is CORRECT**

```
GET https://autosupport-ai-dev.myshopify.com/admin/api/2024-01/orders.json
```

## Breakdown

| Component | Value | Status |
|-----------|-------|--------|
| **Protocol** | `https://` | ✅ Correct |
| **Shop Domain** | `autosupport-ai-dev.myshopify.com` | ✅ From DB |
| **API Prefix** | `/admin/api/` | ✅ Correct |
| **API Version** | `2024-01` | ✅ Supported |
| **Resource** | `/orders.json` | ✅ Correct |

## Full Request Details

```
GET https://autosupport-ai-dev.myshopify.com/admin/api/2024-01/orders.json

Headers:
  X-Shopify-Access-Token: shpat_xxxxxxxxxxxxxxxxxxxx

Query Parameters:
  status: any
  limit: 100
  fields: id,name,email,customer,fulfillment_status,financial_status,fulfillments,line_items
```

## Where Shop Domain Comes From

The shop domain is fetched from the database:

```javascript
const shopResult = await db.query(
    'SELECT * FROM shops WHERE id = $1 AND is_active = true',
    [shop_id]
);
const shop = shopResult.rows[0];

// Then used in the API call:
const apiUrl = `https://${shop.shop_domain}/admin/api/2024-01/orders.json`;
// Result: https://autosupport-ai-dev.myshopify.com/admin/api/2024-01/orders.json
```

## Current Shop in Database

```
Shop ID:      1
Shop Domain:  autosupport-ai-dev.myshopify.com
Is Active:    true
```

✅ Correct format (no protocol, no path)

## Verification

Run this to verify:
```bash
cd backend-v2
node check-shop-domain.js
```

You'll see:
```
🌐 API ENDPOINTS THAT WILL BE USED
============================================================
2024-01: https://autosupport-ai-dev.myshopify.com/admin/api/2024-01/orders.json
2024-04: https://autosupport-ai-dev.myshopify.com/admin/api/2024-04/orders.json
2025-01: https://autosupport-ai-dev.myshopify.com/admin/api/2025-01/orders.json
```

## Shopify API Documentation

The endpoint format matches Shopify's REST API spec:

```
GET https://{shop}.myshopify.com/admin/api/{version}/orders.json
```

Reference: https://shopify.dev/api/admin-rest/2024-01/resources/order

## Request Flow

```
User Request
    ↓
resolveController.js
    ↓
getOrderData(shop.shop_domain, ...)
    ↓
Shopify API Call:
    https://{shop_domain}/admin/api/2024-01/orders.json
    X-Shopify-Access-Token: {decrypted_token}
    ↓
Shopify Returns:
    200 OK + orders data
    OR
    401 Unauthorized (invalid token)
    OR
    403 Forbidden (missing scopes)
    OR
    404 Not Found (wrong domain)
```

## Why 403/401 Happens

| Status | Cause | Fix |
|--------|-------|-----|
| **200 OK** | ✓ Success | Token is valid, API call succeeds |
| **401 Unauthorized** | ✗ Token invalid | Get real token, update DB |
| **403 Forbidden** | ✗ Missing scope | Add read_orders scope |
| **404 Not Found** | ✗ Wrong domain | Check shop domain format |
| **429 Too Many** | ✗ Rate limit | Wait and retry |

## NOT a Problem With:

- ✓ API endpoint URL format
- ✓ Shop domain format
- ✓ API version (2024-01 is valid)
- ✓ Resource name (orders.json)
- ✓ Request headers
- ✓ Query parameters

## IS a Problem With:

- ✗ Access token (invalid/fake/expired)
- ✗ Access token scopes (missing read_orders)
- ✗ API credentials (wrong for this shop)

## Verification Checklist

- ✅ Shop domain in DB: `autosupport-ai-dev.myshopify.com`
- ✅ No protocol (http/https) in DB
- ✅ No path (/admin) in DB
- ✅ API endpoint format: `/admin/api/2024-01/orders.json`
- ✅ Token decrypted before API call
- ✅ Token header: `X-Shopify-Access-Token`
- ✅ Query parameters correct
- ✅ All scopes required: `read_orders`, `read_fulfillments`

## To Verify Yourself

```bash
# Check shop domain
cd backend-v2
node check-shop-domain.js

# Should show:
# 2024-01: https://autosupport-ai-dev.myshopify.com/admin/api/2024-01/orders.json
# ✓ Status: 200 OK
```

## Conclusion

✅ **The API endpoint is 100% correct**

If you're getting 403 or 401, the problem is:
- **Not** the endpoint format
- **Not** the shop domain
- **Not** the API version
- **IS** the access token (invalid/fake/expired/missing scope)

**Solution:** Get a real Shopify access token and update the database.
