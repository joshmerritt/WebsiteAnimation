/**
 * data.js — Analytics data for DaDataDad.com
 *
 * Fetches live data from the Cloudflare Worker proxy (GA4 Data API).
 * Falls back to deterministic mock data if the fetch fails.
 *
 * In production, the worker URL should match your deployed endpoint.
 */

// ── Worker endpoint ─────────────────────────────────────────────────────
const GA4_WORKER_URL = 'https://ga4-analytics-api.dadatadad-analytics.workers.dev';

/**
 * Fetch live analytics data from the GA4 Cloudflare Worker.
 * Returns { timeSeries, sources, pages, ballEvents, isLive: true }
 * or null if the fetch fails.
 */
export async function fetchGA4Data(days = 90) {
  try {
    const res = await fetch(`${GA4_WORKER_URL}?days=${days}`);
    if (!res.ok) throw new Error(`Worker responded ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return { ...data, isLive: true };
  } catch (err) {
    console.warn('GA4 live fetch failed, using mock data:', err.message);
    return null;
  }
}


// ═══════════════════════════════════════════════════════════════════════════
//  Mock / fallback data (kept for offline dev & graceful degradation)
// ═══════════════════════════════════════════════════════════════════════════

// ── Seeded pseudo-random for deterministic "mock" data ──────────────────
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateTimeSeriesData(days = 90) {
  const now = new Date();
  const data = [];
  const rand = seededRandom(42);

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const base = isWeekend ? 18 : 32;
    const trend = Math.max(0, (days - i) * 0.25);
    const noise = (rand() - 0.5) * 20;
    const spike = (i === 10 || i === 35 || i === 60) ? 55 : 0;
    const raw = base + trend + noise + spike;

    const visitors = Math.round(Math.max(5, raw));
    const avgPagesPerVisit = 1.8 + rand() * 1.4;

    data.push({
      date: date.toISOString().split('T')[0],
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      visitors,
      pageviews: Math.round(visitors * avgPagesPerVisit),
      avgDuration: Math.round(35 + rand() * 200),
      bounceRate: Math.round(25 + rand() * 40),
      ballInteractions: Math.round(visitors * (0.4 + rand() * 0.3)),
    });
  }
  return data;
}

// ── Traffic sources ─────────────────────────────────────────────────────
export const REFERRER_DATA = [
  { source: 'LinkedIn',       visits: 287, pct: 33.8, color: '#0A66C2' },
  { source: 'Google Search',  visits: 198, pct: 23.3, color: '#4285F4' },
  { source: 'Direct',         visits: 172, pct: 20.3, color: '#6B9F6B' },
  { source: 'GitHub',         visits: 108, pct: 12.7, color: '#C9D1D9' },
  { source: 'Upwork',         visits: 84,  pct: 9.9,  color: '#14A800' },
];

// ── Top pages ───────────────────────────────────────────────────────────
export const PAGE_DATA = [
  { path: '/',                  title: 'Home (Physics Playground)',    views: 849,  avgTime: '1:48', trend: 15 },
  { path: '/detail/powerBI',    title: 'Microsoft Power BI',          views: 312,  avgTime: '2:42', trend: 22 },
  { path: '/detail/wine',       title: 'The Wine You Drink',          views: 267,  avgTime: '3:58', trend: 45 },
  { path: '/detail/dartleague', title: 'Black Sheep Dart League',     views: 198,  avgTime: '2:21', trend: 38 },
  { path: '/detail/aboutMe',    title: 'Josh Merritt — About',        views: 185,  avgTime: '1:12', trend: 8 },
  { path: '/detail/arduino',    title: 'Smart Chicken Coop',          views: 142,  avgTime: '2:35', trend: 12 },
  { path: '/analytics',         title: 'Site Analytics Dashboard',    views: 98,   avgTime: '3:15', trend: 67 },
  { path: '/detail/gds',        title: 'Google Data Studio',          views: 87,   avgTime: '1:55', trend: -5 },
];

// ── Ball engagement funnel (all 8 project balls) ────────────────────────
export const BALL_ENGAGEMENT = [
  { ball: 'Josh Merritt',            id: 'aboutMe',                      clicks: 312, launches: 289, scores: 267, opens: 251, color: '#6B9F6B',  category: 'Me' },
  { ball: 'Microsoft Power BI',      id: 'powerBIMetrics',               clicks: 234, launches: 218, scores: 189, opens: 178, color: '#D4A843',  category: 'Business' },
  { ball: 'The Wine You Drink',      id: 'thewineyoudrink',              clicks: 198, launches: 182, scores: 156, opens: 149, color: '#8B1A32',  category: 'Apps' },
  { ball: 'Black Sheep Dart League', id: 'dartleague',                   clicks: 178, launches: 165, scores: 141, opens: 132, color: '#7B5EA7',  category: 'Apps' },
  { ball: 'Smart Chicken Coop',      id: 'arduinoCoopDoor',              clicks: 156, launches: 142, scores: 122, opens: 108, color: '#BF360C',  category: 'Technology' },
  { ball: 'Site Analytics',          id: 'SiteAnalytics',                clicks: 145, launches: 131, scores: 112, opens: 98,  color: '#5985B1',  category: 'Technology' },
  { ball: 'Google Data Studio',      id: 'googleDataStudioServiceTechs', clicks: 123, launches: 108, scores: 89,  opens: 78,  color: '#4285F4',  category: 'Business' },
  { ball: 'Portfolio Website',       id: 'thisWebsite',                  clicks: 108, launches: 95,  scores: 84,  opens: 72,  color: '#5985B1',  category: 'Technology' },
];

// ── Aggregate funnel totals (derived from BALL_ENGAGEMENT) ──────────────
export const FUNNEL_TOTALS = BALL_ENGAGEMENT.reduce(
  (acc, b) => ({
    clicks:   acc.clicks + b.clicks,
    launches: acc.launches + b.launches,
    scores:   acc.scores + b.scores,
    opens:    acc.opens + b.opens,
  }),
  { clicks: 0, launches: 0, scores: 0, opens: 0 },
);

// ── Device / viewport breakdown ─────────────────────────────────────────
export const DEVICE_DATA = [
  { device: 'Desktop', visitors: 512, pct: 60.3, avgDuration: 142, ballRate: 72, avgShots: 4.8, accuracy: 68, color: '#5985B1' },
  { device: 'Mobile',  visitors: 289, pct: 34.0, avgDuration: 78,  ballRate: 51, avgShots: 2.1, accuracy: 45, color: '#D4A843' },
  { device: 'Tablet',  visitors: 48,  pct: 5.7,  avgDuration: 165, ballRate: 82, avgShots: 6.2, accuracy: 71, color: '#6B9F6B' },
];

// ── Session journey flow ────────────────────────────────────────────────
export const SESSION_FLOW = [
  { from: 'Landing',          to: 'Ball Interaction', value: 63, color: '#5985B1' },
  { from: 'Landing',          to: 'Bounce',           value: 32, color: '#C05050' },
  { from: 'Landing',          to: 'Scroll Only',      value: 5,  color: '#8B8B8B' },
  { from: 'Ball Interaction', to: 'Detail Page',      value: 48, color: '#D4A843' },
  { from: 'Ball Interaction', to: 'Multiple Balls',   value: 12, color: '#6B9F6B' },
  { from: 'Ball Interaction', to: 'Exit',             value: 3,  color: '#C05050' },
  { from: 'Detail Page',     to: 'External Link',    value: 28, color: '#7B5EA7' },
  { from: 'Detail Page',     to: 'Back to Play',     value: 15, color: '#5985B1' },
  { from: 'Detail Page',     to: 'Exit',             value: 5,  color: '#C05050' },
];

// ── Architecture diagram data ───────────────────────────────────────────
export const ARCHITECTURE = {
  events: [
    { name: 'ball_launch',      params: ['shot_number', 'total_makes', 'accuracy'] },
    { name: 'ball_score',       params: ['shot_number', 'make_number', 'accuracy'] },
    { name: 'detail_open',      params: ['project_name', 'project_link'] },
    { name: 'detail_close',     params: [] },
    { name: 'portfolio_loaded', params: ['load_time_ms'] },
  ],
};

// ── Metric colors ───────────────────────────────────────────────────────
export const METRIC_COLORS = {
  visitors:         '#D4A843',
  pageviews:        '#5985B1',
  bounceRate:       '#C05050',
  avgDuration:      '#6B9F6B',
  ballInteractions: '#7B5EA7',
};
