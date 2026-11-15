/**
 * session.js — The viewer's own session, read from their browser.
 *
 * The game keeps a local record of the current visitor's shots (see
 * src/game/sessionBridge.js): two localStorage keys, meant to last 24 hours.
 * The dashboard reads them directly, so "my session" appears instantly, needs
 * no network, and is never sent anywhere.
 *
 * Because the game and the dashboard are the same origin, a `storage` event
 * fires here whenever the game writes — so with the playground open in another
 * tab, shots appear on the dashboard as they are taken.
 *
 * Three things the stored data does NOT guarantee, each handled below:
 *
 *   · Expiry. The game prunes old records only when the game page loads. Open
 *     just the dashboard a week later and last week's shots are still there, so
 *     the 24-hour limit is applied again on read.
 *   · Agreement. The running counters and the per-shot records expire on
 *     different clocks (the counters from the first visit, each record from its
 *     own time), so one can be reset while the other survives. The larger of
 *     the two is the truth: a shot is never un-taken.
 *   · What "scored" means. Only `isGoal` does: it is set when the shot scores.
 *     `hitType: 'menu'` alone is just a first contact with a category bar.
 */

const IMPACT_KEY = '__dadatadad_impacts';
const BRIDGE_KEY = '__dadatadad_bridge';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;   // the same 24 hours sessionBridge.js uses

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

function parse(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;   // private mode, blocked storage, or a corrupt value
  }
}

/**
 * @param {number} [now]  for tests
 * @returns {{ counts: {shots:number, makes:number, opens:number, ctas:number},
 *             shots: Array, plotted: Array, byBall: Array,
 *             startedAt: number|null, lastUpdated: number|null } | null}
 *   null when the visitor has no recorded play in the last 24 hours.
 */
export function readSession(now = Date.now()) {
  const cutoff = now - MAX_AGE_MS;

  const stored = parse(BRIDGE_KEY, null);
  const bridge = stored && typeof stored === 'object' && finite(stored.startedAt) && stored.startedAt > cutoff
    ? stored
    : null;

  const impacts = parse(IMPACT_KEY, []);
  const records = (Array.isArray(impacts) ? impacts : [])
    .filter((r) => r && typeof r === 'object' && finite(r.timestamp) && r.timestamp > cutoff);

  // One record per shot. It starts as hitType 'launch' with no position, gains
  // coordinates at first contact, and gets isGoal when the shot scores.
  const shots = records.map((r) => {
    const made = r.isGoal === true;
    // A make overwrites hitType with 'menu' / 'Menu_final'. firstHit, written
    // at first contact, still holds what the ball touched first; records from
    // before that field existed lose it for shots that went on to score.
    const overwritten = r.hitLabel === 'Menu_final';
    const hit = r.firstHit || (r.hitType && r.hitType !== 'launch' && !overwritten ? r.hitType : 'unknown');
    return {
      x: finite(r.x) ? r.x : null,
      y: finite(r.y) ? r.y : null,
      vw: finite(r.vpWidth) ? r.vpWidth : null,
      vh: finite(r.vpHeight) ? r.vpHeight : null,
      ball: typeof r.ballName === 'string' ? r.ballName : '',
      hit,
      made,
      n: finite(r.shotNumber) ? r.shotNumber : null,
      at: r.timestamp,
    };
  });

  const count = (key) => (finite(bridge?.[key]) ? bridge[key] : 0);
  const counts = {
    shots: Math.max(count('shots'), shots.length),
    makes: Math.max(count('makes'), shots.filter((s) => s.made).length),
    opens: count('opens'),
    ctas:  count('ctaClicks'),
  };
  if (counts.shots === 0 && counts.opens === 0) return null;

  const byName = new Map();
  for (const s of shots) {
    if (!s.ball) continue;
    const b = byName.get(s.ball) || { ball: s.ball, launches: 0, scores: 0 };
    b.launches++;
    if (s.made) b.scores++;
    byName.set(s.ball, b);
  }

  return {
    counts,
    shots,
    // Only shots that touched something have a position to plot.
    plotted: shots.filter((s) => s.x != null && s.y != null && s.vw > 0 && s.vh > 0),
    byBall: [...byName.values()].sort((a, b) => b.launches - a.launches),
    startedAt: bridge ? bridge.startedAt : null,
    lastUpdated: finite(bridge?.lastUpdated) ? bridge.lastUpdated : null,
  };
}

/** Call `onChange` whenever the session may have changed. Returns an unsubscribe. */
export function watchSession(onChange) {
  const onStorage = (e) => {
    // e.key is null when storage is cleared wholesale.
    if (e.key === null || e.key === IMPACT_KEY || e.key === BRIDGE_KEY) onChange();
  };
  // `storage` only fires for writes made by OTHER tabs. Coming back to this tab
  // re-reads too, which covers playing in this tab and navigating back.
  const onVisible = () => { if (document.visibilityState === 'visible') onChange(); };
  const onShow = () => onChange();

  window.addEventListener('storage', onStorage);
  window.addEventListener('pageshow', onShow);
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('pageshow', onShow);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
