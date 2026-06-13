import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', glow = false }) => {
  return (
    <div className={`glow-card ${glow ? 'shadow-[0_0_20px_var(--border-glow)]' : ''} ${className}`}>
      {children}
    </div>
  );
};

export default GlassCard;
