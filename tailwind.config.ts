import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0f172a',
          card: '#1e293b',
          border: '#334155',
          primary: '#dc2626', // High visibility Emergency Red
          primaryHover: '#b91c1c',
          warning: '#f59e0b',
          success: '#10b981',
          info: '#3b82f6',
        },
      },
    },
  },
  plugins: [],
};

export default config;
