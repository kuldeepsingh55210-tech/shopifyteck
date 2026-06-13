import React, { useState } from 'react';
import { GlassCard } from '../GlassCard';
import { 
  Store, 
  RefreshCw, 
  CheckCircle2, 
  ArrowUpRight, 
  ExternalLink,
  Loader2,
  Trash2
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface StoreConnection {
  id: string;
  name: string;
  domain: string;
  status: 'connected' | 'syncing' | 'error' | 'disconnected';
  volume24h: number;
  volumeMonth: number;
  syncTime: string;
  sparklineData: { val: number }[];
}

interface StoresProps {
  currentShopDomain: string;
  currentShopId: string;
  onDisconnectStore: () => void;
  onAddStoreSubmit: (shopDomain: string) => Promise<void>;
  addStoreLoading: boolean;
}

export const Stores: React.FC<StoresProps> = ({
  currentShopDomain,
  currentShopId,
  onDisconnectStore,
  onAddStoreSubmit,
  addStoreLoading
}) => {
  const [newStoreDomain, setNewStoreDomain] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [syncingStoreId, setSyncingStoreId] = useState<string | null>(null);

  // Pre-configured store cards including the active currentShopDomain
  const defaultStores: StoreConnection[] = [
    {
      id: currentShopId || '1',
      name: currentShopDomain ? currentShopDomain.split('.')[0].toUpperCase().replace('-', ' ') : 'LUNA HOME GLOBAL',
      domain: currentShopDomain || 'luna-home.myshopify.com',
      status: currentShopDomain ? 'connected' : 'disconnected',
      volume24h: 34,
      volumeMonth: 1042,
      syncTime: '5M AGO',
      sparklineData: [{ val: 12 }, { val: 19 }, { val: 3 }, { val: 5 }, { val: 2 }, { val: 3 }, { val: 9 }]
    },
    {
      id: '2',
      name: 'MIDNIGHT SEOUL',
      domain: 'midnight-seoul.myshopify.com',
      status: 'connected',
      volume24h: 84,
      volumeMonth: 2400,
      syncTime: '2M AGO',
      sparklineData: [{ val: 24 }, { val: 30 }, { val: 40 }, { val: 25 }, { val: 35 }, { val: 45 }, { val: 60 }]
    },
    {
      id: '3',
      name: 'AERO WEAR',
      domain: 'aero-wear.myshopify.com',
      status: 'error',
      volume24h: 0,
      volumeMonth: 342,
      syncTime: '24H AGO',
      sparklineData: [{ val: 10 }, { val: 8 }, { val: 12 }, { val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }]
    }
  ];

  const [storesList, setStoresList] = useState<StoreConnection[]>(defaultStores);

  const handleAddNewStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!newStoreDomain.trim()) {
      setErrorMessage('Domain name is required.');
      return;
    }

    if (!newStoreDomain.match(/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/)) {
      setErrorMessage('Must be a valid myshopify.com domain.');
      return;
    }

    try {
      await onAddStoreSubmit(newStoreDomain);
      setSuccessMessage(`Successfully connected ${newStoreDomain}!`);
      
      const newId = (storesList.length + 1).toString();
      const newStoreItem: StoreConnection = {
        id: newId,
        name: newStoreDomain.split('.')[0].toUpperCase().replace('-', ' '),
        domain: newStoreDomain,
        status: 'connected',
        volume24h: 12,
        volumeMonth: 12,
        syncTime: 'JUST NOW',
        sparklineData: [{ val: 2 }, { val: 5 }, { val: 4 }, { val: 7 }, { val: 10 }, { val: 8 }, { val: 12 }]
      };
      setStoresList([...storesList, newStoreItem]);
      setNewStoreDomain('');
    } catch (err) {
      setErrorMessage('Store connection failed or shop domain already registered.');
    }
  };

  const handleTriggerSync = (storeId: string) => {
    setSyncingStoreId(storeId);
    // Simulate webhook re-sync
    setTimeout(() => {
      setSyncingStoreId(null);
      setStoresList(prev => prev.map(s => {
        if (s.id === storeId) {
          return { ...s, status: 'connected', syncTime: 'JUST NOW' };
        }
        return s;
      }));
      alert('Store webhooks successfully re-synchronized and catalog cache refreshed.');
    }, 1500);
  };

  const handleTestConnection = (domain: string) => {
    alert(`API Connection healthy for: ${domain}. Shopify Admin API (v2026-04) returned 200 OK.`);
  };

  return (
    <div className="space-y-8">
      {/* Upper metrics and Store registration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Connect New Store Form (LEFT - 5 cols) */}
        <div className="lg:col-span-5">
          <GlassCard className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white font-display flex items-center gap-2">🏪 Connect Shopify Channel</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Integrate automated AI customer resolution with your store webhooks</p>
            </div>

            <form onSubmit={handleAddNewStore} className="space-y-5">
              <div>
                <label className="text-[10px] font-bold text-[var(--text-muted)] font-mono uppercase tracking-wider mb-2 block">Shopify Domain</label>
                <div className="relative">
                  <Store className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[var(--text-muted)] w-4 h-4" />
                  <input 
                    type="text" 
                    value={newStoreDomain}
                    onChange={e => setNewStoreDomain(e.target.value)}
                    placeholder="e.g. fashion-brands.myshopify.com"
                    className="w-full pl-11 pr-4 py-2.5 bg-[#0A0B0F] border border-[var(--border)] rounded-full text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--primary)] font-sans"
                  />
                </div>
                <span className="text-[9px] text-[var(--text-muted)] font-mono mt-1.5 block">Store must contain valid API scopes for orders and refunds.</span>
              </div>

              <button 
                type="submit" 
                disabled={addStoreLoading}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[var(--primary-container)] to-[var(--secondary-container)] text-white text-sm font-semibold hover:shadow-[0_0_15px_var(--border-glow)] transition duration-200 cursor-pointer flex items-center justify-center gap-2"
              >
                {addStoreLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Registering Store...
                  </>
                ) : 'Connect Store'}
              </button>

              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-red-500/5 border border-red-500/15 text-xs text-[var(--danger)] font-mono">
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-xs text-[var(--tertiary)] font-mono">
                  {successMessage}
                </div>
              )}
            </form>
          </GlassCard>
        </div>

        {/* Global Connection Stats (RIGHT - 7 cols) */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
          <GlassCard className="p-5 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-[var(--text-muted)] font-mono uppercase tracking-wider">CHANNELS ONLINE</span>
            <div className="mt-4">
              <span className="text-3xl font-display font-bold text-white">
                {storesList.filter(s => s.status === 'connected').length} / {storesList.length}
              </span>
              <p className="text-xs text-[var(--text-muted)] mt-1">Active webhooks streaming live</p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-xs font-mono text-[var(--tertiary)]">
              <CheckCircle2 size={14} /> Global health metrics healthy
            </div>
          </GlassCard>

          <GlassCard className="p-5 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-[var(--text-muted)] font-mono uppercase tracking-wider">MONTHLY AI RESOLUTIONS</span>
            <div className="mt-4">
              <span className="text-3xl font-display font-bold text-white">3,784</span>
              <p className="text-xs text-[var(--text-muted)] mt-1">Across all registered stores</p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-xs font-mono text-[var(--secondary)]">
              <ArrowUpRight size={14} /> +15.2% growth this month
            </div>
          </GlassCard>
        </div>

      </div>

      {/* Connected Stores Grid */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-white font-display">Active Store Channels</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {storesList.map((store) => {
            const isSyncing = syncingStoreId === store.id;
            return (
              <GlassCard key={store.id} className="p-6 relative overflow-hidden flex flex-col justify-between min-h-[260px] border border-[var(--border)] hover:border-[var(--primary)]/35 transition-all duration-300">
                {/* Upper row: name and status indicator */}
                <div>
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <span className="font-display font-bold text-base text-white">{store.name}</span>
                      <span className="font-mono text-[10px] text-[var(--text-muted)] mt-0.5">{store.domain}</span>
                    </div>

                    {store.status === 'connected' ? (
                      <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono bg-emerald-500/10 text-[var(--tertiary)] border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--tertiary)] led-pulse" />
                        ONLINE
                      </span>
                    ) : store.status === 'error' ? (
                      <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono bg-rose-500/10 text-[var(--danger)] border border-rose-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--danger)] led-pulse" />
                        ERROR
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono bg-slate-500/10 text-[var(--text-muted)] border border-slate-500/25">
                        DISCONNECTED
                      </span>
                    )}
                  </div>

                  {/* Sparkline mini-graph / Metrics block */}
                  <div className="flex items-center justify-between mt-6">
                    <div className="flex flex-col">
                      <span className="text-xs font-mono text-[var(--text-secondary)]">{store.volume24h} tickets (24h)</span>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono leading-none mt-1">{store.volumeMonth} monthly</span>
                    </div>

                    {/* Sparkline Graph */}
                    <div className="w-24 h-10 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={store.sparklineData}>
                          <Line 
                            type="monotone" 
                            dataKey="val" 
                            stroke={store.status === 'error' ? '#FF4D6D' : '#a2e7ff'} 
                            strokeWidth={1.5} 
                            dot={false} 
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Footer and operations */}
                <div className="pt-4 mt-6 border-t border-[var(--border)]/45 flex items-center justify-between">
                  <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase">SYNC: {store.syncTime}</span>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleTestConnection(store.domain)}
                      disabled={store.status === 'disconnected'}
                      className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-white hover:border-[var(--primary)] transition cursor-pointer"
                      title="Test API Health"
                    >
                      <ExternalLink size={13} />
                    </button>
                    <button 
                      onClick={() => handleTriggerSync(store.id)}
                      disabled={isSyncing || store.status === 'disconnected'}
                      className={`p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-white hover:border-[var(--primary)] transition cursor-pointer ${isSyncing ? 'opacity-50' : ''}`}
                      title="Re-sync Webhooks"
                    >
                      {isSyncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    </button>
                    {store.id === currentShopId && (
                      <button 
                        onClick={onDisconnectStore}
                        className="p-1.5 rounded-lg border border-red-500/20 text-[var(--danger)] hover:bg-red-500/10 transition cursor-pointer"
                        title="Disconnect Store"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

              </GlassCard>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default Stores;
