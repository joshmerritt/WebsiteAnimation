/**
 * legacyShape.js — The worker's document, as the shape v1–v3 were written against.
 *
 * Pure, with no Vite-only imports, so it can be tested with plain Node
 * (legacyShape.test.mjs). data.js is the only caller.
 */

import { projectByName, PAGE_LABELS } from './v4/meta.js';
import { fmtDay } from './v4/format.js';

const PALETTE = ['#D4A843', '#5985B1', '#6B9F6B', '#C05050', '#BF360C', '#4285F4', '#8B1A32', '#C9D1D9'];
const SOURCE_COLORS = { Direct: '#6B9F6B', LinkedIn: '#0A66C2', Google: '#4285F4', GitHub: '#C9D1D9', Upwork: '#14A800', Bing: '#008373' };
const BALL_COLORS = {
  aboutMe: '#6B9F6B', powerBIMetrics: '#D4A843', thewineyoudrink: '#8B1A32', dartleague: '#5985B1',
  arduinoCoopDoor: '#BF360C', SiteAnalytics: '#5985B1', googleDataStudioServiceTechs: '#4285F4', thisWebsite: '#5985B1',
};
const PAGE_PATHS = { playground: '/', portfolio: '/portfolio.html', dashboards: '/analytics-*.html' };

/**
 * A per-day figure (average duration, bounce rate) averaged over a range,
 * weighted by each day's visits.
 *
 * v1–v3 used to take a plain mean over the rows, which was fine when the worker
 * returned only days that had traffic. The series is zero-filled now — one row
 * per calendar day — and a plain mean would count every quiet day as "0 seconds,
 * 0% bounce": 70 s of real average duration came out as 5 s.
 */
export function dailyAverage(rows, key) {
  let total = 0;
  let weight = 0;
  for (const d of rows || []) {
    const w = d.visits ?? d.visitors ?? 0;   // mock rows have visitors only
    total += (d[key] || 0) * w;
    weight += w;
  }
  return weight > 0 ? Math.round(total / weight) : 0;
}

const share = (part, whole) => (whole > 0 ? parseFloat(((part / whole) * 100).toFixed(1)) : 0);
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;

/**
 * The worker's document, as the shape v1–v3 were written against:
 *   timeSeries[] { date, label, visitors, pageviews, avgDuration, bounceRate, ballInteractions, ctaClicks }
 *   sources[]    { source, visits, pct, color }
 *   pages[]      { path, title, views, avgTime, trend }
 *   ballEvents[] { ball, id, clicks, launches, scores, opens, ctaClicks, color, category }
 *   geography[]  { country, users, sessions, pct }
 *
 * The daily series is zero-filled, so it always has one row per day of the
 * range. That matters: v3 used to crash when a range came back with fewer than
 * two rows.
 */
export function toLegacyShape(data, days) {
  const window = data.windows.includes(days) ? days : data.windows[data.windows.length - 1];
  const range = data.ranges[window];
  const visits = range.sources.reduce((a, s) => a + s.visits, 0);
  const visitors = range.countries.reduce((a, c) => a + c.visitors, 0);

  return {
    timeSeries: data.days.slice(-window).map((d) => ({
      date: d.date,
      label: fmtDay(d.date),
      visitors: d.visitors,
      visits: d.visits,           // the weight for dailyAverage()
      pageviews: d.pageviews,
      avgDuration: d.avgDurationSec,
      bounceRate: d.visits ? Math.round((d.bounces / d.visits) * 100) : 0,
      ballInteractions: d.shots,
      ctaClicks: d.ctas,
    })),
    sources: range.sources.map((s, i) => ({
      source: s.name, visits: s.visits, pct: share(s.visits, visits),
      color: SOURCE_COLORS[s.name] || PALETTE[i % PALETTE.length],
    })),
    pages: range.pages.filter((p) => p.views > 0).map((p) => ({
      path: PAGE_PATHS[p.key] || p.key, title: PAGE_LABELS[p.key] || p.key, views: p.views,
      avgTime: clock(range.totals.avgDurationSec), trend: 0,
    })),
    ballEvents: range.balls.map((b, i) => {
      const project = projectByName(b.ball);
      return {
        ball: b.ball, id: project.id,
        clicks: b.launches,   // v1 called launches "clicks"
        launches: b.launches, scores: b.scores, opens: b.opens, ctaClicks: b.ctas,
        color: BALL_COLORS[project.id] || PALETTE[i % PALETTE.length],
        category: project.category || 'Other',
      };
    }),
    geography: range.countries.map((c) => ({
      country: c.name, users: c.visitors, sessions: c.visits, pct: share(c.visitors, visitors),
    })),
    isLive: true,
  };
}
