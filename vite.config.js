import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  server: { open: true },
  build: {
    outDir: 'dist',
    // Disable source maps in production — prevents exposing original source code
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        analytics: resolve(__dirname, 'analytics-dashboard.html'),
      },
    },
  },
});
