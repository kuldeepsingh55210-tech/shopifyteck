import { useState, useEffect } from 'react';
import { Sidebar } from './app/components/Sidebar';
import { Topbar } from './app/components/Topbar';
import { Dashboard } from './app/components/pages/Dashboard';
import { Tickets } from './app/components/pages/Tickets';
import { Analytics } from './app/components/pages/Analytics';
import { Stores } from './app/components/pages/Stores';
import { Settings } from './app/components/pages/Settings';

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

interface Stats {
  total_tickets: number;
  auto_resolved: number;
  escalated: number;
  automation_rate: number;
  avg_confidence: number;
}

interface ChartPoint {
  date: string;
  count?: number;
  value?: number;
  auto_resolved?: number;
  escalated?: number;
  average_sentiment?: number;
}

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

interface CsatStats {
  total_ratings: number;
  positive: number;
  negative: number;
  score: number;
  recent: any[];
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function App() {
  const [page, setPage] = useState<'dashboard' | 'tickets' | 'analytics' | 'stores' | 'settings'>('dashboard');
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved !== null ? saved === 'true' : true; // Default to dark mode
  });

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [shopId, setShopId] = useState('');
  const [shopDomain, setShopDomain] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | number | null>(null);

  // Simulator state
  const [testForm, setTestForm] = useState({ order_number: '', customer_email: '', customer_message: '' });
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [error, setError] = useState('');

  // CSAT state
  const [csatStats, setCsatStats] = useState<CsatStats | null>(null);
  const [csatFeedback, setCsatFeedback] = useState('');
  const [csatSubmitted, setCsatSubmitted] = useState(false);
  const [csatSubmitting, setCsatSubmitting] = useState(false);

  // Canned Responses state
  const [cannedResponses, setCannedResponses] = useState<any[]>([]);
  const [cannedLoading, setCannedLoading] = useState(false);
  const [cannedTitle, setCannedTitle] = useState('');
  const [cannedIntent, setCannedIntent] = useState('order_status');
  const [cannedMessage, setCannedMessage] = useState('');
  const [cannedSuccess, setCannedSuccess] = useState('');
  const [cannedError, setCannedError] = useState('');

  // Analytics states
  const [ticketsOverTime, setTicketsOverTime] = useState<ChartPoint[]>([]);
  const [resolutionRate, setResolutionRate] = useState<ChartPoint[]>([]);
  const [sentimentTrend, setSentimentTrend] = useState<ChartPoint[]>([]);

  // Settings states
  const [settings, setSettings] = useState<SettingsData>({
    auto_resolve: true,
    escalate_angry: true,
    fraud_detection: true,
    vip_detection: true,
    escalation_threshold: 60,
    fraud_refund_limit: 3,
    min_confidence: 50,
    email_notifications: false,
    notification_email: ''
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');

  // Knowledge base states
  const [knowledgeEntries, setKnowledgeEntries] = useState<any[]>([]);
  const [kbCategory, setKbCategory] = useState('General');
  const [kbQuestion, setKbQuestion] = useState('');
  const [kbAnswer, setKbAnswer] = useState('');
  const [kbBulkText, setKbBulkText] = useState('');
  const [kbLoading, setKbLoading] = useState(false);
  const [kbMessage, setKbMessage] = useState('');
  const [kbError, setKbError] = useState('');

  // Add store loading state
  const [addStoreLoading, setAddStoreLoading] = useState(false);

  // Apply dark mode styling class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  // Fetch core data
  const fetchData = async (sid: string) => {
    try {
      setLoading(true);
      setError('');
      const domain = shopDomain || localStorage.getItem('shop_domain') || '';
      
      const promises = [
        fetch(`${API_URL}/api/tickets?shop_id=${sid}`),
        fetch(`${API_URL}/api/stats?shop_id=${sid}`)
      ];
      
      if (domain) {
        promises.push(fetch(`${API_URL}/api/csat/stats?shop_domain=${encodeURIComponent(domain)}`));
      }

      const results = await Promise.all(promises);
      const ticketsData = await results[0].json();
      const statsData = await results[1].json();
      setTickets(ticketsData);
      setStats(statsData);

      if (domain && results[2]) {
        const csatData = await results[2].json();
        setCsatStats(csatData);
      }
    } catch (err) {
      console.error('Failed to fetch core dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch charts & trends for Analytics
  const fetchAnalytics = async () => {
    if (!shopId || !shopDomain) return;
    try {
      const [ticketsRes, resolutionRes, sentimentRes] = await Promise.all([
        fetch(`${API_URL}/api/analytics/tickets-over-time?shop_id=${shopId}`),
        fetch(`${API_URL}/api/analytics/resolution-rate?shop_id=${shopId}`),
        fetch(`${API_URL}/api/analytics/sentiment-trend?shop_domain=${encodeURIComponent(shopDomain)}`)
      ]);

      const ticketsData = ticketsRes.ok ? await ticketsRes.json() : [];
      const resolutionData = resolutionRes.ok ? await resolutionRes.json() : [];
      const sentimentData = sentimentRes.ok ? await sentimentRes.json() : [];
      setTicketsOverTime(Array.isArray(ticketsData) ? ticketsData : []);

      // Remap resolution rate
      if (Array.isArray(resolutionData)) {
        setResolutionRate(resolutionData.map(item => ({
          date: item.date || item.day || 'n/a',
          auto_resolved: Number(item.auto_resolved || 0),
          escalated: Number(item.escalated || 0)
        })));
      } else {
        setResolutionRate([]);
      }

      // Remap sentiment
      if (Array.isArray(sentimentData)) {
        setSentimentTrend(sentimentData.map(item => ({
          date: item.date || item.day || 'n/a',
          value: Number(item.average_sentiment || item.value || 70)
        })));
      } else {
        setSentimentTrend([]);
      }
    } catch (err) {
      console.error('[Analytics] Failed to fetch trend analytics:', err);
    }
  };

  // Fetch FAQ knowledge list
  const fetchKnowledgeBase = async () => {
    if (!shopDomain) return;
    setKbLoading(true);
    setKbError('');
    try {
      const res = await fetch(`${API_URL}/api/knowledge-base?shop_domain=${encodeURIComponent(shopDomain)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load knowledge entries');
      setKnowledgeEntries(data || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load knowledge entries';
      setKbError(msg);
    } finally {
      setKbLoading(false);
    }
  };

  // Fetch store-wide settings
  const fetchSettings = async () => {
    if (!shopDomain) return;
    try {
      const res = await fetch(`${API_URL}/api/settings?shop_domain=${encodeURIComponent(shopDomain)}`);
      const data = await res.json();
      setSettings({
        auto_resolve: data.auto_resolve ?? data.auto_resolve_enabled ?? true,
        escalate_angry: data.escalate_angry ?? data.escalate_angry_enabled ?? true,
        fraud_detection: data.fraud_detection ?? data.fraud_flagging_enabled ?? true,
        vip_detection: data.vip_detection ?? true,
        escalation_threshold: data.escalation_threshold ?? 60,
        fraud_refund_limit: data.fraud_refund_limit ?? 3,
        min_confidence: data.min_confidence ?? 50,
        email_notifications: data.email_notifications ?? false,
        notification_email: data.notification_email ?? ''
      });
      setSettingsError('');
    } catch (err) {
      console.error('[Settings] Failed to fetch settings configs:', err);
      setSettingsError('Unable to load active configurations');
    }
  };

  // Save configurations
  const saveSettings = async () => {
    if (!shopDomain) return;
    setSettingsSaving(true);
    setSettingsMessage('');
    setSettingsError('');
    try {
      const res = await fetch(`${API_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_domain: shopDomain, ...settings })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to save configuration variables');
      }
      setSettingsMessage('Settings saved successfully.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save configurations failed';
      setSettingsError(msg);
    } finally {
      setSettingsSaving(false);
    }
  };

  // Shop entry submit handler
  const handleShopSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!shopId.trim()) {
      setError('Please enter a shop ID or domain');
      return;
    }

    setLoading(true);
    if (shopId.includes('.')) {
      try {
        const res = await fetch(`${API_URL}/api/shops?domain=${encodeURIComponent(shopId)}`);
        if (!res.ok) {
          throw new Error(`Shop domain not registered: ${shopId}`);
        }
        const shop = await res.json();
        setShopId(shop.id.toString());
        setShopDomain(shop.domain);
        localStorage.setItem('shop_id', shop.id.toString());
        localStorage.setItem('shop_domain', shop.domain);
        fetchData(shop.id.toString());
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to locate shop domain';
        setError(msg);
        setLoading(false);
      }
    } else {
      localStorage.setItem('shop_id', shopId);
      fetchData(shopId);
    }
  };

  // Add store switch handler (triggered from Stores.tsx)
  const handleAddStoreSubmit = async (domain: string) => {
    setAddStoreLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/shops?domain=${encodeURIComponent(domain)}`);
      if (!res.ok) {
        throw new Error(`Shop domain not found or verified in database: ${domain}`);
      }
      const shop = await res.json();
      // Switch active store context
      setShopId(shop.id.toString());
      setShopDomain(shop.domain);
      localStorage.setItem('shop_id', shop.id.toString());
      localStorage.setItem('shop_domain', shop.domain);
      
      // Refresh views
      fetchData(shop.id.toString());
      fetchAnalytics();
      setPage('dashboard');
    } finally {
      setAddStoreLoading(false);
    }
  };

  // Disconnect active store channel
  const handleDisconnectStore = () => {
    localStorage.removeItem('shop_id');
    localStorage.removeItem('shop_domain');
    setShopId('');
    setShopDomain('');
    setTickets([]);
    setStats(null);
  };

  // CSAT rating simulation submit
  const handleCsatSubmit = async (rating: number) => {
    if (!testResult || !testResult.ticket_id) return;
    setCsatSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/csat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_domain: shopDomain || localStorage.getItem('shop_domain') || '',
          ticket_id: testResult.ticket_id,
          customer_email: testForm.customer_email,
          rating,
          feedback: csatFeedback
        })
      });
      if (res.ok) {
        setCsatSubmitted(true);
        if (shopId) {
          fetchData(shopId);
          fetchAnalytics();
        }
      }
    } catch (err) {
      console.error('[CSAT] Submit simulated rating failed:', err);
    } finally {
      setCsatSubmitting(false);
    }
  };

  // Run AI order resolver test simulation
  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestLoading(true);
    setCsatFeedback('');
    setCsatSubmitted(false);
    try {
      const res = await fetch(`${API_URL}/resolve-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ shop_id: shopId, ...testForm })
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setTestResult(data);
      fetchData(shopId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setTestResult({ action: 'error', reason: msg });
    } finally {
      setTestLoading(false);
    }
  };

  // Knowledge base FAQ operations
  const handleAddKnowledgeEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setKbMessage('');
    setKbError('');
    if (!kbQuestion.trim() || !kbAnswer.trim()) {
      setKbError('Question and answer parameters are required');
      return;
    }

    setKbLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/knowledge-base`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_domain: shopDomain,
          category: kbCategory,
          question: kbQuestion,
          answer: kbAnswer
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to add entry');
      }
      setKbMessage('Knowledge FAQ entry added.');
      setKbQuestion('');
      setKbAnswer('');
      fetchKnowledgeBase();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Add knowledge entry failed';
      setKbError(msg);
    } finally {
      setKbLoading(false);
    }
  };

  const handleDeleteKnowledgeEntry = async (id: number) => {
    if (!window.confirm('Delete this FAQ record?')) return;
    setKbMessage('');
    setKbError('');
    try {
      const res = await fetch(`${API_URL}/api/knowledge-base/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_domain: shopDomain })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to remove FAQ entry');
      }
      setKbMessage('Entry deleted successfully.');
      fetchKnowledgeBase();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Remove FAQ failed';
      setKbError(msg);
    }
  };

  const parseBulkFaqs = (text: string) => {
    return text
      .split(/---/)
      .map(block => block.trim())
      .filter(Boolean)
      .map(block => {
        const questionMatch = block.match(/Q:\s*(.+)/i);
        const answerMatch = block.match(/A:\s*([\s\S]+)/i);
        return questionMatch && answerMatch
          ? {
              category: 'General',
              question: questionMatch[1].trim(),
              answer: answerMatch[1].trim()
            }
          : null;
      })
      .filter(item => item !== null) as { category: string; question: string; answer: string }[];
  };

  const handleImportFaqs = async () => {
    setKbMessage('');
    setKbError('');
    const entries = parseBulkFaqs(kbBulkText);
    if (entries.length === 0) {
      setKbError('No valid Q/A templates parsed. Use Q: and A: lines separated by ---.');
      return;
    }

    setKbLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/knowledge-base/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_domain: shopDomain, entries })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Bulk FAQs import failed');
      }
      setKbMessage(`${data.count || 0} entries successfully bulk imported.`);
      setKbBulkText('');
      fetchKnowledgeBase();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'FAQ Bulk parse failed';
      setKbError(msg);
    } finally {
      setKbLoading(false);
    }
  };

  // Canned replies operations
  const fetchCannedResponses = async () => {
    if (!shopDomain) return;
    setCannedLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/canned-responses?shop_domain=${encodeURIComponent(shopDomain)}`);
      const data = await res.json();
      setCannedResponses(data || []);
    } catch (err) {
      console.error('[Canned] Failed to load response templates:', err);
    } finally {
      setCannedLoading(false);
    }
  };

  const handleAddCannedResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    setCannedSuccess('');
    setCannedError('');
    if (!cannedTitle.trim() || !cannedMessage.trim()) {
      setCannedError('Template title and body message parameters are required');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/canned-responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_domain: shopDomain,
          title: cannedTitle,
          intent: cannedIntent,
          message: cannedMessage
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCannedSuccess('Canned response template saved.');
        setCannedTitle('');
        setCannedMessage('');
        fetchCannedResponses();
      } else {
        setCannedError(data.error || 'Failed to register canned template');
      }
    } catch (err) {
      setCannedError('Network connection failed');
    }
  };

  const handleToggleCannedResponse = async (id: number, currentActive: boolean, item: any) => {
    try {
      const res = await fetch(`${API_URL}/api/canned-responses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          intent: item.intent,
          message: item.message,
          is_active: !currentActive
        })
      });
      if (res.ok) {
        fetchCannedResponses();
      }
    } catch (err) {
      console.error('[Canned] Toggle template status failed:', err);
    }
  };

  const handleDeleteCannedResponse = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this canned response template?')) return;
    try {
      const res = await fetch(`${API_URL}/api/canned-responses/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchCannedResponses();
      }
    } catch (err) {
      console.error('[Canned] Delete canned response failed:', err);
    }
  };

  const handleUpdateCannedResponse = async (form: any) => {
    try {
      const res = await fetch(`${API_URL}/api/canned-responses/${form.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          intent: form.intent,
          message: form.message,
          is_active: form.is_active
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchCannedResponses();
        return true;
      } else {
        alert(data.error || 'Failed to update canned template');
        return false;
      }
    } catch (err) {
      console.error('[Canned] Update template parameters failed:', err);
      return false;
    }
  };

  // Run on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlShopId = urlParams.get('shop_id');
    const urlShopDomain = urlParams.get('shop');

    if (urlShopId) {
      setShopId(urlShopId);
      localStorage.setItem('shop_id', urlShopId);
      if (urlShopDomain) {
        setShopDomain(urlShopDomain);
        localStorage.setItem('shop_domain', urlShopDomain);
      }
      window.history.replaceState({}, document.title, window.location.pathname);
      fetchData(urlShopId);
      return;
    }

    const saved = localStorage.getItem('shop_id');
    const savedDomain = localStorage.getItem('shop_domain');

    if (saved) {
      setShopId(saved);
      if (savedDomain) setShopDomain(savedDomain);
      fetchData(saved);
    } else {
      setLoading(false);
    }
  }, []);

  // Fetch contextual details depending on page routing
  useEffect(() => {
    if (shopId && shopDomain) {
      if (page === 'dashboard' || page === 'analytics') {
        fetchAnalytics();
      }
      if (page === 'settings') {
        fetchSettings();
        fetchKnowledgeBase();
        fetchCannedResponses();
      }
    }
  }, [page, shopId, shopDomain]);

  // Search Filtered Tickets
  const filteredTickets = tickets.filter(ticket => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      ticket.customer_email.toLowerCase().includes(query) ||
      ticket.detected_intent.toLowerCase().includes(query) ||
      ticket.resolution_status.toLowerCase().includes(query) ||
      (ticket.ai_response && ticket.ai_response.toLowerCase().includes(query)) ||
      ticket.id.toString().includes(query)
    );
  });

  const handleCreateTicketClick = () => {
    // Switch to simulator tab directly inside tickets page
    setPage('tickets');
    alert('Create Ticket simulation triggered. Use the Test Simulator console.');
  };

  // Render Login state screen if no shop is active
  if (!shopId || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0B0F] relative overflow-hidden font-sans text-[var(--text)]">
        {/* Floating Neon Background Orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-[var(--primary)]/10 blur-[130px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-[var(--secondary)]/10 blur-[130px] pointer-events-none"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-30 pointer-events-none"></div>
        
        <div className="relative z-10 w-full max-w-md p-8 backdrop-blur-xl bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.5)]">
          
          <div className="text-center mb-8 flex flex-col items-center">
            {/* Gradient Logo */}
            <div className="w-16 h-16 rounded-2xl bg-[#0a0b0f] border border-[var(--border)] flex items-center justify-center p-1 shadow-[0_0_20px_var(--border-glow)] mb-4 animate-pulse">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <defs>
                  <linearGradient id="logoGradLogin" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a2e7ff" />
                    <stop offset="100%" stopColor="#c4c0ff" />
                  </linearGradient>
                </defs>
                <path d="M 35 40 A 15 15 0 0 1 65 40" fill="none" stroke="url(#logoGradLogin)" strokeWidth="5" strokeLinecap="round"/>
                <path d="M 28 38 L 72 38 L 76 78 C 76 81, 74 83, 71 83 L 29 83 C 26 83, 24 81, 24 78 Z" fill="none" stroke="url(#logoGradLogin)" strokeWidth="5" strokeLinejoin="round"/>
                <circle cx="43" cy="54" r="4" fill="url(#logoGradLogin)"/>
                <circle cx="57" cy="54" r="4" fill="url(#logoGradLogin)"/>
                <path d="M 44 64 Q 50 69 56 64" fill="none" stroke="url(#logoGradLogin)" strokeWidth="4.5" strokeLinecap="round"/>
              </svg>
            </div>
            
            <h1 className="text-2xl font-bold font-display text-white mb-2 tracking-tight">ORYQX AutoSupport AI</h1>
            <p className="text-[var(--text-muted)] text-xs font-mono uppercase tracking-wider">
              {shopDomain ? `Authenticating: ${shopDomain}` : 'Enter merchant shop credentials'}
            </p>
          </div>

          {loading && (
            <div className="flex justify-center mb-6">
              <div className="w-6 h-6 border-2 border-[var(--primary)]/20 border-t-[var(--primary)] rounded-full animate-spin"></div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-3.5 bg-red-500/5 border border-red-500/15 rounded-xl text-[var(--danger)] text-xs text-center font-mono">
              {error}
            </div>
          )}

          <form onSubmit={handleShopSubmit} className="space-y-4">
            <div>
              <input
                value={shopId}
                onChange={e => setShopId(e.target.value)}
                placeholder="store.myshopify.com"
                className="w-full px-5 py-3 bg-[#0A0B0F] border border-[var(--border)] rounded-full text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-all duration-300 font-sans text-center"
                disabled={loading}
              />
            </div>
            
            <button
              type="submit"
              className={`w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-[var(--primary-container)] to-[var(--secondary-container)] hover:from-[var(--primary)] hover:to-[var(--secondary)] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(108,99,255,0.25)] hover:shadow-[0_0_25px_rgba(108,99,255,0.45)] transform active:scale-[0.98] ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={loading}
            >
              {loading ? 'Connecting...' : 'Authorize Interface'}
            </button>
          </form>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans flex relative overflow-hidden transition-colors duration-300">
      
      {/* Floating Neon Background Orbs */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--primary)]/5 blur-[150px] pointer-events-none"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--secondary)]/5 blur-[150px] pointer-events-none"></div>

      {/* Shared Navigation Sidebar */}
      <Sidebar 
        activePage={page} 
        setActivePage={setPage} 
        darkMode={darkMode} 
        setDarkMode={setDarkMode} 
        onCreateTicketClick={handleCreateTicketClick} 
        onDisconnectClick={handleDisconnectStore} 
      />

      {/* Main Container Layout offset by Sidebar (w-70 = 280px) */}
      <div className="pl-70 flex flex-col min-h-screen w-full relative z-10">
        
        {/* Shared Topbar */}
        <Topbar 
          searchQuery={searchQuery} 
          setSearchQuery={setSearchQuery} 
          userName="Admin System"
          userRole="Store Master"
        />

        {/* Dynamic Page Component Mounting */}
        <main className="flex-1 pt-24 px-8 pb-12 w-full max-w-7xl mx-auto">
          {page === 'dashboard' && (
            <Dashboard 
              tickets={filteredTickets} 
              stats={stats} 
              onViewAllTickets={() => setPage('tickets')}
              onSelectTicket={(ticketId) => {
                setSelectedTicketId(ticketId);
                setPage('tickets');
              }}
            />
          )}

          {page === 'tickets' && (
            <Tickets 
              tickets={filteredTickets}
              selectedTicketId={selectedTicketId}
              onBackToDashboard={() => setPage('dashboard')}
              onSelectTicket={(id) => setSelectedTicketId(id)}
              testForm={testForm}
              setTestForm={setTestForm}
              testResult={testResult}
              setTestResult={setTestResult}
              testLoading={testLoading}
              onRunSimulation={handleTest}
              csatSubmitting={csatSubmitting}
              csatSubmitted={csatSubmitted}
              csatFeedback={csatFeedback}
              setCsatFeedback={setCsatFeedback}
              onCsatSubmit={handleCsatSubmit}
            />
          )}

          {page === 'analytics' && (
            <Analytics 
              ticketsOverTime={ticketsOverTime}
              resolutionRate={resolutionRate}
              sentimentTrend={sentimentTrend}
              csatStats={csatStats}
            />
          )}

          {page === 'stores' && (
            <Stores 
              currentShopDomain={shopDomain}
              currentShopId={shopId}
              onDisconnectStore={handleDisconnectStore}
              onAddStoreSubmit={handleAddStoreSubmit}
              addStoreLoading={addStoreLoading}
            />
          )}

          {page === 'settings' && (
            <Settings 
              shopDomain={shopDomain}
              settings={settings}
              setSettings={setSettings}
              settingsSaving={settingsSaving}
              settingsError={settingsError}
              settingsMessage={settingsMessage}
              onSaveSettings={saveSettings}
              
              knowledgeEntries={knowledgeEntries}
              kbCategory={kbCategory}
              setKbCategory={setKbCategory}
              kbQuestion={kbQuestion}
              setKbQuestion={setKbQuestion}
              kbAnswer={kbAnswer}
              setKbAnswer={setKbAnswer}
              kbBulkText={kbBulkText}
              setKbBulkText={setKbBulkText}
              kbLoading={kbLoading}
              kbMessage={kbMessage}
              kbError={kbError}
              onAddKnowledgeEntry={handleAddKnowledgeEntry}
              onDeleteKnowledgeEntry={handleDeleteKnowledgeEntry}
              onImportFaqs={handleImportFaqs}
              onRefreshKb={fetchKnowledgeBase}
              
              cannedResponses={cannedResponses}
              cannedLoading={cannedLoading}
              cannedTitle={cannedTitle}
              setCannedTitle={setCannedTitle}
              cannedIntent={cannedIntent}
              setCannedIntent={setCannedIntent}
              cannedMessage={cannedMessage}
              setCannedMessage={setCannedMessage}
              cannedSuccess={cannedSuccess}
              cannedError={cannedError}
              onAddCannedResponse={handleAddCannedResponse}
              onDeleteCannedResponse={handleDeleteCannedResponse}
              onToggleCannedResponse={handleToggleCannedResponse}
              onUpdateCannedResponse={handleUpdateCannedResponse}
            />
          )}
        </main>

      </div>
    </div>
  );
}

export default App;
