/**
 * ga4.js — Google Analytics 4 event tracking for DaDataDad.com
 *
 * Listens to EventBus events and forwards them as GA4 custom events.
 * Gracefully no-ops if gtag isn't loaded (dev, ad-blockers, etc.).
 *
 * Also maintains a localStorage-based "bridge" store that:
 *   1. Persists impact data across tabs (for the shot chart heatmap)
 *   2. Tracks session stats (shots, makes, opens, cta clicks) with timestamps
 *   3. Auto-expires data older than 24 hours
 *
 * The analytics dashboard reads this bridge data to fill the gap
 * between GA4's ~48hr processing lag and the current moment.
 */

import bus from './EventBus.js';

const IMPACT_KEY  = '__dadatadad_impacts';
const BRIDGE_KEY  = '__dadatadad_bridge';
const MAX_AGE_MS  = 24 * 60 * 60 * 1000; // 24 hours
const MAX_IMPACTS = 500; // Cap impact records to prevent localStorage bloat

// ═══════════════════════════════════════════════════════════════════════════
//  Impact Store — per-shot first-contact data for the shot chart
// ═══════════════════════════════════════════════════════════════════════════

const impactStore = {
  _data: [],

  _hydrate() {
    try {
      const stored = localStorage.getItem(IMPACT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) { this._data = []; this._persist(); return; }
        const cutoff = Date.now() - MAX_AGE_MS;
        this._data = parsed.filter(r => r && typeof r.timestamp === 'number' && r.timestamp > cutoff);
        // Re-persist if we pruned anything
        if (this._data.length !== parsed.length) this._persist();
      }
    } catch (e) { console.warn('ga4: failed to hydrate impact store', e.message); }
  },

  _persist() {
    try {
      localStorage.setItem(IMPACT_KEY, JSON.stringify(this._data));
    } catch (e) { console.warn('ga4: failed to persist impacts', e.message); }
  },

  add(record) {
    this._data.push(record);
    // Cap stored records to prevent localStorage bloat
    if (this._data.length > MAX_IMPACTS) {
      this._data = this._data.slice(-MAX_IMPACTS);
    }
    this._persist();
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
    this._persist();
  },
};

// ═══════════════════════════════════════════════════════════════════════════
//  Bridge Stats — aggregated event counts to supplement GA4 lag
// ═══════════════════════════════════════════════════════════════════════════

const bridgeStats = {
  _data: null,

  _hydrate() {
    try {
      const stored = localStorage.getItem(BRIDGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate shape before accepting
        if (parsed && typeof parsed === 'object' && typeof parsed.startedAt === 'number') {
          this._data = parsed;
          // Expire if older than MAX_AGE
          if (Date.now() - this._data.startedAt > MAX_AGE_MS) {
            this._data = null;
            localStorage.removeItem(BRIDGE_KEY);
          }
        }
      }
    } catch (e) { console.warn('ga4: failed to hydrate bridge stats', e.message); }
    if (!this._data) {
      this._data = { startedAt: Date.now(), shots: 0, makes: 0, opens: 0, ctaClicks: 0, visitors: 1, lastUpdated: Date.now() };
      this._persist();
    }
  },

  _persist() {
    try {
      this._data.lastUpdated = Date.now();
      localStorage.setItem(BRIDGE_KEY, JSON.stringify(this._data));
    } catch (e) { console.warn('ga4: failed to persist bridge stats', e.message); }
  },

  addShot()     { this._data.shots++;     this._persist(); },
  addMake()     { this._data.makes++;     this._persist(); },
  addOpen()     { this._data.opens++;     this._persist(); },
  addCtaClick() { this._data.ctaClicks++; this._persist(); },

  get() { return this._data ? { ...this._data } : null; },

  clear() {
    this._data = { startedAt: Date.now(), shots: 0, makes: 0, opens: 0, ctaClicks: 0, visitors: 1, lastUpdated: Date.now() };
    this._persist();
  },
};

// Hydrate both stores on load
impactStore._hydrate();
bridgeStats._hydrate();

// Expose stores on window in dev only (for debugging via console)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__impactStore = impactStore;
  window.__impactData = impactStore._data;
  window.__bridgeStats = bridgeStats;
}

// ═══════════════════════════════════════════════════════════════════════════
//  GA4 Tracking
// ═══════════════════════════════════════════════════════════════════════════

function gtag(...args) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag(...args);
  }
}

function track(eventName, params = {}) {
  gtag('event', eventName, params);
}

export function initGA4Tracking() {
  const unsubs = [];

  let currentShots = 0;
  let currentMakes = 0;
  unsubs.push(
    bus.on('stats:update', ({ shots, makes }) => {
      currentShots = shots;
      currentMakes = makes;
    }),
  );

  // Per-ball launch
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
      bridgeStats.addShot();
    }),
  );

  // Per-ball score
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
      bridgeStats.addMake();
    }),
  );

  // Detail modal opened
  unsubs.push(
    bus.on('detail:open', (data) => {
      track('detail_open', {
        project_name: data.name || 'unknown',
        project_link: data.link || '',
      });
      bridgeStats.addOpen();
    }),
  );

  // Detail modal closed
  unsubs.push(
    bus.on('detail:close', () => {
      track('detail_close');
    }),
  );

  // CTA clicked
  unsubs.push(
    bus.on('cta:click', ({ name, link, category }) => {
      track('cta_click', {
        project_name: name || 'unknown',
        project_link: link || '',
        project_category: category || '',
      });
      bridgeStats.addCtaClick();
    }),
  );

  // Loading complete
  unsubs.push(
    bus.on('load:complete', () => {
      track('portfolio_loaded', {
        load_time_ms: Math.round(performance.now()),
      });
    }),
  );

  // Game reset
  unsubs.push(
    bus.on('game:reset', () => {
      track('game_reset');
      impactStore.clear();
      bridgeStats.clear();
    }),
  );

  // First-impact tracking
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

export { impactStore, bridgeStats };
