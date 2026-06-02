import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area
} from 'recharts';

interface Ticket {
  id: string;
  customer_email: string;
  detected_intent: string;
  resolution_status: string;
  response_confidence: number;
  ai_response: string;
  created_at: string;
}

interface Stats {
  total_tickets: number;
  auto_resolved: number;
  escalated: number;
  automation_rate: number;
  avg_confidence: number;
}

interface EscalationItem {
  id: number;
  customer_email: string;
  reason: string;
  priority: string;
  created_at: string;
  status: string;
  fraud_flag: boolean;
}

interface ChartPoint {
  date: string;
  count?: number;
  value?: number;
  auto_resolved?: number;
  escalated?: number;
  average_sentiment?: number;
}

interface Settings {
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

const API_URL = 'http://localhost:3000';
const PIE_COLORS = ['#8b5cf6', '#38bdf8', '#f97316', '#10b981', '#f43f5e', '#a855f7'];

function App() {
  const [page, setPage] = useState<'dashboard' | 'tickets' | 'escalations' | 'settings'>('dashboard');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [shopId, setShopId] = useState('');
  const [shopDomain, setShopDomain] = useState('');
  const [testForm, setTestForm] = useState({ order_number: '', customer_email: '', customer_message: '' });
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [error, setError] = useState('');

  const [csatStats, setCsatStats] = useState<CsatStats | null>(null);
  const [csatTrend, setCsatTrend] = useState<any[]>([]);
  const [csatFeedback, setCsatFeedback] = useState('');
  const [csatSubmitted, setCsatSubmitted] = useState(false);
  const [csatSubmitting, setCsatSubmitting] = useState(false);

  const [cannedResponses, setCannedResponses] = useState<any[]>([]);
  const [cannedLoading, setCannedLoading] = useState(false);
  const [cannedTitle, setCannedTitle] = useState('');
  const [cannedIntent, setCannedIntent] = useState('order_status');
  const [cannedMessage, setCannedMessage] = useState('');
  const [cannedSuccess, setCannedSuccess] = useState('');
  const [cannedError, setCannedError] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editCannedForm, setEditCannedForm] = useState({ id: 0, title: '', intent: 'order_status', message: '', is_active: true });

  const [escalations, setEscalations] = useState<EscalationItem[]>([]);
  const [queueFilter, setQueueFilter] = useState<'All' | 'Pending' | 'Resolved' | 'Fraud Flags'>('All');
  const [queueLoading, setQueueLoading] = useState(false);

  const [ticketsOverTime, setTicketsOverTime] = useState<ChartPoint[]>([]);
  const [intentDistribution, setIntentDistribution] = useState<ChartPoint[]>([]);
  const [resolutionRate, setResolutionRate] = useState<ChartPoint[]>([]);
  const [sentimentTrend, setSentimentTrend] = useState<ChartPoint[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);

  const [settings, setSettings] = useState<Settings>({
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
  const [knowledgeEntries, setKnowledgeEntries] = useState<any[]>([]);
  const [kbCategory, setKbCategory] = useState('General');
  const [kbQuestion, setKbQuestion] = useState('');
  const [kbAnswer, setKbAnswer] = useState('');
  const [kbBulkText, setKbBulkText] = useState('');
  const [kbLoading, setKbLoading] = useState(false);
  const [kbMessage, setKbMessage] = useState('');
  const [kbError, setKbError] = useState('');

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
      console.error('Failed to fetch data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchEscalations = async () => {
    if (!shopId) return;
    setQueueLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/escalation-queue?shop_id=${shopId}`);
      const data = await res.json();
      setEscalations(data || []);
    } catch (err) {
      console.error('[App] Failed to load escalation queue:', err);
    } finally {
      setQueueLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    if (!shopId || !shopDomain) return;
    try {
      const [ticketsRes, intentRes, resolutionRes, sentimentRes, csatTrendRes] = await Promise.all([
        fetch(`${API_URL}/api/analytics/tickets-over-time?shop_id=${shopId}`),
        fetch(`${API_URL}/api/analytics/intent-distribution?shop_id=${shopId}`),
        fetch(`${API_URL}/api/analytics/resolution-rate?shop_id=${shopId}`),
        fetch(`${API_URL}/api/analytics/sentiment-trend?shop_domain=${encodeURIComponent(shopDomain)}`),
        fetch(`${API_URL}/api/csat/trend?shop_domain=${encodeURIComponent(shopDomain)}`)
      ]);

      const ticketsData = ticketsRes.ok ? await ticketsRes.json() : chartData;
      const intentData = intentRes.ok ? await intentRes.json() : chartData;
      const resolutionData = resolutionRes.ok ? await resolutionRes.json() : chartData;
      const sentimentData = sentimentRes.ok ? await sentimentRes.json() : chartData;
      const csatTrendData = csatTrendRes.ok ? await csatTrendRes.json() : [];

      setTicketsOverTime(Array.isArray(ticketsData) ? ticketsData : chartData);
      setIntentDistribution(Array.isArray(intentData) ? intentData : chartData);
      setResolutionRate(Array.isArray(resolutionData) ? resolutionData : chartData);
      setSentimentTrend(Array.isArray(sentimentData) ? sentimentData : chartData);
      setCsatTrend(Array.isArray(csatTrendData) ? csatTrendData : []);
    } catch (err) {
      console.error('[Analytics] Failed to fetch charts data:', err);
      setChartData([]);
      setTicketsOverTime(chartData);
      setIntentDistribution(chartData);
      setResolutionRate(chartData);
      setSentimentTrend(chartData);
      setCsatTrend([]);
    }
  };

  const fetchKnowledgeBase = async () => {
    if (!shopDomain) return;
    setKbLoading(true);
    setKbError('');
    try {
      const res = await fetch(`${API_URL}/api/knowledge-base?shop_domain=${encodeURIComponent(shopDomain)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load knowledge base');
      setKnowledgeEntries(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load knowledge base';
      console.error('[KB] Failed to load knowledge base:', message);
      setKbError(message);
    } finally {
      setKbLoading(false);
    }
  };

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
      console.error('[Settings] Failed to load settings:', err);
      setSettingsError('Unable to load settings');
    }
  };

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
        throw new Error(data.error || 'Unable to save settings');
      }
      setSettings({
        auto_resolve: data.auto_resolve,
        escalate_angry: data.escalate_angry,
        fraud_detection: data.fraud_detection,
        vip_detection: data.vip_detection,
        escalation_threshold: data.escalation_threshold,
        fraud_refund_limit: data.fraud_refund_limit,
        min_confidence: data.min_confidence,
        email_notifications: data.email_notifications,
        notification_email: data.notification_email || ''
      });
      setSettingsMessage('Settings saved successfully.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed';
      setSettingsError(message);
      console.error('[Settings] Save error:', message);
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleShopSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!shopId.trim()) {
      setError('Please enter a shop ID or domain');
      return;
    }

    if (shopId.includes('.')) {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/shops?domain=${encodeURIComponent(shopId)}`);
        if (!res.ok) {
          throw new Error(`Shop not found: ${shopId}`);
        }
        const shop = await res.json();
        setShopId(shop.id.toString());
        setShopDomain(shop.domain);
        localStorage.setItem('shop_id', shop.id.toString());
        localStorage.setItem('shop_domain', shop.domain);
        fetchData(shop.id.toString());
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to find shop';
        setError(message);
        console.error('[App] Shop lookup error:', message);
        setLoading(false);
      }
    } else {
      localStorage.setItem('shop_id', shopId);
      fetchData(shopId);
    }
  };

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
      console.error('[CSAT] Submit error:', err);
    } finally {
      setCsatSubmitting(false);
    }
  };

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
      const message = err instanceof Error ? err.message : 'Failed to connect';
      setTestResult({ action: 'error', reason: message });
      console.error('Test error:', message);
    } finally {
      setTestLoading(false);
    }
  };

  const resolveEscalation = async (id: number) => {
    try {
      await fetch(`${API_URL}/api/escalation-queue/${id}/resolve`, { method: 'PUT' });
      fetchEscalations();
    } catch (err) {
      console.error('[App] Failed to mark escalation resolved:', err);
    }
  };

  const handleAddKnowledgeEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setKbMessage('');
    setKbError('');
    if (!kbQuestion.trim() || !kbAnswer.trim()) {
      setKbError('Question and answer are required');
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
      setKbMessage('Knowledge base entry added.');
      setKbQuestion('');
      setKbAnswer('');
      fetchKnowledgeBase();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add knowledge base entry';
      console.error('[KB] Add entry failed:', message);
      setKbError(message);
    } finally {
      setKbLoading(false);
    }
  };

  const handleDeleteKnowledgeEntry = async (id: number) => {
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
        throw new Error(data.error || 'Failed to delete entry');
      }
      setKbMessage('Entry deleted successfully.');
      fetchKnowledgeBase();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete entry';
      console.error('[KB] Delete entry failed:', message);
      setKbError(message);
    }
  };

  const fetchCannedResponses = async () => {
    if (!shopDomain) return;
    setCannedLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/canned-responses?shop_domain=${encodeURIComponent(shopDomain)}`);
      const data = await res.json();
      setCannedResponses(data || []);
    } catch (err) {
      console.error('[Canned] Failed to load canned responses:', err);
    } finally {
      setCannedLoading(false);
    }
  };

  const handleAddCannedResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    setCannedSuccess('');
    setCannedError('');
    if (!cannedTitle.trim() || !cannedMessage.trim()) {
      setCannedError('Title and message are required');
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
        setCannedSuccess('Canned response added successfully.');
        setCannedTitle('');
        setCannedMessage('');
        fetchCannedResponses();
      } else {
        setCannedError(data.error || 'Failed to add canned response');
      }
    } catch (err) {
      setCannedError('Network error while adding response');
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
      console.error('[Canned] Toggle status error:', err);
    }
  };

  const handleDeleteCannedResponse = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this canned response?')) return;
    try {
      const res = await fetch(`${API_URL}/api/canned-responses/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchCannedResponses();
      }
    } catch (err) {
      console.error('[Canned] Delete error:', err);
    }
  };

  const handleUpdateCannedResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/canned-responses/${editCannedForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editCannedForm.title,
          intent: editCannedForm.intent,
          message: editCannedForm.message,
          is_active: editCannedForm.is_active
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowEditModal(false);
        fetchCannedResponses();
      } else {
        alert(data.error || 'Failed to update canned response');
      }
    } catch (err) {
      console.error('[Canned] Update error:', err);
    }
  };

  const parseBulkFaqs = (text: string) => {
    return text
      .split(/---/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => {
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
      .filter((item) => item !== null) as { category: string; question: string; answer: string }[];
  };

  const handleImportFaqs = async () => {
    setKbMessage('');
    setKbError('');
    const entries = parseBulkFaqs(kbBulkText);
    if (entries.length === 0) {
      setKbError('No valid Q/A blocks found. Use Q: and A: separators.');
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
        throw new Error(data.error || 'Bulk import failed');
      }
      setKbMessage(`${data.count || 0} entries imported.`);
      setKbBulkText('');
      fetchKnowledgeBase();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import FAQs';
      console.error('[KB] Bulk import failed:', message);
      setKbError(message);
    } finally {
      setKbLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'auto_resolved') return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Auto Resolved</span>;
    if (status === 'escalated') return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">Escalated</span>;
    if (status === 'resolved') return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Resolved</span>;
    if (status === 'manual') return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-300 border border-slate-500/20">Manual</span>;
    return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">Pending</span>;
  };

  const queueCount = escalations.length;
  const filteredEscalations = escalations.filter(item => {
    if (queueFilter === 'All') return true;
    if (queueFilter === 'Fraud Flags') return item.fraud_flag;
    return item.status.toLowerCase() === queueFilter.toLowerCase();
  });

  useEffect(() => {
    console.log('[App] Initializing...');
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

  useEffect(() => {
    if (shopId && page === 'escalations') {
      fetchEscalations();
      const interval = setInterval(fetchEscalations, 30000);
      return () => clearInterval(interval);
    }
  }, [page, shopId]);

  useEffect(() => {
    if (shopId && shopDomain && page === 'dashboard') {
      fetchAnalytics();
    }
  }, [page, shopId, shopDomain]);

  useEffect(() => {
    if (shopDomain && page === 'settings') {
      fetchSettings();
      fetchKnowledgeBase();
      fetchCannedResponses();
    }
  }, [page, shopDomain]);

  if (!shopId || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f1a] relative overflow-hidden font-sans text-slate-200">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/20 blur-[120px]"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50"></div>
        <div className="relative z-10 w-full max-w-md p-8 backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-violet-400 mb-2">Shopify AI Support</h1>
            <p className="text-slate-400 text-sm">
              {shopDomain ? `Connecting to: ${shopDomain}` : 'Enter your Shop ID to access the dashboard'}
            </p>
          </div>
          {loading && (
            <div className="flex justify-center mb-6">
              <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
          )}
          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm text-center">
              {error}
            </div>
          )}
          <form onSubmit={handleShopSubmit} className="space-y-4">
            <div>
              <input
                value={shopId}
                onChange={e => setShopId(e.target.value)}
                placeholder="Shop ID or domain (e.g., store.myshopify.com)"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all duration-300"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              className={`w-full py-3 rounded-xl font-semibold text-white shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all duration-300 ${loading ? 'bg-slate-600 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] transform hover:-translate-y-0.5'}`}
              disabled={loading}
            >
              {loading ? 'Initializing...' : 'Access Dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-slate-200 font-sans flex relative overflow-hidden">
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[150px] pointer-events-none"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[150px] pointer-events-none"></div>
      <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-50 pointer-events-none"></div>

      <aside className="w-64 border-r border-white/10 bg-[#0f0f1a]/80 backdrop-blur-xl flex flex-col relative z-20">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-violet-400 tracking-tight">
            AI Engine <span className="text-xs align-top text-indigo-400">PRO</span>
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setPage('dashboard')} className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${page === 'dashboard' ? 'bg-gradient-to-r from-indigo-500/20 to-violet-500/10 text-indigo-200 border border-indigo-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
            <span className="text-lg">📊</span> Dashboard
          </button>
          <button onClick={() => setPage('tickets')} className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${page === 'tickets' ? 'bg-gradient-to-r from-indigo-500/20 to-violet-500/10 text-indigo-200 border border-indigo-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
            <span className="text-lg">🎫</span> Tickets
          </button>
          <button onClick={() => setPage('escalations')} className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${page === 'escalations' ? 'bg-gradient-to-r from-indigo-500/20 to-violet-500/10 text-indigo-200 border border-indigo-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
            <span className="text-lg">⚠️</span> Escalations
          </button>
          <button onClick={() => setPage('settings')} className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${page === 'settings' ? 'bg-gradient-to-r from-indigo-500/20 to-violet-500/10 text-indigo-200 border border-indigo-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
            <span className="text-lg">⚙️</span> Settings
          </button>
        </nav>
        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => {
              localStorage.removeItem('shop_id');
              localStorage.removeItem('shop_domain');
              setShopId('');
              setShopDomain('');
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all duration-300"
          >
            <span>🚪</span> Disconnect
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative z-10 h-screen overflow-y-auto">
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#0f0f1a]/80 border-b border-white/10 px-8 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-white">{page === 'dashboard' ? 'Analytics Dashboard' : page === 'tickets' ? 'Tickets' : page === 'escalations' ? 'Escalation Queue' : 'Merchant Settings'}</h2>
            {shopDomain && <p className="text-sm text-slate-400 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span> {shopDomain}</p>}
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 p-[2px]">
              <div className="w-full h-full rounded-full bg-[#0f0f1a] flex items-center justify-center text-sm font-bold text-white">
                {shopDomain ? shopDomain.charAt(0).toUpperCase() : 'AI'}
              </div>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
          {page === 'dashboard' && (
            <div className="space-y-8">
              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  {[
                    { label: 'Total Tickets', value: stats.total_tickets, icon: '📈', color: 'from-blue-500/20 to-indigo-500/20', text: 'text-indigo-400' },
                    { label: 'Auto Resolved', value: `${stats.automation_rate || 0}%`, icon: '⚡', color: 'from-emerald-500/20 to-teal-500/20', text: 'text-emerald-400' },
                    { label: 'Escalated', value: stats.escalated, icon: '⚠️', color: 'from-amber-500/20 to-orange-500/20', text: 'text-amber-400' },
                    { label: 'AI Confidence', value: `${stats.avg_confidence || 0}%`, icon: '🧠', color: 'from-violet-500/20 to-purple-500/20', text: 'text-violet-400' },
                    { 
                      label: 'CSAT Score', 
                      value: csatStats ? `${csatStats.score}%` : '100%', 
                      icon: '⭐', 
                      color: 'from-emerald-500/20 to-teal-500/20', 
                      text: 'text-emerald-400',
                      csat: true 
                    }
                  ].map((s, i) => (
                    <div key={i} className="relative group backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(0,0,0,0.2)] hover:border-white/20">
                      <div className={`absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br ${s.color} rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500`}></div>
                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                          <p className="text-slate-400 text-sm font-medium">{s.label}</p>
                          <span className="text-2xl">{s.icon}</span>
                        </div>
                        <p className={`text-4xl font-bold ${s.text} tracking-tight`}>{s.value}</p>
                        {s.csat && csatStats && (
                          <div className="flex gap-2 text-xs text-slate-400 mt-2 font-medium">
                            <span>Total: <strong className="text-slate-200">{csatStats.total_ratings}</strong></span>
                            <span>•</span>
                            <span className="text-emerald-400">{csatStats.positive} 👍</span>
                            <span>•</span>
                            <span className="text-rose-400">{csatStats.negative} 👎</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Tickets Over Time</h3>
                      <p className="text-sm text-slate-400">Last 7 days ticket count</p>
                    </div>
                  </div>
                  <div className="h-72">
                    {ticketsOverTime.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={ticketsOverTime} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid stroke="#ffffff10" vertical={false} />
                          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ background: '#0f172a', borderColor: '#334155' }} labelStyle={{ color: '#f8fafc' }} itemStyle={{ color: '#ffffff' }} />
                          <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 text-sm">No ticket trend data available.</div>
                    )}
                  </div>
                </div>

                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Intent Distribution</h3>
                      <p className="text-sm text-slate-400">Top customer ticket intents</p>
                    </div>
                  </div>
                  <div className="h-72 flex items-center justify-center">
                    {intentDistribution.length === 0 ? (
                      <div className="text-slate-400 text-sm">No intent data yet.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={intentDistribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2} stroke="transparent">
                            {intentDistribution.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: '#0f172a', borderColor: '#334155' }} labelStyle={{ color: '#f8fafc' }} itemStyle={{ color: '#ffffff' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Resolution Rate</h3>
                      <p className="text-sm text-slate-400">Auto resolved vs escalated</p>
                    </div>
                  </div>
                  <div className="h-72">
                    {resolutionRate.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={resolutionRate} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid stroke="#ffffff10" vertical={false} />
                          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ background: '#0f172a', borderColor: '#334155' }} labelStyle={{ color: '#f8fafc' }} itemStyle={{ color: '#ffffff' }} />
                          <Bar dataKey="auto_resolved" fill="#22c55e" radius={[6,6,0,0]} />
                          <Bar dataKey="escalated" fill="#f59e0b" radius={[6,6,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 text-sm">No resolution rate data available.</div>
                    )}
                  </div>
                </div>

                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Sentiment Trend</h3>
                      <p className="text-sm text-slate-400">Average sentiment over last 7 days</p>
                    </div>
                  </div>
                  <div className="h-72">
                    {sentimentTrend.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sentimentTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.1} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="#ffffff10" vertical={false} />
                          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ background: '#0f172a', borderColor: '#334155' }} labelStyle={{ color: '#f8fafc' }} itemStyle={{ color: '#ffffff' }} />
                          <Area type="monotone" dataKey="average_sentiment" stroke="#38bdf8" fillOpacity={1} fill="url(#sentimentGradient)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 text-sm">No sentiment trend data available.</div>
                    )}
                  </div>
                </div>

                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">CSAT Trend</h3>
                      <p className="text-sm text-slate-400">Last 7 days satisfaction score</p>
                    </div>
                  </div>
                  <div className="h-72">
                    {csatTrend.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={csatTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="csatGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="#ffffff10" vertical={false} />
                          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                          <Tooltip contentStyle={{ background: '#0f172a', borderColor: '#334155' }} labelStyle={{ color: '#f8fafc' }} itemStyle={{ color: '#ffffff' }} />
                          <Area type="monotone" dataKey="score" stroke="#10b981" fillOpacity={1} fill="url(#csatGradient)" strokeWidth={3} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 text-sm">No CSAT trend data available.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {page === 'tickets' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <div className="xl:col-span-2 backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                <div className="p-6 border-b border-white/10 bg-white/[0.02]">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">📝 Recent Interactions</h2>
                  <p className="text-sm text-slate-400 mt-1">Latest ticket activity for your store.</p>
                </div>
                <div className="overflow-x-auto">
                  {tickets.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                      <span className="text-4xl block mb-4 opacity-50">📭</span>
                      <p>No tickets processed yet.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500 font-semibold bg-white/[0.02]">
                          <th className="p-4 pl-6">Customer</th>
                          <th className="p-4">Intent</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Confidence</th>
                          <th className="p-4 pr-6">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {tickets.map(t => (
                          <tr key={t.id} className="hover:bg-white/[0.04] transition-colors duration-200">
                            <td className="p-4 pl-6 text-sm text-slate-300">{t.customer_email}</td>
                            <td className="p-4 text-sm text-cyan-400">{t.detected_intent}</td>
                            <td className="p-4">{getStatusBadge(t.resolution_status)}</td>
                            <td className="p-4 text-sm text-slate-300">
                              {t.response_confidence ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(t.response_confidence || 0) * 100}%` }}></div>
                                  </div>
                                  <span>{((t.response_confidence || 0) * 100).toFixed(1)}%</span>
                                </div>
                              ) : '-'}
                            </td>
                            <td className="p-4 pr-6 text-xs text-slate-500">{new Date(t.created_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">🧪 Simulator</h2>
                  <p className="text-sm text-slate-400 mt-1">Test the AI resolution pipeline safely.</p>
                </div>
                <form onSubmit={handleTest} className="space-y-4">
                  {[
                    { label: 'Order Number', key: 'order_number', placeholder: '#1001', type: 'text' },
                    { label: 'Customer Email', key: 'customer_email', placeholder: 'customer@example.com', type: 'email' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{f.label}</label>
                      <input 
                        type={f.type}
                        value={testForm[f.key as keyof typeof testForm]} 
                        onChange={e => setTestForm({...testForm, [f.key]: e.target.value})} 
                        placeholder={f.placeholder} 
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all" 
                      />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Customer Message</label>
                    <textarea 
                      value={testForm.customer_message} 
                      onChange={e => setTestForm({...testForm, customer_message: e.target.value})} 
                      placeholder="Where is my order?" 
                      rows={4} 
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all resize-y" 
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={testLoading} 
                    className={`w-full py-3 mt-2 rounded-xl font-semibold text-white shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all duration-300 ${testLoading ? 'bg-slate-700 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] transform hover:-translate-y-0.5'}`}
                  >
                    {testLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Processing
                      </span>
                    ) : 'Run Simulation'}
                  </button>
                </form>

                {testResult && (
                  <div className={`mt-6 p-5 rounded-xl border backdrop-blur-md transition-all duration-500 ${
                    (testResult.resolution === 'auto_resolved' || testResult.resolution === 'resolved') ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]' :
                    testResult.resolution === 'escalated' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]' :
                    testResult.resolution === 'fraud_flagged' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.1)]' :
                    testResult.action === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.1)]' :
                    'bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                  }`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xl">
                        {(testResult.resolution === 'auto_resolved' || testResult.resolution === 'resolved') ? '✅' : testResult.resolution === 'escalated' ? '⚠️' : testResult.resolution === 'fraud_flagged' ? '🚫' : testResult.action === 'error' ? '❌' : '⚠️'}
                      </span>
                      <h3 className="font-semibold text-white">
                        {(testResult.resolution === 'auto_resolved' || testResult.resolution === 'resolved') ? 'Auto Resolved' : testResult.resolution === 'escalated' ? 'Escalated to Human' : testResult.resolution === 'fraud_flagged' ? 'Fraud Detected' : testResult.action === 'error' ? 'Execution Error' : 'Escalated to Human'}
                      </h3>
                    </div>
                    {(testResult.response || testResult.message) && (
                      <div className="bg-[#0f0f1a]/50 p-3 rounded-lg mb-3 border border-white/5">
                        <p className="text-sm text-slate-300">{testResult.response ?? testResult.message}</p>
                      </div>
                    )}
                    {testResult.reason && (
                      <p className="text-sm flex items-center gap-2">
                        <span className="opacity-70">{testResult.action === 'error' ? 'Error Details:' : 'Reason for escalation:'}</span> 
                        <span className="font-medium">{testResult.reason}</span>
                      </p>
                    )}
                    {testResult.confidence !== undefined && testResult.confidence !== null && (
                      <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                        <span className="text-sm opacity-70">AI Confidence</span>
                        <span className="text-sm font-bold bg-white/10 px-2 py-0.5 rounded text-white">{((testResult.confidence || 0) * 100).toFixed(1)}%</span>
                      </div>
                    )}

                    {(testResult.resolution === 'auto_resolved' || testResult.resolution === 'resolved') && testResult.ticket_id && (
                      <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                        <p className="text-sm font-semibold text-white">Was this helpful?</p>
                        {!csatSubmitted ? (
                          <div className="space-y-3">
                            <div className="flex gap-4">
                              <button
                                type="button"
                                onClick={() => handleCsatSubmit(1)}
                                disabled={csatSubmitting}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-medium shadow-[0_2px_10px_rgba(16,185,129,0.05)]"
                              >
                                👍 Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCsatSubmit(-1)}
                                disabled={csatSubmitting}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-medium shadow-[0_2px_10px_rgba(244,63,94,0.05)]"
                              >
                                👎 No
                              </button>
                            </div>
                            <textarea
                              value={csatFeedback}
                              onChange={e => setCsatFeedback(e.target.value)}
                              placeholder="Tell us more..."
                              rows={2}
                              disabled={csatSubmitting}
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 text-sm resize-none"
                            />
                          </div>
                        ) : (
                          <p className="text-sm text-emerald-400 font-medium animate-pulse flex items-center gap-1.5">
                            <span>🎉</span> Thank you for your feedback!
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {page === 'escalations' && (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-white">Escalation Queue</h2>
                  <p className="text-sm text-slate-400">Review pending customer escalations and resolve them quickly.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
                  Count <span className="inline-flex items-center justify-center rounded-full bg-indigo-500/20 px-3 py-1 text-indigo-200">{queueCount}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {['All', 'Pending', 'Resolved', 'Fraud Flags'].map(tab => (
                  <button key={tab} onClick={() => setQueueFilter(tab as any)} className={`w-full rounded-2xl px-4 py-3 text-sm font-medium transition ${queueFilter === tab ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-[0_8px_32px_rgba(99,102,241,0.35)]' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>
                    {tab}
                  </button>
                ))}
              </div>

              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                <div className="overflow-x-auto">
                  {queueLoading ? (
                    <div className="p-12 text-center text-slate-400">Refreshing escalation queue…</div>
                  ) : filteredEscalations.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                      <span className="text-4xl block mb-4 opacity-50">🛎️</span>
                      <p>No escalations match this filter.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500 font-semibold bg-white/[0.02]">
                          <th className="p-4 pl-6">Customer Email</th>
                          <th className="p-4">Reason</th>
                          <th className="p-4">Priority</th>
                          <th className="p-4">Time</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 pr-6">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredEscalations.map(item => (
                          <tr key={item.id} className={`transition-colors duration-200 ${item.fraud_flag ? 'bg-rose-500/5' : 'hover:bg-white/[0.04]'}`}>
                            <td className="p-4 pl-6 text-sm text-slate-300">{item.customer_email}</td>
                            <td className="p-4 text-sm text-slate-300 max-w-xs break-words">{item.reason}</td>
                            <td className="p-4">
                              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${item.priority === 'high' ? 'bg-orange-500/10 text-orange-300 border border-orange-500/20' : item.priority === 'medium' ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' : 'bg-slate-500/10 text-slate-300 border border-slate-500/20'}`}>{item.priority?.toUpperCase()}</span>
                            </td>
                            <td className="p-4 text-sm text-slate-400">{new Date(item.created_at).toLocaleString()}</td>
                            <td className="p-4">{item.status === 'resolved' ? <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">Resolved</span> : <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">Pending</span>}</td>
                            <td className="p-4 pr-6">
                              <button onClick={() => resolveEscalation(item.id)} disabled={item.status !== 'pending'} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${item.status !== 'pending' ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-400 hover:to-violet-400'}`}>
                                {item.status === 'resolved' ? 'Resolved' : 'Mark Resolved'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {page === 'settings' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                  <h3 className="text-lg font-semibold text-white mb-4">Store Info</h3>
                  <div className="space-y-4 text-sm text-slate-300">
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                      <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Shop Domain</p>
                      <p className="font-medium text-white">{shopDomain}</p>
                    </div>
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex items-center justify-between">
                      <div>
                        <p className="text-slate-400 text-xs uppercase tracking-wide">Connected Status</p>
                        <p className="font-medium text-white">Active</p>
                      </div>
                      <span className="inline-flex items-center gap-2 text-emerald-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Connected
                      </span>
                    </div>
                  </div>
                </div>
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                  <h3 className="text-lg font-semibold text-white mb-4">Notification Settings</h3>
                  <div className="space-y-4">
                    <label className="flex items-center justify-between gap-4 rounded-2xl bg-white/5 border border-white/10 px-4 py-4">
                      <span className="text-sm text-slate-300">Email notifications</span>
                      <input type="checkbox" checked={settings.email_notifications} onChange={e => setSettings({...settings, email_notifications: e.target.checked})} className="scale-110 accent-indigo-500" />
                    </label>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wide text-slate-400">Notification email address</label>
                      <input type="email" value={settings.notification_email} onChange={e => setSettings({...settings, notification_email: e.target.value})} placeholder="alerts@merchant.com" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent" />
                    </div>
                    <button onClick={saveSettings} disabled={settingsSaving} className={`w-full py-3 rounded-2xl font-semibold text-white ${settingsSaving ? 'bg-slate-700 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400'}`}>
                      {settingsSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                    {settingsMessage && <p className="text-sm text-emerald-300">{settingsMessage}</p>}
                    {settingsError && <p className="text-sm text-rose-400">{settingsError}</p>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                  <h3 className="text-lg font-semibold text-white mb-4">AI Configuration</h3>
                  <div className="space-y-4 text-sm text-slate-300">
                    {[
                      { label: 'Auto resolve tickets', key: 'auto_resolve' },
                      { label: 'Escalate angry customers', key: 'escalate_angry' },
                      { label: 'Fraud detection', key: 'fraud_detection' },
                      { label: 'VIP customer detection', key: 'vip_detection' }
                    ].map(item => (
                      <label key={item.key} className="flex items-center justify-between gap-4 rounded-2xl bg-white/5 border border-white/10 px-4 py-4">
                        <span>{item.label}</span>
                        <input type="checkbox" checked={settings[item.key as keyof Settings] as boolean} onChange={e => setSettings({...settings, [item.key]: e.target.checked})} className="scale-110 accent-indigo-500" />
                      </label>
                    ))}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        { label: 'Escalation threshold %', key: 'escalation_threshold' },
                        { label: 'Fraud refund limit', key: 'fraud_refund_limit' },
                        { label: 'Auto resolve confidence %', key: 'min_confidence' }
                      ].map(item => (
                        <div key={item.key} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                          <label className="block text-xs uppercase tracking-wide text-slate-400 mb-2">{item.label}</label>
                          <input type="number" min={0} max={100} value={settings[item.key as keyof Settings] as number} onChange={e => setSettings({...settings, [item.key]: Number(e.target.value)})} className="w-full px-3 py-2 bg-[#0f172a] border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                  <div className="flex items-center justify-between mb-4 gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Knowledge Base / FAQs</h3>
                      <p className="text-sm text-slate-400">Add merchant store policies and FAQ entries to prevent AI hallucinations.</p>
                    </div>
                    <span className="text-sm text-slate-400">{knowledgeEntries.length} entries</span>
                  </div>

                  <form onSubmit={handleAddKnowledgeEntry} className="space-y-4">
                    <div>
                      <label className="text-xs uppercase tracking-wide text-slate-400 mb-2 block">Category</label>
                      <select value={kbCategory} onChange={e => setKbCategory(e.target.value)} className="w-full px-4 py-3 bg-[#0f172a] border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                        {['General', 'Refund Policy', 'Shipping', 'Products', 'Payment', 'Exchange', 'Other'].map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wide text-slate-400 mb-2 block">Question</label>
                      <input value={kbQuestion} onChange={e => setKbQuestion(e.target.value)} placeholder="Enter FAQ question" className="w-full px-4 py-3 bg-[#0f172a] border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wide text-slate-400 mb-2 block">Answer</label>
                      <textarea value={kbAnswer} onChange={e => setKbAnswer(e.target.value)} rows={4} placeholder="Enter FAQ answer" className="w-full px-4 py-3 bg-[#0f172a] border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-y" />
                    </div>
                    <button type="submit" disabled={kbLoading} className={`w-full py-3 rounded-2xl font-semibold text-white ${kbLoading ? 'bg-slate-700 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400'}`}>
                      {kbLoading ? 'Saving...' : 'Add Entry'}
                    </button>
                    {(kbMessage || kbError) && (
                      <p className={`text-sm ${kbMessage ? 'text-emerald-300' : 'text-rose-400'}`}>{kbMessage || kbError}</p>
                    )}
                  </form>
                </div>

                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                  <div className="flex items-center justify-between mb-4 gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Entry Library</h3>
                      <p className="text-sm text-slate-400">Active knowledge base entries for this store.</p>
                    </div>
                    <button type="button" onClick={fetchKnowledgeBase} className="text-sm text-indigo-300 hover:text-white">Refresh</button>
                  </div>

                  {kbLoading ? (
                    <div className="p-6 text-slate-400">Loading entries...</div>
                  ) : knowledgeEntries.length === 0 ? (
                    <div className="p-6 rounded-3xl bg-white/5 border border-white/10 text-slate-400 text-sm">
                      No knowledge base entries yet. Add your store policies and FAQs to prevent AI hallucinations.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {knowledgeEntries.map(entry => (
                        <div key={entry.id} className="rounded-3xl bg-white/5 border border-white/10 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <span className="inline-flex items-center rounded-full bg-indigo-500/10 text-indigo-200 px-3 py-1 text-xs font-semibold">{entry.category || 'General'}</span>
                            <button onClick={() => handleDeleteKnowledgeEntry(entry.id)} className="rounded-full bg-rose-500/10 text-rose-300 px-3 py-1 text-xs font-semibold hover:bg-rose-500/20">Delete</button>
                          </div>
                          <div className="mt-3 text-sm text-slate-300">
                            <p className="font-semibold text-white">{entry.question}</p>
                            <p className="mt-2 text-slate-400">{entry.answer.length > 120 ? `${entry.answer.slice(0, 120)}...` : entry.answer}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-6 pt-6 border-t border-white/10">
                    <h4 className="text-sm font-semibold text-white mb-3">Bulk Import FAQs</h4>
                    <textarea value={kbBulkText} onChange={e => setKbBulkText(e.target.value)} rows={8} placeholder={`Q: question here\nA: answer here\n---\nQ: next question\nA: next answer`} className="w-full px-4 py-3 bg-[#0f172a] border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-y" />
                    <button type="button" onClick={handleImportFaqs} disabled={kbLoading} className={`mt-4 w-full py-3 rounded-2xl font-semibold text-white ${kbLoading ? 'bg-slate-700 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400'}`}>
                      {kbLoading ? 'Importing...' : 'Import FAQs'}
                    </button>
                    <p className="mt-3 text-xs text-slate-500">Paste FAQs using Q: and A: lines separated by ---. </p>
                  </div>
                </div>
              </div>

              {/* CANNED RESPONSES SYSTEM */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-8">
                {/* Column 1: Add new response form */}
                <div className="xl:col-span-1 backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)] text-left">
                  <h3 className="text-lg font-semibold text-white mb-2">Add Canned Response</h3>
                  <p className="text-sm text-slate-400 mb-6">Create predefined answers for automated support.</p>
                  
                  <form onSubmit={handleAddCannedResponse} className="space-y-4">
                    <div>
                      <label className="text-xs uppercase tracking-wide text-slate-400 mb-2 block">Title</label>
                      <input 
                        value={cannedTitle} 
                        onChange={e => setCannedTitle(e.target.value)} 
                        placeholder="e.g. Refund Policy Explanation" 
                        className="w-full px-4 py-3 bg-[#0f172a] border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50" 
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wide text-slate-400 mb-2 block">Intent</label>
                      <select 
                        value={cannedIntent} 
                        onChange={e => setCannedIntent(e.target.value)} 
                        className="w-full px-4 py-3 bg-[#0f172a] border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      >
                        {['order_status', 'refund_request', 'angry_customer', 'shipping_status', 'general_inquiry', 'cancel_order', 'other'].map(intent => (
                           <option key={intent} value={intent}>{intent}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wide text-slate-400 mb-2 block">Message</label>
                      <textarea 
                        value={cannedMessage} 
                        onChange={e => setCannedMessage(e.target.value)} 
                        rows={5} 
                        placeholder="Type response message here... You can use {order_id}, {status}, and {eta} placeholders." 
                        className="w-full px-4 py-3 bg-[#0f172a] border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-y" 
                      />
                    </div>
                    <button 
                      type="submit" 
                      className="w-full py-3 rounded-2xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 shadow-[0_4px_15px_rgba(99,102,241,0.2)] transition-all"
                    >
                      Add Response
                    </button>
                    {cannedSuccess && <p className="text-sm text-emerald-300 mt-2">{cannedSuccess}</p>}
                    {cannedError && <p className="text-sm text-rose-400 mt-2">{cannedError}</p>}
                  </form>
                </div>

                {/* Column 2: Canned responses library/table */}
                <div className="xl:col-span-2 backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col text-left">
                  <h3 className="text-lg font-semibold text-white mb-2">Canned Responses Library</h3>
                  <p className="text-sm text-slate-400 mb-6">List of custom automated answers used under AI failure or low confidence states.</p>
                  
                  {cannedLoading ? (
                    <p className="text-slate-400 text-sm">Loading canned responses...</p>
                  ) : cannedResponses.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 rounded-2xl border border-white/5 bg-white/[0.01] text-center">
                      <span className="text-4xl block mb-4 opacity-50">💬</span>
                      <p className="text-slate-300 font-medium mb-1">No canned responses yet.</p>
                      <p className="text-slate-500 text-sm">Add your first custom reply to improve response quality.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-white/10">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500 font-semibold bg-white/[0.02]">
                            <th className="p-4 pl-6">Title</th>
                            <th className="p-4">Intent</th>
                            <th className="p-4">Message Preview</th>
                            <th className="p-4 text-center">Usage</th>
                            <th className="p-4 text-center">Status</th>
                            <th className="p-4 pr-6 text-right font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {cannedResponses.map(item => {
                            const getIntentBadge = (intentStr: string) => {
                              let colorClasses = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
                              if (intentStr === 'order_status') colorClasses = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                              else if (intentStr === 'refund_request') colorClasses = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                              else if (intentStr === 'angry_customer') colorClasses = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                              else if (intentStr === 'general_inquiry') colorClasses = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                              return (
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClasses}`}>
                                  {intentStr || 'other'}
                                </span>
                              );
                            };
                            
                            return (
                              <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                                <td className="p-4 pl-6 font-medium text-slate-200">{item.title}</td>
                                <td className="p-4">{getIntentBadge(item.intent)}</td>
                                <td className="p-4 text-sm text-slate-400 max-w-xs truncate">{item.message}</td>
                                <td className="p-4 text-center text-sm font-semibold text-indigo-400">{item.usage_count}</td>
                                <td className="p-4 text-center">
                                  <button 
                                    onClick={() => handleToggleCannedResponse(item.id, item.is_active, item)}
                                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${item.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'}`}
                                  >
                                    {item.is_active ? 'Active' : 'Inactive'}
                                  </button>
                                </td>
                                <td className="p-4 pr-6 text-right space-x-2">
                                  <button 
                                    onClick={() => {
                                      setEditCannedForm(item);
                                      setShowEditModal(true);
                                    }}
                                    className="text-xs font-semibold text-indigo-300 hover:text-white px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10"
                                  >
                                    Edit
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteCannedResponse(item.id)}
                                    className="text-xs font-semibold text-rose-300 hover:text-rose-200 px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 rounded-lg hover:bg-rose-500/20"
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 bg-[#0f0f1a] border border-white/10 rounded-3xl shadow-[0_15px_50px_rgba(0,0,0,0.5)] relative text-left">
            <h3 className="text-xl font-semibold text-white mb-2">Edit Canned Response</h3>
            <p className="text-sm text-slate-400 mb-6">Modify predefined auto response and triggers.</p>
            
            <form onSubmit={handleUpdateCannedResponse} className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wide text-slate-400 mb-2 block">Title</label>
                <input 
                  value={editCannedForm.title} 
                  onChange={e => setEditCannedForm({...editCannedForm, title: e.target.value})} 
                  placeholder="Title" 
                  className="w-full px-4 py-3 bg-[#0f172a] border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50" 
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-slate-400 mb-2 block">Intent</label>
                <select 
                  value={editCannedForm.intent} 
                  onChange={e => setEditCannedForm({...editCannedForm, intent: e.target.value})} 
                  className="w-full px-4 py-3 bg-[#0f172a] border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  {['order_status', 'refund_request', 'angry_customer', 'shipping_status', 'general_inquiry', 'cancel_order', 'other'].map(intent => (
                    <option key={intent} value={intent}>{intent}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-slate-400 mb-2 block">Message</label>
                <textarea 
                  value={editCannedForm.message} 
                  onChange={e => setEditCannedForm({...editCannedForm, message: e.target.value})} 
                  rows={5} 
                  placeholder="Message message..." 
                  className="w-full px-4 py-3 bg-[#0f172a] border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-y" 
                />
              </div>
              <div className="flex items-center gap-4 justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={editCannedForm.is_active} 
                    onChange={e => setEditCannedForm({...editCannedForm, is_active: e.target.checked})} 
                    className="scale-110 accent-indigo-500" 
                  />
                  <span className="text-sm text-slate-300">Active</span>
                </label>
                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => setShowEditModal(false)} 
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 transition"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 shadow-[0_2px_10px_rgba(99,102,241,0.2)] transition"
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
}

export default App;
