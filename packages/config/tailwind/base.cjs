// Shared Tailwind preset for GeoSight — dark-first, RTL-ready, premium SaaS palette.
// Workspaces extend this via `presets: [require('@geosight/config/tailwind/base')]`.

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
        arabic: ['var(--font-arabic)', 'IBM Plex Sans Arabic', 'Noto Kufi Arabic', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        serif: ['var(--font-serif)', 'Playfair Display', 'Cormorant Garamond', 'Georgia', 'serif'],
        display: ['var(--font-display)', 'Inter Tight', 'Inter', 'system-ui', 'sans-serif'],
        'arabic-serif': ['var(--font-arabic-serif)', 'Amiri', 'Scheherazade New', 'serif'],
      },
      colors: {
        // GeoSight palette — HSL channels exposed as CSS vars so themes can swap them.
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        // Editorial "paper" theme — used by .theme-paper wrappers (landing page, marketing).
        // Adapted from open-design.ai's kami system; values are concrete (not HSL) because
        // the parchment palette is fixed and not user-themable.
        paper: {
          DEFAULT: '#efe7d2',
          warm: '#ece4cf',
          dark: '#ddd2b6',
          bone: '#f7f1de',
        },
        ink: {
          DEFAULT: '#15140f',
          soft: '#2a2620',
          mute: '#5a5448',
          faint: '#8b8676',
        },
        coral: {
          DEFAULT: '#ed6f5c',
          soft: '#f08e7c',
        },
        mustard: '#e9b94a',
        olive: '#6e7448',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        glow: '0 0 24px hsl(var(--primary) / 0.18)',
        'glow-lg': '0 0 48px hsl(var(--primary) / 0.22)',
        paper: '0 30px 60px -30px rgba(21, 20, 15, 0.18)',
        'paper-sm': '0 10px 24px -16px rgba(21, 20, 15, 0.18)',
      },
      backgroundImage: {
        'glass-gradient':
          'linear-gradient(180deg, hsl(var(--card) / 0.6) 0%, hsl(var(--card) / 0.3) 100%)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'reveal-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        ticker: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        shimmer: 'shimmer 2s linear infinite',
        'reveal-up': 'reveal-up 0.7s cubic-bezier(0.22, 0.61, 0.36, 1) both',
        ticker: 'ticker 40s linear infinite',
      },
    },
  },
  plugins: [],
};
