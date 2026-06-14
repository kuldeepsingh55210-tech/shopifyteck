import React, { useEffect, useState } from 'react';
import { ShieldAlert, ExternalLink } from 'lucide-react';

interface AppProviderProps {
  children: React.ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [isEmbedded, setIsEmbedded] = useState<boolean | null>(null);
  const [shop, setShop] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hostParam = params.get('host');
    const shopParam = params.get('shop') || '';

    setShop(shopParam);

    // If host parameter is present, we assume it's running inside Shopify iframe
    if (hostParam) {
      setIsEmbedded(true);
      // Persist host and shop to localStorage for convenience
      localStorage.setItem('shopify_host', hostParam);
      if (shopParam) {
        localStorage.setItem('shop_domain', shopParam);
      }
    } else {
      setIsEmbedded(false);
    }
  }, []);

  if (isEmbedded === null) {
    // Render brief loading screen during initial parameter detection
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0B0F] text-[var(--text)] font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin"></div>
          <span className="text-xs font-mono text-[var(--text-muted)] tracking-widest uppercase">Detecting Environment...</span>
        </div>
      </div>
    );
  }

  if (!isEmbedded) {
    // Show premium Cyber-Enterprise Neon error warning page when loaded standalone
    const apiKey = import.meta.env.VITE_SHOPIFY_API_KEY || '';
    const cleanShop = shop.trim().replace(/^https?:\/\//, '');
    const installUrl = cleanShop 
      ? `https://${cleanShop}/admin/oauth/authorize?client_id=${apiKey}&scope=read_orders,read_fulfillments,write_orders,write_price_rules,read_price_rules,write_discounts,read_discounts&redirect_uri=${window.location.origin}/shopify/callback`
      : '#';

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0B0F] relative overflow-hidden font-sans text-[var(--text)] px-4">
        {/* Floating Neon Background Orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-[var(--primary)]/10 blur-[130px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-[var(--secondary)]/10 blur-[130px] pointer-events-none"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-30 pointer-events-none"></div>

        <div className="relative z-10 w-full max-w-md p-8 backdrop-blur-xl bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.5)] text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#0a0b0f] border border-[var(--border)] flex items-center justify-center p-1 shadow-[0_0_20px_var(--border-glow)] mb-6 mx-auto text-[var(--danger)]">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <h1 className="text-xl font-bold font-display text-white mb-2 tracking-tight">Shopify Admin Access Required</h1>
          <p className="text-[var(--text-muted)] text-sm mb-6 leading-relaxed">
            This app is a Shopify Embedded App and must be opened from inside your Shopify Admin dashboard.
          </p>

          {cleanShop ? (
            <div className="space-y-4">
              <div className="p-3 bg-slate-950/40 border border-[var(--border)]/55 rounded-xl text-left">
                <span className="text-[10px] font-bold text-[var(--text-muted)] font-mono uppercase tracking-wider block mb-1">Target Shop Domain</span>
                <span className="text-sm font-mono text-white block truncate">{cleanShop}</span>
              </div>

              <a
                href={installUrl}
                target="_top"
                className="w-full py-2.5 rounded-lg font-semibold text-[#0A0B0F] bg-[var(--primary)] hover:bg-[var(--primary-container)] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(196,192,255,0.25)] transform active:scale-[0.98]"
              >
                <span>Authorize & Install App</span>
                <ExternalLink className="w-4 h-4 text-[#0A0B0F]" />
              </a>
            </div>
          ) : (
            <div className="p-4 bg-yellow-500/5 border border-yellow-500/15 rounded-xl text-left mb-2">
              <span className="text-[10px] font-bold text-[var(--warning)] font-mono uppercase tracking-wider block mb-1">Store Parameter Missing</span>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-sans">
                Please open this application directly from the Apps list inside your Shopify Admin dashboard.
              </p>
            </div>
          )}

          <div className="mt-8 text-xs text-[var(--text-muted)] border-t border-[var(--border)]/30 pt-4">
            If you need technical assistance, contact <span className="text-[var(--primary)] font-semibold">support@oryqx.com</span>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
