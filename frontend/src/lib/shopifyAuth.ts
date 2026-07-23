const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Gets a fresh session token from Shopify App Bridge.
 * Supports App Bridge v4 function call directly, or v3 fallback get() method.
 */
export async function getSessionToken(): Promise<string> {
  if (typeof window !== 'undefined' && (window as any).shopify) {
    const shopify = (window as any).shopify;

    // 1. Direct function call (App Bridge v4+)
    if (typeof shopify.idToken === 'function') {
      try {
        const token = await shopify.idToken();
        if (token) return token;
      } catch (err) {
        console.warn('[Shopify Auth] Failed to retrieve session token via direct idToken():', err);
      }
    }

    // 2. Object with .get() method (Legacy/Compatibility)
    if (shopify.idToken && typeof shopify.idToken.get === 'function') {
      try {
        const token = await shopify.idToken.get();
        if (token) return token;
      } catch (err) {
        console.warn('[Shopify Auth] Failed to retrieve session token via idToken.get():', err);
      }
    }

    throw new Error('Shopify App Bridge idToken API not available');
  }
  return '';
}

/**
 * Wrapper around global fetch that injects the Shopify Session Token.
 * If the API returns 401 Unauthorized, it redirects the parent window to re-authenticate.
 */
export async function authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getSessionToken();
  
  const headers: HeadersInit = {
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    console.warn('[Shopify Auth] Received 401 Unauthorized, redirecting to re-auth...');
    
    const params = new URLSearchParams(window.location.search);
    const shop = params.get('shop') || localStorage.getItem('shop_domain') || '';
    
    if (shop) {
      // Safe top-level frame cross-origin redirect using window.open(..., '_top')
      const reAuthUrl = `${API_URL}/shopify/auth?shop=${shop}`;
      window.open(reAuthUrl, '_top');
    }
  }

  return response;
}

/**
 * Performs Token Exchange authentication flow with backend.
 * Retrieves session token from App Bridge and sends { sessionToken, shop } to POST /shopify/token-exchange
 */
export async function performTokenExchange(shopDomain?: string): Promise<boolean> {
  try {
    const params = new URLSearchParams(window.location.search);
    const shop = shopDomain || params.get('shop') || localStorage.getItem('shop_domain') || '';
    if (!shop) {
      console.warn('[Shopify Auth] Token exchange skipped: missing shop domain parameter');
      return false;
    }

    const cleanShop = shop.trim().replace(/^https?:\/\//, '');
    const sessionToken = await getSessionToken();
    if (!sessionToken) {
      console.warn('[Shopify Auth] Token exchange skipped: no session token obtained from App Bridge');
      return false;
    }

    const response = await fetch(`${API_URL}/shopify/token-exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionToken,
        shop: cleanShop
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Shopify Auth] Token exchange request failed:', response.status, errorData);
      return false;
    }

    const data = await response.json();
    console.log('[Shopify Auth] Token exchange completed successfully:', data);
    return true;
  } catch (err) {
    console.error('[Shopify Auth] Token exchange error:', err);
    return false;
  }
}
