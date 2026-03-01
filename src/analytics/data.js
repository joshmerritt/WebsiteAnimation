/**
 * data.js — Analytics mock data
 *
 * In production, replace generateTimeSeriesData() with real
 * GA4 / Plausible / PostHog API calls.
 */

export function generateTimeSeriesData(days = 90) {
  const now = new Date();
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const base = isWeekend ? 35 : 65;
    const trend = Math.max(0, (days - i) * 0.4);
    const noise = (Math.random() - 0.5) * 30;
    const spike = (i === 12 || i === 28 || i === 45) ? 80 : 0;
    const raw = base + trend + noise + spike;

    data.push({
      date: date.toISOString().split('T')[0],
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      visitors: Math.round(Math.max(8, raw)),
      pageviews: Math.round(Math.max(12, raw * 2.3)),
      avgDuration: Math.round(45 + Math.random() * 180),
      bounceRate: Math.round(30 + Math.random() * 35),
    });
  }
  return data;
}

export const REFERRER_DATA = [
  { source: 'LinkedIn',      visits: 342, pct: 31.2, color: '#0A66C2' },
  { source: 'Google Search', visits: 289, pct: 26.4, color: '#4285F4' },
  { source: 'Direct',        visits: 198, pct: 18.1, color: '#6B9F6B' },
  { source: 'Twitter / X',   visits: 156, pct: 14.2, color: '#8B8B8B' },
  { source: 'GitHub',        visits: 112, pct: 10.2, color: '#C9D1D9' },
];

export const PAGE_DATA = [
  { path: '/',             title: 'Home (Physics Playground)', views: 1847, avgTime: '1:42', trend: 12 },
  { path: '/powerBI',      title: 'Power BI Dashboards',      views: 623,  avgTime: '2:58', trend: 24 },
  { path: '/analytics',    title: 'Analytics Portfolio',       views: 512,  avgTime: '3:12', trend: 18 },
  { path: '/about',        title: 'About Me',                 views: 445,  avgTime: '1:15', trend: -3 },
  { path: '/wine-cellar',  title: 'Wine Cellar App',          views: 398,  avgTime: '4:31', trend: 67 },
  { path: '/arduino',      title: 'Arduino Coop Door',        views: 201,  avgTime: '2:05', trend: 5 },
];

export const BALL_ENGAGEMENT = [
  { ball: 'Power BI',     clicks: 234, scores: 189, opens: 178, color: '#D4A843' },
  { ball: 'Analytics',    clicks: 198, scores: 156, opens: 149, color: '#5985B1' },
  { ball: 'Wine Cellar',  clicks: 176, scores: 134, opens: 128, color: '#8B1A32' },
  { ball: 'About Me',     clicks: 312, scores: 267, opens: 251, color: '#6B9F6B' },
  { ball: 'Arduino',      clicks: 145, scores: 112, opens: 98,  color: '#BF360C' },
  { ball: 'Dart League',  clicks: 167, scores: 141, opens: 132, color: '#7B5EA7' },
];

export const METRIC_COLORS = {
  visitors:    '#D4A843',
  pageviews:   '#5985B1',
  bounceRate:  '#C05050',
  avgDuration: '#6B9F6B',
};
