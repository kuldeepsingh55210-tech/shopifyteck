import React, { useState } from 'react';
import { GlassCard } from '../GlassCard';
import { Toggle } from '../Toggle';
import { 
  Mail, 
  Cpu, 
  BookOpen, 
  MessageSquare, 
  RefreshCw, 
  Trash2, 
  Edit3, 
  Info,
  Save,
  FileText
} from 'lucide-react';

interface SettingsData {
  auto_resolve: boolean;
  escalate_angry: boolean;
  fraud_detection: boolean;
  vip_detection: boolean;
  escalation_threshold: number;
  fraud_refund_limit: number;
  min_confidence: number;
  email_notifications: boolean;
  notification_email: string;
}

interface SettingsProps {
  shopDomain: string;
  settings: SettingsData;
  setSettings: React.Dispatch<React.SetStateAction<SettingsData>>;
  settingsSaving: boolean;
  settingsError: string;
  settingsMessage: string;
  onSaveSettings: () => void;

  // Knowledge base
  knowledgeEntries: any[];
  kbCategory: string;
  setKbCategory: (cat: string) => void;
  kbQuestion: string;
  setKbQuestion: (q: string) => void;
  kbAnswer: string;
  setKbAnswer: (ans: string) => void;
  kbBulkText: string;
  setKbBulkText: (text: string) => void;
  kbLoading: boolean;
  kbMessage: string;
  kbError: string;
  onAddKnowledgeEntry: (e: React.FormEvent) => void;
  onDeleteKnowledgeEntry: (id: number) => void;
  onImportFaqs: () => void;
  onRefreshKb: () => void;

  // Canned responses
  cannedResponses: any[];
  cannedLoading: boolean;
  cannedTitle: string;
  setCannedTitle: (t: string) => void;
  cannedIntent: string;
  setCannedIntent: (i: string) => void;
  cannedMessage: string;
  setCannedMessage: (msg: string) => void;
  cannedSuccess: string;
  cannedError: string;
  onAddCannedResponse: (e: React.FormEvent) => void;
  onDeleteCannedResponse: (id: number) => void;
  onToggleCannedResponse: (id: number, is_active: boolean, item: any) => void;
  onUpdateCannedResponse: (form: any) => Promise<boolean>;
}

export const Settings: React.FC<SettingsProps> = ({
  shopDomain,
  settings,
  setSettings,
  settingsSaving,
  settingsError,
  settingsMessage,
  onSaveSettings,

  knowledgeEntries,
  kbCategory,
  setKbCategory,
  kbQuestion,
  setKbQuestion,
  kbAnswer,
  setKbAnswer,
  kbBulkText,
  setKbBulkText,
  kbLoading,
  kbMessage,
  kbError,
  onAddKnowledgeEntry,
  onDeleteKnowledgeEntry,
  onImportFaqs,
  onRefreshKb,

  cannedResponses,
  cannedLoading,
  cannedTitle,
  setCannedTitle,
  cannedIntent,
  setCannedIntent,
  cannedMessage,
  setCannedMessage,
  cannedSuccess,
  cannedError,
  onAddCannedResponse,
  onDeleteCannedResponse,
  onToggleCannedResponse,
  onUpdateCannedResponse
}) => {
  const [activeTab, setActiveTab] = useState<'ai' | 'kb' | 'canned'>('ai');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editCannedForm, setEditCannedForm] = useState({ id: 0, title: '', intent: 'order_status', message: '', is_active: true });

  const handleEditClick = (item: any) => {
    setEditCannedForm(item);
    setShowEditModal(true);
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onUpdateCannedResponse(editCannedForm);
    if (success) {
      setShowEditModal(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Navigation Tabs */}
      <div className="flex justify-between items-center border-b border-[var(--border)] pb-4">
        <div>
          <h2 className="text-xl font-bold text-white font-display">System Configuration</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Manage AI parameters, FAQs, and canned responses</p>
        </div>

        <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface-low)] p-1 shrink-0">
          <button 
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${activeTab === 'ai' ? 'bg-[var(--primary)] text-[#0A0B0F]' : 'text-[var(--text-muted)] hover:text-white'}`}
          >
            <Cpu size={13} />
            AI Engine
          </button>
          <button 
            onClick={() => setActiveTab('kb')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${activeTab === 'kb' ? 'bg-[var(--primary)] text-[#0A0B0F]' : 'text-[var(--text-muted)] hover:text-white'}`}
          >
            <BookOpen size={13} />
            Knowledge Base
          </button>
          <button 
            onClick={() => setActiveTab('canned')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${activeTab === 'canned' ? 'bg-[var(--primary)] text-[#0A0B0F]' : 'text-[var(--text-muted)] hover:text-white'}`}
          >
            <MessageSquare size={13} />
            Canned Library
          </button>
        </div>
      </div>

      {activeTab === 'ai' && (
        /* AI ENGINE CONFIGURATION */
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* Left Col: Store Info & Notification email */}
            <div className="xl:col-span-1 space-y-6">
              <GlassCard className="p-6">
                <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono mb-4">Channel Credentials</h3>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[var(--surface-low)] border border-[var(--border)]">
                    <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">STORE DOMAIN</span>
                    <span className="text-sm font-bold text-white mt-1 block">{shopDomain}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--surface-low)] border border-[var(--border)] flex justify-between items-center">
                    <div>
                      <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">API HOOKS</span>
                      <span className="text-xs text-white mt-1 block">Active Listening</span>
                    </div>
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-emerald-500/10 text-[var(--tertiary)] border border-emerald-500/20">
                      ONLINE
                    </span>
                  </div>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono mb-4">Alert Notification</h3>
                <div className="space-y-5">
                  <Toggle 
                    checked={settings.email_notifications}
                    onChange={checked => setSettings({ ...settings, email_notifications: checked })}
                    label="Email Alerts"
                    description="Receive logs on human escalations"
                  />
                  
                  <div>
                    <label className="text-[10px] font-bold text-[var(--text-muted)] font-mono uppercase tracking-wider mb-2 block">Alert Receiver Email</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[var(--text-muted)] w-4 h-4" />
                      <input 
                        type="email"
                        value={settings.notification_email}
                        onChange={e => setSettings({ ...settings, notification_email: e.target.value })}
                        placeholder="alerts@merchant.com"
                        className="w-full pl-11 pr-4 py-2.5 bg-[#0A0B0F] border border-[var(--border)] rounded-full text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--primary)] font-sans"
                      />
                    </div>
                  </div>

                  <button
                    onClick={onSaveSettings}
                    disabled={settingsSaving}
                    className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[var(--primary-container)] to-[var(--secondary-container)] text-white text-sm font-semibold hover:shadow-[0_0_15px_var(--border-glow)] transition duration-200 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {settingsSaving ? 'Saving Configurations...' : (
                      <>
                        <Save size={14} />
                        Save Settings
                      </>
                    )}
                  </button>

                  {settingsMessage && <p className="text-xs text-[var(--tertiary)] font-mono text-center">{settingsMessage}</p>}
                  {settingsError && <p className="text-xs text-[var(--danger)] font-mono text-center">{settingsError}</p>}
                </div>
              </GlassCard>
            </div>

            {/* Right Col: AI Configuration Controls */}
            <div className="xl:col-span-2 space-y-6">
              <GlassCard className="p-6">
                <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono mb-6">AI Agent Policy Controls</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Toggle 
                    checked={settings.auto_resolve}
                    onChange={checked => setSettings({ ...settings, auto_resolve: checked })}
                    label="Auto Resolve Tickets"
                    description="Allow AI agent to reply & close orders directly"
                  />
                  <Toggle 
                    checked={settings.escalate_angry}
                    onChange={checked => setSettings({ ...settings, escalate_angry: checked })}
                    label="Sentiment Escalate"
                    description="Instantly route angry users to senior agents"
                  />
                  <Toggle 
                    checked={settings.fraud_detection}
                    onChange={checked => setSettings({ ...settings, fraud_detection: checked })}
                    label="Fraud Watcher"
                    description="Detect and flag chargeback abuse/risk orders"
                  />
                  <Toggle 
                    checked={settings.vip_detection}
                    onChange={checked => setSettings({ ...settings, vip_detection: checked })}
                    label="VIP Flagging"
                    description="Identify gold & high LTV loyalty customers"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 pt-8 border-t border-[var(--border)]/50">
                  {/* Confidence Slider */}
                  <div className="p-4 rounded-xl bg-[var(--surface-low)] border border-[var(--border)] flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">AUTO-RESOLVE CONFIDENCE</span>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">Minimum score for automated answers</p>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between items-center text-sm font-mono text-white mb-2">
                        <span>Score Limit</span>
                        <span className="font-bold text-[var(--secondary)]">{settings.min_confidence}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="30" 
                        max="95" 
                        value={settings.min_confidence}
                        onChange={e => setSettings({ ...settings, min_confidence: Number(e.target.value) })}
                        className="w-full accent-[var(--secondary)]"
                      />
                    </div>
                  </div>

                  {/* Escalation Threshold Slider */}
                  <div className="p-4 rounded-xl bg-[var(--surface-low)] border border-[var(--border)] flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">ESCALATION THRESHOLD</span>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">Confidence cutoff to trigger support queue</p>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between items-center text-sm font-mono text-white mb-2">
                        <span>Cutoff</span>
                        <span className="font-bold text-[var(--primary)]">{settings.escalation_threshold}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="40" 
                        max="90" 
                        value={settings.escalation_threshold}
                        onChange={e => setSettings({ ...settings, escalation_threshold: Number(e.target.value) })}
                        className="w-full accent-[var(--primary)]"
                      />
                    </div>
                  </div>

                  {/* Refund Limit Selector */}
                  <div className="p-4 rounded-xl bg-[var(--surface-low)] border border-[var(--border)] flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">FRAUD REFUND LIMIT</span>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">Max automated refunds per customer</p>
                    </div>
                    <div className="mt-4">
                      <label className="text-xs uppercase tracking-wide text-slate-400 mb-1.5 block">Limit amount</label>
                      <input 
                        type="number"
                        min="1"
                        max="10"
                        value={settings.fraud_refund_limit}
                        onChange={e => setSettings({ ...settings, fraud_refund_limit: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-[#0A0B0F] border border-[var(--border)] rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                      />
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>

          </div>
        </div>
      )}

      {activeTab === 'kb' && (
        /* KNOWLEDGE BASE MANAGEMENT */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Add FAQs library entries (LEFT - 5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <GlassCard className="p-6">
              <div className="mb-6">
                <h3 className="text-base font-bold text-white font-display">Add FAQ Knowledge</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Train standard merchant return, shipping policies</p>
              </div>

              <form onSubmit={onAddKnowledgeEntry} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-muted)] font-mono uppercase tracking-wider mb-2 block">Category</label>
                  <select 
                    value={kbCategory} 
                    onChange={e => setKbCategory(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#0A0B0F] border border-[var(--border)] rounded-full text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  >
                    {['General', 'Refund Policy', 'Shipping', 'Products', 'Payment', 'Exchange', 'Other'].map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[var(--text-muted)] font-mono uppercase tracking-wider mb-2 block">Question</label>
                  <input 
                    value={kbQuestion} 
                    onChange={e => setKbQuestion(e.target.value)} 
                    placeholder="e.g. Do you support free returns?"
                    className="w-full px-4 py-2.5 bg-[#0A0B0F] border border-[var(--border)] rounded-full text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[var(--text-muted)] font-mono uppercase tracking-wider mb-2 block">Answer Policy Details</label>
                  <textarea 
                    value={kbAnswer} 
                    onChange={e => setKbAnswer(e.target.value)}
                    rows={4}
                    placeholder="We offer 30-day free domestic returns for all unworn clothes..."
                    className="w-full px-4 py-3 bg-[#0A0B0F] border border-[var(--border)] rounded-2xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={kbLoading}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[var(--primary-container)] to-[var(--secondary-container)] text-white text-sm font-semibold hover:shadow-[0_0_15px_var(--border-glow)] transition duration-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  {kbLoading ? 'Saving FAQs...' : 'Add Knowledge Entry'}
                </button>

                {kbMessage && <p className="text-xs text-[var(--tertiary)] font-mono text-center">{kbMessage}</p>}
                {kbError && <p className="text-xs text-[var(--danger)] font-mono text-center">{kbError}</p>}
              </form>
            </GlassCard>

            {/* Bulk FAQ parser */}
            <GlassCard className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono">Bulk Import Policies</h3>
                <span className="p-1 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-white transition cursor-pointer" title="FAQ Syntax Help">
                  <Info size={13} />
                </span>
              </div>
              <textarea 
                value={kbBulkText}
                onChange={e => setKbBulkText(e.target.value)}
                placeholder="Q: What shipping carrier is used?&#10;A: We ship via USPS Priority Mail.&#10;---&#10;Q: How to track order?&#10;A: Tracking links are sent to email."
                rows={6}
                className="w-full px-4 py-3 bg-[#0A0B0F] border border-[var(--border)] rounded-2xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none font-mono"
              />
              <button 
                onClick={onImportFaqs}
                disabled={kbLoading}
                className="w-full mt-3 py-2 rounded-lg border border-[var(--border)] text-xs text-white font-semibold hover:bg-white/5 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <FileText size={13} />
                Bulk Parse Import FAQs
              </button>
            </GlassCard>
          </div>

          {/* FAQ Entry Library Lists (RIGHT - 7 cols) */}
          <div className="lg:col-span-7">
            <GlassCard className="p-6 flex flex-col min-h-[400px]">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-base font-bold text-white font-display">FAQ Library Catalog</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">List of trained context instructions</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--text-muted)] font-mono">{knowledgeEntries.length} items loaded</span>
                  <button 
                    onClick={onRefreshKb}
                    className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-white transition cursor-pointer"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
              </div>

              {kbLoading ? (
                <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm font-mono">
                  Loading trained database tags...
                </div>
              ) : knowledgeEntries.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-[var(--text-muted)]">
                  <span className="text-3xl mb-3">📖</span>
                  <p className="text-sm font-medium">No FAQ records on file.</p>
                  <p className="text-xs mt-1 text-[var(--text-muted)] max-w-xs">Tuning guidelines avoids standard customer support hallucinations.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {knowledgeEntries.map((entry) => (
                    <div key={entry.id} className="p-4 rounded-xl bg-[var(--surface-low)] border border-[var(--border)]/70 flex justify-between items-start gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono bg-blue-500/10 text-[#a2e7ff] border border-blue-500/20 uppercase">
                            {entry.category || 'General'}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-white">{entry.question}</p>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed italic">"{entry.answer}"</p>
                      </div>

                      <button 
                        onClick={() => onDeleteKnowledgeEntry(entry.id)}
                        className="p-1.5 rounded-lg border border-red-500/15 text-[var(--danger)]/80 hover:text-[var(--danger)] hover:bg-red-500/10 transition cursor-pointer shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>

        </div>
      )}

      {activeTab === 'canned' && (
        /* CANNED AUTOMATIC RESPONSES */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Create Canned reply (LEFT - 4 cols) */}
          <div className="lg:col-span-4">
            <GlassCard className="p-6">
              <div className="mb-6">
                <h3 className="text-base font-bold text-white font-display">Add Canned Reply</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Predefined replies triggered by specific intent tags</p>
              </div>

              <form onSubmit={onAddCannedResponse} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-muted)] font-mono uppercase tracking-wider mb-2 block">Canned Title</label>
                  <input 
                    value={cannedTitle} 
                    onChange={e => setCannedTitle(e.target.value)}
                    placeholder="e.g. Refund Policy Trigger"
                    className="w-full px-4 py-2.5 bg-[#0A0B0F] border border-[var(--border)] rounded-full text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[var(--text-muted)] font-mono uppercase tracking-wider mb-2 block">Triggers on Intent</label>
                  <select 
                    value={cannedIntent} 
                    onChange={e => setCannedIntent(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#0A0B0F] border border-[var(--border)] rounded-full text-sm text-white focus:outline-none"
                  >
                    {['order_status', 'refund_request', 'angry_customer', 'shipping_status', 'general_inquiry', 'cancel_order', 'other'].map(intent => (
                       <option key={intent} value={intent}>{intent}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[var(--text-muted)] font-mono uppercase tracking-wider mb-2 block">Response Message</label>
                  <textarea 
                    value={cannedMessage} 
                    onChange={e => setCannedMessage(e.target.value)}
                    rows={4}
                    placeholder="Hello, we are processing your order {order_id} right away..."
                    className="w-full px-4 py-3 bg-[#0A0B0F] border border-[var(--border)] rounded-2xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[var(--primary-container)] to-[var(--secondary-container)] text-white text-sm font-semibold hover:shadow-[0_0_15px_var(--border-glow)] transition duration-200 cursor-pointer"
                >
                  Save Canned Template
                </button>

                {cannedSuccess && <p className="text-xs text-[var(--tertiary)] font-mono text-center">{cannedSuccess}</p>}
                {cannedError && <p className="text-xs text-[var(--danger)] font-mono text-center">{cannedError}</p>}
              </form>
            </GlassCard>
          </div>

          {/* Library of replies (RIGHT - 8 cols) */}
          <div className="lg:col-span-8">
            <GlassCard className="p-6 overflow-hidden flex flex-col min-h-[400px]">
              <div className="mb-6 flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-white font-display">Canned Templates</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">Automated backup answers used for specific ticket intents</p>
                </div>
                <span className="text-xs text-[var(--text-muted)] font-mono">{cannedResponses.length} templates saved</span>
              </div>

              {cannedLoading ? (
                <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm font-mono">
                  Loading responses...
                </div>
              ) : cannedResponses.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-[var(--text-muted)]">
                  <span className="text-3xl mb-3">💬</span>
                  <p className="text-sm font-medium">No custom templates on file.</p>
                  <p className="text-xs mt-1 max-w-xs">Creating custom canned responses boosts automation reliability.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-[var(--border)]/40 rounded-xl">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[9px] uppercase tracking-wider text-[var(--text-muted)] bg-white/[0.01]">
                        <th className="p-3 pl-4">Title</th>
                        <th className="p-3">Intent</th>
                        <th className="p-3">Preview</th>
                        <th className="p-3 text-center">Hits</th>
                        <th className="p-3 text-center">Active</th>
                        <th className="p-3 pr-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]/30">
                      {cannedResponses.map((item) => (
                        <tr key={item.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="p-3 pl-4 font-bold text-white">{item.title}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[9px] bg-slate-500/10 text-slate-300 border border-slate-500/20">
                              {item.intent}
                            </span>
                          </td>
                          <td className="p-3 max-w-[150px] truncate text-[var(--text-secondary)]">{item.message}</td>
                          <td className="p-3 text-center font-bold text-[var(--primary)]">{item.usage_count || 0}</td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => onToggleCannedResponse(item.id, item.is_active, item)}
                              className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${item.is_active ? 'bg-emerald-500/10 text-[var(--tertiary)] border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-rose-500/10 text-[var(--danger)] border-rose-500/20 hover:bg-rose-500/20'} transition`}
                            >
                              {item.is_active ? 'Yes' : 'No'}
                            </button>
                          </td>
                          <td className="p-3 pr-4 text-right space-x-1.5 shrink-0">
                            <button 
                              onClick={() => handleEditClick(item)}
                              className="p-1 rounded bg-white/5 border border-[var(--border)] text-[var(--text-muted)] hover:text-white transition cursor-pointer inline-flex"
                            >
                              <Edit3 size={11} />
                            </button>
                            <button 
                              onClick={() => onDeleteCannedResponse(item.id)}
                              className="p-1 rounded bg-red-500/5 border border-red-500/10 text-[var(--danger)] hover:bg-red-500/15 transition cursor-pointer inline-flex"
                            >
                              <Trash2 size={11} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </GlassCard>
          </div>

        </div>
      )}

      {/* Edit Canned Modal Backdrop */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 bg-[#121317] border border-[var(--border)] rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.6)] relative text-left">
            <h3 className="text-lg font-bold text-white font-display mb-2">Edit Canned Reply</h3>
            <p className="text-xs text-[var(--text-muted)] mb-6">Modify predefined template details and save updates</p>
            
            <form onSubmit={handleUpdateSubmit} className="space-y-4 font-mono">
              <div>
                <label className="text-[10px] uppercase text-[var(--text-muted)] block mb-1.5">Reply Title</label>
                <input 
                  value={editCannedForm.title} 
                  onChange={e => setEditCannedForm({...editCannedForm, title: e.target.value})} 
                  className="w-full px-4 py-2.5 bg-[#0a0b0f] border border-[var(--border)] rounded-xl text-xs text-white focus:outline-none" 
                />
              </div>
              <div>
                <label className="text-[10px] uppercase text-[var(--text-muted)] block mb-1.5">Intent Category</label>
                <select 
                  value={editCannedForm.intent} 
                  onChange={e => setEditCannedForm({...editCannedForm, intent: e.target.value})} 
                  className="w-full px-4 py-2.5 bg-[#0a0b0f] border border-[var(--border)] rounded-xl text-xs text-white focus:outline-none"
                >
                  {['order_status', 'refund_request', 'angry_customer', 'shipping_status', 'general_inquiry', 'cancel_order', 'other'].map(intent => (
                    <option key={intent} value={intent}>{intent}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase text-[var(--text-muted)] block mb-1.5">Template Message Body</label>
                <textarea 
                  value={editCannedForm.message} 
                  onChange={e => setEditCannedForm({...editCannedForm, message: e.target.value})} 
                  rows={4} 
                  className="w-full px-4 py-3 bg-[#0a0b0f] border border-[var(--border)] rounded-xl text-xs text-white focus:outline-none resize-none" 
                />
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]/40">
                <label className="flex items-center gap-2 cursor-pointer font-sans text-xs">
                  <input 
                    type="checkbox" 
                    checked={editCannedForm.is_active} 
                    onChange={e => setEditCannedForm({...editCannedForm, is_active: e.target.checked})} 
                    className="accent-[var(--primary)]" 
                  />
                  <span className="text-[var(--text-secondary)]">Active and Triggerable</span>
                </label>
                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => setShowEditModal(false)} 
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--text-muted)] bg-[var(--surface-low)] border border-[var(--border)] hover:bg-white/5 transition"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[var(--primary-container)] to-[var(--secondary-container)] hover:shadow-[0_0_12px_var(--border-glow)] transition"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
