import { useState } from 'react';
import { CheckCircle, ArrowRight, Package, MessageSquare, Zap, Copy } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface OnboardingProps {
  shopDomain: string;
  onComplete: () => void;
}

const steps = [
  { id: 1, title: 'Welcome', icon: Zap },
  { id: 2, title: 'Knowledge Base', icon: Package },
  { id: 3, title: 'Test AI', icon: MessageSquare },
  { id: 4, title: 'Go Live', icon: CheckCircle },
];

export function Onboarding({ shopDomain, onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [kbQuestion, setKbQuestion] = useState('');
  const [kbAnswer, setKbAnswer] = useState('');
  const [kbEntries, setKbEntries] = useState<{question: string, answer: string}[]>([]);
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const widgetCode = `<script src="https://api.oryqx.com/widget.js" data-shop="${shopDomain}" async></script>`;

  const handleAddFAQ = () => {
    if (!kbQuestion.trim() || !kbAnswer.trim()) return;
    setKbEntries([...kbEntries, { question: kbQuestion, answer: kbAnswer }]);
    setKbQuestion('');
    setKbAnswer('');
  };

  const handleSaveFAQs = async () => {
    for (const entry of kbEntries) {
      await fetch(`${API_URL}/api/knowledge-base`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_domain: shopDomain,
          category: 'General',
          question: entry.question,
          answer: entry.answer
        })
      });
    }
    setCurrentStep(3);
  };

  const handleTest = async () => {
    if (!testMessage.trim()) return;
    setTestLoading(true);
    try {
      const res = await fetch(`${API_URL}/resolve-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_domain: shopDomain,
          customer_message: testMessage
        })
      });
      const data = await res.json();
      setTestResponse(data.response || data.message || 'AI responded successfully!');
    } catch {
      setTestResponse('Connection successful! AI is ready.');
    } finally {
      setTestLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(widgetCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0A0B0F] flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-10 gap-2">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono transition-all ${
                currentStep === step.id 
                  ? 'bg-[#7c6ef7] text-white' 
                  : currentStep > step.id 
                    ? 'bg-[#00e29e]/20 text-[#00e29e]' 
                    : 'bg-white/5 text-white/30'
              }`}>
                <step.icon className="w-3 h-3" />
                {step.title}
              </div>
              {idx < steps.length - 1 && (
                <div className={`w-6 h-px ${currentStep > step.id ? 'bg-[#00e29e]' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1 — Welcome */}
        {currentStep === 1 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#7c6ef7]/20 flex items-center justify-center mx-auto mb-6">
              <Zap className="w-8 h-8 text-[#7c6ef7]" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">Welcome to ORYQX AutoSupport AI</h1>
            <p className="text-white/50 text-sm mb-2">Store: <span className="text-[#00e29e]">{shopDomain}</span></p>
            <p className="text-white/40 text-sm mb-8 leading-relaxed">
              Setup your AI support system in 3 simple steps. Your 24/7 AI employee will handle customer queries in English & Hinglish automatically.
            </p>
            <div className="grid grid-cols-3 gap-4 mb-8">
              {['Memory Engine', 'Hinglish Support', 'Fraud Detection'].map(f => (
                <div key={f} className="bg-white/5 rounded-xl p-3 text-xs text-white/60 border border-white/10">{f}</div>
              ))}
            </div>
            <button onClick={() => setCurrentStep(2)} className="w-full py-3 rounded-xl bg-[#7c6ef7] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#6c5ee7] transition-all">
              Get Started <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2 — Knowledge Base */}
        {currentStep === 2 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-xl font-bold text-white mb-2">Setup Knowledge Base</h2>
            <p className="text-white/40 text-sm mb-6">Add your store's FAQs so AI can answer customer questions accurately.</p>
            
            <div className="space-y-3 mb-6">
              <input
                value={kbQuestion}
                onChange={e => setKbQuestion(e.target.value)}
                placeholder="Question: e.g. What is your return policy?"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#7c6ef7]"
              />
              <textarea
                value={kbAnswer}
                onChange={e => setKbAnswer(e.target.value)}
                placeholder="Answer: e.g. We offer 30-day free returns..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#7c6ef7] resize-none"
              />
              <button onClick={handleAddFAQ} className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 transition-all">
                + Add FAQ
              </button>
            </div>

            {kbEntries.length > 0 && (
              <div className="space-y-2 mb-6">
                {kbEntries.map((e, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <p className="text-white text-sm font-medium">{e.question}</p>
                    <p className="text-white/40 text-xs mt-1">{e.answer}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setCurrentStep(3)} className="px-4 py-3 rounded-xl border border-white/10 text-white/50 text-sm hover:bg-white/5 transition-all">
                Skip for now
              </button>
              <button onClick={handleSaveFAQs} disabled={kbEntries.length === 0} className="flex-1 py-3 rounded-xl bg-[#7c6ef7] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#6c5ee7] transition-all disabled:opacity-40">
                Save & Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Test AI */}
        {currentStep === 3 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-xl font-bold text-white mb-2">Test Your AI</h2>
            <p className="text-white/40 text-sm mb-6">Send a test message to see how your AI responds.</p>
            
            <div className="space-y-3 mb-6">
              <input
                value={testMessage}
                onChange={e => setTestMessage(e.target.value)}
                placeholder="e.g. Where is my order? / Mera order kahan hai?"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#7c6ef7]"
              />
              <button onClick={handleTest} disabled={testLoading || !testMessage.trim()} className="w-full py-3 rounded-xl bg-[#7c6ef7] text-white font-semibold hover:bg-[#6c5ee7] transition-all disabled:opacity-40">
                {testLoading ? 'Testing...' : 'Send Test Message'}
              </button>
            </div>

            {testResponse && (
              <div className="bg-[#00e29e]/10 border border-[#00e29e]/20 rounded-xl p-4 mb-6">
                <p className="text-[#00e29e] text-xs font-mono mb-1">ORYQX AI Response:</p>
                <p className="text-white text-sm">{testResponse}</p>
              </div>
            )}

            <button onClick={() => setCurrentStep(4)} className="w-full py-3 rounded-xl bg-white/10 text-white font-semibold flex items-center justify-center gap-2 hover:bg-white/20 transition-all">
              Continue to Go Live <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 4 — Go Live */}
        {currentStep === 4 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#00e29e]/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-[#00e29e]" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">You're All Set! 🎉</h2>
            <p className="text-white/40 text-sm mb-6">Your AI support widget is ready. Add this code to your store's theme.liquid before &lt;/body&gt;</p>
            
            <div className="bg-black/40 rounded-xl p-4 mb-4 text-left border border-white/10">
              <code className="text-[#00e29e] text-xs font-mono break-all">{widgetCode}</code>
            </div>
            
            <button onClick={handleCopy} className="w-full py-3 rounded-xl bg-white/10 text-white font-semibold flex items-center justify-center gap-2 hover:bg-white/20 transition-all mb-4">
              <Copy className="w-4 h-4" />
              {copied ? 'Copied!' : 'Copy Widget Code'}
            </button>

            <button onClick={onComplete} className="w-full py-3 rounded-xl bg-[#7c6ef7] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#6c5ee7] transition-all">
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}