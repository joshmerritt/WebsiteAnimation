/**
 * session.js reads what sessionBridge.js wrote to localStorage. These tests
 * feed it records in exactly the shapes the game writes, including the awkward
 * ones: records older than a day, counters reset while shots survive, and a
 * first contact with a category bar that never became a goal.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const NOW = Date.parse('2026-11-14T20:00:00Z');
const HOUR = 60 * 60 * 1000;

// A stand-in for the browser's localStorage, installed before session.js is used.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const { readSession } = await import('./session.js');

const put = (impacts, bridge) => {
  store.clear();
  if (impacts) store.set('__dadatadad_impacts', JSON.stringify(impacts));
  if (bridge) store.set('__dadatadad_bridge', JSON.stringify(bridge));
};

/** A record as sessionBridge leaves it after: launch → first contact [→ score]. */
const shot = (n, { hit = 'net', scored = false, ago = HOUR, x = 0.2, y = 0.4, firstHit = hit } = {}) => ({
  ballId: 'SiteAnalytics', ballName: 'Site Analytics', ballCategory: 'Technology',
  hitType: scored ? 'menu' : hit,
  hitLabel: scored ? 'Menu_final' : hit,
  ...(firstHit ? { firstHit } : {}),
  isGoal: scored,
  x, y, px: 256, py: 320, vpWidth: 1280, vpHeight: 800,
  shotNumber: n, timestamp: NOW - ago,
});
const bridge = (over = {}) => ({ startedAt: NOW - 2 * HOUR, shots: 0, makes: 0, opens: 0, ctaClicks: 0, visitors: 1, lastUpdated: NOW - HOUR, ...over });

test('no stored play means no session', () => {
  put(null, null);
  assert.equal(readSession(NOW), null);
  put([], bridge());
  assert.equal(readSession(NOW), null, 'a visit with no shots and no opens is not a session');
});

test('a normal session: counts, plotted shots and outcomes', () => {
  put(
    [shot(1, { hit: 'wall' }), shot(2, { hit: 'net' }), shot(3, { hit: 'wall', scored: true })],
    bridge({ shots: 3, makes: 1, opens: 2, ctaClicks: 1 }),
  );
  const s = readSession(NOW);
  assert.deepEqual(s.counts, { shots: 3, makes: 1, opens: 2, ctas: 1 });
  assert.equal(s.plotted.length, 3);
  assert.deepEqual(s.plotted.map((p) => p.made), [false, false, true]);
  assert.equal(s.plotted[2].hit, 'wall', 'a make keeps what the ball touched first');
  assert.deepEqual([s.plotted[0].vw, s.plotted[0].vh], [1280, 800]);
});

test('records older than 24 hours are ignored, even though the game has not pruned them', () => {
  // The game only prunes when ITS page loads. Opening just the dashboard days
  // later must not present last week as "my session".
  put([shot(1, { ago: 9 * 24 * HOUR }), shot(2, { ago: 30 * HOUR })], bridge({ startedAt: NOW - 9 * 24 * HOUR, shots: 2 }));
  assert.equal(readSession(NOW), null);

  put([shot(1, { ago: 30 * HOUR }), shot(2, { ago: 2 * HOUR })], bridge({ startedAt: NOW - 30 * HOUR, shots: 2, opens: 5 }));
  const s = readSession(NOW);
  assert.equal(s.plotted.length, 1, 'only the recent shot');
  assert.deepEqual(s.counts, { shots: 1, makes: 0, opens: 0, ctas: 0 }, 'expired counters are not trusted');
});

test('counters reset by the game do not hide shots that are still on record', () => {
  // First visit > 24h ago, shots within the last day, then the game reloads:
  // the counters restart from zero while the per-shot records survive.
  put([shot(1), shot(2), shot(3, { scored: true })], bridge({ startedAt: NOW - HOUR / 2, shots: 0, makes: 0 }));
  const s = readSession(NOW);
  assert.deepEqual([s.counts.shots, s.counts.makes], [3, 1]);
  assert.equal(s.plotted.length, 3);
});

test('touching a category bar first is not a goal unless the shot scored', () => {
  put([shot(1, { hit: 'menu', scored: false })], bridge({ shots: 1, makes: 0 }));
  const s = readSession(NOW);
  assert.equal(s.plotted[0].made, false);
  assert.equal(s.plotted[0].hit, 'menu');
  assert.equal(s.counts.makes, 0);
});

test('a launch with no contact is counted but not plotted', () => {
  const launchOnly = { ...shot(2), hitType: 'launch', hitLabel: 'launch', firstHit: undefined, x: null, y: null, vpWidth: null, vpHeight: null };
  put([shot(1), launchOnly], bridge({ shots: 2 }));
  const s = readSession(NOW);
  assert.equal(s.counts.shots, 2);
  assert.equal(s.plotted.length, 1);
});

test('records written before firstHit existed still read sensibly', () => {
  put([shot(1, { hit: 'wall', firstHit: null }), shot(2, { hit: 'net', scored: true, firstHit: null })], bridge({ shots: 2, makes: 1 }));
  const s = readSession(NOW);
  assert.equal(s.plotted[0].hit, 'wall');
  assert.equal(s.plotted[1].hit, 'unknown', 'the first contact of an old made shot was overwritten and is gone');
  assert.equal(s.plotted[1].made, true);
});

test('corrupt or foreign values never throw', () => {
  store.clear();
  store.set('__dadatadad_impacts', '{not json');
  store.set('__dadatadad_bridge', '"a string"');
  assert.equal(readSession(NOW), null);

  put([null, 7, 'x', { timestamp: 'yesterday' }, shot(1)], { startedAt: 'never' });
  const s = readSession(NOW);
  assert.equal(s.plotted.length, 1);
  assert.equal(s.counts.shots, 1);
});
