import { useState } from 'react';
import { Check, Zap, Star, Crown } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface PricingProps {
  shopDomain: string;
  currentPlan?: string;
}

export function Pricing({ shopDomain, currentPlan = 'free' }: PricingProps) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);

  const plans = [
    {
      id: 'free',
      name: 'Free',
      icon: Zap,
      monthly_price: 0,
      annual_price: 0,
      tickets_limit: 50,
      color: '#8B8FA8',
      features: ['50 tickets/month', 'Basic AI', 'Chat Widget', 'Email Support'],
      cta: 'Current Plan'
    },
    {
      id: 'starter',
      name: 'Starter',
      icon: Star,
      monthly_price: 99,
      annual_price: 990,
      tickets_limit: 1500,
      color: '#7c6ef7',
      popular: false,
      features: ['1,500 tickets/month', 'AI Memory Engine', 'Hinglish Support', 'Analytics Dashboard', 'Email Support'],
      cta: 'Upgrade to Starter'
    },
    {
      id: 'growth',
      name: 'Growth',
      icon: Star,
      monthly_price: 199,
      annual_price: 1990,
      tickets_limit: 3500,
      color: '#00e29e',
      popular: true,
      features: ['3,500 tickets/month', 'Everything in Starter', 'Fraud Detection', 'VIP Customer Detection', 'Priority Support'],
      cta: 'Upgrade to Growth'
    },
    {
      id: 'pro',
      name: 'Pro',
      icon: Crown,
      monthly_price: 349,
      annual_price: 3490,
      tickets_limit: -1,
      color: '#f7c26e',
      popular: false,
      features: ['Unlimited tickets', 'Everything in Growth', 'White-label Widget', 'SLA Guarantee', 'Dedicated Support'],
      cta: 'Upgrade to Pro'
    }
  ];

  const handleUpgrade = async (planId: string) => {
    if (planId === 'free' || planId === currentPlan) return;
    setLoading(planId);
    try {
      const res = await fetch(`${API_URL}/api/billing/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planId,
          billing_cycle: billing,
          shop_domain: shopDomain
        })
      });
      const data = await res.json();
      if (data.confirmation_url) {
        window.top!.location.href = data.confirmation_url;
      }
    } catch (err) {
      console.error('Billing error:', err);
    } finally {
      setLoading(null);
    }
  };

  const getPrice = (plan: typeof plans[0]) => {
    if (plan.monthly_price === 0) return 'Free';
    const price = billing === 'annual' ? plan.annual_price / 12 : plan.monthly_price;
    return `$${Math.round(price)}`;
  };

  const getSavings = (plan: typeof plans[0]) => {
    if (plan.monthly_price === 0) return null;
    const savings = (plan.monthly_price * 12) - plan.annual_price;
    return savings;
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-white mb-3">Simple, Transparent Pricing</h1>
        <p className="text-white/50 text-sm mb-6">No hidden fees. Cancel anytime.</p>

        {/* Billing Toggle */}
        <div className="inline-flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-1">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${billing === 'monthly' ? 'bg-[#7c6ef7] text-white' : 'text-white/50 hover:text-white'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${billing === 'annual' ? 'bg-[#7c6ef7] text-white' : 'text-white/50 hover:text-white'}`}
          >
            Annual
            <span className="ml-2 text-xs bg-[#00e29e]/20 text-[#00e29e] px-2 py-0.5 rounded-full">Save 2 months</span>
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-4 gap-4">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isCurrentPlan = currentPlan === plan.id;
          const savings = getSavings(plan);

          return (
            <div
              key={plan.id}
              className={`relative bg-white/5 border rounded-2xl p-6 flex flex-col transition-all ${
                plan.popular
                  ? 'border-[#00e29e] shadow-[0_0_30px_rgba(0,226,158,0.15)]'
                  : isCurrentPlan
                    ? 'border-[#7c6ef7]'
                    : 'border-white/10 hover:border-white/20'
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#00e29e] text-black text-xs font-bold px-3 py-1 rounded-full">
                  MOST POPULAR
                </div>
              )}

              {/* Plan Header */}
              <div className="mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${plan.color}20` }}>
                  <Icon size={20} style={{ color: plan.color }} />
                </div>
                <h3 className="text-white font-bold text-lg">{plan.name}</h3>
                <p className="text-white/40 text-xs mt-1">
                  {plan.tickets_limit === -1 ? 'Unlimited tickets' : `${plan.tickets_limit.toLocaleString()} tickets/month`}
                </p>
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-bold text-white">{getPrice(plan)}</span>
                  {plan.monthly_price > 0 && (
                    <span className="text-white/40 text-sm mb-1">/mo</span>
                  )}
                </div>
                {billing === 'annual' && savings && (
                  <p className="text-[#00e29e] text-xs mt-1">Save ${savings}/year</p>
                )}
                {billing === 'annual' && plan.monthly_price > 0 && (
                  <p className="text-white/30 text-xs">Billed ${plan.annual_price}/year</p>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-white/60">
                    <Check size={14} className="text-[#00e29e] shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={isCurrentPlan || plan.id === 'free' || loading === plan.id}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isCurrentPlan
                    ? 'bg-white/10 text-white/50 cursor-default'
                    : plan.id === 'free'
                      ? 'bg-white/5 text-white/30 cursor-default'
                      : plan.popular
                        ? 'bg-[#00e29e] text-black hover:bg-[#00e29e]/90'
                        : 'bg-[#7c6ef7] text-white hover:bg-[#6c5ee7]'
                }`}
              >
                {loading === plan.id ? 'Processing...' : isCurrentPlan ? '✓ Current Plan' : plan.cta}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-center mt-8 text-white/30 text-xs">
        All plans include 14-day free trial • No credit card required • Cancel anytime
      </div>
    </div>
  );
}