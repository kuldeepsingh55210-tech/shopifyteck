import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Plug, Power, ShieldCheck } from 'lucide-react';
import { GlassCard } from '../GlassCard';

interface StoresProps {
  currentShopDomain: string;
  currentShopId: string;
  totalTicketsThisMonth: number;
  onDisconnectStore: () => void;
}

const formatStoreName = (domain: string) => {
  if (!domain) return 'My Shopify Store';
  const handle = domain.replace('.myshopify.com', '');
  return handle
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export const Stores: React.FC<StoresProps> = ({
  currentShopDomain,
  currentShopId,
  totalTicketsThisMonth,
  onDisconnectStore
}) => {
  const [copied, setCopied] = useState(false);
  const isOnline = Boolean(currentShopDomain && currentShopId);
  const storeDomain = currentShopDomain || 'No Shopify store connected';
  const storeName = formatStoreName(currentShopDomain);
  const lastSyncTime = isOnline ? 'Just now' : 'Not synced';
  const widgetScript = `<script src="https://api.oryqx.com/widget.js" data-shop="${currentShopDomain}" async></script>`;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(widgetScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white font-display">My Store</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">Manage the Shopify store connected to this ORYQX workspace.</p>
        </div>
        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold font-mono border w-fit ${isOnline ? 'bg-emerald-500/10 text-[var(--tertiary)] border-emerald-500/20' : 'bg-rose-500/10 text-[var(--danger)] border-rose-500/20'}`}>
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[var(--tertiary)] led-pulse' : 'bg-[var(--danger)]'}`} />
          {isOnline ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <GlassCard className="lg:col-span-7 p-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 border border-[var(--primary)]/25 flex items-center justify-center text-[var(--primary)]">
                <Plug size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-display">{storeName}</h3>
                <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">{storeDomain}</p>
              </div>
            </div>
            <a
              href={currentShopDomain ? `https://${currentShopDomain}/admin` : undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={`p-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-white hover:border-[var(--primary)] transition ${currentShopDomain ? '' : 'pointer-events-none opacity-40'}`}
              title="Open Shopify Admin"
            >
              <ExternalLink size={15} />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[var(--surface-low)] border border-[var(--border)]">
              <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider">Connection Status</span>
              <span className={`text-sm font-bold mt-2 block ${isOnline ? 'text-[var(--tertiary)]' : 'text-[var(--danger)]'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-[var(--surface-low)] border border-[var(--border)]">
              <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider">Last Sync</span>
              <span className="text-sm font-bold text-white mt-2 block">{lastSyncTime}</span>
            </div>
            <div className="p-4 rounded-xl bg-[var(--surface-low)] border border-[var(--border)]">
              <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider">Tickets This Month</span>
              <span className="text-sm font-bold text-white mt-2 block">{totalTicketsThisMonth.toLocaleString()}</span>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[var(--tertiary)] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Merchant data isolation is active.</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">This dashboard is scoped to the connected Shopify store only.</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-5 p-6">
          <h3 className="text-base font-bold text-white font-display">Widget Installation Script</h3>
          <p className="text-xs text-[var(--text-muted)] mt-1 mb-5">Paste this before the closing body tag in your Shopify theme.</p>

          <div className="relative p-4 pr-12 rounded-xl bg-[#0A0B0F] border border-[var(--border)] font-mono text-[10px] break-all select-all min-h-[96px]">
            <span className="text-[var(--text-secondary)]">{widgetScript}</span>
            <button
              onClick={handleCopyScript}
              disabled={!currentShopDomain}
              className="absolute right-3 top-3 p-2 rounded-lg bg-[var(--surface-low)] border border-[var(--border)] text-[var(--text-muted)] hover:text-white hover:border-[var(--primary)] transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Copy widget script"
            >
              {copied ? <Check size={13} className="text-[var(--tertiary)]" /> : <Copy size={13} />}
            </button>
          </div>

          {copied && (
            <p className="text-[10px] text-[var(--tertiary)] font-mono mt-3">Copied widget script to clipboard.</p>
          )}

          <button
            onClick={onDisconnectStore}
            className="w-full mt-6 py-2.5 px-4 rounded-lg border border-red-500/25 bg-red-500/5 text-[var(--danger)] text-sm font-semibold hover:bg-red-500/10 transition duration-200 cursor-pointer flex items-center justify-center gap-2"
          >
            <Power size={15} />
            Disconnect Store
          </button>
        </GlassCard>
      </div>
    </div>
  );
};

export default Stores;
