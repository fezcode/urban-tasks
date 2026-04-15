import React from 'react';

interface Props {
  seed?: string | null;
  name?: string;
  size?: number;
  className?: string;
  ring?: boolean;
}

// Warm, cohesive palette that plays well with the app's terracotta accent.
const PALETTES: [string, string, string][] = [
  ['#C96442', '#F2C48E', '#2A1E18'],
  ['#7B3F2E', '#E8A878', '#1F1B17'],
  ['#2F4F3B', '#D8C28A', '#1A1A1A'],
  ['#344054', '#E6B499', '#0F172A'],
  ['#6B2E1E', '#F5D6B8', '#221714'],
  ['#4A2B3E', '#EAC6A0', '#1A0F15'],
  ['#1F3A2E', '#D4A574', '#0E1B13'],
  ['#8B4513', '#F4D19C', '#241310'],
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function randomAvatarSeed(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const Avatar: React.FC<Props> = ({ seed, name, size = 40, className, ring }) => {
  const effectiveSeed = seed || name || '?';
  const h = hashStr(effectiveSeed);
  const palette = PALETTES[h % PALETTES.length];
  const variant = Math.floor(h / 7) % 6;
  const rotation = (h % 8) * 45;

  const [bg, accent, ink] = palette;
  const id = React.useId().replace(/:/g, '');

  const initial = (name || effectiveSeed).trim().charAt(0).toUpperCase() || '·';

  const decoration = (() => {
    switch (variant) {
      case 0:
        // Orbit: thin ring + small filled disc
        return (
          <>
            <circle cx="32" cy="32" r="20" stroke={accent} strokeWidth="1.5" fill="none" opacity="0.55" />
            <circle cx="48" cy="20" r="3.5" fill={accent} />
          </>
        );
      case 1:
        // Sweeping arc
        return (
          <path
            d="M 6 44 Q 32 -6 58 44"
            stroke={accent}
            strokeWidth="2"
            fill="none"
            opacity="0.55"
            strokeLinecap="round"
          />
        );
      case 2:
        // Diagonal band
        return (
          <path d="M64 10 L54 0 L0 54 L0 64 L10 64 L64 10 Z" fill={accent} fillOpacity="0.35" />
        );
      case 3:
        // Ascending bars
        return (
          <g fill={accent} fillOpacity="0.7">
            <rect x="10" y="40" width="4" height="14" rx="1" />
            <rect x="20" y="32" width="4" height="22" rx="1" />
            <rect x="30" y="24" width="4" height="30" rx="1" />
            <rect x="40" y="16" width="4" height="38" rx="1" />
            <rect x="50" y="10" width="4" height="44" rx="1" />
          </g>
        );
      case 4:
        // Quarter-disc + dot (clock-motif)
        return (
          <>
            <path d="M0 32 A32 32 0 0 1 32 0 L32 32 Z" fill={accent} fillOpacity="0.3" />
            <circle cx="48" cy="48" r="5" fill={accent} />
          </>
        );
      case 5:
      default:
        // Nested squares rotated
        return (
          <g>
            <rect x="12" y="12" width="40" height="40" rx="6" stroke={accent} strokeWidth="1.5" fill="none" opacity="0.5" />
            <rect
              x="22"
              y="22"
              width="20"
              height="20"
              rx="3"
              fill={accent}
              fillOpacity="0.55"
              transform="rotate(45 32 32)"
            />
          </g>
        );
    }
  })();

  const border = ring ? `0 0 0 3px rgba(245,239,230,0.9), 0 0 0 4px ${ink}` : undefined;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      style={border ? { boxShadow: border, borderRadius: '9999px' } : undefined}
    >
      <defs>
        <radialGradient id={`bg-${id}`} cx="30%" cy="30%" r="90%">
          <stop offset="0" stopColor={accent} stopOpacity="0.5" />
          <stop offset="0.5" stopColor={bg} />
          <stop offset="1" stopColor={ink} />
        </radialGradient>
        <clipPath id={`c-${id}`}>
          <rect width="64" height="64" rx="32" />
        </clipPath>
      </defs>
      <g clipPath={`url(#c-${id})`}>
        <rect width="64" height="64" fill={`url(#bg-${id})`} />
        <g transform={`rotate(${rotation} 32 32)`}>{decoration}</g>
        <text
          x="32"
          y="32"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="Fraunces, Georgia, serif"
          fontWeight="500"
          fontSize="28"
          fill="#F5EFE6"
          style={{ letterSpacing: '-0.02em' }}
        >
          {initial}
        </text>
      </g>
    </svg>
  );
};

export default Avatar;
