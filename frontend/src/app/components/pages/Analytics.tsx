import React from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart, 
  Bar
} from 'recharts';
import { GlassCard } from '../GlassCard';
import { StatCard } from '../StatCard';

interface CsatStats {
  total_ratings: number;
  positive: number;
  negative: number;
  score: number;
  recent: any[];
}

interface AnalyticsProps {
  ticketsOverTime: any[];
  resolutionRate: any[];
  sentimentTrend: any[];
  csatStats: CsatStats | null;
}

export const Analytics: React.FC<AnalyticsProps> = ({
  ticketsOverTime = [],
  resolutionRate = [],
  sentimentTrend = [],
  csatStats
}) => {
  // Safe fallbacks for stats
  const totalCsatRatings = csatStats?.total_ratings ?? 0;
  const csatPositive = csatStats?.positive ?? 0;
  const csatScore = csatStats?.score ?? 0;

  return (
    <div className="space-y-8">
      {/* Real CSAT Tracking Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <StatCard 
          label="CUSTOMER SATISFACTION (CSAT)" 
          value={`${csatScore}%`} 
          progressBar={csatScore} 
          icon="⭐" 
          color="text-[var(--tertiary)] font-display"
        />
        <StatCard 
          label="TOTAL SATISFACTION RATINGS" 
          value={totalCsatRatings} 
          trend={`+${csatPositive} Positives`}
          trendDirection="up" 
          icon="💬" 
          color="text-[var(--secondary)]"
        />
      </div>

      {/* Resolution Rate Trends & Volume Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Resolution Rate Trends (LEFT - 8 Col) */}
        <div className="lg:col-span-8">
          <GlassCard className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-base font-bold text-white font-display">Resolution Rate Trends</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Dual-stream monitoring: Auto-Resolved vs. Escalated</p>
              </div>
              <span className="font-mono text-[10px] text-[var(--text-muted)]">REALTIME QUEUE</span>
            </div>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={resolutionRate}
                  margin={{ top: 5, right: 10, left: -25, bottom: 0 }}
                >
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#8B8FA8', fontSize: 10, fontFamily: 'JetBrains Mono' }} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    tick={{ fill: '#8B8FA8', fontSize: 10, fontFamily: 'JetBrains Mono' }} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <Tooltip 
                    contentStyle={{ background: '#121317', borderColor: '#2A2D3E', borderRadius: '12px' }} 
                    labelStyle={{ color: '#e3e2e8', fontFamily: 'JetBrains Mono', fontSize: '10px' }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="auto_resolved" 
                    name="Auto-Resolved"
                    stroke="#00e29e" 
                    strokeWidth={2.5} 
                    dot={{ r: 3 }} 
                    activeDot={{ r: 5 }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="escalated" 
                    name="Escalated"
                    stroke="#FF4D6D" 
                    strokeWidth={2} 
                    dot={{ r: 2 }} 
                    activeDot={{ r: 4 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        {/* Volume Comparison Chart (RIGHT - 4 Col) */}
        <div className="lg:col-span-4">
          <GlassCard className="p-6">
            <h3 className="text-base font-bold text-white font-display mb-1">Volume Comparison</h3>
            <p className="text-xs text-[var(--text-muted)] mb-6">Support volume load over the week</p>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={ticketsOverTime}
                  margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                >
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#8B8FA8', fontSize: 10, fontFamily: 'JetBrains Mono' }} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    tick={{ fill: '#8B8FA8', fontSize: 10, fontFamily: 'JetBrains Mono' }} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <Tooltip 
                    contentStyle={{ background: '#121317', borderColor: '#2A2D3E', borderRadius: '12px' }} 
                    labelStyle={{ color: '#e3e2e8', fontFamily: 'JetBrains Mono', fontSize: '10px' }} 
                  />
                  <Bar 
                    dataKey="count" 
                    name="Tickets"
                    fill="url(#barGradient)" 
                    radius={[4, 4, 0, 0]}
                  />
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a2e7ff" />
                      <stop offset="100%" stopColor="#c4c0ff" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

      </div>

      {/* Sentiment Analysis Trend */}
      <div>
        <GlassCard className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-bold text-white font-display">Sentiment Trend</h3>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={sentimentTrend}
                margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="sentimentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00e29e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00e29e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: '#8B8FA8', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: '#8B8FA8', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#121317', borderColor: '#2A2D3E', borderRadius: '12px' }} labelStyle={{ color: '#e3e2e8', fontFamily: 'JetBrains Mono', fontSize: '10px' }} />
                <Area type="monotone" dataKey="value" name="Positive Sentiment %" stroke="#00e29e" strokeWidth={2.5} fillOpacity={1} fill="url(#sentimentGrad)" dot={{ r: 2 }} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default Analytics;
