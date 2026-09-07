import React from 'react';
import { StatCard } from '../StatCard';
import { GlassCard } from '../GlassCard';
import { Badge } from '../Badge';
import { Filter, Download } from 'lucide-react';

interface Ticket {
  id: string | number;
  customer_email: string;
  order_number?: string | null;
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
      {/* Merchant Store Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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
      </div>

      {/* Live Ticket Feed */}
      <div className="w-full">
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
                            </div>
                          </div>
                        </td>

                        {/* Order ID */}
                        <td className="p-4 text-sm font-mono text-[var(--secondary)]">
                          {t.order_number && t.order_number !== 'NONE'
                            ? (t.order_number.startsWith('#') ? t.order_number : `#${t.order_number}`)
                            : '—'}
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
    </div>
  );
};

export default Dashboard;
