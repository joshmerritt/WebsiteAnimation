/**
 * ga4.js — Google Analytics 4 event tracking for DaDataDad.com
 *
 * Listens to EventBus events and forwards them as GA4 custom events.
 * Gracefully no-ops if gtag isn't loaded (dev, ad-blockers, etc.).
 *
 * Custom events tracked:
 *   ball_launch     — user releases a ball with enough power
 *   ball_score      — ball collides with matching goal → detail opens
 *   detail_open     — project detail modal displayed
 *   detail_close    — modal dismissed
 *   portfolio_loaded — all images loaded, canvas ready
 */

import bus from './EventBus.js';

function gtag(...args) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag(...args);
  }
}

/** Send a GA4 custom event. */
function track(eventName, params = {}) {
  gtag('event', eventName, params);
}

/** Wire up all EventBus → GA4 listeners. Returns an unsubscribe function. */
export function initGA4Tracking() {
  const unsubs = [];

  // Track aggregate stats for accuracy calculation
  let currentShots = 0;
  let currentMakes = 0;
  unsubs.push(
    bus.on('stats:update', ({ shots, makes }) => {
      currentShots = shots;
      currentMakes = makes;
    }),
  );

  // Per-ball launch tracking (includes project_name for GA4 breakdown)
  unsubs.push(
    bus.on('ball:launched', ({ name, category }) => {
      track('ball_launch', {
        project_name: name,
        project_category: category,
        shot_number: currentShots,
        total_makes: currentMakes,
        accuracy: currentShots > 0 ? Math.round((currentMakes / currentShots) * 100) : 0,
      });
    }),
  );

  // Per-ball score tracking
  unsubs.push(
    bus.on('ball:scored', ({ name, category }) => {
      track('ball_score', {
        project_name: name,
        project_category: category,
        shot_number: currentShots,
        make_number: currentMakes,
        accuracy: currentShots > 0 ? Math.round((currentMakes / currentShots) * 100) : 0,
      });
    }),
  );

  // Detail modal opened
  unsubs.push(
    bus.on('detail:open', (data) => {
      track('detail_open', {
        project_name: data.name || 'unknown',
        project_link: data.link || '',
      });
    }),
  );

  // Detail modal closed
  unsubs.push(
    bus.on('detail:close', () => {
      track('detail_close');
    }),
  );

  // Loading complete (measures load performance)
  unsubs.push(
    bus.on('load:complete', () => {
      track('portfolio_loaded', {
        load_time_ms: Math.round(performance.now()),
      });
    }),
  );

  return () => unsubs.forEach((fn) => fn());
}
