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

// Generate static heat matrix data for Peak Volume 24x7 Heatmap
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${i}:00`);
// 7x24 grid simulation
const heatmapData = DAYS.map(day => 
  HOURS.map((_, hIdx) => {
    // Simulate higher traffic mid-day (10am - 4pm) and mid-week
    let weight = 0.1;
    if (hIdx >= 9 && hIdx <= 17) weight += 0.4;
    if (day !== 'Sat' && day !== 'Sun') weight += 0.3;
    weight += Math.random() * 0.2; // randomness
    return Math.min(Math.round(weight * 10) / 10, 1.0);
  })
);

export const Analytics: React.FC<AnalyticsProps> = ({
  ticketsOverTime = [],
  resolutionRate = [],
  sentimentTrend = [],
  csatStats
}) => {
  // Safe fallbacks for stats
  const totalCsatRatings = csatStats?.total_ratings ?? 184;
  const csatPositive = csatStats?.positive ?? 162;
  const csatScore = csatStats?.score ?? 88;

  // Render a cell of the 24x7 Peak Volume Heatmap
  const getHeatmapColorClass = (val: number) => {
    if (val >= 0.8) return 'bg-[var(--primary)] border-[var(--primary)] shadow-[0_0_8px_rgba(196,192,255,0.4)]';
    if (val >= 0.6) return 'bg-[var(--primary-container)]/80 border-[var(--primary-container)]/80';
    if (val >= 0.4) return 'bg-[var(--secondary)]/60 border-[var(--secondary)]/40';
    if (val >= 0.2) return 'bg-[var(--secondary)]/30 border-transparent';
    return 'bg-[var(--surface-low)] border-transparent';
  };

  return (
    <div className="space-y-8">
      {/* Hero Header & Efficiency Multiplier */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Efficiency Multiplier Hero (LEFT) */}
        <div className="lg:col-span-7">
          <GlassCard className="p-6 h-full relative overflow-hidden border border-[var(--primary)]/30 shadow-[0_0_20px_rgba(196,192,255,0.08)] bg-gradient-to-br from-[#121317] to-[#0d0e12]">
            {/* Ambient background glow */}
            <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-[var(--primary)]/5 blur-[80px]" />
            <div className="absolute -left-20 -bottom-20 w-64 h-64 rounded-full bg-[var(--secondary)]/5 blur-[80px]" />

            <div className="relative z-10 flex flex-col justify-between h-full space-y-6">
              <div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 uppercase tracking-widest">
                  ✦ Efficiency Engine
                </span>
                <h2 className="text-2xl font-bold text-white mt-4 font-display leading-tight">
                  Your Automation Multiplier is at <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--secondary-container)] to-[var(--primary-container)]">5.8x</span>
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-2 max-w-md leading-relaxed">
                  ORYQX AI handles, processes, and auto-resolves your incoming customer ticket support load with a 92% resolution rate compared to standard support queues.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[var(--border)]/50">
                <div>
                  <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">SUPPORT HOURS SAVED</span>
                  <span className="text-lg font-bold text-white mt-1 block">42.5 hrs</span>
                </div>
                <div>
                  <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">COST REDUCTION RATE</span>
                  <span className="text-lg font-bold text-[var(--tertiary)] mt-1 block">74.2%</span>
                </div>
                <div>
                  <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">SLA RESPONSE BOOST</span>
                  <span className="text-lg font-bold text-[var(--secondary)] mt-1 block">+380%</span>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* CSAT Tracking and Stat Overview (RIGHT) */}
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <StatCard 
            label="PEAK RESOLUTION RATE" 
            value="98.2%" 
            trend="+2.1% this week"
            trendDirection="up"
            icon="⚡" 
            color="text-[var(--primary)]"
          />
          <StatCard 
            label="AI ESCALATION PCT" 
            value="8.4%" 
            trend="-1.2% reduction"
            trendDirection="down"
            icon="⚠️" 
            color="text-[var(--danger)]"
          />
        </div>
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
                  data={resolutionRate.length > 0 ? resolutionRate : [
                    { date: 'Mon', auto_resolved: 45, escalated: 5 },
                    { date: 'Tue', auto_resolved: 50, escalated: 8 },
                    { date: 'Wed', auto_resolved: 62, escalated: 4 },
                    { date: 'Thu', auto_resolved: 58, escalated: 7 },
                    { date: 'Fri', auto_resolved: 75, escalated: 3 },
                    { date: 'Sat', auto_resolved: 80, escalated: 2 },
                    { date: 'Sun', auto_resolved: 85, escalated: 4 }
                  ]}
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
                  data={ticketsOverTime.length > 0 ? ticketsOverTime : [
                    { date: 'Mon', count: 120 },
                    { date: 'Tue', count: 150 },
                    { date: 'Wed', count: 180 },
                    { date: 'Thu', count: 170 },
                    { date: 'Fri', count: 210 },
                    { date: 'Sat', count: 90 },
                    { date: 'Sun', count: 95 }
                  ]}
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
                  >
                    {/* Define gradient colors internally if needed, or link global */}
                  </Bar>
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

      {/* Peak Volume Heatmap Grid */}
      <GlassCard className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-base font-bold text-white font-display">Peak Volume Heatmap</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">24x7 matrix detailing automated ticket arrival density levels</p>
          </div>
          <div className="flex gap-4 items-center text-[10px] font-mono text-[var(--text-muted)]">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[var(--surface-low)]" /> Low</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[var(--secondary)]/40" /> Medium</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[var(--primary)]" /> Heavy</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[760px] space-y-1.5 font-mono">
            {/* Header hours */}
            <div className="flex text-[8px] text-[var(--text-muted)] pb-1 pl-10 border-b border-[var(--border)]/30">
              {HOURS.map((hr, idx) => (
                <div key={idx} className="flex-1 text-center truncate">
                  {idx % 4 === 0 ? hr : ''}
                </div>
              ))}
            </div>

            {/* Matrix rows */}
            {DAYS.map((day, dIdx) => (
              <div key={day} className="flex items-center">
                <span className="w-10 text-[10px] text-[var(--text-secondary)] font-bold shrink-0">{day}</span>
                <div className="flex-1 flex gap-1">
                  {heatmapData[dIdx].map((val, hIdx) => (
                    <div 
                      key={hIdx}
                      className={`flex-1 h-6 rounded-md border border-[var(--border)]/10 hover:border-white/40 transition duration-200 cursor-pointer ${getHeatmapColorClass(val)}`}
                      title={`${day} @ ${hIdx}:00 - Density: ${Math.round(val * 100)}%`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* Sentiment Analysis Trend */}
      <div>
        <GlassCard className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-bold text-white font-display">Sentiment Trend</h3>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">NPS SCORE: +42</span>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={sentimentTrend.length > 0 ? sentimentTrend : [
                  { date: 'Mon', value: 72 },
                  { date: 'Tue', value: 68 },
                  { date: 'Wed', value: 75 },
                  { date: 'Thu', value: 78 },
                  { date: 'Fri', value: 82 },
                  { date: 'Sat', value: 85 },
                  { date: 'Sun', value: 89 }
                ]}
                margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="sentimentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00e29e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00e29e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: '#8B8FA8', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
                <YAxis domain={[50, 100]} tick={{ fill: '#8B8FA8', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
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
