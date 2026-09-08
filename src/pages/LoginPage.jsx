import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Sparkles, Lock, Mail, Eye, EyeOff, AlertCircle, ShoppingBag } from 'lucide-react';

export default function LoginPage({ onOpenCatalog }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err) {
      const msgs = {
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
        'auth/invalid-credential': 'Invalid email or password.',
      };
      setError(msgs[err.code] || 'Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pointer-events-none" />
      <div className="fixed top-0 right-0 w-96 h-96 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-block relative mb-3">
            <img
              src="/jam-logo-blush.jpg"
              alt="JAM Beauty Store"
              className="w-24 h-24 rounded-full object-cover shadow-2xl border-2 border-[#efaa9b]/60 mx-auto"
            />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-wide">JAM BEAUTY STORE</h1>
          <p className="text-[#efaa9b] text-xs font-semibold uppercase tracking-widest mt-1">
            Point of Sale & Enterprise Management
          </p>
        </div>

        {/* Login card */}
        <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-5">Sign In</h2>

          {error && (
            <div className="flex items-start gap-2 bg-red-900/30 border border-red-700/50 rounded-lg p-3 mb-4">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-10 pr-10 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 transition-colors"
                />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-all shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Public customer catalog quick jump */}
          <div className="mt-4 pt-4 border-t border-slate-700/60 text-center">
            <button
              type="button"
              onClick={onOpenCatalog}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/70 text-[#efaa9b] hover:text-white rounded-xl text-xs font-bold transition-colors"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>🛍️ Browse Store Catalog (Public View)</span>
            </button>
          </div>

          <p className="text-center text-xs text-slate-500 mt-3">
            Contact your store manager for staff account access.
          </p>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          JAM Beauty Store &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
