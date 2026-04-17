/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        // Brand
        primary: {
          DEFAULT: '#0E3A5F',
          dark: '#0A2B47',
        },
        accent: {
          DEFAULT: '#F97316',
          dark: '#EA580C',
        },
        // Backgrounds
        bg: '#FFFFFF',
        surface: {
          DEFAULT: '#F8FAFC',
          dark: '#0B2238',
        },
        // Text
        text: {
          DEFAULT: '#0F172A',
          muted: '#475569',
          inverse: '#FFFFFF',
        },
        // UI
        border: {
          DEFAULT: '#E2E8F0',
          strong: '#CBD5E1',
        },
        success: '#16A34A',
        warning: '#F59E0B',
        error: '#DC2626',
        focus: '#F97316',
      },
      fontFamily: {
        display: ['Archivo', 'Archivo Narrow', 'system-ui', '-apple-system', 'sans-serif'],
        body: ['Manrope', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        sans: ['Manrope', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem',
        '6xl': '3.75rem',
      },
      lineHeight: {
        tight: '1.05',
        snug: '1.2',
        normal: '1.5',
        loose: '1.7',
      },
      letterSpacing: {
        tight: '-0.02em',
        normal: '0',
        wide: '0.04em',
        extrawide: '0.1em',
      },
      spacing: {
        1: '0.25rem',
        2: '0.5rem',
        3: '0.75rem',
        4: '1rem',
        5: '1.25rem',
        6: '1.5rem',
        8: '2rem',
        10: '2.5rem',
        12: '3rem',
        16: '4rem',
        20: '5rem',
        24: '6rem',
        32: '8rem',
      },
      maxWidth: {
        container: '1200px',
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '10px',
        xl: '14px',
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(15, 23, 42, 0.05)',
        md: '0 2px 8px rgba(15, 23, 42, 0.08)',
        lg: '0 8px 24px rgba(15, 23, 42, 0.12)',
        cta: '0 4px 14px rgba(249, 115, 22, 0.35)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '250ms',
        slow: '400ms',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};
