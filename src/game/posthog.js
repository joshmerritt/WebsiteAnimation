/**
 * posthog.js — PostHog product analytics for DaDataDad.com
 *
 * Runs alongside GA4 (see ga4.js). Initializes posthog-js with autocapture,
 * automatic pageviews, and session replay, then subscribes to the same
 * EventBus game events GA4 listens to and forwards them as PostHog events.
 *
 * Event names + property keys mirror ga4.js so the two tools stay comparable.
 *
 * Gracefully no-ops if VITE_POSTHOG_KEY isn't set (local dev without a key,
 * forks, ad-blockers) so a missing analytics key never breaks the app.
 */

import posthog from 'posthog-js';
import bus from './EventBus.js';

const POSTHOG_KEY  = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let initialized = false;

/**
 * Initialize the PostHog SDK once. Returns the posthog instance, or null if
 * no key is configured (in which case all tracking below silently no-ops).
 */
export function initPostHog() {
  if (initialized) return posthog;
  if (typeof window === 'undefined') return null;
  if (!POSTHOG_KEY) {
    if (import.meta.env.DEV) {
      console.info('posthog: VITE_POSTHOG_KEY not set — PostHog disabled.');
    }
    return null;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // Only create billable person profiles for identified users. This site
    // doesn't identify anyone, so events stay anonymous (and cheaper).
    person_profiles: 'identified_only',
    capture_pageview: true,   // automatic $pageview on load + SPA navigations
    capture_pageleave: true,  // $pageleave for time-on-page / bounce
    autocapture: true,        // automatic clicks/inputs on DOM elements
    session_recording: {
      maskAllInputs: true,    // privacy: never record what's typed into inputs
    },
    // NOTE: session replay must ALSO be toggled on in PostHog project settings
    // (Settings → Session replay → "Record user sessions").
  });

  initialized = true;
  return posthog;
}

function capture(event, props) {
  if (initialized) posthog.capture(event, props);
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

  // Loading complete
  unsubs.push(
    bus.on('load:complete', () => {
      capture('portfolio_loaded', {
        load_time_ms: Math.round(performance.now()),
      });
    }),
  );

  // Game reset
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

  return () => unsubs.forEach((fn) => fn());
}

export default posthog;
