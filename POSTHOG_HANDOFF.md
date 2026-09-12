# PostHog Handoff — DaDataDad.com

**Prepared:** 2026-09-11, 22:40 UTC
**Audited:** repo `master` @ `b9eefb0` · live site https://dadatadad.com (runtime probe) · PostHog project **Website** (id `605146`, org DaDataDad, US Cloud) read via the PostHog MCP
**Audience:** a developer, or a Claude Code session with the PostHog MCP connected. Everything below is either verified fact (marked *verified*) or an exact instruction.
**Goal:** take PostHog from "installed" to a complete, trustworthy setup — clean data, replays that actually show the game, web vitals plus a custom load-time metric for the slowness complaint, error tracking with readable stacks, ad-blocker-resistant ingestion, and a dashboard that answers "is the site working and converting?".

---

## STATUS — executed 2026-09-11 (commit `9378ce8`)

Phases 0–3 are **done**. §7 (site speed) was deliberately deferred until field data arrives.
This section is the current truth; the sections below are the plan as written, kept for the reasoning.

| Phase | State | Notes |
|---|---|---|
| **0 — project settings** | ✅ all 8 applied | Web vitals on, canvas capture on (fps 3, quality 0.4 — PostHog's current default), min duration 2000 ms, `recording_domains` + `app_urls` = `https://dadatadad.com`, `test_account_filters` = `$host exact dadatadad.com` (+ default-checked), timezone `America/Los_Angeles`. Verified in the live remote config. |
| **1 — code** | ✅ shipped | posthog-js **1.430.2**, `defaults: '2026-08-30'`, `shouldTrack()` host gating, web vitals + network timing, explicit `capture_exceptions`, super properties, `captureException` from the React ErrorBoundary, `first_launch` / `miss_hint_shown` / `game_perf`, `data-attr` on the modal + portfolio links, `Permissions-Policy` gyroscope/accelerometer `(self)`. |
| **2 — source maps + annotations** | ✅ done & verified | `POSTHOG_API_KEY` added 2026-09-12 00:08 UTC. Run `34660902098` uploaded **10 symbol sets** (all `has_uploaded_file: true`, no failures) against release `dadatadad-portfolio@3.1.4`, and created annotation `438945` "Deploy 9424b07: …". No `.map` reaches public_html — `deleteAfterUpload` removes them before the FTP step. |
| **2 — reverse proxy** | ✅ live | CNAME added 2026-09-12; proxy went `waiting → issuing → valid` at 00:15:50 UTC. Verified `/array/<token>/config.js`, `/static/1.430.2/posthog-recorder.js`, `/static/1.430.2/web-vitals-with-attribution.js` all 200 `application/javascript`, and `GET /e/` returns 400 exactly as `us.i.posthog.com` does (needs a POST body) while an unrouted path 404s. `VITE_POSTHOG_HOST` now points at it. |
| **3 — analytics build-out** | ✅ built | Dashboard **"DaDataDad · Site health"** (id `2088517`, pinned) with 8 tiles; 3 alerts; 4 actions; 3 cohorts. |
| **7 — site speed** | ⛔ not started | Deferred on purpose: `load_time_ms` p90 and `game_perf` now exist, so the next pass can be driven by field data instead of guesses. |

### Verified on the live domain after deploy

- Remote config the SDK receives: `$web_vitals_enabled_server_side: true`, `recordCanvas: true`, `canvasRecording: {enabled: true, fps: 3, quality: "0.4"}`, `minimumDurationMilliseconds: 2000`, console logs on, `maskAllInputs` on.
- `web-vitals-with-attribution.js` now loads from `us-assets.i.posthog.com/static/1.430.2/` — it never loaded before. Console says `[Web Vitals] enabled, starting...`.
- Console also says `History API monitoring enabled` (proves `defaults: '2026-08-30'` gave us `capture_pageview: 'history_change'`).
- **No CSP errors and no accelerometer Permissions-Policy errors.** The two-errors-per-load noise is gone.
- Ingestion confirmed from the new build: `portfolio_loaded` with `$lib_version = 1.430.2` from `$host = dadatadad.com`.
- Host gating confirmed: a fresh `localhost:4173` load writes no `ph_*` storage and never initialises the SDK.
- `$pageview`, `$pageleave`, `$web_vitals`, `ball_impact`, `ball_score`, `detail_open` all confirmed ingesting from `dadatadad.com` — but on SDK 1.379.0, from real visits earlier that afternoon. **They have not yet been observed on 1.430.2**, nor have the three new events, because an automated browser tab is always hidden (see §10) and posthog-js defers the initial `$pageview` and all paint-based vitals until the tab is visible. One ordinary visit closes that gap.

### Both prerequisites are done

The CNAME and the `POSTHOG_API_KEY` secret were both added on 2026-09-12 and are verified above. For reference, the key needs **`error tracking: write`**, **`organization: read`** and **`annotation: write`** — `organization: read` is easy to miss and the upload 403s without it, because the rollup plugin shells out to `posthog-cli`.

**Remaining tidy-ups:**

- Drop `https://us.i.posthog.com` and `https://us-assets.i.posthog.com` from the CSP in `public/.htaccess` once you're satisfied the proxy is stable. They're kept for now as a documented rollback path (`VITE_POSTHOG_HOST` back to `us.i.posthog.com` with no CSP edit).
- One ordinary visit to the site to produce a `$pageview`, a `$web_vitals` set, and the first canvas-visible replay on 1.430.2 (see the note above).
- Web analytics → conversion goal → `cta_click` (one click; the `CTA clicked` action already exists).
- **Pre-existing, unrelated:** the SPA fallback in `public/.htaccess` returns **200 + `index.html` for every missing path**, including `/assets/*.js` and `/package.json`. Nothing is leaked — those are the index page, not the real files — but it means a missing asset looks like a successful HTML response instead of a 404, which masks broken deploys and creates soft-404s for crawlers. Excluding `/assets/` from the fallback would fix it.

### Deliberate deviations from the plan below

- **§3 item 8 (Web analytics conversion goal = `cta_click`)** was *not* set. The Web Analytics tab's conversion-goal picker is not exposed in the project-settings API — only *marketing* analytics goals are, which is a different product and would need ad-source mapping to mean anything. The `CTA clicked` action it needs already exists, so this is one click in the Web analytics tab.
- **The funnel tile carries no breakdown.** §6 asked for `layout_mode` + `$device_type`; a 5-step funnel split three ways is unreadable at tile size, so the headline number is clean and the breakdown is one click away. The description on the insight says so.
- **`game_perf.min_fps` uses the median, not p10.** PostHog's trend math offers `median`/`p75`/`p90`/`p95`/`p99`, not p10.
- **The load-time alert runs off a separate insight** (`Loading-screen wait p90 (alert source)`), because PostHog alerts cannot evaluate an insight that has a breakdown.
- **`game:reset` listeners were kept, not deleted.** §4.4 offered either. Nothing emits the event (there is no reset control in the UI), so it is flagged in the `EventBus.js` catalog and the instrumentation waits for a reset button rather than being removed.
- **Web vitals CLS is not on the dashboard tile.** It is unitless and would share an axis with three millisecond metrics; it lives on the Web analytics → Web vitals tab.

### One regression worth knowing about

The SDK upgrade grew the PostHog chunk from **~65 KB to 102 KB gzipped** (314 KB raw) — 1.430 statically bundles more of what 1.379 lazy-loaded. It still loads in parallel with the main bundle and does not block render, but it is real weight on a site already flagged as slow. Worth revisiting if `load_time_ms` p90 disappoints once real data lands.

---

## 0. TL;DR

| Question | Answer |
|---|---|
| Is PostHog live on the site? | Yes. SDK `posthog-js` 1.379.0 is bundled, the CSP allows it, remote config loads, events reach project 605146, the replay recorder script loads. |
| **Are web vitals enabled?** | **No.** `autocapture_web_vitals_opt_in` is `null` in project settings and the client passes no `capture_performance`. The `$web_vitals` event has never been ingested. Fix = one settings toggle + a 3-line config change (§3, §4.2). |
| Do session replays show the game? | **No.** Canvas capture is off (`recordCanvas: false` in the remote config the SDK receives). The p5.js `<canvas>` *is* the UI, so every recording is a dark screen with a moving cursor. Fix = one settings toggle (§3). |
| Is the data clean? | **No.** Every event and both recordings so far are test traffic: `vite preview` on `localhost:4173` plus hidden-tab browser probes. There is not a single `$pageview` from `dadatadad.com` yet, i.e. **no real visitor has been captured**. Fix = hostname gating in code + `recording_domains` + a `$host` test-account filter (§3, §4.2). |
| Why is the site slow? | 1.34 MB of full-size JPEGs must all download before the loading screen goes away, plus a 290 KB (gzipped) JS bundle dominated by p5.js. Details and fixes in §7. |
| Fastest win? | §3 "Phase 0": five project-setting changes, no deploy, ~15 minutes. |
| SDK freshness | 1.379.0 installed, **1.430.2** latest (`npm view posthog-js version`, 2026-09-11). No `defaults` date set, so the SDK runs with legacy behaviours. |

---

## 1. Verified current state

### 1.1 Code (repo)

| Item | State | Verdict |
|---|---|---|
| SDK | `posthog-js` `^1.379.0` in `package.json`; 1.379.0 installed | Upgrade to 1.430.x |
| Init (`src/game/posthog.js`) | `api_host`, `person_profiles: 'identified_only'`, `capture_pageview: true`, `capture_pageleave: true`, `autocapture: true`, `session_recording.maskAllInputs: true` — nothing else | Rewrite (§4.2) |
| `defaults` | not set | Set `'2026-08-30'` |
| Web vitals client config | none | Add `capture_performance` |
| Error tracking | server-side autocapture on, so `exception-autocapture.js` loads; ErrorBoundary in `src/App.jsx` only `console.error`s; no source maps (`build.sourcemap: false` in `vite.config.js`) | Add `captureException` + source maps |
| Custom events | `ball_launch`, `ball_score`, `ball_impact`, `detail_open`, `detail_close`, `cta_click`, `portfolio_loaded` (`load_time_ms`), `game_reset` — forwarded from `src/game/EventBus.js` | Keep; add perf events (§4.4) |
| `game_reset` | listener exists, but **nothing emits `game:reset`** anywhere in `src/` — the event can never fire | Wire or delete |
| Super properties (`posthog.register`) | none | Add `app_version`, `input_type`, `layout_mode`, `device_pixel_ratio` |
| Hostname gating | none — `vite preview` (`localhost:4173`) and any local `npm run build` send **real production events and recordings** | Add `shouldTrack()` (§4.2) |
| Other pages | `src/portfolio-main.jsx` calls `initPostHog()` for `/portfolio.html` ✔. `analytics-*.html` dashboards do not load PostHog (fine — internal) | Keep |
| CSP (`public/.htaccess`) | `script-src`/`img-src` allow `https://us-assets.i.posthog.com`; `connect-src` allows `https://us.i.posthog.com` + `https://us-assets.i.posthog.com`; `worker-src 'self' blob:` | ✔ (must change when the proxy lands, §5.1) |
| Permissions-Policy (`public/.htaccess`) | `accelerometer=()` blocks p5's devicemotion listener → 2 console errors on every load | Fix (§4.7) |
| CI | `.github/workflows/deploy.yml` builds with `.env.production` and FTPS-uploads `dist/` on every push to `master`; `dist/` is git-ignored | Add source-map upload + deploy annotation (§5.2, §5.3) |

### 1.2 PostHog project settings (`project-get`, 2026-09-11 22:30 UTC) — *verified*

| Setting | Current value | Verdict |
|---|---|---|
| `session_recording_opt_in` | `true` | ✔ |
| `capture_console_log_opt_in` | `true` | ✔ |
| `capture_performance_opt_in` (network timing in replay) | `true` | ✔ |
| `session_replay_config` (canvas capture) | `null` → SDK gets `recordCanvas: false` | ✖ **Enable canvas capture** |
| `session_recording_minimum_duration_milliseconds` | `null` | Set `2000` |
| `session_recording_sample_rate` | `null` (100%) | OK at current traffic |
| `session_recording_retention_period` | `30d` | OK |
| `recording_domains` | `null` (records on any host, including localhost) | Set `["https://dadatadad.com"]` |
| `autocapture_web_vitals_opt_in` | `null` | ✖ **Enable** |
| `autocapture_web_vitals_allowed_metrics` | `null` (= all four) | OK |
| `autocapture_exceptions_opt_in` | `true` | ✔ |
| `heatmaps_opt_in` | `true` | ✔ |
| `capture_dead_clicks` | `true` | ✔ |
| `surveys_opt_in` | `null` (no surveys; `surveys.js` still loads) | OK |
| `app_urls` (authorized URLs for toolbar + heatmap overlay) | `[]` | ✖ Add `https://dadatadad.com` |
| `test_account_filters` | `cohort 564789 "Internal / Test users" not_in` — cohort has **0 members**, so it filters nothing | Replace with `$host = dadatadad.com` |
| `data_attributes` | `["data-attr"]` | Use it in markup (§4.5) |
| `timezone` | `UTC` | Consider `America/Los_Angeles` |
| `event_retention_months` | `12` | OK |
| Managed reverse proxy | none (`proxy-list`: 0 of 2 allowed) | ✖ Create (§5.1) |
| Dashboards | "Your starter dashboard" (id `2088176`) with 8 template insights (DAU/WAU, pageviews, sessions, retention, top referrers, "Visit to interaction funnel") | Build real ones (§6) |
| Actions / feature flags / surveys | none | §6 |

### 1.3 Runtime on the live domain (browser probe, 22:24–22:32 UTC) — *verified*

- Loaded from PostHog: `array/<token>/config.js` (remote config), `exception-autocapture.js`, `dead-clicks-autocapture.js`, `posthog-recorder.js`, `surveys.js`; one `/e/` batch → 200. **No CSP errors.**
- **Not loaded:** `web-vitals.js` (disabled server-side and client-side).
- No `/flags` request at all — the project has no flags, so the SDK skips it (good: one less request per load).
- Remote config the SDK stored in `localStorage["ph_<token>_posthog"]`: `$web_vitals_enabled_server_side: false`, `$session_recording_remote_config: { enabled: true, recordCanvas: false, canvasRecording.enabled: false, consoleLogRecordingEnabled: true, networkPayloadCapture.capturePerformance.network_timing: true, web_vitals: false, masking.maskAllInputs: true, sampleRate: null, minimumDurationMilliseconds: null }`, `$exception_capture_enabled_server_side: true`, `$heatmaps_enabled_server_side: true`, `$dead_clicks_enabled_server_side: true`.
- SDK debug log (`?__posthog_debug=true`): `[ExceptionAutocapture] enabled`, `[SessionRecording] starting`, `[Heatmaps] starting`, `[Dead Clicks] starting`, `[Surveys] isSurveysEnabled: false`, `send "portfolio_loaded"`. **No `send "$pageview"`** — see the gotcha below.
- Console errors: `Permissions policy violation: accelerometer is not allowed in this document` ×2 (p5 registers `devicemotion`/`deviceorientation` listeners; the `.htaccess` Permissions-Policy header disables the accelerometer). Harmless, but it pollutes every replay's console tab and the recording's `console_error_count`.

> **Gotcha (important for anyone verifying with Claude's in-app browser):** the probe tab is hidden (`innerWidth === 0`, pane hidden). posthog-js 1.379 only captures the initial `$pageview` when `document.visibilityState === 'visible'` and otherwise waits for `visibilitychange` (verified in `node_modules/posthog-js/dist/module.js`, method `un()`). That is why the live domain shows `portfolio_loaded` but zero `$pageview`. A normal, visible browser tab will send `$pageview` → `$pageleave` → `$autocapture`. Verify with §8, not with a hidden tab.

### 1.4 Data actually ingested (`execute-sql`, last 7 days = project lifetime) — *verified*

| event | `$host` | count | users | first | last |
|---|---|---|---|---|---|
| `portfolio_loaded` | dadatadad.com | 2 | 1 | 22:17:46Z | 22:24:13Z |
| `portfolio_loaded` | localhost:4173 | 2 | 2 | 20:45:40Z | 20:46:07Z |
| `$pageview` | localhost:4173 | 1 | 1 | 20:45:39Z | — |
| `$pageleave` | localhost:4173 | 1 | 1 | 20:52:32Z | — |
| `ball_impact` | localhost:4173 | 1 | 1 | 20:45:43Z | — |
| `ball_score` | localhost:4173 | 1 | 1 | 20:45:46Z | — |
| `detail_open` | localhost:4173 | 1 | 1 | 20:45:46Z | — |

Recordings (2): both `start_url = http://localhost:4173/`, 300 s and 462 s long, 0 clicks, 0 console errors (canvas not recorded, so they show nothing).
All `dadatadad.com` events were produced by hidden-tab probes (this audit and the previous one). Two more `portfolio_loaded` were added by this audit at 22:24 and 22:32 UTC.

**Conclusion:** treat everything captured before Phase 1 ships as test data. Nothing here is a real visitor.

---

## 2. Target end state

- **SDK 1.430.x with `defaults: '2026-08-30'`** — history-change pageviews, strict minimum recording duration, rage-click content ignorelist, scripts injected in `<head>`, debounced persistence, streamed network bodies, cookie-wins-on-conflict.
- **Only `dadatadad.com` sends data.** Local dev, `vite preview`, forks and staging are silent unless explicitly forced.
- **Web analytics complete:** `$pageview`/`$pageleave` (bounce, duration), **`$web_vitals`** (LCP, CLS, FCP, INP), conversion goal = `cta_click`, test traffic filtered by `$host`.
- **Replay that shows the game:** canvas capture on (4 fps, quality 0.4), console logs on, network timing on, minimum duration 2 s, domain-restricted, 30-day retention.
- **Error tracking:** unhandled errors + rejections autocaptured, React ErrorBoundary reports to PostHog, source maps uploaded from CI so stacks are readable.
- **Performance telemetry that matches the complaint:** `portfolio_loaded.load_time_ms` (time until the loading screen hides), `game_perf` (average/min FPS during the first 30 s), `first_launch` (time to first interaction), all sliceable by `layout_mode`, `input_type`, `$device_type`, `app_version`.
- **Ad-blocker-resistant ingestion** through a managed reverse proxy on a neutral subdomain (`e.dadatadad.com`), CSP updated.
- **Deploy markers:** every CI deploy creates a PostHog annotation, so chart changes line up with releases.
- **Toolbar + heatmaps usable** on the live site (authorized URL set).
- **A "Site health" dashboard** with a visit → launch → score → open → CTA funnel, load-time and FPS percentiles, web vitals p75, error count, top projects — plus two alerts (errors > 0, pageviews = 0 for 24 h).

---

## 3. Phase 0 — project settings (no deploy, ~15 min)

All in PostHog → project **Website** → Settings (`https://us.posthog.com/project/605146/settings/`). Use the settings search box if a section moved.

| # | Setting | Where | Value |
|---|---|---|---|
| 1 | **Web vitals autocapture → Enable** | Settings → Product analytics → Autocapture → "Web vitals autocapture" | On (all four metrics) |
| 2 | **Canvas capture → On** | Settings → Session replay (`/settings/project-replay`) → "Canvas capture" (a.k.a. record canvas) | On; leave fps/quality at the defaults (4 fps, 0.4) — tune later without a deploy |
| 3 | **Minimum session duration** | Settings → Session replay | 2 seconds (drops blank bounces; `strictMinimumDuration` comes with the SDK `defaults`) |
| 4 | **Authorized domains for replay** | Settings → Session replay | `https://dadatadad.com` |
| 5 | **Authorized URLs** (toolbar + heatmap overlay) | Settings → Project / Toolbar → "Authorized URLs" | `https://dadatadad.com` |
| 6 | **Filter out internal and test users** | Settings → Project → "Filter out internal and test users" | Replace the empty-cohort rule with event property **`$host` = `dadatadad.com`** and turn "filter test accounts" on by default for Web analytics |
| 7 | Timezone | Settings → Project → General | `America/Los_Angeles` (optional; Josh's local time) |
| 8 | Web analytics → Conversion goals | Web analytics → Settings | custom event `cta_click` |

**Via the PostHog MCP instead** (Claude Code, this repo): run `info project-settings-update`, then a single call along the lines of

```json
{
  "autocapture_web_vitals_opt_in": true,
  "session_replay_config": { "record_canvas": true },
  "session_recording_minimum_duration_milliseconds": 2000,
  "recording_domains": ["https://dadatadad.com"],
  "app_urls": ["https://dadatadad.com"],
  "test_account_filters": [
    { "key": "$host", "type": "event", "operator": "exact", "value": ["dadatadad.com"] }
  ],
  "timezone": "America/Los_Angeles"
}
```

(Field names match the `project-get` output in §1.2; confirm the exact `session_replay_config` / filter shapes against `info project-settings-update` before calling.) Verify afterwards: reload the live site with `?__posthog_debug=true` and check `localStorage["ph_<token>_posthog"]` → `$web_vitals_enabled_server_side: true` and `$session_recording_remote_config.canvasRecording.enabled: true`.

---

## 4. Phase 1 — code changes (one deploy)

### 4.1 Upgrade the SDK

```bash
npm install posthog-js@latest
```

Expect `1.430.2` or newer. Nothing else in the app touches the SDK API surface, so no other changes are required for the upgrade itself.

### 4.2 Replace `src/game/posthog.js`

Full replacement for the init half of the file (the EventBus listeners below it stay, see 4.4 for additions):

```js
/**
 * posthog.js — PostHog product analytics for DaDataDad.com
 *
 * Runs alongside GA4 (see ga4.js). Event names/properties mirror ga4.js so
 * the two tools stay comparable.
 *
 * Only the production hostname sends data. Local dev, `vite preview`, forks
 * and staging are silent unless you opt in with
 *   localStorage.setItem('ph_force', '1')
 */

import posthog from 'posthog-js';
import bus from './EventBus.js';
import config from './config.js';

const POSTHOG_KEY     = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST    = import.meta.env.VITE_POSTHOG_HOST    || 'https://us.i.posthog.com';
const POSTHOG_UI_HOST = import.meta.env.VITE_POSTHOG_UI_HOST || 'https://us.posthog.com';

const PROD_HOSTS = new Set(['dadatadad.com', 'www.dadatadad.com']);

function shouldTrack() {
  if (typeof window === 'undefined') return false;
  if (PROD_HOSTS.has(window.location.hostname)) return true;
  try { return localStorage.getItem('ph_force') === '1'; } catch { return false; }
}

/** Mirrors Game._computeLayout(): max(w,h) <= 1000 is "mobile". */
function layoutMode() {
  const w = window.innerWidth, h = window.innerHeight;
  if (Math.max(w, h) <= 1000) return h > w ? 'mobile-portrait' : 'mobile-landscape';
  return 'desktop';
}

let initialized = false;

export function initPostHog() {
  if (initialized) return posthog;
  if (!POSTHOG_KEY || !shouldTrack()) {
    if (import.meta.env.DEV) console.info('posthog: disabled (no key or non-production host)');
    return null;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,          // becomes https://e.dadatadad.com once the proxy is live (§5.1)
    ui_host:  POSTHOG_UI_HOST,       // required with a proxy so toolbar/replay links point at PostHog
    defaults: '2026-08-30',          // history_change pageviews, strict min duration, head injection, etc.

    person_profiles: 'identified_only', // nobody is identified → cheaper anonymous events
    capture_pageleave: true,            // bounce rate / time on page in Web analytics
    capture_dead_clicks: true,
    capture_heatmaps: true,

    // Error tracking (also enabled server-side; explicit here so it never depends on remote config)
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    },

    // Web vitals + network timing (LCP, CLS, FCP, INP → $web_vitals; needs SDK ≥ 1.141.2)
    capture_performance: {
      web_vitals: true,
      network_timing: true,
      web_vitals_allowed_metrics: ['LCP', 'CLS', 'FCP', 'INP'],
    },

    session_recording: {
      maskAllInputs: true,
      // Canvas capture is driven by PostHog → Settings → Session replay (remote
      // config) so fps/quality can be tuned without a deploy. To pin it in code:
      // captureCanvas: { recordCanvas: true, canvasFps: 4, canvasQuality: '0.4' },
    },

    // Optional: skip the surveys script until a survey exists.
    // disable_surveys: true,

    loaded: (ph) => {
      // Super properties: attached to every event from this browser.
      ph.register({
        app_version:            config.version,
        input_type:             window.matchMedia?.('(pointer: coarse)').matches ? 'touch' : 'mouse',
        layout_mode:            layoutMode(),
        device_pixel_ratio:     window.devicePixelRatio || 1,
        prefers_reduced_motion: !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
      });
    },
  });

  initialized = true;
  return posthog;
}

function capture(event, props) {
  if (initialized) posthog.capture(event, props);
}

/** Safe wrapper for React error boundaries etc. */
export function captureException(error, props) {
  if (initialized) posthog.captureException(error, props);
}
```

Notes:
- `defaults: '2026-08-30'` implies `capture_pageview: 'history_change'` (initial pageview + history API), `session_recording.strictMinimumDuration`, `rageclick.content_ignorelist`, `external_scripts_inject_target: 'head'`, `persistence_save_debounce_ms: 250`, `split_storage`, `detect_google_search_app`, `session_recording.streamNetworkBody`, `cookieWinsOnConflict`, `session_recording.captureJsonLd`. Any option you set explicitly overrides the default.
- Autocapture on the `<canvas>`: every tap on the canvas produces a `$autocapture` event with `tag_name: canvas`. That is acceptable at this traffic level and useful for heatmaps. If it gets noisy, restrict with `autocapture: { element_allowlist: ['a', 'button', 'input', 'select', 'textarea', 'label'] }` and confirm heatmaps still record (they use their own click listener).
- Keep PostHog eager (static import) rather than deferring to `requestIdleCallback`: deferring would hide visitors who bounce during the loading screen — exactly the segment the slowness question is about. The cost is 65 KB gzipped in parallel with the 290 KB main bundle.

### 4.3 `src/App.jsx` — report boundary errors

```jsx
import { initPostHogTracking, captureException } from './game/posthog.js';
// …
componentDidCatch(error, info) {
  console.error('App error:', error, info);
  captureException(error, { react_component_stack: info?.componentStack });
}
```

### 4.4 New perf/interaction events (EventBus → PostHog)

Add to `initPostHogTracking()` in `src/game/posthog.js`:

```js
// Time to first interaction
let firstLaunchSent = false;
unsubs.push(bus.on('ball:launched', () => {
  if (firstLaunchSent) return;
  firstLaunchSent = true;
  capture('first_launch', { ms_since_navigation: Math.round(performance.now()) });
}));

// Miss hint shown (3 consecutive misses)
unsubs.push(bus.on('miss:hint', (show) => { if (show) capture('miss_hint_shown'); }));

// Frame-rate sample emitted once by Game.js ~30 s after load:complete
unsubs.push(bus.on('perf:sample', (s) => capture('game_perf', s)));
```

Add to `src/game/Game.js` (in `draw()`, after the idle-framerate block; `this._perf` initialised in the constructor as `{ samples: [], sent: false, start: 0 }`):

```js
// ── One-shot performance sample for analytics ──
if (this._loaded && !this._perf.sent) {
  if (!this._perf.start) this._perf.start = performance.now();
  if (!isIdle) this._perf.samples.push(p.frameRate());            // only count active frames
  if (performance.now() - this._perf.start > 30_000) {
    this._perf.sent = true;
    const s = this._perf.samples;
    if (s.length) {
      bus.emit('perf:sample', {
        avg_fps:          Math.round(s.reduce((a, b) => a + b, 0) / s.length),
        min_fps:          Math.round(Math.min(...s)),
        active_frames:    s.length,
        hardware_threads: navigator.hardwareConcurrency || null,
        device_memory_gb: navigator.deviceMemory || null,
        canvas_px:        Math.round(p.width * p.pixelDensity()) + 'x' + Math.round(p.height * p.pixelDensity()),
      });
    }
  }
}
```

Document the two new events (`perf:sample`, and that `game:reset` has no emitter) in the catalog at the bottom of `src/game/EventBus.js`. Either wire a reset control to `bus.emit('game:reset')` or delete the `game_reset` listeners in `ga4.js`/`posthog.js`.

### 4.5 `data-attr` on the elements that matter

The project already declares `data-attr` as its autocapture data attribute. Add it so `$autocapture` events are readable and Actions are stable:

- `src/components/DetailModal.jsx`: the `<a className="modal-cta">` → `data-attr="modal-cta"`; the close button → `data-attr="modal-close"`.
- `src/AccessiblePortfolio.jsx`: email / LinkedIn / GitHub / Upwork links → `data-attr="portfolio-link-email"` etc.; the per-project `href={project.link}` → `data-attr="portfolio-project-link"`.

### 4.6 `.env.production`

```
VITE_POSTHOG_KEY=phc_D5Vr…            # unchanged (publishable key)
VITE_POSTHOG_HOST=https://us.i.posthog.com   # → https://e.dadatadad.com after §5.1 goes live
VITE_POSTHOG_UI_HOST=https://us.posthog.com
```

`vite build` reads this file in CI; nothing else to configure. Local `npm run dev` has no `.env.development`, so the key is undefined there and PostHog stays off — with `shouldTrack()` it now also stays off for `vite preview`.

### 4.7 `public/.htaccess` — Permissions-Policy

p5.js registers `devicemotion`/`deviceorientation` listeners on every page. Either allow them for the page itself:

```
Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(self), accelerometer=(self)"
```

or accept the two console errors per load (they are not JS exceptions, so error tracking ignores them, but they show in every replay's console tab).

### 4.8 Deploy

Push to `master`; CI builds and uploads. Then run §8.

---

## 5. Phase 2 — infrastructure

### 5.1 Managed reverse proxy (ad-blocker resistance)

Free on PostHog Cloud; nothing exists yet (`proxy-list` → 0 of 2). Ad blockers block `*.posthog.com` for a meaningful share of desktop visitors, and this audience (analysts, engineers) skews toward blockers.

1. PostHog → Organization settings → Proxy (`https://us.posthog.com/settings/organization-proxy`) → **New managed proxy** → subdomain **`e.dadatadad.com`** (neutral name; avoid `analytics`, `tracking`, `telemetry`, `posthog`, `ph`). Or via MCP: `info proxy-create` → `call proxy-create {"domain":"e.dadatadad.com"}`.
2. cPanel → Zone Editor → add **CNAME** `e` → the target PostHog shows (format `xxxxxxxx.proxy-us.posthog.com`). No Cloudflare-style proxying on that record.
3. Wait for status `waiting → issuing → live` (2–5 min; `proxy-list` / `proxy-diagnose` show it).
4. `.env.production`: `VITE_POSTHOG_HOST=https://e.dadatadad.com` (keep `VITE_POSTHOG_UI_HOST=https://us.posthog.com`).
5. **CSP** in `public/.htaccess` — add `https://e.dadatadad.com` to `script-src`, `img-src` and `connect-src`. Static extensions (`/static/posthog-recorder.js`, `web-vitals.js`, …) and `/array/<token>/config.js` are fetched from the proxy host once `api_host` is a custom domain, so `script-src` is mandatory, not optional. Keep the existing `us.i.posthog.com` / `us-assets.i.posthog.com` entries until §8 passes, then drop them.
6. Deploy, then verify on the live domain (§8) that every PostHog request goes to `e.dadatadad.com` and none to `*.posthog.com`.

### 5.2 Source maps for error tracking (Vite)

```bash
npm install --save-dev @posthog/rollup-plugin
```

`vite.config.js`:

```js
import posthog from '@posthog/rollup-plugin';
// …
plugins: [
  react(),
  ...(process.env.POSTHOG_API_KEY ? [posthog({
    personalApiKey: process.env.POSTHOG_API_KEY,
    projectId:      process.env.POSTHOG_PROJECT_ID,   // 605146
    host:           process.env.POSTHOG_HOST,         // https://us.posthog.com
    sourcemaps: {
      enabled: true,
      releaseName: 'dadatadad-portfolio',
      releaseVersion: pkg.version,
      deleteAfterUpload: true,   // maps are uploaded, then removed from dist/ — nothing ships to the server
    },
  })] : []),
],
build: {
  sourcemap: true,   // required for the plugin; maps never reach public_html (deleteAfterUpload + .htaccess blocks *.map)
  …
}
```

- Create a **personal API key** at https://us.posthog.com/settings/user-api-keys, scoped to project 605146, with **`error tracking: write`** + **`organization: read`** (both required by `posthog-cli`, which the plugin spawns) and **`annotation: write`** (for §5.3). Store it as the GitHub secret `POSTHOG_API_KEY`. Do not paste the value into a chat or a committed file — `gh secret set POSTHOG_API_KEY` prompts for it.
- In `.github/workflows/deploy.yml`, give the Build step:

```yaml
      - name: Build
        run: npm run build
        env:
          POSTHOG_API_KEY:    ${{ secrets.POSTHOG_API_KEY }}
          POSTHOG_PROJECT_ID: "605146"
          POSTHOG_HOST:       https://us.posthog.com
```

Local builds without the key skip the plugin and keep working. Bump `version` in `package.json` on releases so `releaseVersion` (and the `app_version` super property) stay meaningful.

### 5.3 Deploy annotations from CI

Append to `deploy.yml` after the FTP step:

```yaml
      - name: Annotate deploy in PostHog
        if: success()
        env:
          POSTHOG_API_KEY: ${{ secrets.POSTHOG_API_KEY }}
        run: |
          MSG=$(git log -1 --pretty=%s | head -c 200)
          curl -sS -X POST "https://us.posthog.com/api/projects/605146/annotations/" \
            -H "Authorization: Bearer $POSTHOG_API_KEY" \
            -H "Content-Type: application/json" \
            -d "{\"content\":\"Deploy ${GITHUB_SHA::7}: ${MSG}\",\"date_marker\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"scope\":\"project\"}"
```

Every chart in the project then shows a marker at each release. (Same thing is available interactively through the MCP: `annotation-create`.)

---

## 6. Phase 3 — analytics build-out (all doable through the PostHog UI or the MCP)

**Actions** (Data management → Actions): `Project opened` = `detail_open`; `CTA clicked` = `cta_click`; `Ball scored` = `ball_score`; `Outbound profile link` = `$autocapture` where `data-attr` starts with `portfolio-link-`.

**Funnel insight — "Visit → launch → score → open → CTA"**: `$pageview` → `ball_launch` → `ball_score` → `detail_open` → `cta_click`, conversion window 1 day, breakdown by `layout_mode` (super property) and `$device_type`. This is the one number the portfolio exists for.

**Performance insights**
- `portfolio_loaded` → `load_time_ms` p50 / p90, broken down by `$device_type` and `layout_mode`. **This is the metric that matches "the site feels slow"** — web vitals will not fully capture the loading-screen wait (a `<canvas>` is not an LCP candidate; the loading-screen title paints early and becomes LCP).
- `game_perf` → `avg_fps` p50 and `min_fps` p10 by `$device_type`, `device_pixel_ratio`.
- `first_launch` → `ms_since_navigation` p50.
- Web analytics → **Web vitals** tab (LCP/CLS/FCP/INP p75) once `$web_vitals` flows (needs real visits, ~24 h).

**Dashboard — "DaDataDad · Site health"**: visitors/day, the funnel above, `load_time_ms` p90, INP p75, `$exception` count, top projects by `detail_open`, `cta_click` by `project_name`, `game_perf.avg_fps` p50, plus a text tile linking to Replay filtered on `console_error_count > 0`.

**Alerts** (on trend insights): `$exception` > 0 in a day; `$pageview` = 0 over 24 h (tracking broke or deploy broke); `load_time_ms` p90 > 6000 ms.

**Cohorts**: `Engaged` = performed `detail_open` ≥ 1; `Converted` = `cta_click` ≥ 1; `Struggling` = `miss_hint_shown` ≥ 1 and `ball_score` = 0.

**Surveys** (optional; `surveys.js` already loads): a one-question "What brought you here?" shown after the first `detail_open`, limited to once per person.

**Experiments** (optional): the miss-hint threshold (3 vs 2 misses) or the title text. Note: the first feature flag makes the SDK fetch `/flags` on every load (~100 ms); acceptable, just be aware.

---

## 7. Site speed — what the data says and what to fix

Measured on the live site (warm cache; sizes are exact):

| Asset | Raw | Over the wire | Note |
|---|---|---|---|
| `main-*.js` (p5.js + matter-js + game) | 1,187 KB | **290 KB** gzipped | p5 1.x is not tree-shakeable; ~75 % of this is p5 |
| `client-*.js` (react-dom) | 144 KB | 44 KB | |
| `posthog-*.js` | 202 KB | 65 KB | + lazy extensions from PostHog CDN (recorder, exceptions, dead clicks, surveys) |
| 8 ball images (JPEG, 486–1511 px, 100–285 KB each) | **1,341 KB** | **1,341 KB** | not compressible, no WebP/AVIF; each is fetched by p5 `loadImage` (fetch + Image) and again by `Ball.nativeImage` (cache hits) |
| `index.html` | 19 KB | 4.6 KB | |
| Google Fonts CSS (3 families, ~10 weights) | — | render-blocking `<link rel=stylesheet>` | |
| TTFB / HTTP | 348 ms, HTTP/2, gzip on JS/CSS, 1-year immutable JS cache, 30-day image cache | | shared cPanel host |

A cold visit is roughly **2 MB, two thirds of it images, and all 8 images must finish before p5's `setup()` fires `load:complete` and the loading screen hides.** On a typical 4G phone that is several seconds of progress bar before anything is interactive. The JS bundle is the second cost: nothing renders until 290 KB gzipped of p5 has downloaded and parsed.

Fixes, in order of payoff:

1. **Re-encode the ball images**: max 800 px on the long edge (balls render at `viewport/6` ≈ 170–320 CSS px, hero image ≤ 600 px), WebP quality ~80. Expect ~1.34 MB → ~200–250 KB. Nothing in the code cares about the format except the `.jpg` path in `Game.preload()` / `Ball.imageSrc` / `index.html` noscript.
2. **Preload the images** in `index.html` (`<link rel="preload" as="image" href="/assets/images/aboutMe.jpg">` × 8) so they download during JS parse instead of after it.
3. **Split the entry**: render React + `LoadingScreen` from a small first chunk and `import()` `GameCanvas.jsx` (which pulls p5/matter) afterwards. The loading bar then appears in ~300 ms instead of after the whole bundle.
4. **Make Google Fonts non-blocking** (preload + `onload` swap, or self-host the three families as subset woff2).
5. Optional: `disable_surveys: true` until a survey exists (one fewer script), and trim `favicon.png` (84 KB for a 240 px icon).
6. Then **read the field data**: `$web_vitals` p75 (LCP/INP/CLS) in Web analytics, `load_time_ms` p90 and `game_perf.avg_fps` from §6, all split by `$device_type`. That tells you whether the remaining problem is download (load_time) or runtime (INP/FPS on low-end phones).

---

## 8. Verification runbook (always on the live domain, in a normal visible browser)

1. Open `https://dadatadad.com/?__posthog_debug=true` (or run `localStorage.setItem('ph_debug','true')` first). DevTools → Console should show, in order: `[PostHog.js] … send "$pageview"`, `[SessionRecording] starting`, `[ExceptionAutocapture] enabled`, `[Heatmaps] starting`, and later `send "portfolio_loaded"`. **No** `Refused to …` CSP errors, **no** `Bad HTTP status`.
2. DevTools → Network, filter `posthog` (before the proxy) or `e.dadatadad.com` (after): `config.js` 200, `posthog-recorder.js` 200, **`web-vitals.js` 200** (proves web vitals are on), `/e/` 200s, `/s/` 200s (replay snapshots).
3. In the console: `JSON.parse(localStorage["ph_" + Object.keys(localStorage).find(k=>k.startsWith("ph_phc")).slice(3)])` → `$web_vitals_enabled_server_side: true`, `$session_recording_remote_config.canvasRecording.enabled: true`.
4. Launch a couple of balls, open a project, click its CTA, close the tab.
5. PostHog → Activity → filter `$host = dadatadad.com`: expect `$pageview`, `$autocapture`, `ball_launch`, `ball_impact`, `ball_score`, `detail_open`, `cta_click`, `$pageleave`, and within ~5 s of leaving, `$web_vitals` with `$web_vitals_LCP_value` / `$web_vitals_INP_value` / `$web_vitals_CLS_value` / `$web_vitals_FCP_value`.
6. PostHog → Replay: open the newest recording → the **game canvas is visible** (balls, goals, motion at 4 fps), console tab has no accelerometer errors (after §4.7), network tab shows timings.
7. `vite preview` locally → console shows `posthog: disabled (no key or non-production host)` and no PostHog requests.
8. After the proxy: repeat 1–2 and confirm zero requests to `*.posthog.com`.

Via MCP, the equivalent of step 5 is `execute-sql`:

```sql
SELECT event, count() AS n
FROM events
WHERE timestamp > now() - INTERVAL 1 DAY AND properties.$host = 'dadatadad.com'
GROUP BY event ORDER BY n DESC
```

---

## 9. Event catalog

### Current (mirrors GA4; all in `src/game/posthog.js`)

| PostHog event | Trigger (EventBus) | Properties | Status |
|---|---|---|---|
| `$pageview` / `$pageleave` | SDK | standard | working (visible tabs) |
| `$autocapture`, `$rageclick`, `$dead_click`, `$$heatmap` | SDK | standard | working |
| `$exception` | SDK autocapture | standard | working (no errors seen yet) |
| `portfolio_loaded` | `load:complete` | `load_time_ms` | working |
| `ball_launch` | `ball:launched` | `project_name`, `project_category`, `ball_launches`, `ball_makes`, `total_shots`, `total_makes`, `accuracy` | working |
| `ball_score` | `ball:scored` | same as above | working |
| `ball_impact` | `impact:first` | `ball_name`, `ball_category`, `hit_type`, `is_goal`, `impact_x`, `impact_y`, `shot_number` | working |
| `detail_open` | `detail:open` | `project_name`, `project_link` | working |
| `detail_close` | `detail:close` | — | working |
| `cta_click` | `cta:click` | `project_name`, `project_link`, `project_category` | working |
| `game_reset` | `game:reset` | — | **dead — no emitter** |

### Proposed (Phase 1)

| Event | Trigger | Properties |
|---|---|---|
| `$web_vitals` | SDK | `$web_vitals_{LCP,CLS,FCP,INP}_value` + `_event` |
| `first_launch` | first `ball:launched` per page | `ms_since_navigation` |
| `miss_hint_shown` | `miss:hint` = true | — |
| `game_perf` | `perf:sample` (once, ~30 s after load) | `avg_fps`, `min_fps`, `active_frames`, `hardware_threads`, `device_memory_gb`, `canvas_px` |
| super properties (all events) | `loaded` | `app_version`, `input_type`, `layout_mode`, `device_pixel_ratio`, `prefers_reduced_motion` |

---

## 10. Gotchas and known issues

- **CSP** (`public/.htaccess`): any new PostHog host (the proxy) must be added to `script-src`, `img-src` and `connect-src`, or the browser silently blocks it on the live domain while localhost works. Cost a full debug cycle once already.
- **Hidden tabs never send `$pageview`** (SDK waits for visibility). Verify in a visible browser.
- **`vite preview` sends production data** until §4.2 ships. Don't trust any pre-Phase-1 numbers.
- **`person_profiles: 'identified_only'`** means anonymous visitors have no person properties, so person-property-based test filters never match them. Filter test traffic on the **event** property `$host` instead.
- **Canvas capture cost**: rrweb snapshots the canvas 4×/s as an image. Watch `game_perf.min_fps` on mobile after enabling; drop to 2 fps / quality 0.2 in Settings → Session replay if it hurts. Canvas content cannot be masked (fine here: project images and text only).
- **No `/flags` request today.** The first feature flag or targeted survey adds one per load.
- **`$pageleave` accuracy** depends on `sendBeacon`; some in-app browsers drop it. Expect bounce rate to be slightly optimistic.
- **Retention**: replays 30 days, events 12 months on the current plan.
- The **GA4 → dashboard bridge** (`src/game/ga4.js` localStorage store, Cloudflare Worker) is untouched by all of this; PostHog runs in parallel.

---

## 11. References

- posthog-js config reference (incl. the `defaults` dates): https://posthog.com/docs/libraries/js/config
- Web vitals autocapture: https://posthog.com/docs/web-analytics/web-vitals
- Canvas recording: https://posthog.com/docs/session-replay/canvas-recording
- Exception autocapture config: https://posthog.com/docs/error-tracking/capture
- Source maps for Vite: https://posthog.com/docs/error-tracking/upload-source-maps/vite
- Managed reverse proxy: https://posthog.com/docs/advanced/proxy/managed-reverse-proxy
- Project dashboard: https://us.posthog.com/project/605146 · Replay: https://us.posthog.com/project/605146/replay · Settings: https://us.posthog.com/project/605146/settings/
- Audit tooling used: PostHog MCP (`project-get`, `read-data-schema`, `execute-sql`, `query-session-recordings-list`, `proxy-list`), Claude in-app browser (network + console + `localStorage` probe), `node_modules/posthog-js/dist/module.js` (SDK 1.379.0 source).
