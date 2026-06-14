import React, { useState } from 'react';
import { Loader2, User, Mail, Phone, Lock } from 'lucide-react';

interface SignupProps {
  onSignupSuccess: (merchant: any) => void;
  onSwitchToLogin: () => void;
  apiUrl: string;
}

export const Signup: React.FC<SignupProps> = ({ onSignupSuccess, onSwitchToLogin, apiUrl }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validations
    if (!name.trim() || !email.trim() || !phone.trim() || !password || !confirmPassword) {
      setError('All fields are required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${apiUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Store credentials
      localStorage.setItem('merchant_token', data.token);
      localStorage.setItem('merchant_info', JSON.stringify(data.merchant));

      onSignupSuccess(data.merchant);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0B0F] relative overflow-hidden font-sans text-[var(--text)] px-4">
      {/* Floating Neon Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-[var(--primary)]/10 blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-[var(--secondary)]/10 blur-[130px] pointer-events-none"></div>
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-30 pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md p-8 backdrop-blur-xl bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.5)]">
        
        {/* Brand Header */}
        <div className="text-center mb-6 flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-[#0a0b0f] border border-[var(--border)] flex items-center justify-center p-1 shadow-[0_0_20px_var(--border-glow)] mb-4">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <defs>
                <linearGradient id="logoGradSignup" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#a2e7ff" />
                  <stop offset="100%" stopColor="#c4c0ff" />
                </linearGradient>
              </defs>
              <path d="M 35 40 A 15 15 0 0 1 65 40" fill="none" stroke="url(#logoGradSignup)" strokeWidth="5" strokeLinecap="round"/>
              <path d="M 28 38 L 72 38 L 76 78 C 76 81, 74 83, 71 83 L 29 83 C 26 83, 24 81, 24 78 Z" fill="none" stroke="url(#logoGradSignup)" strokeWidth="5" strokeLinejoin="round"/>
              <circle cx="43" cy="54" r="4" fill="url(#logoGradSignup)"/>
              <circle cx="57" cy="54" r="4" fill="url(#logoGradSignup)"/>
              <path d="M 44 64 Q 50 69 56 64" fill="none" stroke="url(#logoGradSignup)" strokeWidth="4.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold font-display text-white mb-1 tracking-tight">Create your ORYQX account</h1>
          <p className="text-[var(--text-muted)] text-xs">Register your support intelligence dashboard</p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-red-500/5 border border-red-500/15 rounded-xl text-[var(--danger)] text-xs text-center font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-[var(--text-muted)] font-mono uppercase tracking-wider mb-1.5 block">Full Name</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[var(--text-muted)] w-4 h-4" />
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full pl-11 pr-4 py-2.5 bg-[#0A0B0F] border border-[var(--border)] rounded-full text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] transition-all duration-300 font-sans"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-[var(--text-muted)] font-mono uppercase tracking-wider mb-1.5 block">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[var(--text-muted)] w-4 h-4" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="merchant@example.com"
                className="w-full pl-11 pr-4 py-2.5 bg-[#0A0B0F] border border-[var(--border)] rounded-full text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] transition-all duration-300 font-sans"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-[var(--text-muted)] font-mono uppercase tracking-wider mb-1.5 block">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[var(--text-muted)] w-4 h-4" />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+1 (555) 019-2834"
                className="w-full pl-11 pr-4 py-2.5 bg-[#0A0B0F] border border-[var(--border)] rounded-full text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] transition-all duration-300 font-sans"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-[var(--text-muted)] font-mono uppercase tracking-wider mb-1.5 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[var(--text-muted)] w-4 h-4" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-2.5 bg-[#0A0B0F] border border-[var(--border)] rounded-full text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] transition-all duration-300 font-sans"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-[var(--text-muted)] font-mono uppercase tracking-wider mb-1.5 block">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[var(--text-muted)] w-4 h-4" />
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-2.5 bg-[#0A0B0F] border border-[var(--border)] rounded-full text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] transition-all duration-300 font-sans"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 mt-4 rounded-lg font-semibold text-[#0A0B0F] bg-[var(--primary)] hover:bg-[var(--primary-container)] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(196,192,255,0.25)] transform active:scale-[0.98] ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#0A0B0F]" />
                Generating Account...
              </>
            ) : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs">
          <span className="text-[var(--text-muted)]">Already have an account? </span>
          <button 
            type="button"
            onClick={onSwitchToLogin} 
            className="text-[var(--primary)] font-semibold hover:underline bg-transparent border-none cursor-pointer"
          >
            Log in
          </button>
        </div>

      </div>
    </div>
  );
};

export default Signup;
