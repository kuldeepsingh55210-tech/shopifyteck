const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Gets a fresh session token from Shopify App Bridge.
 */
export async function getSessionToken(): Promise<string> {
  if (typeof window !== 'undefined' && (window as any).shopify?.idToken) {
    try {
      const token = await (window as any).shopify.idToken.get();
      if (token) return token;
    } catch (err) {
      console.warn('[Shopify Auth] Failed to retrieve session token:', err);
    }
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
      // Direct parent page to backend re-authentication route
      window.top!.location.href = `${API_URL}/shopify/auth?shop=${shop}`;
    }
  }

  return response;
}
