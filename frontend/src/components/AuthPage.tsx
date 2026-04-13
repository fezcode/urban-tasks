import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, UserPlus, AlertCircle } from 'lucide-react';

const AuthPage: React.FC = () => {
  const { login, register, error, clearError } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, name, password);
      }
    } catch {
      // error is set via context
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    clearError();
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 4.5A2.5 2.5 0 0 1 4.5 2h3a2.5 2.5 0 0 1 0 5h-3A2.5 2.5 0 0 1 2 4.5Z"
                fill="white"
                fillOpacity="0.9"
              />
              <path
                d="M6 11.5A2.5 2.5 0 0 1 8.5 9h3a2.5 2.5 0 0 1 0 5h-3A2.5 2.5 0 0 1 6 11.5Z"
                fill="white"
                fillOpacity="0.5"
              />
            </svg>
          </div>
          <span className="text-xl font-semibold text-text-primary tracking-tight">
            Urban Tasks
          </span>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary mb-1">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="text-[13px] text-text-tertiary mb-6">
            {mode === 'login'
              ? 'Sign in to your account to continue'
              : 'Get started with Urban Tasks'}
          </p>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 mb-4 rounded-lg bg-danger-bg text-danger text-[13px]">
              <AlertCircle size={15} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-[14px] text-text-primary outline-none focus:border-accent transition-base"
                  placeholder="Your name"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-[14px] text-text-primary outline-none focus:border-accent transition-base"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-[14px] text-text-primary outline-none focus:border-accent transition-base"
                placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter password'}
                required
                minLength={mode === 'register' ? 8 : undefined}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-text-inverse rounded-lg text-[14px] font-medium hover:bg-accent-hover transition-base disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : mode === 'login' ? (
                <LogIn size={16} />
              ) : (
                <UserPlus size={16} />
              )}
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>

        {/* Switch mode */}
        <p className="text-center text-[13px] text-text-tertiary mt-5">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button onClick={switchMode} className="text-accent hover:underline font-medium">
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
