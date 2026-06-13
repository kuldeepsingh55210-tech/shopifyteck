import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, description }) => {
  return (
    <label className="flex items-center justify-between gap-4 p-4 rounded-xl bg-[var(--surface-low)] border border-[var(--border)] hover:bg-white/5 transition duration-200 cursor-pointer w-full">
      {label && (
        <div className="flex flex-col text-left">
          <span className="text-sm font-semibold text-[var(--text)]">{label}</span>
          {description && <span className="text-xs text-[var(--text-muted)] mt-0.5">{description}</span>}
        </div>
      )}
      <div className="relative shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`w-11 h-6 rounded-full transition-all duration-300 relative ${
            checked 
              ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] shadow-[0_0_10px_var(--border-glow)]' 
              : 'bg-[var(--surface-high)] border border-[var(--border)]'
          }`}
        >
          <div
            className={`w-4.5 h-4.5 rounded-full bg-white absolute top-0.5 left-0.5 transition-transform duration-300 ${
              checked ? 'transform translate-x-5' : ''
            }`}
          />
        </div>
      </div>
    </label>
  );
};

export default Toggle;
