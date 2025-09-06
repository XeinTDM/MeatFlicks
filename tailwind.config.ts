import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{html,js,ts,jsx,tsx,mdx,svelte}',
  ],
  theme: {
    extend: {
      colors: {
        'primary-color': 'var(--primary-color)',
        'primary-color-alt': 'var(--primary-color-alt)',
        'bg-color': 'var(--bg-color)',
        'bg-color-alt': 'var(--bg-color-alt)',
        'text-color': 'var(--text-color)',
        'text-color-light': 'var(--text-color-light)',
        'border-color': 'var(--border-color)',
        'white-color': 'var(--white-color)',
        'shadow-color': 'var(--shadow-color)',
      },
    },
  },
  plugins: [],
};

export default config;
