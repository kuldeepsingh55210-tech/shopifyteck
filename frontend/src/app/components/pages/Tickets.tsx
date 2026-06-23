import React, { useState } from 'react';
import { GlassCard } from '../GlassCard';
import { Badge } from '../Badge';
import { 
  ArrowLeft, 
  ShoppingCart, 
  MessageSquare, 
  Star, 
  Truck, 
  User, 
  Sliders, 
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';

interface Ticket {
  id: string | number;
  customer_email: string;
  detected_intent: string;
  resolution_status: string;
  response_confidence: number;
  ai_response: string;
  created_at: string;
  raw_message?: string;
}

interface TestForm {
  order_number: string;
  customer_email: string;
  customer_message: string;
}

interface TestResult {
  action: string;
  message?: string;
  reason?: string;
  confidence?: number;
  resolution?: 'auto_resolved' | 'resolved' | 'escalated' | 'fraud_flagged';
  response?: string;
  intent?: string;
  csat_token?: string;
  ticket_id?: number;
}

interface TicketsProps {
  tickets: Ticket[];
  selectedTicketId: string | number | null;
  onBackToDashboard: () => void;
  onSelectTicket: (id: string | number) => void;
  // Simulator triggers passed down
  testForm: TestForm;
  setTestForm: (form: TestForm) => void;
  testResult: TestResult | null;
  setTestResult: (res: TestResult | null) => void;
  testLoading: boolean;
  onRunSimulation: (e: React.FormEvent) => void;
  // CSAT rating triggers
  csatSubmitting: boolean;
  csatSubmitted: boolean;
  csatFeedback: string;
  setCsatFeedback: (val: string) => void;
  onCsatSubmit: (rating: number) => void;
  // Resolve action trigger
  onMarkResolved?: (ticketId: string | number, responseMessage: string) => void;
}

export const Tickets: React.FC<TicketsProps> = ({
  tickets,
  selectedTicketId,
  onBackToDashboard,
  onSelectTicket: _onSelectTicket,
  testForm,
  setTestForm,
  testResult,
  setTestResult: _setTestResult,
  testLoading,
  onRunSimulation,
  csatSubmitting,
  csatSubmitted,
  csatFeedback,
  setTestForm: _dummy, // not used
  setCsatFeedback,
  onCsatSubmit,
  onMarkResolved
}) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'simulator'>('queue');
  const [editingResponse, setEditingResponse] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Find currently active ticket
  const activeTicket = tickets.find(t => t.id === selectedTicketId) || tickets[0];

  const handleApproveSend = () => {
    if (activeTicket && onMarkResolved) {
      onMarkResolved(activeTicket.id, editingResponse || activeTicket.ai_response);
      alert('Response approved and sent!');
    }
  };

  const handleEscalate = () => {
    alert('Ticket escalated to senior human support team.');
  };

  return (
    <div className="space-y-6">
      
      {/* Top action header */}
      <div className="flex justify-between items-center">
        <button 
          onClick={onBackToDashboard}
          className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-white transition duration-200 cursor-pointer font-sans"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface-low)] p-1 shrink-0">
          <button 
            onClick={() => setActiveTab('queue')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition ${activeTab === 'queue' ? 'bg-[var(--primary)] text-[#0A0B0F]' : 'text-[var(--text-muted)] hover:text-white'}`}
          >
            Ticket Detail View
          </button>
          <button 
            onClick={() => setActiveTab('simulator')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition ${activeTab === 'simulator' ? 'bg-[var(--primary)] text-[#0A0B0F]' : 'text-[var(--text-muted)] hover:text-white'}`}
          >
            Test Simulator
          </button>
        </div>
      </div>

      {activeTab === 'simulator' ? (
        /* SIMULATOR SCREEN VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5">
            <GlassCard className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white font-display flex items-center gap-2">🧪 Support Simulator</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Test order resolving AI workflow safely</p>
              </div>
              <form onSubmit={onRunSimulation} className="space-y-5">
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-muted)] font-mono uppercase tracking-wider mb-2 block">Order Number</label>
                  <input 
                    type="text" 
                    value={testForm.order_number}
                    onChange={e => setTestForm({...testForm, order_number: e.target.value})}
                    placeholder="e.g. #1001"
                    className="w-full px-4 py-2.5 bg-[#0A0B0F] border border-[var(--border)] rounded-full text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-muted)] font-mono uppercase tracking-wider mb-2 block">Customer Email</label>
                  <input 
                    type="email" 
                    value={testForm.customer_email}
                    onChange={e => setTestForm({...testForm, customer_email: e.target.value})}
                    placeholder="e.g. customer@gmail.com"
                    className="w-full px-4 py-2.5 bg-[#0A0B0F] border border-[var(--border)] rounded-full text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-muted)] font-mono uppercase tracking-wider mb-2 block">Customer Message</label>
                  <textarea 
                    value={testForm.customer_message}
                    onChange={e => setTestForm({...testForm, customer_message: e.target.value})}
                    placeholder="e.g. Where is my order?"
                    rows={4}
                    className="w-full px-4 py-3 bg-[#0A0B0F] border border-[var(--border)] rounded-2xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={testLoading}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[var(--primary-container)] to-[var(--secondary-container)] text-white text-sm font-semibold hover:shadow-[0_0_15px_var(--border-glow)] transition duration-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  {testLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Running Simulation...
                    </>
                  ) : 'Run Simulation'}
                </button>
              </form>
            </GlassCard>
          </div>

          <div className="lg:col-span-7">
            {testResult ? (
              <GlassCard className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-[var(--surface-high)] flex items-center justify-center text-xl shrink-0">
                    {testResult.action === 'error' ? '❌' : '🧠'}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white font-display">Simulation Outcome</h3>
                    <p className="text-xs text-[var(--text-muted)]">AI analysis results</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-[var(--surface-low)] border border-[var(--border)]">
                      <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">DETECTED INTENT</span>
                      <p className="text-sm font-bold text-[var(--secondary)] mt-1 font-mono">{testResult.intent || 'Unknown'}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-[var(--surface-low)] border border-[var(--border)]">
                      <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">RESOLUTION</span>
                      <p className="text-sm font-bold mt-1 font-mono">
                        {testResult.resolution || testResult.action || 'escalated'}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[var(--surface-low)] border border-[var(--border)]">
                    <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">AI AGENT RESPONSE</span>
                    <p className="text-sm text-[var(--text)] mt-2 leading-relaxed italic">
                      "{testResult.response || testResult.message || 'No response generated.'}"
                    </p>
                  </div>

                  {testResult.reason && (
                    <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 text-[var(--danger)]">
                      <span className="text-[10px] font-mono uppercase tracking-wider block font-semibold text-[var(--danger)]">REASON</span>
                      <p className="text-xs font-mono mt-1">{testResult.reason}</p>
                    </div>
                  )}

                  {/* CSAT evaluation wrapper */}
                  {testResult.ticket_id && (
                    <div className="pt-4 border-t border-[var(--border)] space-y-4">
                      <h4 className="text-xs font-mono font-bold uppercase text-white tracking-wider">Leave CSAT Feedback</h4>
                      {!csatSubmitted ? (
                        <div className="space-y-3">
                          <div className="flex gap-4">
                            <button onClick={() => onCsatSubmit(1)} disabled={csatSubmitting} className="flex-1 py-2 px-4 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-[var(--tertiary)] text-xs font-bold hover:bg-emerald-500/20 transition cursor-pointer flex items-center justify-center gap-1.5">
                              <ThumbsUp size={14} /> Yes
                            </button>
                            <button onClick={() => onCsatSubmit(-1)} disabled={csatSubmitting} className="flex-1 py-2 px-4 rounded-lg bg-red-500/10 border border-red-500/25 text-[var(--danger)] text-xs font-bold hover:bg-red-500/20 transition cursor-pointer flex items-center justify-center gap-1.5">
                              <ThumbsDown size={14} /> No
                            </button>
                          </div>
                          <textarea 
                            value={csatFeedback} 
                            onChange={e => setCsatFeedback(e.target.value)}
                            placeholder="Provide feedback (optional)..."
                            rows={2}
                            className="w-full px-3 py-2 bg-[#0A0B0F] border border-[var(--border)] rounded-xl text-xs text-white focus:outline-none"
                          />
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-[var(--tertiary)] text-xs font-semibold flex items-center gap-2">
                          <span>🎉</span> CSAT Feedback recorded successfully. Thank you!
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </GlassCard>
            ) : (
              <GlassCard className="p-12 text-center text-[var(--text-muted)] flex flex-col items-center justify-center min-h-[300px]">
                <span className="text-4xl mb-4">🧪</span>
                <p className="text-sm">Enter testing values on the left and run simulation to analyze outcomes.</p>
              </GlassCard>
            )}
          </div>
        </div>
      ) : (
        /* THREE-COLUMN CHAT QUEUE VIEW */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* Column 1: Customer Info Panel (LEFT) */}
          <div className="xl:col-span-3 space-y-6">
            <GlassCard className="p-6 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-[var(--surface-high)] border border-[var(--border)] flex items-center justify-center mb-4 relative shrink-0">
                <User size={36} className="text-[var(--primary)]" />
              </div>
              <h3 className="font-display font-bold text-lg text-white leading-tight">
                {activeTicket ? activeTicket.customer_email.split('@')[0] : 'Unknown Customer'}
              </h3>
              <span className="font-mono text-[10px] text-[var(--secondary)] font-semibold uppercase tracking-wider mt-1.5">
                Loyalty: Platinum Tier
              </span>

              <div className="w-full text-left mt-6 pt-6 border-t border-[var(--border)] space-y-4 text-xs font-mono">
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block">EMAIL ADDRESS</span>
                  <span className="text-[var(--text)] mt-1 block break-all">{activeTicket?.customer_email || 'n/a'}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block">SHOPIFY STORE</span>
                  <span className="text-white font-bold mt-1 block">Current Store</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block">LIFETIME VALUE</span>
                  <span className="text-[var(--tertiary)] font-bold mt-1 block">$1,420.50</span>
                </div>
              </div>
            </GlassCard>

            {/* Order info detail card */}
            <GlassCard className="p-5 space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs font-bold text-white uppercase">ORDER #ORD-7721</span>
                <Badge status="pending" className="!px-2 !py-0.5" />
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between text-[var(--text-muted)]">
                  <span>Product A x1</span>
                  <span>SKU-9981</span>
                </div>
                <div className="flex justify-between text-[var(--text-muted)]">
                  <span>Product B x2</span>
                  <span>SKU-7742</span>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border)]/40 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[var(--warning)]/10 text-[var(--warning)] shrink-0">
                  <Truck size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-white">In Transit</span>
                  <span className="text-[8px] text-[var(--text-muted)] font-mono mt-0.5">Est. Delivery: Tomorrow</span>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Column 2: Chat & Response Suggestion (MIDDLE) */}
          <div className="xl:col-span-6 space-y-6">
            <GlassCard className="flex flex-col h-[520px] overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-[var(--border)] flex justify-between items-center bg-white/[0.01]">
                <div className="flex items-center gap-3">
                  <span className="font-display font-bold text-white text-base">Ticket #{activeTicket?.id || '8821'}</span>
                  <span className="px-2 py-0.5 rounded text-[8px] font-mono font-bold bg-red-500/10 text-[var(--danger)] border border-red-500/25 uppercase">High Priority</span>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 rounded border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-white hover:border-[var(--primary)] transition duration-200 cursor-pointer font-medium">
                    Mark as Resolved
                  </button>
                  <button className="px-3 py-1.5 rounded bg-gradient-to-r from-[var(--primary-container)] to-[var(--secondary-container)] text-xs text-white hover:shadow-[0_0_12px_var(--border-glow)] transition duration-200 cursor-pointer font-semibold">
                    Action Menu
                  </button>
                </div>
              </div>

              {/* Chat Status Bar */}
              <div className="px-5 py-2.5 border-b border-[var(--border)] bg-[var(--surface-low)] flex justify-between items-center font-mono text-[10px]">
                <div className="flex items-center gap-2 text-[var(--tertiary)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-current led-pulse" />
                  <span>AI Agent Active</span>
                </div>
                <span className="text-[var(--text-muted)]">SLA: 14m remaining</span>
              </div>

              {/* Chat messages area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white/[0.005]">
                {/* Customer Message */}
                <div className="flex flex-col items-end">
                  <div className="max-w-[70%] p-4 rounded-2xl rounded-tr-none bg-[var(--surface-high)] border border-[var(--border)] text-sm text-[var(--text)]">
                    <p>{activeTicket?.raw_message || 'Where is my order? It was scheduled to arrive three days ago but I still have not received it.'}</p>
                  </div>
                  <span className="text-[8px] text-[var(--text-muted)] font-mono mt-1.5 mr-1 uppercase">Customer</span>
                </div>

                {/* AI Agent Message */}
                <div className="flex flex-col items-start">
                  <div className="flex gap-3 max-w-[80%]">
                    {/* Tiny Shopping Bag Logo */}
                    <div className="w-8 h-8 rounded-lg bg-[#0a0b0f] border border-[var(--border)] flex items-center justify-center p-[1px] shadow-[0_0_8px_var(--border-glow)] shrink-0">
                      <svg viewBox="0 0 100 100" className="w-full h-full">
                        <defs>
                          <linearGradient id="tinyLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#a2e7ff" /><stop offset="100%" stopColor="#c4c0ff" />
                          </linearGradient>
                        </defs>
                        <path d="M 35 40 A 15 15 0 0 1 65 40" fill="none" stroke="url(#tinyLogoGrad)" strokeWidth="6"/>
                        <path d="M 28 38 L 72 38 L 76 78 C 76 81, 74 83, 71 83 L 29 83 C 26 83, 24 81, 24 78 Z" fill="none" stroke="url(#tinyLogoGrad)" strokeWidth="6"/>
                      </svg>
                    </div>
                    <div className="p-4 rounded-2xl rounded-tl-none bg-[var(--surface-low)] border border-[var(--border)] text-sm text-[var(--text-secondary)]">
                      <p>{activeTicket?.ai_response || 'We are looking into this details immediately.'}</p>
                    </div>
                  </div>
                  <span className="text-[8px] text-[var(--text-muted)] font-mono mt-1.5 ml-11 uppercase">AI Assistant</span>
                </div>
              </div>
            </GlassCard>

            {/* AI suggested response editor */}
            {activeTicket && (
              <GlassCard className="p-5 border border-[var(--primary)]/20 shadow-[0_0_15px_rgba(196,192,255,0.05)]">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                    ✦ AI Suggested Response
                  </span>
                  <span className="px-2 py-0.5 rounded text-[8px] font-mono font-bold bg-[var(--tertiary)]/10 text-[var(--tertiary)] border border-[var(--tertiary)]/20">
                    {Math.round((activeTicket.response_confidence ?? 0.96) * 100)}% CONFIDENCE
                  </span>
                </div>

                {isEditing ? (
                  <textarea
                    value={editingResponse || activeTicket.ai_response}
                    onChange={(e) => setEditingResponse(e.target.value)}
                    rows={3}
                    className="w-full p-3 bg-[#0A0B0F] border border-[var(--border)] rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
                  />
                ) : (
                  <div className="p-3 bg-[var(--surface-low)] rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] italic">
                    "{editingResponse || activeTicket.ai_response}"
                  </div>
                )}

                <div className="flex justify-between items-center mt-4 pt-3 border-t border-[var(--border)]/40">
                  <div className="flex gap-2">
                    <button 
                      onClick={handleApproveSend}
                      className="px-4 py-2 rounded bg-gradient-to-r from-[var(--primary-container)] to-[var(--secondary-container)] text-xs font-semibold text-white hover:shadow-[0_0_12px_var(--border-glow)] transition cursor-pointer"
                    >
                      Approve & Send
                    </button>
                    <button 
                      onClick={() => setIsEditing(!isEditing)}
                      className="px-4 py-2 rounded border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-white transition cursor-pointer"
                    >
                      {isEditing ? 'Save Changes' : 'Edit Suggested'}
                    </button>
                  </div>
                  <button 
                    onClick={handleEscalate}
                    className="px-4 py-2 rounded border border-[var(--danger)]/30 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger)]/10 transition cursor-pointer"
                  >
                    ⚡ Escalate
                  </button>
                </div>
              </GlassCard>
            )}
          </div>

          {/* Column 3: Interaction Timeline History (RIGHT) */}
          <div className="xl:col-span-3">
            <GlassCard className="p-6">
              <div className="flex justify-between items-center mb-6">
                <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">INTERACTION HISTORY</span>
                <button className="text-[var(--text-muted)] hover:text-white transition cursor-pointer">
                  <Sliders size={14} />
                </button>
              </div>

              <div className="space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1.5px] before:bg-[var(--border)]/60">
                {/* Event 1 */}
                <div className="flex gap-4 relative">
                  <div className="w-6.5 h-6.5 rounded-full bg-[var(--surface-high)] border border-[var(--border)] flex items-center justify-center text-[var(--secondary)] relative z-10 shrink-0">
                    <ShoppingCart size={12} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">Purchased Order #ORD-7721</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">$284.00 • 3 Items</span>
                    <span className="text-[8px] text-[var(--text-muted)] font-mono mt-1">2 DAYS AGO</span>
                  </div>
                </div>

                {/* Event 2 */}
                <div className="flex gap-4 relative">
                  <div className="w-6.5 h-6.5 rounded-full bg-[var(--surface-high)] border border-[var(--border)] flex items-center justify-center text-[var(--primary)] relative z-10 shrink-0">
                    <MessageSquare size={12} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">Opened Ticket #8821</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">Issue: Shipping Status</span>
                    <span className="text-[8px] text-[var(--tertiary)] font-mono mt-1 font-semibold">1H AGO • handle time 1.4m</span>
                  </div>
                </div>

                {/* Event 3 */}
                <div className="flex gap-4 relative">
                  <div className="w-6.5 h-6.5 rounded-full bg-[var(--surface-high)] border border-[var(--border)] flex items-center justify-center text-yellow-400 relative z-10 shrink-0">
                    <Star size={12} fill="currentColor" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">Left 5-Star Review</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono mt-1 italic leading-relaxed">
                      "Fast delivery, wonderful customer support!"
                    </span>
                    <span className="text-[8px] text-[var(--text-muted)] font-mono mt-1">1 WEEK AGO</span>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

        </div>
      )}

    </div>
  );
};

export default Tickets;
