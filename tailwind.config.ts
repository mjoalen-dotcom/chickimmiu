import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

/**
 * CHIC KIM & MIU Tailwind 設定
 * 融合高級極簡優雅（米白/米杏/金）與韓系可愛活力（柔和粉調）
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        lg: '2rem',
      },
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // CHIC KIM & MIU 品牌色系
        cream: {
          50: '#FDFBF7',
          100: '#F9F5EC',
          200: '#F2EAD6',
          300: '#EADCB8',
        },
        gold: {
          300: '#E2C89A',
          400: '#D4AF77',
          500: '#C19A5B',
          600: '#A8824A',
          700: '#856639',
        },
        blush: {
          50: '#FDF7F5',
          100: '#FBEDE8',
          200: '#F6D7CD',
          300: '#EFBBAA',
        },
        // 主題 token（runtime 由 SiteThemes active doc 注入 :root，
        // 預設 fallback 在 src/app/(frontend)/globals.css :root）
        // 用 RGB channel + <alpha-value> 形式以支援 bg-brand-primary/40 等 alpha
        brand: {
          primary: 'rgb(var(--theme-primary) / <alpha-value>)',
          accent: 'rgb(var(--theme-accent) / <alpha-value>)',
          surface: 'rgb(var(--theme-surface) / <alpha-value>)',
          ink: 'rgb(var(--theme-ink) / <alpha-value>)',
          'on-primary': 'rgb(var(--theme-on-primary) / <alpha-value>)',
          'on-accent': 'rgb(var(--theme-on-accent) / <alpha-value>)',
        },
        // shadcn/ui 語意色
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
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-noto-sans-tc)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-noto-serif-tc)', 'serif'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.5s ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
