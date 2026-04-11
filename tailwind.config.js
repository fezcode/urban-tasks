/** @type {import('tailwindcss').Config} */

function cssVar(name) {
  return `rgb(var(--color-${name}) / <alpha-value>)`;
}

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: cssVar('bg'),
          secondary: cssVar('bg-secondary'),
          tertiary: cssVar('bg-tertiary'),
        },
        surface: {
          DEFAULT: cssVar('surface'),
          hover: cssVar('surface-hover'),
          raised: cssVar('surface-raised'),
        },
        border: {
          DEFAULT: cssVar('border'),
          light: cssVar('border-light'),
          focus: cssVar('border-focus'),
        },
        text: {
          primary: cssVar('text-primary'),
          secondary: cssVar('text-secondary'),
          tertiary: cssVar('text-tertiary'),
          inverse: cssVar('text-inverse'),
        },
        accent: {
          DEFAULT: cssVar('accent'),
          hover: cssVar('accent-hover'),
          light: cssVar('accent-light'),
          muted: cssVar('accent-muted'),
        },
        status: {
          active: cssVar('status-active'),
          'active-bg': cssVar('status-active-bg'),
          warning: cssVar('status-warning'),
          'warning-bg': cssVar('status-warning-bg'),
        },
        danger: {
          DEFAULT: cssVar('danger'),
          bg: cssVar('danger-bg'),
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'system-ui',
          'sans-serif',
        ],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
