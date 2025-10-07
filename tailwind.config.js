/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,html}",
    "./src/**/*.css"
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          subtle: 'var(--color-surface-subtle)'
        },
        border: {
          DEFAULT: 'var(--color-border)',
          strong: 'var(--color-border-strong)'
        },
        text: {
          DEFAULT: 'var(--color-text-primary)',
          muted: 'var(--color-text-muted)',
          inverse: 'var(--color-text-inverse)'
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          contrast: 'var(--color-accent-contrast)'
        },
        focus: {
          ring: 'var(--color-focus-ring)'
        }
      },
      boxShadow: {
        elevation: 'var(--shadow-elevation)'
      },
      ringColor: {
        focus: 'var(--color-focus-ring)'
      },
      borderColor: {
        DEFAULT: 'var(--color-border)'
      }
    },
  },
  plugins: [],
};
