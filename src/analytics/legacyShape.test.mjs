/**
 * The v1–v3 dashboards read the worker's document through toLegacyShape().
 * These tests build a real document with the worker's own buildPayload() and
 * check the adapted shape those dashboards index into.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPayload } from '../../analytics-worker/aggregate.js';
import { toLegacyShape, dailyAverage } from './legacyShape.js';

const session = (over) => ({
  sid: 's', pid: 'p', day: '2026-11-14', days_ago: 0, started_unix: 1794700000, tz: 'UTC', duration_s: 60,
  pv_site: 1, pv_dash: 0, pv_portfolio: 0, loads: 1, shots: 0, makes: 0, opens: 0, ctas: 0, hints: 0,
  device: 'Desktop', country: 'United States', referrer: '$direct',
  load_ms: null, first_shot_ms: null, fps_avg: null, fps_min: null, lcp: null, fcp: null, inp: null, cls: null,
  ...over,
});

const DOC = buildPayload({
  sessions: [
    session({ sid: 'a', pid: 'p1', days_ago: 2, day: '2026-11-12', shots: 4, makes: 1, opens: 2, ctas: 1, duration_s: 120 }),
    session({ sid: 'b', pid: 'p2', days_ago: 2, day: '2026-11-12', duration_s: 3, loads: 0, referrer: 'www.linkedin.com', country: 'Canada' }),
    session({ sid: 'c', pid: 'p1', days_ago: 40, day: '2026-10-05', pv_site: 2, pv_portfolio: 1 }),
  ],
  ballDays: [
    { days_ago: 2, ball: 'Site Analytics', launches: 4, scores: 1, opens: 1, ctas: 1 },
    { days_ago: 2, ball: 'A Project That Was Renamed', launches: 0, scores: 0, opens: 1, ctas: 0 },
  ],
  shots: [],
}, { now: new Date('2026-11-14T20:00:00Z'), epochUtc: '2026-09-13 16:15:00' });

test('every range has one row per day, so no chart is ever handed fewer than two points', () => {
  for (const days of [7, 30, 90]) {
    const legacy = toLegacyShape(DOC, days);
    assert.equal(legacy.timeSeries.length, days);
    assert.equal(legacy.isLive, true);
  }
});

test('a daily row carries the fields v1–v3 read', () => {
  const day = toLegacyShape(DOC, 7).timeSeries.find((d) => d.date === '2026-11-12');
  assert.deepEqual(day, {
    date: '2026-11-12', label: 'Nov 12',
    visitors: 2, visits: 2, pageviews: 2,
    avgDuration: 62,          // (120 + 3) / 2, rounded
    bounceRate: 50,           // one of the two visits bounced
    ballInteractions: 4, ctaClicks: 1,
  });
  const quiet = toLegacyShape(DOC, 7).timeSeries[0];
  assert.deepEqual([quiet.visitors, quiet.bounceRate, quiet.avgDuration], [0, 0, 0]);
});

test('range averages are weighted by visits, so quiet days do not drag them down', () => {
  const rows = toLegacyShape(DOC, 90).timeSeries;
  assert.equal(rows.length, 90);
  // Two days had traffic: Nov 12 (2 visits, avg 62 s, 50% bounce) and Oct 5 (1 visit, 60 s, 0%).
  assert.equal(dailyAverage(rows, 'avgDuration'), 61);       // (62×2 + 60×1) / 3
  assert.equal(dailyAverage(rows, 'bounceRate'), 33);        // (50×2 + 0×1) / 3
  // The plain mean over 90 rows these dashboards used to take:
  assert.equal(Math.round(rows.reduce((a, d) => a + d.avgDuration, 0) / rows.length), 1);

  assert.equal(dailyAverage([], 'avgDuration'), 0);
  assert.equal(dailyAverage(toLegacyShape(DOC, 7).timeSeries.slice(0, 2), 'avgDuration'), 0, 'no visits → 0, not NaN');
  // Mock rows carry visitors but no visits.
  assert.equal(dailyAverage([{ visitors: 1, avgDuration: 10 }, { visitors: 3, avgDuration: 50 }], 'avgDuration'), 40);
});

test('sources, geography and pages are shares of the range', () => {
  const legacy = toLegacyShape(DOC, 7);
  assert.deepEqual(legacy.sources.map((s) => [s.source, s.visits, s.pct]), [['Direct', 1, 50], ['LinkedIn', 1, 50]]);
  assert.ok(legacy.sources.every((s) => /^#[0-9A-F]{6}$/i.test(s.color)));
  assert.deepEqual(legacy.geography.map((g) => [g.country, g.users, g.sessions, g.pct]), [['Canada', 1, 1, 50], ['United States', 1, 1, 50]]);
  assert.deepEqual(legacy.pages.map((p) => [p.path, p.views]), [['/', 2]]);
  assert.match(legacy.pages[0].avgTime, /^\d+:\d{2}$/);

  // 90 days adds the visit that also viewed the accessible portfolio.
  assert.deepEqual(toLegacyShape(DOC, 90).pages.map((p) => [p.path, p.views]), [['/', 3], ['/portfolio.html', 1]]);
});

test('projects are matched by name, and an unknown name still renders', () => {
  const [known, unknown] = toLegacyShape(DOC, 7).ballEvents;
  assert.deepEqual(known, {
    ball: 'Site Analytics', id: 'SiteAnalytics', clicks: 4, launches: 4, scores: 1, opens: 1, ctaClicks: 1,
    color: '#5985B1', category: 'Technology',
  });
  assert.equal(unknown.ball, 'A Project That Was Renamed');
  assert.equal(unknown.id, 'A Project That Was Renamed');
  assert.equal(unknown.category, 'Other');
  assert.match(unknown.color, /^#[0-9A-F]{6}$/i);
});

test('an unsupported range falls back to the longest one instead of crashing', () => {
  assert.equal(toLegacyShape(DOC, 365).timeSeries.length, 90);
});
