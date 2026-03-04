# Changelog — DaDataDad.com Portfolio

All notable changes to this project are documented here. This log covers Claude-assisted development sessions. Version numbers in `package.json` may have been bumped independently between sessions.

Current version: **2.9.2** (as of 2026-03-04)

---

## [Unreleased] — 2026-03-04

### Fixed — Live data reconnection
- Restored `fetchGA4Data()` in `data.js` — was accidentally removed during `hooks.js` cleanup
- V1 `AnalyticsDashboard.jsx`: added `useEffect` to fetch live data from Cloudflare Worker, dynamic Live/Demo/Loading badge, passes `liveData` prop to `BallEngagement`
- V2 `AnalyticsDashboardV2.jsx`: same live fetching pattern, removed fake `simTick` simulation counter
- `BallEngagementV2.jsx`: added `liveData` prop with dynamic funnel totals
- Defensive null guards on all KPI computations to handle sparse Worker responses

### Fixed — vite.config.js regressions
- Restored `__APP_VERSION__` injection via `readFileSync` + Vite `define` — was lost when security hardening session delivered a new `vite.config.js` with `sourcemap: false` but without the version define
- Added `analyticsV2` entry point to `rollupOptions.input` — was never added to the config despite V2 dashboard being created

### Added — CHANGELOG.md
- Created this file to track all changes and prevent regressions across sessions

**Files changed:** `vite.config.js`, `data.js`, `hooks.js`, `AnalyticsDashboard.jsx`, `AnalyticsDashboardV2.jsx`, `BallEngagementV2.jsx`, `CHANGELOG.md`

---

## 2026-03-03 (Evening) — Security Hardening

### Added
- `.htaccess` with HTTPS enforcement, HSTS, Content-Security-Policy, X-Frame-Options, Permissions-Policy, Referrer-Policy, X-Content-Type-Options
- Blocked access to sensitive files (`.env`, `package.json`, `.map`, dotfiles)
- Blocked common bot attack paths (`wp-admin`, `phpmyadmin`, etc.)
- SQL injection and XSS query string filtering
- Gzip compression and aggressive cache headers for hashed Vite assets
- Updated `.cpanel.yml` to explicitly deploy `.htaccess`

### Changed
- `vite.config.js`: added `sourcemap: false` to prevent exposing source in production

### Regression introduced
- `vite.config.js` was delivered as a full replacement, dropping the `__APP_VERSION__` define and the V2 entry point that had been added in earlier sessions

**Files changed:** `.htaccess`, `.cpanel.yml`, `vite.config.js`

---

## 2026-03-03 (Late afternoon) — Analytics Dashboard V2

### Added
- `analytics-v2.html` — new Vite entry point with GA4 snippet
- `src/analytics-v2-main.jsx` — React entry for V2
- `src/analytics/AnalyticsDashboardV2.jsx` — full V2 layout with 8 sections
- `src/analytics/BallEngagementV2.jsx` — enhanced engagement with FunnelViz + table side-by-side
- `src/analytics/FunnelViz.jsx` — animated SVG funnel visualization (Click→Launch→Score→Open)
- `src/styles/analytics-v2.css` — dedicated V2 styles (811 lines)
- V2 sections: Device Breakdown, Session Journey Flow (Sankey-style), Tracking Architecture showcase
- Navigation links between V1, V2, and Portfolio on both dashboards

### Changed
- `data.js`: added `FUNNEL_TOTALS`, `DEVICE_DATA`, `SESSION_FLOW`, `ARCHITECTURE` exports
- V1 `AnalyticsDashboard.jsx`: added nav links to V2

### Regression introduced
- `hooks.js` was delivered without `fetchLiveData` / `getMockData` exports that V1 depended on, breaking the build
- `data.js` was delivered without `fetchGA4Data()`, disconnecting live data from both dashboards
- V2 entry point was not added to `vite.config.js`

**Files changed:** 8 new files, `data.js`, `AnalyticsDashboard.jsx`, `hooks.js`

---

## 2026-03-03 (Afternoon) — GA4 Tracking Troubleshooting

### Investigated
- GA4 Realtime showing zero activity after per-ball event tracking deploy
- Root cause: incognito/private browsing blocks Google Analytics
- Confirmed GA4 has 24-48 hour processing delay for standard reports
- Verified Cloudflare Worker queries match new event structure

**Files changed:** None

---

## 2026-03-03 (Afternoon) — Version Automation + GA4 Per-Ball Tracking + Dashboard Fixes

### Added — Automated version numbering
- `vite.config.js`: reads `version` from `package.json` via `readFileSync`, injects as `__APP_VERSION__` global at build time
- `config.js`: changed hardcoded `version: '2.7.0'` to `version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'`
- `DetailModal.jsx` already read `config.version` — no changes needed
- Workflow: `npm version patch` → `npm run build` → modal footer updates automatically

### Fixed — GA4 per-ball event tracking
- `Game.js`: added `bus.emit('ball:launched', { ball })` and `bus.emit('ball:scored', { ball })` with ball identity
- `ga4.js`: added listeners for `ball:launched` and `ball:scored` events, sends `ball_launch` and `ball_score` with `project_name`, `shot_number`, `total_makes`, `accuracy` parameters
- Previously all GA4 ball events showed `(not set)` because aggregate `stats:update` lacked ball identity

### Fixed — Dashboard crash on sparse Worker data
- `AnalyticsDashboard.jsx`: added defensive filtering (`.filter(d => d && d.visitors != null)`) to handle incomplete Worker responses
- `AreaChart.jsx`: added NaN guards on SVG path generation

### Added — CSS
- `.modal-version` styling for version tag in detail modals

**Files changed:** `vite.config.js`, `config.js`, `Game.js`, `ga4.js`, `AnalyticsDashboard.jsx`, `AreaChart.jsx`, `modal-version-css-snippet.css`

---

## 2026-03-03 (Afternoon) — Portfolio Copy Overhaul

### Changed
- `projects.js`: rewrote all 8 project descriptions for professional presentation
  - Removed first-person filler ("I created", "I use", "I am")
  - Led with outcomes and impact instead of process
  - Named architecture and data flows for technical projects
  - Updated tech stacks to match current reality (React 18, Vite, GA4)
  - Matched official product branding (Power BI not PowerBI, Claude AI not Claude.ai)
- Updated roles, goals, and technology fields for all 8 projects
- Created side-by-side comparison document (`portfolio-copy-comparison.md`)

**Files changed:** `projects.js`

---

## 2026-03-03 (Afternoon) — GA4 Ball Tracking Fix + Dashboard Polish

### Fixed
- GA4 events for ball interactions now include `project_name` parameter
- Previously all ball events showed `(not set)` in GA4 reports because the aggregate `stats:update` event didn't carry ball identity
- Added per-ball `ball:launched` and `ball:scored` events to `Game.js`
- Updated `ga4.js` to listen for per-ball events with enriched parameters

### Changed
- Dashboard footer copy updated for professional presentation
- `BallEngagement.jsx`: accepts optional `liveData` prop, falls back to mock data

**Files changed:** `Game.js`, `ga4.js`, `BallEngagement.jsx`, `AnalyticsDashboard.jsx`, `data.js`

---

## 2026-03-03 (Morning) — GA4 Dashboard Live Data Integration

### Added
- `fetchGA4Data(days)` in `data.js` — fetches from Cloudflare Worker endpoint
- `useAnalyticsData` hook for live data fetching with mock fallback
- Dynamic Live/Demo badge in dashboard header
- `BallEngagement.jsx`: optional `liveData` prop for Worker ball event data

### Changed
- `AnalyticsDashboard.jsx`: wired `useEffect` to fetch live data when time range changes
- Sources, pages, and ball engagement sections use live data when available, mock when not

### Fixed
- Build error from mismatched exports between `data.js` and `hooks.js`

**Files changed:** `data.js`, `hooks.js`, `AnalyticsDashboard.jsx`, `BallEngagement.jsx`

---

## 2026-03-03 (Morning) — GA4 Cloudflare Worker Setup

### Added
- Cloudflare Worker (`ga4-analytics-api`) deployed at `https://ga4-analytics-api.dadatadad-analytics.workers.dev`
- Worker authenticates via Google service account, queries GA4 Data API
- Returns `{ timeSeries, sources, pages, ballEvents, isLive, fetchedAt, days }`
- Configured Wrangler secrets: `GA4_SERVICE_ACCOUNT_JSON`, `GA4_PROPERTY_ID`

### Fixed
- DNS resolution issues during Worker deployment
- Empty filter expression errors in Worker code
- GA4 Data API enablement in Google Cloud Console

**Files changed:** Cloudflare Worker (external), no repo files

---

## 2026-03-02 — Performance Optimization + UI Refinements

### Fixed — Desktop performance
- Identified draw loop exceeding 16.6ms frame budget (~22ms per frame)
- Bottlenecks: per-frame clip path operations (8 balls), static content redrawn every frame, canvas captures every 8 frames
- Pre-rendered ball images to circular offscreen canvases (eliminated clip paths)
- Cached static background elements (gradients, title text, netting)
- Implemented adaptive framerate (drops to 15fps during idle, ramps to 60fps on interaction)

### Fixed — Mobile regression from static caching
- Title disappeared and layout misaligned on mobile
- Root cause: static layer cache captured frame before fonts loaded, corrupting cached state
- Fix: removed static layer cache while preserving offscreen ball rendering and adaptive framerate

### Added — Analytics dashboard V1 integration
- 5 KPI cards with sparklines (Visitors, Pageviews, Duration, Bounce Rate, Ball Interaction Rate)
- Traffic over time area chart with metric toggle
- Traffic sources donut chart + top pages table
- Ball engagement funnel (Click→Launch→Score→Open) with per-ball breakdown
- Category conversion chips and auto-generated insights
- GA4 event tracking integration
- Updated CSS for 7-column grid layout

### Changed
- Demo launch angle: 45° → 60° with 33% reduced power
- Desktop ball grid: centered horizontally on screen
- Ball ordering documented: controlled by array sequence in `projects.js`

**Files changed:** `Game.js`, `Ball.js`, `AnalyticsDashboard.jsx`, `BallEngagement.jsx`, `data.js`, `hooks.js`, `StatCard.jsx`, `AreaChart.jsx`, `DonutChart.jsx`, `Sparkline.jsx`, `analytics.css`

---

## Pre-2026-03-02 — v2 Rebuild (v1 → v2.0.0)

### Changed — Full architecture rebuild
- Migrated from 7 script tags with global scope to ES modules
- Replaced `window.ui` / `window.onReset` bridge with EventBus pub/sub
- Switched from p5 global mode to p5 instance mode inside React
- Replaced Babel CDN runtime JSX transform with Vite + `@vitejs/plugin-react`
- Replaced runtime `.txt` file loading with static `projects.js` data module
- Consolidated 30+ naked global variables into `Game` class
- Replaced deprecated `Matter.World` with `Matter.Composite`
- Replaced destructive `img.mask()` with canvas clipping (`drawingContext.clip()`)

**Stack:** React 18, Vite, p5.js (instance mode), Matter.js, ES Modules

---

## Known Regressions to Watch For

When receiving file updates from Claude, always verify:

1. **`vite.config.js`** must contain:
   - `import { readFileSync } from 'fs'` and `__APP_VERSION__` define
   - `sourcemap: false`
   - All three entry points: `main`, `analytics`, `analyticsV2`

2. **`data.js`** must contain:
   - `fetchGA4Data()` function with Worker URL
   - All mock data exports (including V2: `FUNNEL_TOTALS`, `DEVICE_DATA`, `SESSION_FLOW`, `ARCHITECTURE`)

3. **`hooks.js`** must contain:
   - `useAnimatedNumber` (used by StatCard)
   - Should NOT contain `fetchLiveData` / `getMockData` (fetching is done in dashboard components directly)

4. **`config.js`** must contain:
   - `version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'`
   - NOT a hardcoded version string

5. **Version number** should update in modal footer after each `npm version patch && npm run build`
