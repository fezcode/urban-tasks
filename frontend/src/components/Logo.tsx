import React from 'react';

interface Props {
  size?: number;
  className?: string;
  glow?: boolean;
}

// Abstract mark: warm block crossed by a cream diagonal band, with two
// off-axis counter-dots — reads as structure + motion + a task in play.
const Logo: React.FC<Props> = ({ size = 32, className, glow = false }) => {
  const id = React.useId().replace(/:/g, '');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
      style={glow ? { filter: `drop-shadow(0 10px 24px rgba(201, 100, 66, 0.45))` } : undefined}
    >
      <defs>
        <linearGradient id={`g-${id}`} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#D47653" />
          <stop offset="1" stopColor="#B0502F" />
        </linearGradient>
        <clipPath id={`c-${id}`}>
          <rect width="32" height="32" rx="8" />
        </clipPath>
      </defs>
      <g clipPath={`url(#c-${id})`}>
        <rect width="32" height="32" rx="8" fill={`url(#g-${id})`} />
        <path
          d="M32 4 L4 32 L-2 32 L-2 26 L26 -2 L32 -2 Z"
          fill="#F5EFE6"
          fillOpacity="0.92"
        />
        <circle cx="9" cy="9" r="2.6" fill="#F5EFE6" />
        <circle cx="23" cy="23" r="2.2" fill="#1F1B17" />
      </g>
    </svg>
  );
};

export default Logo;
