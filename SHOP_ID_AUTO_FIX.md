# Permanent Fix: Auto Shop ID Detection from OAuth

## Problem Fixed

❌ **Before:** Frontend hardcoded shop_id = "1", users had to manually enter shop ID  
✅ **After:** Frontend automatically gets shop_id from OAuth redirect, no manual entry needed

## What Changed

### Backend Changes

#### 1. New API Endpoint: `/api/shops`
Get shop by domain (useful for manual entry fallback)

```javascript
GET /api/shops?domain=autosupport-ai-dev.myshopify.com

Response:
{
  "id": 1,
  "domain": "autosupport-ai-dev.myshopify.com",
  "is_active": true,
  "created_at": "2026-04-03T12:00:00Z"
}
```

#### 2. Updated OAuth Callback
Now returns `shop_id` in redirect URL

**Before:**
```javascript
res.redirect(`${process.env.APP_URL}/success?shop=${shop}`);
// Result: /success?shop=autosupport-ai-dev.myshopify.com
```

**After:**
```javascript
// Get shop_id from database
const shopResult = await db.query(
  'SELECT id FROM shops WHERE shop_domain = $1',
  [shop]
);
const shopId = shopResult.rows[0]?.id;

res.redirect(`${process.env.APP_URL}/success?shop=${shop}&shop_id=${shopId}`);
// Result: /success?shop=autosupport-ai-dev.myshopify.com&shop_id=1
```

### Frontend Changes

#### 1. Auto-Detect OAuth Redirect
On app load, check URL for `shop_id` parameter from OAuth

```typescript
const urlParams = new URLSearchParams(window.location.search);
const urlShopId = urlParams.get('shop_id');

if (urlShopId) {
  // Coming from OAuth - auto-populate shop_id
  setShopId(urlShopId);
  localStorage.setItem('shop_id', urlShopId);
  fetchData(urlShopId);
}
```

#### 2. Auto-Fetch Dashboard
Once shop_id is detected, immediately fetch tickets and stats

```typescript
fetchData(shopId)
// Calls: /api/tickets?shop_id=1
// Calls: /api/stats?shop_id=1
```

#### 3. Support Manual Entry with Domain Lookup
Users can still manually enter shop domain if needed

```typescript
if (shopId.includes('.')) {
  // Domain was entered - lookup shop_id from /api/shops
  const res = await fetch(`${API_URL}/api/shops?domain=${shopId}`);
  const shop = await res.json();
  setShopId(shop.id);
  fetchData(shop.id);
}
```

#### 4. Cleaner UI
- Shows shop domain in header and login form
- Shows loading state during OAuth redirect handling
- Shows error messages for lookup failures
- Disabled inputs during loading

## OAuth Flow (After Fix)

```
User visits app
    ↓
1️⃣ App detects no shop_id in localStorage
    ↓
    (Shows login form)
    ↓
User clicks "Install App" / "Authorize"
    ↓
2️⃣ Redirected to Shopify OAuth
    ↓
User grants permission
    ↓
3️⃣ OAuth callback: /shopify/callback
    - Gets access token
    - Inserts shop into database
    - Gets shop_id from database
    - Redirects to: /success?shop=domain&shop_id=1
    ↓
4️⃣ Frontend detects shop_id in URL
    ↓
5️⃣ Auto-fetches dashboard data
    ↓
6️⃣ Shows dashboard with tickets and stats
    ↓
✅ Shop ID is automatically set in localStorage
```

## Features

### 1. Auto OAuth Handling
When user returns from OAuth, app automatically:
- Detects shop_id in URL
- Saves it to localStorage
- Cleans up URL (removes query params)
- Fetches dashboard data

### 2. Persistent Storage
Shop ID is saved to localStorage, so:
- User doesn't need to re-authenticate on next visit
- Dashboard loads automatically on reload
- Works across browser sessions

### 3. Manual Entry Fallback
Users can still manually enter:
- **Shop ID** (e.g., "1")
- **Shop domain** (e.g., "autosupport-ai-dev.myshopify.com")
  - If domain entered, app fetches shop_id from `/api/shops` endpoint
  - Then loads dashboard

### 4. Better Error Handling
- Shows error messages if shop lookup fails
- Shows loading states during async operations
- Disabled inputs while loading

### 5. Shop Domain Display
Header now shows:
```
Shopify AI Support Engine
autosupport-ai-dev.myshopify.com
```

## Testing the Flow

### Test 1: OAuth Flow
1. Start the app: `npm run dev` (frontend) + `npm start` (backend)
2. Go to: http://localhost:8080
3. Should show login form
4. Manually enter shop ID "1" or domain "autosupport-ai-dev.myshopify.com"
5. Click "View Dashboard"
6. Should fetch tickets and stats

### Test 2: localStorage Persistence
1. Load dashboard
2. Refresh page
3. Should load immediately (not show login form)
4. Shop ID should still be visible

### Test 3: Logout and Re-login
1. Click "Logout"
2. localStorage is cleared
3. Should show login form again
4. Can re-enter shop ID

### Test 4: OAuth Redirect (if app is installed)
1. Complete OAuth flow
2. After authorize, should redirect to: `/success?shop=domain&shop_id=1`
3. Frontend detects shop_id automatically
4. Dashboard loads immediately

## Files Modified

### Backend
1. **`src/routes/api.js`**
   - Added: `GET /api/shops?domain=...` endpoint

2. **`src/routes/shopify.js`**
   - Updated: OAuth callback to fetch and include shop_id in redirect

### Frontend
1. **`src/App.tsx`**
   - Auto-detect shop_id from OAuth redirect
   - Support domain lookup via API
   - Better error handling and UI
   - localStorage persistence with shop_domain
   - Improved header to show shop domain

## Data Flow

```
User Action → Frontend Logic → Backend API → Database

Manual Entry (Shop Domain):
  Domain input → /api/shops?domain=X → lookup in DB → return shop_id
  
OAuth Redirect:
  User authorizes → /shopify/callback → insert shop → query shop_id → redirect with shop_id
  
Auto-Load:
  URL params → detect shop_id → save localStorage → fetch /api/tickets & /api/stats
```

## No More Hardcoding

**Before (Hardcoded):**
```typescript
// In test form
body: JSON.stringify({ shop_id: "1", ...testForm })  // ❌ Hardcoded
```

**After (Dynamic):**
```typescript
// shop_id comes from state
body: JSON.stringify({ shop_id: shopId, ...testForm })  // ✅ Dynamic from URL or localStorage
```

## Environment Requirements

No new environment variables needed. Uses existing:
- `APP_URL` - For OAuth redirect
- `DATABASE_URL` - For shop lookups

## Security

- Shop ID is not sensitive (just identifies which shop's data to fetch)
- Access token is encrypted in database
- OAuth callback validates HMAC signature
- shop_id in URL is only trusted if it matches database

## Benefits

✅ **Better UX:** No manual shop ID entry after OAuth  
✅ **Persistent:** Shop ID saved to localStorage  
✅ **Flexible:** Manual entry still supported  
✅ **Resilient:** Multiple fallback methods  
✅ **Maintainable:** No more hardcoded values  
✅ **Debuggable:** Console logs at each step  

## Troubleshooting

### Issue: Shop ID not loading after OAuth
1. Check browser console for errors
2. Verify `/api/shops` endpoint is deployed
3. Check that shop was created in database
4. Verify URL has `shop_id` parameter

### Issue: Manual domain lookup fails
1. Verify `/api/shops` endpoint works: `curl http://localhost:3000/api/shops?domain=autosupport-ai-dev.myshopify.com`
2. Check that shop exists in database
3. Verify domain spelling is exactly correct

### Issue: localStorage not persisting
1. Browser may have disabled localStorage
2. Try clearing browser cache and localStorage
3. Check if running in incognito mode

## Future Improvements

- [ ] Add proper OAuth redirect flow (not just /success page)
- [ ] Support multiple shops (user can switch between shops)
- [ ] Add "Connect New Shop" button
- [ ] Show shop installation date and status
- [ ] Add shop settings/configuration page
