import React from 'react';
import { Search, Bell, Grid } from 'lucide-react';

interface TopbarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  notificationCount?: number;
  userName?: string;
  userRole?: string;
  avatarUrl?: string;
}

export const Topbar: React.FC<TopbarProps> = ({
  searchQuery,
  setSearchQuery,
  notificationCount = 3,
  userName = 'Admin System',
  userRole = 'Master Lead',
  avatarUrl
}) => {
  return (
    <header className="h-16 fixed top-0 right-0 left-70 z-30 bg-[#0A0B0F]/80 backdrop-blur-xl border-b border-[var(--border)] px-8 flex justify-between items-center">
      
      {/* Search Input Bar */}
      <div className="relative w-96">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[var(--text-muted)] w-4 h-4" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tickets, orders, customers..."
          className="w-full pl-11 pr-4 py-2 bg-[#0A0B0F] border border-[var(--border)] text-sm rounded-full text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-all duration-300 font-sans"
        />
      </div>

      {/* Right User Utility Operations */}
      <div className="flex items-center gap-6">
        {/* Actions Button Group */}
        <div className="flex items-center gap-4 border-r border-[var(--border)] pr-6">
          {/* Notification Indicator */}
          <button className="relative p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/5 transition duration-200 cursor-pointer">
            <Bell size={18} />
            {notificationCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--danger)] shadow-[0_0_8px_var(--danger)] led-pulse" />
            )}
          </button>

          {/* Grid Panel Trigger */}
          <button className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/5 transition duration-200 cursor-pointer">
            <Grid size={18} />
          </button>
        </div>

        {/* User Account Info Display */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col text-right">
            <span className="font-mono text-xs font-bold text-[var(--text)] leading-tight">{userName}</span>
            <span className="font-mono text-[9px] text-[var(--text-muted)] tracking-wider uppercase leading-none">{userRole}</span>
          </div>
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[var(--primary)] to-[var(--secondary)] p-[1.5px] shadow-[0_0_10px_var(--border-glow)] shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="w-full h-full rounded-full object-cover" />
            ) : (
              <div className="w-full h-full rounded-full bg-[var(--surface)] flex items-center justify-center text-xs font-bold text-white uppercase font-mono">
                {userName.split(' ').map(n => n[0]).join('')}
              </div>
            )}
          </div>
        </div>
      </div>

    </header>
  );
};

export default Topbar;
