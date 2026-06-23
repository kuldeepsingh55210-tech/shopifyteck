import React from 'react';
import { LayoutDashboard, Ticket, BarChart3, Settings, CreditCard, HelpCircle, LogOut, Plus, Sun, Moon } from 'lucide-react';

interface SidebarProps {
  activePage: 'dashboard' | 'tickets' | 'analytics' | 'stores' | 'settings' | 'onboarding' | 'pricing';
setActivePage: (page: 'dashboard' | 'tickets' | 'analytics' | 'stores' | 'settings' | 'onboarding' | 'pricing') => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  onCreateTicketClick: () => void;
  onDisconnectClick: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage, darkMode, setDarkMode, onCreateTicketClick, onDisconnectClick }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tickets', label: 'Tickets', icon: Ticket },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'pricing', label: 'Pricing', icon: CreditCard },
  ] as const;

  return (
    <aside className="w-70 fixed top-0 left-0 bottom-0 z-40 bg-[#0d0e12] border-r border-[var(--border)] flex flex-col justify-between py-6">
      <div>
        <div className="px-6 flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0a0b0f] border border-[var(--border)] flex items-center justify-center p-[2px] shadow-[0_0_15px_var(--border-glow)]">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <defs>
                  <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a2e7ff" />
                    <stop offset="100%" stopColor="#c4c0ff" />
                  </linearGradient>
                </defs>
                <path d="M 35 40 A 15 15 0 0 1 65 40" fill="none" stroke="url(#logoGrad)" strokeWidth="5" strokeLinecap="round"/>
                <path d="M 28 38 L 72 38 L 76 78 C 76 81, 74 83, 71 83 L 29 83 C 26 83, 24 81, 24 78 Z" fill="none" stroke="url(#logoGrad)" strokeWidth="5" strokeLinejoin="round"/>
                <circle cx="43" cy="54" r="4" fill="url(#logoGrad)"/>
                <circle cx="57" cy="54" r="4" fill="url(#logoGrad)"/>
                <path d="M 44 64 Q 50 69 56 64" fill="none" stroke="url(#logoGrad)" strokeWidth="4.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-lg text-white">ORYQX</span>
              <span className="font-mono text-[10px] text-[var(--text-muted)]">My Store</span>
            </div>
          </div>
          <button onClick={() => setDarkMode(!darkMode)} className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-white transition-all duration-200 cursor-pointer">
            {darkMode ? <Sun size={15} className="text-yellow-400" /> : <Moon size={15} />}
          </button>
        </div>

        <nav className="px-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 group cursor-pointer ${isActive ? 'bg-[var(--primary)]/10 text-[var(--primary)] border-l-[3px] border-[var(--primary)] font-semibold' : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:translate-x-1'}`}
              >
                <Icon size={18} className={`transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="px-4 space-y-4">
        <button onClick={onCreateTicketClick} className="w-full py-2.5 px-4 rounded-lg font-semibold text-white bg-gradient-to-r from-[var(--primary-container)] to-[var(--secondary-container)] hover:from-[var(--primary)] hover:to-[var(--secondary)] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer">
          <Plus size={16} strokeWidth={2.5} />
          Create Ticket
        </button>

        <div className="pt-2 border-t border-[var(--border)] space-y-1">
          <a href="https://oryqx.com/support" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-2 text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text)] transition duration-200">
            <HelpCircle size={14} />
            Support Helpdesk
          </a>
          <button onClick={onDisconnectClick} className="w-full flex items-center gap-3 px-4 py-2 text-xs font-mono text-[var(--danger)]/80 hover:text-[var(--danger)] transition duration-200 cursor-pointer">
            <LogOut size={14} />
            Disconnect Store
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
