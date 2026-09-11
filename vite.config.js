import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import posthog from '@posthog/rollup-plugin';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

// Source maps are generated, uploaded to PostHog error tracking, then deleted
// from dist/ — so stack traces are readable in PostHog but no original source
// ever ships to public_html. Only runs when POSTHOG_API_KEY is present (set as
// a GitHub Actions secret), so local builds are unaffected.
const posthogSourcemaps = process.env.POSTHOG_API_KEY
  ? [posthog({
      personalApiKey: process.env.POSTHOG_API_KEY,
      projectId:      process.env.POSTHOG_PROJECT_ID || '605146',
      host:           process.env.POSTHOG_HOST || 'https://us.posthog.com',
      sourcemaps: {
        enabled:           true,
        releaseName:       'dadatadad-portfolio',
        releaseVersion:    pkg.version,
        deleteAfterUpload: true,
      },
    })]
  : [];

export default defineConfig({
  plugins: [react(), ...posthogSourcemaps],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: { open: true },
  build: {
    outDir: 'dist',
    // Source maps are emitted only when we're uploading them to PostHog (and
    // then deleted from dist/). Without the key: no maps, no source exposure.
    // public/.htaccess also blocks *.map from being served, as a second net.
    sourcemap: !!process.env.POSTHOG_API_KEY,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        analytics: resolve(__dirname, 'analytics-dashboard.html'),
        analyticsV2: resolve(__dirname, 'analytics-v2.html'),
        analyticsV3: resolve(__dirname, 'analytics-v3.html'),
        portfolio: resolve(__dirname, 'portfolio.html'),
      },
    },
  },
});
