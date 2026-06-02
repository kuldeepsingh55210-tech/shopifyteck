# Implementation: Auto Shop ID Detection

## Problem
Frontend was hardcoding `shop_id: "1"` - not flexible for multiple shops

## Solution
Auto-detect shop_id from OAuth redirect, with manual fallback

## Changes Made

### Backend

**1. New Endpoint: `/api/shops`** (in `src/routes/api.js`)

```javascript
router.get('/shops', async (req, res) => {
    const { domain } = req.query;
    // Returns: { id: 1, domain: "...", is_active: true }
});
```

**2. Updated OAuth** (in `src/routes/shopify.js`)

```javascript
// Get shop_id and include in redirect
const shopResult = await db.query(
    'SELECT id FROM shops WHERE shop_domain = $1',
    [shop]
);
const shopId = shopResult.rows[0]?.id;
res.redirect(`${process.env.APP_URL}/success?shop=${shop}&shop_id=${shopId}`);
```

### Frontend

**1. Auto-Detect OAuth Redirect** (in `src/App.tsx`)

```typescript
const urlParams = new URLSearchParams(window.location.search);
const urlShopId = urlParams.get('shop_id');

if (urlShopId) {
    setShopId(urlShopId);
    localStorage.setItem('shop_id', urlShopId);
    fetchData(urlShopId);
}
```

**2. Support Manual Domain Lookup**

```typescript
if (shopId.includes('.')) {
    const res = await fetch(`/api/shops?domain=${shopId}`);
    const shop = await res.json();
    setShopId(shop.id.toString());
    fetchData(shop.id);
}
```

**3. Better UI**
- Show shop domain in header and login form
- Auto-load on OAuth redirect
- Clear error messages
- localStorage persistence

## OAuth Flow

```
User authorizes
  ↓
OAuth callback (get shop_id from DB)
  ↓
Redirect: /success?shop_id=1
  ↓
Frontend detects shop_id
  ↓
Dashboard loads automatically
```

## Key Features

✅ Auto-detect shop_id from OAuth  
✅ Persistent storage (localStorage)  
✅ Manual entry fallback  
✅ Domain lookup via API  
✅ No hardcoding  
✅ Better error handling  

## Testing

1. **OAuth Flow**: Complete OAuth, should auto-load
2. **Manual Entry**: Enter shop_id "1", should load
3. **Domain Lookup**: Enter domain, should lookup and load
4. **Persistence**: Refresh page, should load without login
5. **Logout**: Clear data, show login form again

## No Breaking Changes

- All existing API calls work
- Test form uses shop_id correctly
- Database and environment unchanged
- Backward compatible
