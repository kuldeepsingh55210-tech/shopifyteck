import React from 'react';
import GlassCard from './GlassCard';

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  icon?: string;
  color?: string;
  progressBar?: number; // percentage (0 - 100)
  glow?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  trend,
  trendDirection = 'neutral',
  icon,
  color = 'text-[var(--primary)]',
  progressBar,
  glow = false,
}) => {
  return (
    <GlassCard glow={glow} className="p-6 relative overflow-hidden group flex flex-col justify-between min-h-[120px] w-full">
      <div className="flex justify-between items-start mb-4">
        <p className="text-[var(--text-muted)] text-sm font-medium">{label}</p>
        {icon && <span className="text-xl opacity-80">{icon}</span>}
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <p className={`text-3xl font-bold ${color} tracking-tight font-display`}>{value}</p>
          {trend && (
            <span
              className={`text-xs font-semibold font-mono ${
                trendDirection === 'up'
                  ? 'text-[var(--secondary)]'
                  : trendDirection === 'down'
                  ? 'text-[var(--danger)]'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              {trend}
            </span>
          )}
        </div>
        {progressBar !== undefined && (
          <div className="w-full bg-[var(--surface-high)] h-1.5 rounded-full overflow-hidden mt-3">
            <div
              className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] rounded-full transition-all duration-500 shadow-[0_0_10px_var(--border-glow)]"
              style={{ width: `${progressBar}%` }}
            />
          </div>
        )}
      </div>
    </GlassCard>
  );
};

export default StatCard;
