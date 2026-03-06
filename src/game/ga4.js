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
 *   cta_click       — user clicks the CTA link in the detail modal
 *   ball_impact     — first collision after launch (wall/net/goal/menu/ball)
 *   portfolio_loaded — all images loaded, canvas ready
 */

import bus from './EventBus.js';

/**
 * Session-level impact data store.
 * Accessible via window.__impactData and window.__impactStore
 */
const impactStore = {
  _data: [],
  add(record) {
    this._data.push(record);
    if (typeof window !== 'undefined') window.__impactData = this._data;
  },
  getAll() { return [...this._data]; },
  getByBall(ballId) { return this._data.filter(r => r.ballId === ballId); },
  getSummary() {
    const total = this._data.length;
    const goals = this._data.filter(r => r.isGoal).length;
    const byType = {};
    this._data.forEach(r => { byType[r.hitType] = (byType[r.hitType] || 0) + 1; });
    return { total, goals, accuracy: total > 0 ? Math.round((goals / total) * 100) : 0, byType };
  },
  clear() {
    this._data = [];
    if (typeof window !== 'undefined') window.__impactData = this._data;
  },
};

if (typeof window !== 'undefined') {
  window.__impactStore = impactStore;
  window.__impactData = impactStore._data;
}

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
    bus.on('ball:launched', ({ name, category, ballLaunches, ballMakes }) => {
      track('ball_launch', {
        project_name: name,
        project_category: category,
        ball_launches: ballLaunches,
        ball_makes: ballMakes,
        total_shots: currentShots,
        total_makes: currentMakes,
        accuracy: currentShots > 0 ? Math.round((currentMakes / currentShots) * 100) : 0,
      });
    }),
  );

  // Per-ball score tracking
  unsubs.push(
    bus.on('ball:scored', ({ name, category, ballLaunches, ballMakes }) => {
      track('ball_score', {
        project_name: name,
        project_category: category,
        ball_launches: ballLaunches,
        ball_makes: ballMakes,
        total_shots: currentShots,
        total_makes: currentMakes,
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

  // CTA clicked from detail modal
  unsubs.push(
    bus.on('cta:click', ({ name, link, category }) => {
      track('cta_click', {
        project_name: name || 'unknown',
        project_link: link || '',
        project_category: category || '',
      });
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

  // Game reset — clear impact data for fresh session
  unsubs.push(
    bus.on('game:reset', () => {
      track('game_reset');
      impactStore.clear();
    }),
  );

  // ── First-impact tracking ──
  unsubs.push(
    bus.on('impact:first', (data) => {
      impactStore.add(data);
      track('ball_impact', {
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

export { impactStore };
