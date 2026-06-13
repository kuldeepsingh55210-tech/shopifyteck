import React from 'react';

interface BadgeProps {
  status: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, className = '' }) => {
  const getStyles = () => {
    switch (status.toLowerCase()) {
      case 'auto_resolved':
      case 'resolved':
      case 'healthy':
        return 'bg-[var(--tertiary)]/10 text-[var(--tertiary)] border-[var(--tertiary)]/20';
      case 'escalated':
      case 'error':
        return 'bg-[var(--danger)]/10 text-[var(--danger)] border-[var(--danger)]/20';
      case 'open':
      case 'syncing':
      case 'warning':
      case 'pending':
        return 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20';
      case 'manual':
      default:
        return 'bg-[var(--text-muted)]/10 text-[var(--text-secondary)] border-[var(--border)]';
    }
  };

  const getLabel = () => {
    switch (status.toLowerCase()) {
      case 'auto_resolved':
        return 'Auto Resolved';
      case 'resolved':
        return 'Resolved';
      case 'escalated':
        return 'Escalated';
      case 'open':
        return 'Open';
      case 'syncing':
        return 'Syncing';
      case 'healthy':
        return 'Healthy';
      case 'error':
        return 'Error';
      case 'manual':
        return 'Manual';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold font-mono border ${getStyles()} ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current led-pulse" />
      {getLabel()}
    </span>
  );
};

export default Badge;
