# Changelog — DaDataDad.com Portfolio

All notable changes to this project are documented here. This log covers Claude-assisted development sessions. Version numbers in `package.json` may have been bumped independently between sessions.

Current version: **3.3.0** (as of 2026-11-14) — ⚠ **not yet deployed or verified live**, see below

---

## 3.3.0 — 2026-11-14 — Dashboard v4, the last of Google Analytics, and a broken certificate

### Found, not fixed — the live site's certificate
- `dadatadad.com` and `www` were serving the host's default certificate (`*.web-hosting.com`), so
  browsers showed a full-page security error. DNS was correct. PostHog's last recorded visit was
  2026-11-09, so it broke between then and the 14th
- Every certificate-validation path (`/.well-known/acme-challenge/…`, `/.well-known/pki-validation/…`,
  cPanel's `.cpaneldcv` files) was being 301-redirected to HTTPS by `.htaccess` — measured over plain
  HTTP. Once a certificate has lapsed, that redirect points the renewal at the broken thing.
  **`.htaccess` now lets those paths through first** (new section 0)
- **The cause is not confirmed and the certificate still has to be reissued from cPanel.** Whether
  AutoSSL was failing for this reason, was off, or a paid certificate expired is not knowable from
  outside. And nothing in this release could be checked on the live domain while it is broken

### Diagnosed and fixed — "the dashboard fails, then works on reload"
- **Reproduced.** v3's chart returned early *above* a `useMemo`. It rendered mock data first (90 rows,
  three hooks), then the live response; if that had fewer than two daily rows the early return fired,
  React counted two hooks where there had been three, and threw **error #300** — the "Dashboard hit a
  snag" screen. A reload started from the default 90-day range, which still had data
- The GA4 worker's data ends on 2026-09-11, so it now answers **7 and 30 days with nothing at all** —
  exactly the response that crashes v3, on either of those two buttons. Its 90-day answer was down to
  seven rows; from about 2026-12-10 it would have had one, and v3 would have crashed on **every** load.
  (Reproduced locally with an empty live response. Not clicked through on the live site: see above)
- Fixed in v3 (hooks above the early return, and a stale hover index can no longer read past the end
  of a shorter series). v4 is built so the case cannot arise: the daily series is zero-filled, and
  switching range no longer makes a request

### Added — analytics dashboard v4 (`/analytics-v4.html`)
- **Loads once, with real data.** The header appears immediately, a loading panel holds the space,
  and the dashboard is drawn a single time. No mock data first, no swap. A cached answer (5 min, per
  tab) is instant; otherwise one retry, then clearly labelled sample data with a *Try again* button.
  *Refresh* never trades live numbers for sample ones: if it fails, what is on screen stays and a
  notice says so
- **Contrast, computed rather than eyeballed.** Text is 16:1, 11:1 and 6.9:1 on its surface; v3 set
  most labels in white at 20–40% opacity, which measures 1.9–3.8:1 (4.5:1 is the accessibility bar).
  No text under 12px, none in a data colour, status is always an icon and a word. The three chart
  colours pass colour-blindness and contrast checks as a set
- **Shot chart on the real court**, opening on **your own session** when you have one. Every mark is a
  recorded first contact drawn against the playground's actual geometry: the whole screen plus a
  close-up of the goal. Scored = green dot, missed = ×, so it never relies on red-versus-green.
  All-visitor shots come from PostHog and are re-drawn from whatever they hit, so a wall hit from a
  2:1 monitor still lands on the wall. Updates live while you play in another tab
- **Two heat maps**: shot density on the court (toggle on the shot chart), and visits by weekday and
  hour in each visitor's own time
- **Everything is real.** v3's device split, session flow, "% vs last period" and all-time shot
  scatter were invented. v4 adds a real funnel (built so each step contains the next), real
  previous-period comparisons that hide themselves when the earlier period predates tracking, real
  sources / countries / devices, load time, frame rate and Core Web Vitals, and findings written from
  the numbers — including how many visits look automated and a warning when the sample is small
- Every chart has a table view; keyboard and reduced-motion support; one request covers 7/30/90 days
- A second tab explains the pipeline, with physics values read from `config.js` rather than typed in

### Changed — the analytics worker, rewritten (`analytics-worker/`)
- Renamed `ga4-analytics-api` → **`site-analytics`**. A new worker, so the old one keeps running
  until it is deleted by hand
- **3 queries instead of 7.** PostHog allows three API queries at once per project; the previous
  version — never deployed — would have been rejected on every request. Now: one row per session,
  one per day × project, one per shot, aggregated in the worker for all three ranges
- Ignores everything before 2026-09-13 16:15 UTC (the demo-shot fix). Sends totals and shot
  positions only: no person ids, session ids, timestamps, referring URLs or exact screen sizes
- Retries once on 429/5xx, never after a timeout, inside a 9-second budget for the whole batch. Keeps
  its last answer in memory for 2 minutes and serves it if PostHog is down. Responses are `no-store`
- Split in two: `analytics-worker.js` is the Worker itself and exports only its handler;
  `aggregate.js` holds the SQL and the aggregation, is pure, and is what the tests and the
  dashboard's sample data reuse
- All three queries were run against the live project (the two that changed in review were run
  again), and the real rows put through the worker locally. **It has not yet run on Cloudflare** —
  `wrangler` was logged out and it needs a key
- v1–v3 now read the same document through an adapter and show real data instead of frozen GA4 data

### Added — PostHog on the dashboard pages, and tests
- The four dashboard pages sent **nothing** to PostHog: no page views, no errors, no replay — which is
  why the load failure left no trace. They now load PostHog on demand (it stays out of their first
  paint), v4 reports `dashboard_loaded` with how it went, and render errors reach error tracking.
  Dashboard traffic is tracked separately and never counted as a visit to the portfolio
- `npm test` — 50 tests on Node's built-in runner, no new dependencies: the worker end to end against
  a stubbed PostHog, the court geometry against contacts recorded in real sessions, the reader for
  the viewer's own session, and the v1–v3 adapter. CI now runs them before building

### Fixed before release — an independent review of all of the above
A second pass by a reviewer that had not seen the work being built found 15 defects. All are fixed.
The ones worth remembering:
- **The worker could hang for everyone.** Simultaneous requests shared one in-flight promise, and on
  Workers a promise belongs to the request that created it: close that tab mid-load and every other
  request waiting on it hangs until Cloudflare kills it. Each request now runs its own batch; only
  the finished answer is shared. Also gone: the Cache API layer (it does nothing on `*.workers.dev`),
  HTTP caching (it would have made *Refresh* do nothing) and retrying a query that timed out (the
  first copy may still be running, and a second counts against the limit of three)
- **Scores were paired with the wrong shot** when two balls were in the air at once. Each impact and
  score is now tied, inside the query, to the launch it followed for that ball
- **The dashboard was measuring itself.** Web vitals from the dashboard pages were being averaged
  into the playground's performance numbers
- **It sent more than the page claimed.** Every referring site and every exact viewport went to the
  browser — together, close to a fingerprint. Referrers are now a short list of known sources or
  "Other sites", and a shot's screen is a shape (aspect ratio, long side rounded up to 100px). That
  moves a mark by under half a pixel on the real shots. The page's privacy wording was corrected
- **A failed *Refresh* replaced live numbers with sample data.** See above
- **"My session" could show last week.** The game only expires its stored shots when its own page
  loads, so the dashboard now applies the same 24-hour limit as it reads them. A made shot keeps
  what it touched first, and brushing a category bar is no longer counted as a goal — in v4, and in
  the older pages' session view, which had the same mistake
- **v1–v3 averaged over empty days.** With one row per calendar day, a plain mean turned 70 seconds
  of average visit into 5. They now weight by visits
- **v3 printed "Infinity%"** — "down Infinity% WoW" on a quiet fortnight, and "converts at
  Infinity%" for a category. Its insights divide by launches, and live data has projects that were
  opened and clicked through without one (a double-click opens the panel). A finding with nothing to
  divide by is now left out, and the v2/v3 funnels scale to their widest step instead of assuming
  it is the first. Checked in the browser on the real rows for all three ranges; this part has no
  unit test, because the insight code lives inside the page component
- Smaller: the shot chart's table view keeps its "whose shots" and layout switches, tooltips stay up
  on touch screens, the weekday heat map fits a phone, the portrait court draws balls at game size

### Removed — the last of Google Analytics
- `GA4-SETUP-GUIDE.md`; `codebase_dump.txt` (a March snapshot still carrying the GA4 code and
  measurement id — regenerate with `bash dump_codebase.sh`, whose file list is now current)
- `src/dashboard-v3.jsx` and `src/analytics/analytics-v3-main.jsx` — dead, never imported
- The `VITE_GA4_WORKER_URL` fallback, the GA4 worker from the CSP, and the remaining comments
- The production build was scanned: no Google Analytics host or code in any bundle
- **Still to do outside the repo:** delete the `ga4-analytics-api` worker, the GA4 property and its
  service account

### Not done
- Certificate reissue, worker deploy, deleting the old worker: all need Josh's cPanel, Cloudflare and
  PostHog access. Until the worker is deployed the dashboard shows sample data, and says so
- No live-domain verification of any of this (CSP, PostHog on the dashboards, the worker)
- v1–v3 still fill gaps with demo data; the owner's own visits are still counted. Both in CLAUDE.md
- v1–v3's funnels still assume every open follows a make. Live data doesn't, so their "Open" step can
  read above 100% (333% on the real 90-day rows). v4's funnel is built for it; the old pages are left
  as built until it is decided whether to keep, fix or retire them

**Files changed:** `analytics-worker/*`, `src/analytics/v4/*` (new), `src/analytics/{data,legacyShape,telemetry}.js`,
`src/analytics/AnalyticsDashboard{,V2,V3}.jsx`, `src/analytics/{FunnelViz,ShotChart}.jsx`, `src/analytics-{main,v2-main,v3-main,v4-main}.jsx`,
`src/styles/analytics-v4.css`, `analytics-v4.html`, `src/game/{posthog,sessionBridge}.js`,
`src/data/projects.js`, `src/AccessiblePortfolio.jsx`, `index.html`, `portfolio.html`, `public/.htaccess`,
`public/sitemap.xml`, `.env.production`, `.github/workflows/deploy.yml`, `vite.config.js`, `package.json`,
`dump_codebase.sh`, `V2-INTEGRATION-GUIDE.md`, `CLAUDE.md`, `.claude/launch.json` (new — lets Claude's
browser pane start `npm run preview`)

---

## 2026-10-06 — PostHog self-driving turned on (no site change)

Set up in PostHog, not in the site's code. No version bump: nothing that ships changed.

- **GitHub connected** — the PostHog GitHub App, scoped to `joshmerritt/WebsiteAnimation` only, so
  self-driving can open pull requests here
- **Setup wizard run** (`npx @posthog/wizard self-driving`) against the Website project (605146).
  It found AI data processing already approved, enabled 6 signal sources and 7 of 30 scouts, and
  wrote two scouts specific to this site: the portfolio interaction journey and canvas playability
- Verified independently through the PostHog connector, not taken from the wizard's report: the
  sources, scouts, GitHub integration and repository scope all match it, and no source files changed
- **Not done:** the two Replay Vision scanners the wizard planned (it couldn't create them), and
  CSP violation reporting, without which the CSP scout has nothing to read. Both are in CLAUDE.md's
  open items
- Context worth knowing: the site gets roughly one visit every few days, so expect few reports

**Files changed:** `CLAUDE.md`, `CHANGELOG.md`, `.gitignore`; added `posthog-self-driving-report.md`

---

## 3.2.2 — 2026-09-13 — Deadened the goal

### Fixed — balls ricocheting off the goal
- Matter.js resolves every contact at `max(bodyA.restitution, bodyB.restitution)`, so the ball's 0.66 always
  won. The goal posts and nets (0.3) and category bars (0.03) were configured to deaden the ball but **never did**
  — every contact bounced at 0.66, and shots that caught the rim ricocheted away
- `Game._dampGoalContacts` now forces goal contacts to the goal body's own value, in `collisionStart` (which fires
  before the velocity solve — `collisionActive`, where scoring lives, fires after it and would do nothing)
- Walls and ball-on-ball bounce are unchanged. Their configured values are still inert, on purpose

### Measured, not guessed
- The in-app browser can't run the game loop, so this was tuned with a headless simulation: the real `Game`
  building the real goal, 1,292 shots per variant across 1280×800, 1920×1080 and a 402×670 phone
- **Overall makes: 15.3% → 20.0%, 15.6% → 20.8%, 19.7% → 24.4%** (+24–33%)
- Finding: a ball that gets fully **inside** the chute already scored 99–100% of the time. What looks like bouncing
  out is catching a post or net at the mouth. The ball is 79–88% as wide as the opening, so rim clips dominate
- `config.goal.restitution` 0.3 → **0.15**: best on all three screens; 0.05 gained nothing
- A first version of the measurement falsely showed 66% bounce-outs on phones (it counted misses falling past
  *below* the goal as entering it). Caught by tracing individual shots before reporting it

**Files changed:** `src/game/Game.js`, `src/game/config.js`, `CLAUDE.md`, `package.json`

---

## 3.2.1 — 2026-09-13 — Game data fixes and jank

Found by reading a real production session event by event, and by the `game_perf` event added in 3.2.0.

### Fixed — the intro demo counted as the visitor's shot
- `_runDemo()` auto-launches the About Me ball, and `_handleCollisions()` never checked for it. Every page
  load did `totalMakes++` and emitted `detail:open` + `ball:scored` + `impact:first`
- **Visible to every visitor:** someone who made their first shot saw **"1 shot · 2 makes · 200%"**
- **In analytics:** a fake score and project open for "Josh Merritt" on every visit — first place in
  Top projects opened, and every visitor (bounces included) in the Engaged cohort
- The demo now tags its shot. It still plays and still opens the panel exactly as before, but counts nowhere.
  Pre-existing since Feb/Mar 2026. **Data before this release is inflated**

### Fixed — the miss hint fired a shot early
- It counted a miss at launch, so "try double-clicking" appeared as the 3rd attempt started — after 2 real
  misses — and could show on a shot that went in. A miss is now counted when a shot actually fails

### Fixed — latent double count
- One collision event can carry several pairs for the same ball, and each counted a make. Only a panel
  that actually opens counts now

### Fixed — jank on desktop
- p5 defaults pixel density to `Math.ceil(devicePixelRatio)`, rendering a common 1.09–1.25 desktop at 2×.
  A real session measured a **4694×2360 canvas (11M pixels) on a 1.09 display: 16 fps average, 6 fps minimum**.
  Density is now `min(devicePixelRatio, 2)` — ~3.4× fewer pixels in that case, ~2.25× on a 3× phone
- **Session replay canvas capture turned off.** It read back the whole canvas on the main thread; that session
  logged a **194 ms stall** and 1.66 MB of snapshot data in about a minute. Replays still record DOM, clicks,
  console and network
- ⚠ FPS could not be measured locally — `requestAnimationFrame` never fires in the hidden in-app browser.
  Verified instead by a Node test driving the real `Game`/`Ball` methods: 30 checks pass, 13 of which fail
  against the pre-fix code. Confirm with real play via `game_perf`

**Files changed:** `src/game/Game.js`, `src/game/Ball.js`, `src/game/posthog.js`, `src/game/sessionBridge.js`,
`src/game/EventBus.js`, `CLAUDE.md`, `package.json`. PostHog setting: `session_replay_config.record_canvas = false`

---

## 3.2.0 — 2026-09-11/12 — Analytics rebuilt on PostHog, GA4 removed, site speed

Six months of deploys had silently not shipped (see the deploy note below). This session
worked through `POSTHOG_HANDOFF.md` end to end, then removed GA4 entirely.

### Added — PostHog, properly configured
- Upgraded `posthog-js` 1.379 → 1.430.2 with `defaults: '2026-08-30'`
- Web vitals (LCP/CLS/FCP/INP), network timing, explicit exception capture
- Canvas session replay — the p5 `<canvas>` IS the UI, so before this every recording was a blank screen
- Super properties on every event: `app_version`, `input_type`, `layout_mode`, `device_pixel_ratio`, `prefers_reduced_motion`
- New events: `first_launch`, `miss_hint_shown`, `game_perf` (avg/min FPS over the first 30s of active frames)
- React ErrorBoundary now reports via `captureException` with the component stack
- Source maps generated and uploaded to PostHog error tracking from CI, then deleted from `dist/` so no source ships
- Deploy annotations from CI, so chart changes line up with releases
- First-party ingestion via a managed reverse proxy at `e.dadatadad.com` (ad blockers block `*.posthog.com`)
- In PostHog: dashboard "DaDataDad · Site health" (id 2088517), 3 alerts, 4 actions, 3 cohorts

### Fixed — local builds were polluting production analytics
- `shouldTrack()` in `posthog.js` gates on hostname; `vite preview` and local prod builds are now silent
  (override with `localStorage.setItem('ph_force','1')`). Everything ingested before 2026-09-11 16:28 PT is test data.

### Removed — GA4, entirely
- GA4 cost **175 KB gzipped per page load**, more than the entire critical path, duplicating what PostHog captures
- Deleted `src/game/ga4.js`, `public/gtag-init.js`, `ga4-worker/`, the GA4 snippet from **all five** HTML entries,
  and every Google Analytics host from the CSP
- **`analytics-worker/` replaces `ga4-worker/`** — same JSON contract and deployed worker name, but runs HogQL
  against the PostHog query API. ⚠ Still needs deploying (see "Open items")
- **`src/game/sessionBridge.js` is new, extracted from `ga4.js`** — the localStorage stores
  `__dadatadad_impacts` / `__dadatadad_bridge` were never GA4-specific. `AnalyticsDashboardV3` reads those
  **keys** directly for the shot chart's "your session" view; they would have died with `ga4.js`

### Changed — site speed (handoff §7)
- Ball images **1,309 KB → 292 KB (-78%)** as WebP capped at 900px long edge, via `npm run images`
  (`scripts/optimize-images.mjs`, sharp). `aboutMe.jpg` was a 337px PNG misnamed `.jpg` costing 199 KB → now 12 KB
- `GameCanvas` is `React.lazy`, so p5 + matter left the entry chunk: `main` **1,187 KB → 11.7 KB**;
  paint-blocking path **~354 KB → ~61 KB gzipped**
- Ball images preloaded in `index.html`; Google Fonts made non-blocking; `favicon.png` 84.5 → 18.7 KB
- ⚠ The byte cuts are measured. The `load_time_ms` improvement is **not yet proven** — the only samples are
  hidden-tab probes on one fast connection, whose old-build readings already scatter 551–1837 ms

### Fixed — `og:image` had never existed
- `index.html` and `portfolio.html` advertised `/assets/images/og-preview.jpg`, which 404'd. Every LinkedIn,
  Slack, iMessage and X preview fell back to no image. Built by `npm run og` from the real logo

### Fixed — bugs found while working
- **Image preloads were silently discarded.** p5's `loadImage` fetches with `mode:'cors'` (credentials mode
  *same-origin*); a `<link rel=preload>` without `crossorigin` uses *include*. Mismatched, so nothing reused them.
  Fixed by adding `crossorigin` and aligning `Ball.nativeImage`
- **`.htaccess` SPA fallback returned 200 + `index.html` for every missing path**, so a missing asset looked like
  a successful HTML response instead of a 404. `/assets/` is now excluded
- **`Permissions-Policy` blocked p5's devicemotion listeners**, logging two console errors into every page load
  and every session replay. `gyroscope`/`accelerometer` are now `(self)`

**Files changed:** `src/game/posthog.js`, `src/game/sessionBridge.js` (new), `src/game/ga4.js` (deleted),
`src/game/Game.js`, `src/game/Ball.js`, `src/game/EventBus.js`, `src/App.jsx`, `src/analytics/data.js`,
`src/analytics/AnalyticsDashboard*.jsx`, `src/data/projects.js`, `src/AccessiblePortfolio.jsx`,
`src/components/DetailModal.jsx`, `index.html`, `portfolio.html`, `analytics-*.html`, `public/.htaccess`,
`public/gtag-init.js` (deleted), `vite.config.js`, `.env.production`, `.github/workflows/deploy.yml`,
`analytics-worker/` (new), `ga4-worker/` (deleted), `scripts/` (new), `CLAUDE.md` (new)

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
