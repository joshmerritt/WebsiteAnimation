import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: { open: true },
  build: {
    outDir: 'dist',
    // Disable source maps in production — prevents exposing original source code
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        analytics: resolve(__dirname, 'analytics-dashboard.html'),
        analyticsV2: resolve(__dirname, 'analytics-v2.html'),
        analyticsV3: resolve(__dirname, 'analytics-v3.html'),
        analyticsV3b: resolve(__dirname, 'analytics-v3b.html'),
        portfolio: resolve(__dirname, 'portfolio.html'),
      },
    },
  },
});
