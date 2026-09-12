/**
 * sessionBridge.js — Local, per-browser record of the current visitor's session
 *
 * Two localStorage-backed stores, both capped and auto-expiring after 24h:
 *   __dadatadad_impacts — one record per shot (first-contact coordinates,
 *                         later finalised as make/miss) for the shot chart
 *   __dadatadad_bridge  — running counts: shots, makes, opens, cta clicks
 *
 * `AnalyticsDashboardV3` reads both keys directly to render the "your session"
 * view of the shot chart, which no warehouse query can provide: these are the
 * viewer's own interactions, available instantly and without a round trip.
 *
 * This used to live inside ga4.js, but it was never GA4-specific — it is
 * local browser state that happens to be fed by the same EventBus events. It
 * was extracted when GA4 was removed so the shot chart kept working.
 *
 * Everything here is best-effort: storage can be unavailable (private mode,
 * embedded webviews) and every access is guarded.
 */

import bus from './EventBus.js';

const IMPACT_KEY  = '__dadatadad_impacts';
const BRIDGE_KEY  = '__dadatadad_bridge';
const MAX_AGE_MS  = 24 * 60 * 60 * 1000; // 24 hours
const MAX_IMPACTS = 500; // Cap impact records to prevent localStorage bloat


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
    } catch (e) { console.warn('sessionBridge: failed to hydrate impact store', e.message); }
  },

  _persist() {
    try {
      localStorage.setItem(IMPACT_KEY, JSON.stringify(this._data));
    } catch (e) { console.warn('sessionBridge: failed to persist impacts', e.message); }
  },

  add(record) {
    if (!record || typeof record !== 'object') return;
    const shotNumber = typeof record.shotNumber === 'number' ? record.shotNumber : null;

    // Ensure one impact record per shot: later updates (e.g., score resolution)
    // replace the initial first-contact snapshot for that same shot.
    if (shotNumber != null) {
      const idx = this._data.findIndex((r) => r && r.shotNumber === shotNumber);
      if (idx >= 0) {
        const prev = this._data[idx];
        const merged = { ...prev, ...record };
        // Preserve first-impact coordinates if a later update omits them.
        ['x', 'y', 'px', 'py', 'vpWidth', 'vpHeight'].forEach((k) => {
          if (record[k] == null && prev[k] != null) merged[k] = prev[k];
        });
        this._data[idx] = merged;
      } else this._data.push(record);
    } else {
      this._data.push(record);
    }
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
//  Bridge Stats — running counts for the current visitor session
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
    } catch (e) { console.warn('sessionBridge: failed to hydrate bridge stats', e.message); }
    if (!this._data) {
      this._data = { startedAt: Date.now(), shots: 0, makes: 0, opens: 0, ctaClicks: 0, visitors: 1, lastUpdated: Date.now() };
      this._persist();
    }
  },

  _persist() {
    try {
      this._data.lastUpdated = Date.now();
      localStorage.setItem(BRIDGE_KEY, JSON.stringify(this._data));
    } catch (e) { console.warn('sessionBridge: failed to persist bridge stats', e.message); }
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

/** Map a ball's display name back to its project id (see src/data/projects.js). */
function nameToBallId(name) {
  const map = {
    'Josh Merritt': 'aboutMe',
    'Microsoft Power BI': 'powerBIMetrics',
    'The Wine You Drink': 'thewineyoudrink',
    'Black Sheep Dart League': 'dartleague',
    'Smart Chicken Coop': 'arduinoCoopDoor',
    'Site Analytics': 'SiteAnalytics',
    'Google Data Studio Streaming Dashboard': 'googleDataStudioServiceTechs',
    'Google Data Studio': 'googleDataStudioServiceTechs',
    'Portfolio Website': 'thisWebsite',
  };
  return map[name] || name;
}

/**
 * Subscribe the local stores to the EventBus.
 * Returns a cleanup function that unsubscribes all listeners.
 */
export function initSessionBridge() {
  const unsubs = [];

  // Per-ball launch — count the shot and seed a record that is finalised
  // later, when the shot resolves and we know make vs miss.
  unsubs.push(
    bus.on('ball:launched', ({ name, category, shotNumber }) => {
      bridgeStats.addShot();
      if (typeof shotNumber === 'number') {
        impactStore.add({
          ballId:       nameToBallId(name),
          ballName:     name,
          ballCategory: category,
          hitType:      'launch',
          hitLabel:     'launch',
          isGoal:       false,
          x: null, y: null, px: null, py: null,
          vpWidth: null, vpHeight: null,
          shotNumber,
          timestamp:    Date.now(),
        });
      }
    }),
  );

  // Per-ball score — finalise this shot as a make.
  unsubs.push(
    bus.on('ball:scored', ({ name, category, shotNumber }) => {
      bridgeStats.addMake();
      if (typeof shotNumber === 'number') {
        impactStore.add({
          ballId:       nameToBallId(name),
          ballName:     name,
          ballCategory: category,
          hitType:      'menu',
          hitLabel:     'Menu_final',
          isGoal:       true,
          x: null, y: null, px: null, py: null,
          vpWidth: null, vpHeight: null,
          shotNumber,
          timestamp:    Date.now(),
        });
      }
    }),
  );

  unsubs.push(bus.on('detail:open', () => bridgeStats.addOpen()));
  unsubs.push(bus.on('cta:click',   () => bridgeStats.addCtaClick()));

  // First contact — keep the coordinates, but don't trust first-contact goal
  // classification until shot resolution updates it.
  unsubs.push(
    bus.on('impact:first', (data) => impactStore.add({ ...data, isGoal: false })),
  );

  // Reset clears the visitor's local session view.
  unsubs.push(
    bus.on('game:reset', () => { impactStore.clear(); bridgeStats.clear(); }),
  );

  return () => unsubs.forEach((fn) => fn());
}

export { impactStore, bridgeStats };
