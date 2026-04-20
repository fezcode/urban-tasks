import React from 'react';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

interface Props {
  seed?: string | null;
  name?: string;
  size?: number;
}

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
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

let uidCounter = 0;

export default function Avatar({ seed, name, size = 40 }: Props) {
  const effectiveSeed = seed || name || '?';
  const h = hashStr(effectiveSeed);
  const palette = PALETTES[h % PALETTES.length];
  const variant = Math.floor(h / 7) % 6;
  const rotation = (h % 8) * 45;
  const [bg, accent, ink] = palette;
  const id = React.useMemo(() => `a${++uidCounter}`, []);
  const initial = (name || effectiveSeed).trim().charAt(0).toUpperCase() || '·';

  const decoration = (() => {
    switch (variant) {
      case 0:
        return (
          <>
            <Circle cx="32" cy="32" r="20" stroke={accent} strokeWidth="1.5" fill="none" opacity={0.55} />
            <Circle cx="48" cy="20" r="3.5" fill={accent} />
          </>
        );
      case 1:
        return (
          <Path
            d="M 6 44 Q 32 -6 58 44"
            stroke={accent}
            strokeWidth="2"
            fill="none"
            opacity={0.55}
            strokeLinecap="round"
          />
        );
      case 2:
        return <Path d="M64 10 L54 0 L0 54 L0 64 L10 64 L64 10 Z" fill={accent} fillOpacity={0.35} />;
      case 3:
        return (
          <G fill={accent} fillOpacity={0.7}>
            <Rect x="10" y="40" width="4" height="14" rx="1" />
            <Rect x="20" y="32" width="4" height="22" rx="1" />
            <Rect x="30" y="24" width="4" height="30" rx="1" />
            <Rect x="40" y="16" width="4" height="38" rx="1" />
            <Rect x="50" y="10" width="4" height="44" rx="1" />
          </G>
        );
      case 4:
        return (
          <>
            <Path d="M0 32 A32 32 0 0 1 32 0 L32 32 Z" fill={accent} fillOpacity={0.3} />
            <Circle cx="48" cy="48" r="5" fill={accent} />
          </>
        );
      case 5:
      default:
        return (
          <G>
            <Rect x="12" y="12" width="40" height="40" rx="6" stroke={accent} strokeWidth="1.5" fill="none" opacity={0.5} />
            <Rect
              x="22"
              y="22"
              width="20"
              height="20"
              rx="3"
              fill={accent}
              fillOpacity={0.55}
              transform="rotate(45 32 32)"
            />
          </G>
        );
    }
  })();

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <RadialGradient id={`bg-${id}`} cx="30%" cy="30%" r="90%">
          <Stop offset="0" stopColor={accent} stopOpacity={0.5} />
          <Stop offset="0.5" stopColor={bg} />
          <Stop offset="1" stopColor={ink} />
        </RadialGradient>
        <ClipPath id={`c-${id}`}>
          <Rect width="64" height="64" rx="32" />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#c-${id})`}>
        <Rect width="64" height="64" fill={`url(#bg-${id})`} />
        <G transform={`rotate(${rotation} 32 32)`}>{decoration}</G>
        <SvgText
          x="32"
          y="32"
          textAnchor="middle"
          fontFamily="Fraunces"
          fontWeight="500"
          fontSize="28"
          fill="#F5EFE6"
          dy="10"
        >
          {initial}
        </SvgText>
      </G>
    </Svg>
  );
}
