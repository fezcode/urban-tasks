import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react';
import Logo from './Logo';

const FEATURES: { tag: string; title: string; body: string }[] = [
  {
    tag: '01 — STRUCTURE',
    title: 'A quiet grid for loud days.',
    body: 'Projects, priorities, recurring work. Shape the week like a street plan — legible, ordered, yours.',
  },
  {
    tag: '02 — RHYTHM',
    title: 'Velocity you can feel.',
    body: 'A dashboard that reads like a pulse: streaks, burndown, the things pressing against today.',
  },
  {
    tag: '03 — CRAFT',
    title: 'Built for the long haul.',
    body: 'Keyboard-first, offline-ready, undo-everything. Designed to disappear, engineered to endure.',
  },
];

const AuthPage: React.FC = () => {
  const { login, register, error, clearError } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, name, password);
    } catch {
      /* context */
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    clearError();
  };

  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] bg-[#F5EFE6] text-[#1F1B17] font-sans">
      {/* LEFT — editorial hero panel */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden px-12 py-10 text-[#F5EFE6]">
        {/* Warm gradient base */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(120% 90% at 20% 10%, #E5835B 0%, #C96442 38%, #6B2E1E 78%, #1F1B17 100%)',
          }}
        />
        {/* Fine grain overlay */}
        <div
          className="absolute inset-0 -z-10 opacity-[0.22] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />
        {/* Faint architectural grid */}
        <div
          className="absolute inset-0 -z-10 opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(245,239,230,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(245,239,230,0.6) 1px, transparent 1px)',
            backgroundSize: '88px 88px',
            maskImage: 'radial-gradient(ellipse at 70% 40%, black 40%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse at 70% 40%, black 40%, transparent 80%)',
          }}
        />

        {/* Top band */}
        <header className="relative z-10 flex items-center justify-between animate-slide-down">
          <div className="flex items-center gap-3">
            <Logo size={40} glow />
            <div className="leading-tight">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[#F5EFE6]/70">
                Urban
              </div>
              <div className="font-display font-semibold text-[20px] tracking-tight">
                Tasks<span className="text-[#F5EFE6]/50">.</span>
              </div>
            </div>
          </div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-[#F5EFE6]/60">
            Est. MMXXVI
          </div>
        </header>

        {/* Hero copy */}
        <div className="relative z-10 max-w-xl animate-slide-up">
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.3em] text-[#F5EFE6]/70 mb-6">
            <span className="h-px w-10 bg-[#F5EFE6]/60" />
            A personal workshop
          </div>
          <h1 className="font-display text-[58px] xl:text-[68px] leading-[0.96] tracking-[-0.02em] font-light">
            Build the week
            <br />
            <span className="italic font-normal text-[#F5EFE6]">
              before it builds
            </span>{' '}
            <span className="relative inline-block">
              you
              <span className="absolute -bottom-1 left-0 right-0 h-[3px] bg-[#F5EFE6]/70 rounded-full" />
            </span>
            .
          </h1>
          <p className="mt-6 text-[15px] leading-relaxed text-[#F5EFE6]/75 max-w-md">
            A task manager for people who take planning seriously — and themselves, only
            occasionally.
          </p>
        </div>

        {/* Feature strip */}
        <div className="relative z-10 grid grid-cols-3 gap-5 border-t border-[#F5EFE6]/15 pt-6">
          {FEATURES.map((f, i) => (
            <div
              key={f.tag}
              className="animate-slide-up"
              style={{ animationDelay: `${120 + i * 80}ms`, animationFillMode: 'backwards' }}
            >
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#F5EFE6]/55 mb-2">
                {f.tag}
              </div>
              <div className="font-display text-[16px] leading-snug text-[#F5EFE6]">
                {f.title}
              </div>
              <div className="text-[12px] leading-relaxed text-[#F5EFE6]/60 mt-1.5">
                {f.body}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* RIGHT — form */}
      <main className="relative flex items-center justify-center px-5 sm:px-10 py-10 lg:py-14">
        {/* Mobile-only top band */}
        <div className="lg:hidden absolute inset-x-0 top-0 flex items-center gap-3 px-5 pt-6">
          <Logo size={32} />
          <div className="font-display font-semibold text-[18px] tracking-tight">
            Urban Tasks<span className="text-[#1F1B17]/40">.</span>
          </div>
        </div>

        <div className="w-full max-w-[420px] animate-slide-up">
          {/* Mode tabs */}
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="inline-flex p-1 rounded-full bg-[#E9DFCF] text-[12px] font-medium mb-10"
          >
            {(['login', 'register'] as const).map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    if (!active) switchMode();
                  }}
                  className={`px-4 py-1.5 rounded-full transition-all duration-200 ${
                    active
                      ? 'bg-[#1F1B17] text-[#F5EFE6] shadow-sm'
                      : 'text-[#1F1B17]/60 hover:text-[#1F1B17]'
                  }`}
                >
                  {m === 'login' ? 'Sign in' : 'New here'}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-[#1F1B17]/55 mb-4">
            <span className="h-px w-8 bg-[#1F1B17]/30" />
            {mode === 'login' ? 'Welcome back' : 'Create an account'}
          </div>
          <h2 className="font-display text-[40px] sm:text-[46px] leading-[1.02] tracking-[-0.02em] font-light">
            {mode === 'login' ? (
              <>
                Pick up
                <br />
                <span className="italic">where you left off.</span>
              </>
            ) : (
              <>
                Begin with
                <br />
                <span className="italic">a blank street.</span>
              </>
            )}
          </h2>

          {error && (
            <div
              className="mt-6 flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-[#C96442]/10 border border-[#C96442]/30 text-[#8F3A24] text-[13px]"
              role="alert"
            >
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {mode === 'register' && (
              <Field
                label="Name"
                type="text"
                value={name}
                onChange={setName}
                placeholder="What should we call you?"
                required
              />
            )}
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@somewhere.co"
              required
              autoComplete="email"
            />
            <Field
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={setPassword}
              placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
              required
              minLength={mode === 'register' ? 8 : undefined}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              suffix={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-[#1F1B17]/45 hover:text-[#1F1B17] transition-colors p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />

            <button
              type="submit"
              disabled={loading}
              className="group mt-2 w-full flex items-center justify-between gap-3 px-5 py-3.5 rounded-full bg-[#1F1B17] text-[#F5EFE6] text-[14px] font-medium hover:bg-[#C96442] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.985] shadow-[0_10px_24px_-12px_rgba(31,27,23,0.5)]"
            >
              <span className="flex items-center gap-2">
                {loading && (
                  <span className="w-4 h-4 border-2 border-[#F5EFE6]/30 border-t-[#F5EFE6] rounded-full animate-spin" />
                )}
                {mode === 'login' ? 'Sign in' : 'Create account'}
              </span>
              <ArrowRight
                size={16}
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </button>
          </form>

          <p className="mt-8 text-[13px] text-[#1F1B17]/60">
            {mode === 'login' ? "Don't have an account yet? " : 'Already have one? '}
            <button
              onClick={switchMode}
              className="text-[#1F1B17] font-medium underline decoration-[#C96442] decoration-2 underline-offset-4 hover:decoration-[#1F1B17] transition-colors"
            >
              {mode === 'login' ? 'Start here' : 'Sign in'}
            </button>
          </p>

          <footer className="mt-14 flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-[#1F1B17]/40">
            <span>© Urban Tasks</span>
            <span>Made with care</span>
          </footer>
        </div>
      </main>
    </div>
  );
};

interface FieldProps {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  suffix?: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
  minLength,
  autoComplete,
  suffix,
}) => {
  const [focused, setFocused] = useState(false);
  return (
    <label className="block group">
      <span className="block text-[11px] uppercase tracking-[0.22em] text-[#1F1B17]/55 mb-2">
        {label}
      </span>
      <div
        className={`relative flex items-center border-b transition-colors duration-200 ${
          focused ? 'border-[#C96442]' : 'border-[#1F1B17]/20 group-hover:border-[#1F1B17]/40'
        }`}
      >
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1 bg-transparent py-2.5 text-[15px] text-[#1F1B17] placeholder:text-[#1F1B17]/30 outline-none"
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
        />
        {suffix}
      </div>
    </label>
  );
};

export default AuthPage;
