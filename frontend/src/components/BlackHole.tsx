import React, { useState } from 'react';
import { format, differenceInDays } from 'date-fns';

interface Props {
  startDate: string;
  dueDate: string;
}

const STAR_POSITIONS = Array.from({ length: 80 }, (_, i) => {
  const r1 = Math.sin(i * 12.9898) * 43758.5453;
  const r2 = Math.sin(i * 78.233) * 43758.5453;
  const r3 = Math.sin(i * 37.719) * 43758.5453;
  return {
    top: (r1 - Math.floor(r1)) * 100,
    left: (r2 - Math.floor(r2)) * 100,
    size: 1 + Math.abs(r3 - Math.floor(r3)) * 1.8,
  };
});

/**
 * Easter egg: when a task's due date precedes its start date, reality breaks.
 * Full-pane black hole with accretion disk, lensing rings, starfield, and the
 * whispered title "TIME TRAVELLER". Click anywhere to dismiss for this view.
 */
const BlackHole: React.FC<Props> = ({ startDate, dueDate }) => {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const days = Math.abs(differenceInDays(new Date(dueDate), new Date(startDate)));

  return (
    <div
      className="absolute inset-0 z-40 overflow-hidden cursor-pointer select-none"
      onClick={() => setDismissed(true)}
      role="button"
      aria-label="Dismiss easter egg"
      title="Click to return"
      style={{ containerType: 'size' }}
    >
      <style>{`
        @keyframes bh-spin-slow { to { transform: translate(-50%,-50%) rotate(360deg); } }
        @keyframes bh-spin-rev  { to { transform: translate(-50%,-50%) rotate(-360deg); } }
        @keyframes bh-pulse {
          0%,100% { opacity: .55; transform: translate(-50%,-50%) scale(1); }
          50%     { opacity: .85; transform: translate(-50%,-50%) scale(1.04); }
        }
        @keyframes bh-twinkle {
          0%,100% { opacity: .15; }
          50%     { opacity: .9; }
        }
        @keyframes bh-title-in {
          from { opacity: 0; letter-spacing: 1.2em; filter: blur(12px); }
          to   { opacity: 1; letter-spacing: .32em; filter: blur(0); }
        }
        @keyframes bh-drift {
          from { transform: translate(-50%,-50%) translateX(-3px); }
          to   { transform: translate(-50%,-50%) translateX(3px); }
        }
      `}</style>

      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 50%, #050208 0%, #0b0714 40%, #000 100%)',
        }}
      />

      {STAR_POSITIONS.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            animation: `bh-twinkle ${2 + (i % 5) * 0.6}s ease-in-out ${i * 0.11}s infinite`,
            boxShadow: '0 0 3px rgba(255,255,255,0.9)',
          }}
        />
      ))}

      {/* Gravitational lensing */}
      <div
        className="absolute top-1/2 left-1/2 pointer-events-none"
        style={{
          width: 'min(560px, 85cqmin)',
          height: 'min(560px, 85cqmin)',
          transform: 'translate(-50%,-50%)',
          background:
            'radial-gradient(circle, transparent 38%, rgba(255,180,140,0.09) 40%, transparent 43%, transparent 56%, rgba(255,220,180,0.07) 58%, transparent 62%)',
          animation: 'bh-drift 6s ease-in-out infinite alternate',
        }}
      />

      {/* Accretion disk */}
      <div
        className="absolute top-1/2 left-1/2 rounded-full"
        style={{
          width: 'min(480px, 72cqmin)',
          height: 'min(480px, 72cqmin)',
          transform: 'translate(-50%,-50%)',
          background:
            'conic-gradient(from 0deg, rgba(255,255,255,0) 0deg, rgba(255,160,80,0.0) 20deg, rgba(255,170,90,0.7) 90deg, rgba(255,230,200,0.95) 150deg, rgba(201,100,66,0.85) 210deg, rgba(120,40,20,0.55) 280deg, rgba(0,0,0,0) 360deg)',
          filter: 'blur(8px)',
          animation: 'bh-spin-slow 14s linear infinite',
          maskImage:
            'radial-gradient(circle, transparent 32%, #000 34%, #000 70%, transparent 74%)',
          WebkitMaskImage:
            'radial-gradient(circle, transparent 32%, #000 34%, #000 70%, transparent 74%)',
        }}
      />

      {/* Counter-rotating dust lane */}
      <div
        className="absolute top-1/2 left-1/2 rounded-full pointer-events-none"
        style={{
          width: 'min(620px, 94cqmin)',
          height: 'min(620px, 94cqmin)',
          transform: 'translate(-50%,-50%)',
          background:
            'conic-gradient(from 180deg, transparent 0deg, rgba(255,140,80,0.2) 120deg, rgba(255,210,180,0.24) 180deg, rgba(255,120,60,0.12) 240deg, transparent 360deg)',
          filter: 'blur(18px)',
          animation: 'bh-spin-rev 26s linear infinite',
          maskImage:
            'radial-gradient(circle, transparent 44%, #000 48%, #000 68%, transparent 72%)',
          WebkitMaskImage:
            'radial-gradient(circle, transparent 44%, #000 48%, #000 68%, transparent 72%)',
        }}
      />

      {/* Event horizon */}
      <div
        className="absolute top-1/2 left-1/2 rounded-full"
        style={{
          width: 'min(240px, 36cqmin)',
          height: 'min(240px, 36cqmin)',
          background: '#000',
          boxShadow:
            '0 0 60px 12px rgba(255,170,110,0.5), inset 0 0 80px rgba(255,200,150,0.18)',
          animation: 'bh-pulse 5s ease-in-out infinite',
        }}
      />

      {/* Text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6 text-center">
        <div
          className="font-mono text-[11px] uppercase tracking-[0.4em] text-[#ffb088]/70 mb-3"
          style={{ animation: 'bh-title-in 1.4s ease-out 0.2s backwards' }}
        >
          — Causality violation detected —
        </div>
        <h2
          className="font-display font-light text-white leading-none"
          style={{
            fontSize: 'clamp(28px, 9cqmin, 84px)',
            letterSpacing: '0.28em',
            textShadow:
              '0 0 22px rgba(255,180,120,0.6), 0 0 48px rgba(255,120,60,0.4)',
            animation: 'bh-title-in 1.8s cubic-bezier(.2,.8,.2,1) backwards',
          }}
        >
          TIME&nbsp;TRAVELLER
        </h2>
        <div
          className="mt-6 font-mono text-[12px] text-white/65 tracking-wider"
          style={{ animation: 'bh-title-in 2.2s ease-out 0.5s backwards' }}
        >
          due {format(new Date(dueDate), 'MMM d, yyyy')}
          <span className="mx-2 text-[#ffb088]">←</span>
          start {format(new Date(startDate), 'MMM d, yyyy')}
          <div className="mt-1 text-white/40 text-[11px]">
            {days} day{days !== 1 ? 's' : ''} of borrowed time
          </div>
        </div>
        <div
          className="mt-10 text-white/30 text-[10px] tracking-[0.3em] font-mono"
          style={{ animation: 'bh-title-in 2.6s ease-out 1s backwards' }}
        >
          click anywhere to return
        </div>
      </div>
    </div>
  );
};

export default BlackHole;
