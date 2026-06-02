# Quick Reference: Shop ID Auto-Detection

## The Fix in One Sentence

✅ **Frontend automatically gets shop_id from OAuth redirect URL - no more hardcoding**

## OAuth Flow

```
User authorizes → /shopify/callback → DB saves shop → returns to /success?shop_id=1
                                      ↓
                                 Frontend detects
                                 shop_id in URL
                                 ↓
                              Loads dashboard
                              automatically
```

## API Endpoint Added

```bash
GET /api/shops?domain=autosupport-ai-dev.myshopify.com

Returns:
{
  "id": 1,
  "domain": "autosupport-ai-dev.myshopify.com",
  "is_active": true,
  "created_at": "2026-04-03T..."
}
```

## Frontend Changes

### Auto-Detect OAuth Redirect
```typescript
// On app load, check URL for shop_id
const urlParams = new URLSearchParams(window.location.search);
const urlShopId = urlParams.get('shop_id');

if (urlShopId) {
  setShopId(urlShopId);
  localStorage.setItem('shop_id', urlShopId);
  fetchData(urlShopId);
}
```

### Support Manual Domain Lookup
```typescript
// If user enters domain like "autosupport-ai-dev.myshopify.com"
const res = await fetch(`/api/shops?domain=${domain}`);
const shop = await res.json();
setShopId(shop.id);  // Get numeric ID
fetchData(shop.id);
```

## Files Changed

**Backend:**
- ✏️ `src/routes/api.js` - Added `/api/shops` endpoint
- ✏️ `src/routes/shopify.js` - OAuth callback now includes shop_id

**Frontend:**
- ✏️ `src/App.tsx` - Auto-detect shop_id, localStorage handling

## Usage

### After OAuth (Automatic)
1. User authorizes app in Shopify
2. Redirected to: `/success?shop=domain&shop_id=1`
3. Frontend detects `shop_id=1`
4. Dashboard loads automatically
5. ✓ Done - no manual entry needed

### Manual Entry (Fallback)
1. Enter shop ID: `1`
2. OR enter domain: `autosupport-ai-dev.myshopify.com`
3. Click "View Dashboard"
4. If domain entered, API lookup happens automatically
5. Dashboard loads

### Logout
1. Click "Logout"
2. localStorage cleared
3. Must re-enter shop ID or complete OAuth again

## localStorage Keys

```javascript
localStorage.getItem('shop_id')      // e.g., "1"
localStorage.getItem('shop_domain')  // e.g., "autosupport-ai-dev.myshopify.com"
```

## No More Hardcoding

**Test Resolution Form Now Uses:**
```typescript
// shop_id from state (from OAuth or manual entry)
body: JSON.stringify({
  shop_id: shopId,  // ✅ Dynamic, not hardcoded "1"
  customer_message: ...,
  order_number: ...,
  customer_email: ...
})
```

## Testing

```bash
# 1. Start frontend and backend
cd frontend && npm run dev
cd backend-v2 && npm start

# 2. Visit app
http://localhost:8080

# 3. Option A: Enter shop ID manually
Input: "1"
Click: "View Dashboard"

# 3. Option B: Enter domain manually
Input: "autosupport-ai-dev.myshopify.com"
Click: "View Dashboard"
(App will lookup shop_id from /api/shops)

# 4. After OAuth (if app installed)
Visit: http://localhost:3000/shopify/auth?shop=autosupport-ai-dev.myshopify.com
Authorize app
Gets redirected to: /success?shop=domain&shop_id=1
Frontend auto-loads dashboard
```

## Error Handling

If shop lookup fails:
```
❌ Shop not found: autosupport-ai-dev.myshopify.com
```

If API is unreachable:
```
❌ Failed to load dashboard data
```

Check backend logs for details.

## Summary of Benefits

| Before | After |
|--------|-------|
| ❌ Hardcoded shop_id="1" | ✅ Auto-detected from OAuth |
| ❌ Manual entry required | ✅ OAuth redirect auto-populates |
| ❌ No persistence | ✅ Saved to localStorage |
| ❌ Always asks for input | ✅ Loads immediately on refresh |
| ❌ One shop only | ✅ Can support multiple shops |

## Key Code Locations

**Backend OAuth callback that gets shop_id:**
```
src/routes/shopify.js - lines 24-45
```

**Backend new endpoint:**
```
src/routes/api.js - lines 4-30
```

**Frontend auto-detect logic:**
```
src/App.tsx - useEffect hook, lines 57-100
```

**Frontend manual entry with API lookup:**
```
src/App.tsx - handleShopSubmit function
```

## That's It!

✅ Shop ID is no longer hardcoded  
✅ OAuth automatically populates shop_id  
✅ Frontend handles all the logic  
✅ No more manual entry after OAuth  
✅ Persistent across page reloads
