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
 * Throws on failure so hooks.js can catch and fall back to mock.
 * Returns { timeSeries, sources, pages, ballEvents, fetchedAt, days }
 */
export async function fetchLiveData(days = 90) {
  const res = await fetch(`${GA4_WORKER_URL}?days=${days}`);
  if (!res.ok) throw new Error(`Worker responded ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

/**
 * Returns mock data in the same shape as the live worker response.
 * Used as fallback when the worker is unavailable.
 */
export function getMockData(days = 90) {
  return {
    timeSeries: generateTimeSeriesData(days),
    sources: REFERRER_DATA,
    pages: PAGE_DATA,
    ballEvents: BALL_ENGAGEMENT,
    fetchedAt: new Date().toISOString(),
    days,
  };
}


// ═══════════════════════════════════════════════════════════════════════════
//  Mock / fallback data (kept for offline dev & graceful degradation)
// ═══════════════════════════════════════════════════════════════════════════

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

export const REFERRER_DATA = [
  { source: 'LinkedIn',       visits: 287, pct: 33.8, color: '#0A66C2' },
  { source: 'Google Search',  visits: 198, pct: 23.3, color: '#4285F4' },
  { source: 'Direct',         visits: 172, pct: 20.3, color: '#6B9F6B' },
  { source: 'GitHub',         visits: 108, pct: 12.7, color: '#C9D1D9' },
  { source: 'Upwork',         visits: 84,  pct: 9.9,  color: '#14A800' },
];

export const PAGE_DATA = [
  { path: '/',                  title: 'Home (Physics Playground)',    views: 849,  avgTime: '1:48', trend: 15 },
  { path: '/detail/powerBI',    title: 'Microsoft Power BI',          views: 312,  avgTime: '2:42', trend: 22 },
  { path: '/detail/wine',       title: 'The Wine You Drink',          views: 267,  avgTime: '3:58', trend: 45 },
  { path: '/detail/dartleague', title: 'Black Sheep Dart League',     views: 198,  avgTime: '2:21', trend: 38 },
  { path: '/detail/aboutMe',    title: 'Josh Merritt — About',        views: 185,  avgTime: '1:12', trend: 8 },
  { path: '/detail/arduino',    title: 'Smart Chicken Coop',          views: 142,  avgTime: '2:35', trend: 12 },
  { path: '/analytics',         title: 'Site Analytics Dashboard',    views: 98,   avgTime: '3:15', trend: 67 },
  { path: '/detail/gds',        title: 'Google Data Studio Dashboard',views: 87,   avgTime: '1:55', trend: -5 },
];

export const BALL_ENGAGEMENT = [
  { ball: 'Josh Merritt',              id: 'aboutMe',                     clicks: 312, launches: 289, scores: 267, opens: 251, color: '#6B9F6B',  category: 'Me' },
  { ball: 'Microsoft Power BI',        id: 'powerBIMetrics',              clicks: 234, launches: 218, scores: 189, opens: 178, color: '#D4A843',  category: 'Business' },
  { ball: 'The Wine You Drink',        id: 'thewineyoudrink',             clicks: 198, launches: 182, scores: 156, opens: 149, color: '#8B1A32',  category: 'Apps' },
  { ball: 'Black Sheep Dart League',   id: 'dartleague',                  clicks: 178, launches: 165, scores: 141, opens: 132, color: '#7B5EA7',  category: 'Apps' },
  { ball: 'Smart Chicken Coop',        id: 'arduinoCoopDoor',             clicks: 156, launches: 142, scores: 122, opens: 108, color: '#BF360C',  category: 'Technology' },
  { ball: 'Site Analytics',            id: 'SiteAnalytics',               clicks: 145, launches: 131, scores: 112, opens: 98,  color: '#5985B1',  category: 'Technology' },
  { ball: 'Google Data Studio',        id: 'googleDataStudioServiceTechs',clicks: 123, launches: 108, scores: 89,  opens: 78,  color: '#4285F4',  category: 'Business' },
  { ball: 'Portfolio Website',         id: 'thisWebsite',                 clicks: 108, launches: 95,  scores: 84,  opens: 72,  color: '#5985B1',  category: 'Technology' },
];

export const METRIC_COLORS = {
  visitors:         '#D4A843',
  pageviews:        '#5985B1',
  bounceRate:       '#C05050',
  avgDuration:      '#6B9F6B',
  ballInteractions: '#7B5EA7',
};
