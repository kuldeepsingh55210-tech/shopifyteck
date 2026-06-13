import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { StatCard } from '../StatCard';
import { GlassCard } from '../GlassCard';
import { Badge } from '../Badge';
import { Filter, Download } from 'lucide-react';

interface Ticket {
  id: string | number;
  customer_email: string;
  detected_intent: string;
  resolution_status: string;
  response_confidence: number;
  ai_response: string;
  created_at: string;
}

interface Stats {
  total_tickets: number;
  auto_resolved: number;
  escalated: number;
  automation_rate: number;
  avg_confidence: number;
}

interface DashboardProps {
  tickets: Ticket[];
  stats: Stats | null;
  onViewAllTickets: () => void;
  onSelectTicket: (ticketId: string | number) => void;
}

// Mock chart data matching the screenshot style
const accuracyData = [
  { time: '08:00', value: 92 },
  { time: '10:00', value: 89 },
  { time: '12:00', value: 94 },
  { time: '14:00', value: 91 },
  { time: '16:00', value: 96 },
  { time: '18:00', value: 93 },
  { time: '20:00', value: 97 },
];

const issueDistributionData = [
  { name: 'Shipping', value: 45 },
  { name: 'Refunds', value: 25 },
  { name: 'Quality', value: 30 },
];

const COLORS = ['#a2e7ff', '#c4c0ff', '#00e29e'];

const systemEvents = [
  { id: 1, type: 'success', title: 'Auto-Resolution Triggered', desc: 'Ticket #8821 closed successfully.', time: '2M AGO' },
  { id: 2, type: 'info', title: 'New Shopify Integration', desc: "\'Midnight Seoul\' store connected.", time: '45M AGO' },
  { id: 3, type: 'warning', title: 'Spike in Shipping Queries', desc: 'Anomaly detected in North America.', time: '2H AGO' }
];

export const Dashboard: React.FC<DashboardProps> = ({
  tickets,
  stats,
  onViewAllTickets,
  onSelectTicket
}) => {
  // Stat values fallback to default mock if stats DB call is empty/pending
  const totalTickets = stats?.total_tickets ?? 1284;
  const automationRate = stats?.automation_rate ?? 84;
  const escalatedCount = stats?.escalated ?? 42;
  const avgResponse = '1.2m';
  const activeStores = 15;

  // Render Issue intent category tag/badge
  const renderIssueTag = (intent: string) => {
    const cleanIntent = intent.toUpperCase();
    if (cleanIntent.includes('SHIPPING') || cleanIntent.includes('ORDER')) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-semibold font-mono bg-blue-500/10 text-[#a2e7ff] border border-blue-500/25">SHIPPING</span>;
    } else if (cleanIntent.includes('REFUND') || cleanIntent.includes('PAYMENT')) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-semibold font-mono bg-amber-500/10 text-[#FFB547] border border-amber-500/25">PAYMENT</span>;
    } else {
      return <span className="px-2 py-0.5 rounded text-[10px] font-semibold font-mono bg-rose-500/10 text-[#FF4D6D] border border-rose-500/25">PRODUCT</span>;
    }
  };

  // Get dynamic progress bar color class depending on confidence level
  const getConfidenceColorClass = (conf: number) => {
    if (conf >= 0.8) return 'bg-[var(--tertiary)]';
    if (conf >= 0.5) return 'bg-[var(--warning)]';
    return 'bg-[var(--danger)]';
  };

  return (
    <div className="space-y-8">
      {/* 5 Stats Cards in a Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        <StatCard 
          label="TOTAL TICKETS" 
          value={totalTickets} 
          trend="+12% ↑" 
          trendDirection="up" 
          icon="📈" 
          color="text-white"
        />
        <StatCard 
          label="AI RESOLVED" 
          value={`${automationRate}%`} 
          progressBar={automationRate} 
          icon="⚡" 
          color="text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]"
        />
        <StatCard 
          label="ESCALATED" 
          value={escalatedCount} 
          trendDirection="down" 
          icon="⚠️" 
          color="text-[var(--danger)]"
        />
        <StatCard 
          label="AVG RESPONSE" 
          value={avgResponse} 
          icon="🧠" 
          color="text-[var(--primary)]"
        />
        <StatCard 
          label="ACTIVE STORES" 
          value={activeStores} 
          icon="🏪" 
          color="text-[var(--secondary)]"
        />
      </div>

      {/* Main content grid 8:4 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left column: Live Ticket Feed */}
        <div className="lg:col-span-8">
          <GlassCard className="overflow-hidden">
            <div className="p-6 border-b border-[var(--border)] bg-white/[0.01] flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-white font-display">Live Ticket Feed</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Real-time AI ticket stream</p>
              </div>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-white transition duration-200 cursor-pointer">
                  <Filter size={13} />
                  Filter
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-white transition duration-200 cursor-pointer">
                  <Download size={13} />
                  Export
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] bg-white/[0.01]">
                    <th className="p-4 pl-6">Customer</th>
                    <th className="p-4">Order ID</th>
                    <th className="p-4">Issue</th>
                    <th className="p-4">AI Confidence</th>
                    <th className="p-4 pr-6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/40">
                  {tickets.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-[var(--text-muted)] text-sm">
                        No active tickets in queue. Run simulations to stream tickets.
                      </td>
                    </tr>
                  ) : (
                    tickets.slice(0, 7).map((t) => {
                      const initial = t.customer_email.charAt(0).toUpperCase();
                      const confidence = t.response_confidence ?? 0.85;
                      return (
                        <tr 
                          key={t.id} 
                          onClick={() => onSelectTicket(t.id)}
                          className="hover:bg-white/[0.03] transition-colors duration-200 cursor-pointer group"
                        >
                          {/* Customer info */}
                          <td className="p-4 pl-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[var(--surface-high)] border border-[var(--border)] flex items-center justify-center text-xs font-semibold font-mono text-[var(--primary)] group-hover:border-[var(--primary-container)] transition duration-200 shrink-0">
                                {initial}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-[var(--text)]">{t.customer_email.split('@')[0]}</span>
                                <span className="font-mono text-[9px] text-[var(--text-muted)] leading-none mt-0.5">Tier: Gold</span>
                              </div>
                            </div>
                          </td>

                          {/* Order ID */}
                          <td className="p-4 text-sm font-mono text-[var(--secondary)]">
                            #ORD-{(t.id as any) * 11 + 7000}
                          </td>

                          {/* Issue intent pill */}
                          <td className="p-4">
                            {renderIssueTag(t.detected_intent)}
                          </td>

                          {/* AI confidence meter */}
                          <td className="p-4 text-xs">
                            <div className="flex items-center gap-2 max-w-[120px]">
                              <span className="font-mono font-medium text-[var(--text-secondary)]">
                                {Math.round(confidence * 100)}%
                              </span>
                              <div className="flex-1 bg-[var(--surface-high)] h-1 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${getConfidenceColorClass(confidence)} rounded-full shadow-[0_0_8px_currentColor]`}
                                  style={{ width: `${confidence * 100}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="p-4 pr-6">
                            <Badge status={t.resolution_status} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer View All link */}
            <div className="p-4 border-t border-[var(--border)] bg-white/[0.01] text-center">
              <button
                onClick={onViewAllTickets}
                className="text-xs font-semibold text-[var(--primary)] hover:text-white transition duration-200 cursor-pointer font-sans"
              >
                View All {totalTickets} Tickets &rarr;
              </button>
            </div>
          </GlassCard>
        </div>

        {/* Right column: 3 Stacked Analytics Cards */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card 1: AI Accuracy Line Chart */}
          <GlassCard className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-sm font-bold text-white tracking-wide font-display">AI Accuracy</h4>
              <span className="font-mono text-[10px] text-[var(--text-muted)]">LAST 24H</span>
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={accuracyData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#c4c0ff" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#c4c0ff" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" tick={{ fill: '#8B8FA8', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#8B8FA8', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} domain={[80, 100]} />
                  <Tooltip contentStyle={{ background: '#121317', borderColor: '#2A2D3E', borderRadius: '8px' }} labelStyle={{ color: '#e3e2e8', fontFamily: 'JetBrains Mono', fontSize: '10px' }} />
                  <Area type="monotone" dataKey="value" stroke="#c4c0ff" strokeWidth={2.5} fillOpacity={1} fill="url(#purpleGradient)" dot={{ r: 2 }} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Card 2: Volume by Issue Donut Chart */}
          <GlassCard className="p-6">
            <h4 className="text-sm font-bold text-white tracking-wide mb-4 font-display">Volume by Issue</h4>
            <div className="flex items-center justify-between">
              <div className="w-1/2 h-28 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={issueDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={32}
                      outerRadius={46}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {issueDistributionData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center">
                  <span className="text-sm font-bold text-white leading-none">1.2k</span>
                  <span className="text-[8px] text-[var(--text-muted)] uppercase tracking-wider mt-0.5">Total</span>
                </div>
              </div>
              <div className="w-1/2 space-y-2.5">
                {issueDistributionData.map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx] }} />
                      <span className="text-[var(--text-secondary)]">{item.name}</span>
                    </div>
                    <span className="font-semibold text-white">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          {/* Card 3: System Events Timeline */}
          <GlassCard className="p-6">
            <h4 className="text-sm font-bold text-white tracking-wide mb-5 font-display">System Events</h4>
            <div className="space-y-5">
              {systemEvents.map((evt) => {
                const ledColor = evt.type === 'success' ? 'text-[var(--tertiary)]' : evt.type === 'warning' ? 'text-[var(--warning)]' : 'text-[var(--secondary)]';
                return (
                  <div key={evt.id} className="flex gap-3 relative">
                    {/* Event Type LED Dot */}
                    <div className={`w-2 h-2 rounded-full bg-current ${ledColor} led-pulse mt-1.5 shrink-0`} />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-[var(--text)]">{evt.title}</span>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">{evt.desc}</span>
                      <span className="text-[8px] text-[var(--text-muted)] font-mono mt-1 tracking-wider">{evt.time}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
