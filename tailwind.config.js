/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './contexts/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Theme-aware tokens — driven by CSS variables in globals.css
        'th-bg':          'var(--th-bg)',
        'th-surface':     'var(--th-surface)',
        'th-surface-alt': 'var(--th-surface-alt)',
        'th-border':      'var(--th-border)',
        'th-text':        'var(--th-text)',
        'th-muted':       'var(--th-muted)',
        'th-faint':       'var(--th-faint)',
        'th-accent':      'var(--th-accent)',
        'th-accent-fg':   'var(--th-accent-fg)',
        'th-open':        'var(--th-open)',
        'th-resolved':    'var(--th-resolved)',
        'th-changes':     'var(--th-changes)',
        'th-info':        'var(--th-info)',
      },
      borderRadius: {
        'th':    'var(--th-r)',
        'th-sm': 'var(--th-r-sm)',
        'th-lg': 'var(--th-r-lg)',
        'th-full': 'var(--th-r-full)',
      },
      fontFamily: {
        'th': 'var(--th-font)',
        'th-mono': 'var(--th-mono)',
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)',
        'card-hover': '0 8px 24px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.1)',
        'panel': '0 16px 48px rgba(0,0,0,0.32)',
      },
      animation: {
        'fade-in': 'fadeIn 0.18s ease-out',
        'slide-up': 'slideUp 0.22s ease-out',
        'toast-in': 'toastIn 0.25s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        toastIn: { from: { opacity: '0', transform: 'translateX(-50%) translateY(12px)' }, to: { opacity: '1', transform: 'translateX(-50%) translateY(0)' } },
      },
      width: { '85': '340px' },
      height: { '13': '52px' },
    },
  },
  plugins: [],
}
