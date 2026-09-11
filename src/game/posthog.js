/**
 * posthog.js — PostHog product analytics for DaDataDad.com
 *
 * Runs alongside GA4 (see ga4.js). Initializes posthog-js with autocapture,
 * automatic pageviews, session replay, web vitals and exception capture, then
 * subscribes to the same EventBus game events GA4 listens to and forwards them
 * as PostHog events.
 *
 * Event names + property keys mirror ga4.js so the two tools stay comparable.
 *
 * ── Where data comes from ────────────────────────────────────────────────
 * Only the production hostname sends data. Local dev, `vite preview`, forks
 * and staging are silent, so the project never fills up with test traffic.
 * To deliberately send from a non-production host:
 *     localStorage.setItem('ph_force', '1')
 *
 * Also no-ops if VITE_POSTHOG_KEY isn't set, so a missing analytics key never
 * breaks the app.
 */

import posthog from 'posthog-js';
import bus from './EventBus.js';
import config from './config.js';

const POSTHOG_KEY     = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST    = import.meta.env.VITE_POSTHOG_HOST    || 'https://us.i.posthog.com';
const POSTHOG_UI_HOST = import.meta.env.VITE_POSTHOG_UI_HOST || 'https://us.posthog.com';

/** Hosts allowed to send production analytics. */
const PROD_HOSTS = new Set(['dadatadad.com', 'www.dadatadad.com']);

function shouldTrack() {
  if (typeof window === 'undefined') return false;
  if (PROD_HOSTS.has(window.location.hostname)) return true;
  try { return localStorage.getItem('ph_force') === '1'; } catch { return false; }
}

/** Mirrors Game._computeLayout(): max(w,h) <= 1000 is "mobile". */
function layoutMode() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (Math.max(w, h) <= 1000) return h > w ? 'mobile-portrait' : 'mobile-landscape';
  return 'desktop';
}

let initialized = false;

/**
 * Initialize the PostHog SDK once. Returns the posthog instance, or null if
 * no key is configured / this host isn't allowed to track (in which case all
 * tracking below silently no-ops).
 */
export function initPostHog() {
  if (initialized) return posthog;
  if (!POSTHOG_KEY || !shouldTrack()) {
    if (import.meta.env.DEV) {
      console.info('posthog: disabled (no key or non-production host)');
    }
    return null;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,    // becomes https://e.dadatadad.com once the proxy is live
    ui_host:  POSTHOG_UI_HOST, // needed with a proxy so toolbar/replay links point at PostHog

    // Opt into the modern SDK behaviours as a dated bundle: history_change
    // pageviews, strict minimum recording duration, rage-click ignorelist,
    // <head> script injection, debounced persistence, streamed network bodies.
    defaults: '2026-08-30',

    // Only create billable person profiles for identified users. This site
    // doesn't identify anyone, so events stay anonymous (and cheaper).
    person_profiles: 'identified_only',
    capture_pageleave: true,  // $pageleave for time-on-page / bounce
    capture_dead_clicks: true,
    capture_heatmaps: true,

    // Error tracking. Also enabled server-side; set explicitly here so it
    // never silently depends on remote config.
    capture_exceptions: {
      capture_unhandled_errors:     true,
      capture_unhandled_rejections: true,
      capture_console_errors:       false,
    },

    // Core Web Vitals ($web_vitals) + network timing in replay.
    capture_performance: {
      web_vitals: true,
      network_timing: true,
      web_vitals_allowed_metrics: ['LCP', 'CLS', 'FCP', 'INP'],
    },

    session_recording: {
      maskAllInputs: true,  // privacy: never record what's typed into inputs
      // Canvas capture is driven by PostHog → Settings → Session replay so the
      // fps/quality can be tuned without a deploy. The p5 <canvas> IS the UI
      // here, so without it every recording is a blank screen.
      // To pin it in code instead:
      //   captureCanvas: { recordCanvas: true, canvasFps: 4, canvasQuality: '0.4' },
    },

    loaded: (ph) => {
      // Super properties — attached to every event from this browser, so any
      // insight can be broken down by device/layout/release.
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

/** Report a caught error (React error boundaries etc.) to error tracking. */
export function captureException(error, props) {
  if (initialized) posthog.captureException(error, props);
}

/**
 * Initialize PostHog and wire it to the EventBus. Mirrors initGA4Tracking().
 * Returns a cleanup function that unsubscribes all listeners.
 */
export function initPostHogTracking() {
  if (!initPostHog()) return () => {};

  const unsubs = [];

  let currentShots = 0;
  let currentMakes = 0;
  unsubs.push(
    bus.on('stats:update', ({ shots, makes }) => {
      currentShots = shots;
      currentMakes = makes;
    }),
  );

  const accuracy = () =>
    currentShots > 0 ? Math.round((currentMakes / currentShots) * 100) : 0;

  // Per-ball launch
  unsubs.push(
    bus.on('ball:launched', ({ name, category, ballLaunches, ballMakes }) => {
      capture('ball_launch', {
        project_name: name,
        project_category: category,
        ball_launches: ballLaunches,
        ball_makes: ballMakes,
        total_shots: currentShots,
        total_makes: currentMakes,
        accuracy: accuracy(),
      });
    }),
  );

  // Per-ball score
  unsubs.push(
    bus.on('ball:scored', ({ name, category, ballLaunches, ballMakes }) => {
      capture('ball_score', {
        project_name: name,
        project_category: category,
        ball_launches: ballLaunches,
        ball_makes: ballMakes,
        total_shots: currentShots,
        total_makes: currentMakes,
        accuracy: accuracy(),
      });
    }),
  );

  // Detail modal opened
  unsubs.push(
    bus.on('detail:open', (data) => {
      capture('detail_open', {
        project_name: data.name || 'unknown',
        project_link: data.link || '',
      });
    }),
  );

  // Detail modal closed
  unsubs.push(bus.on('detail:close', () => capture('detail_close')));

  // CTA clicked
  unsubs.push(
    bus.on('cta:click', ({ name, link, category }) => {
      capture('cta_click', {
        project_name: name || 'unknown',
        project_link: link || '',
        project_category: category || '',
      });
    }),
  );

  // Loading complete — the metric that matches "the site feels slow"
  unsubs.push(
    bus.on('load:complete', () => {
      capture('portfolio_loaded', {
        load_time_ms: Math.round(performance.now()),
      });
    }),
  );

  // Game reset. NOTE: nothing emits 'game:reset' today (there is no reset
  // control in the UI) — Game._onReset() is wired and waiting. Kept so a
  // future reset button is instrumented the moment it lands.
  unsubs.push(bus.on('game:reset', () => capture('game_reset')));

  // First-impact (shot chart heatmap)
  unsubs.push(
    bus.on('impact:first', (data) => {
      capture('ball_impact', {
        ball_name:     data.ballName,
        ball_category: data.ballCategory,
        hit_type:      data.hitType,
        is_goal:       data.isGoal ? 'true' : 'false',
        impact_x:      data.x,
        impact_y:      data.y,
        shot_number:   data.shotNumber,
      });
    }),
  );

  // Time to first interaction — how long before a visitor actually plays
  let firstLaunchSent = false;
  unsubs.push(
    bus.on('ball:launched', () => {
      if (firstLaunchSent) return;
      firstLaunchSent = true;
      capture('first_launch', { ms_since_navigation: Math.round(performance.now()) });
    }),
  );

  // Miss hint shown (3 consecutive misses) — a struggling-visitor signal
  unsubs.push(
    bus.on('miss:hint', (show) => { if (show) capture('miss_hint_shown'); }),
  );

  // Frame-rate sample, emitted once by Game.js ~30s after load
  unsubs.push(bus.on('perf:sample', (s) => capture('game_perf', s)));

  return () => unsubs.forEach((fn) => fn());
}

export default posthog;
