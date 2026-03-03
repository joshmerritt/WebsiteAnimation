# V2 Analytics Dashboard — Integration Guide

All changes below are DIFFS against the current master. V1 functionality is untouched.

---

## 1. vite.config.js — Add V2 entry point

```diff
 build: {
   outDir: 'dist',
   rollupOptions: {
     input: {
       main: resolve(__dirname, 'index.html'),
       analytics: resolve(__dirname, 'analytics-dashboard.html'),
+      analyticsV2: resolve(__dirname, 'analytics-v2.html'),
     },
   },
 },
```

---

## 2. src/analytics/data.js — Add V2 exports

Insert BETWEEN the `BALL_ENGAGEMENT` array and the `METRIC_COLORS` object:

```javascript
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
```

---

## 3. src/styles/analytics.css — Add nav link styles

Paste BEFORE the FOOTER section:

```css
/* ── Dashboard Version Nav ──────────────────────────────────────────────── */
.dash-nav {
  display: flex;
  gap: 6px;
  align-items: center;
}
.dash-nav-link {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--a-text-muted);
  text-decoration: none;
  padding: 4px 10px;
  border: 1px solid var(--a-border);
  border-radius: 4px;
  transition: all 0.2s;
  letter-spacing: 0.03em;
}
.dash-nav-link:hover {
  color: var(--a-blue);
  background: rgba(89, 133, 177, 0.08);
  border-color: rgba(89, 133, 177, 0.3);
}
.dash-nav-link.active {
  background: rgba(89, 133, 177, 0.12);
  border-color: var(--a-blue);
  color: var(--a-text);
}
```

---

## 4. src/analytics/AnalyticsDashboard.jsx (V1) — Add nav link to V2

In the header, AFTER the time-range-group div, add a nav block:

```diff
         <div className="time-range-group">
           {TIME_RANGES.map((r) => (
             <button
               key={r.key}
               className={`time-range-btn ${timeRange === r.key ? 'active' : ''}`}
               onClick={() => setTimeRange(r.key)}
             >
               {r.label}
             </button>
           ))}
         </div>
+        <div className="dash-nav">
+          <a className="dash-nav-link active" href="/analytics-dashboard.html">V1</a>
+          <a className="dash-nav-link" href="/analytics-v2.html">V2</a>
+          <a className="dash-nav-link" href="/">Portfolio</a>
+        </div>
       </header>
```

---

## New Files Summary

| File | Location | Description |
|------|----------|-------------|
| `analytics-v2.html` | root | Vite entry with GA4 snippet |
| `src/analytics-v2-main.jsx` | src/ | React entry imports V2 dashboard + V2 CSS |
| `src/styles/analytics-v2.css` | src/styles/ | 850+ lines — all V2 section styles |
| `src/analytics/FunnelViz.jsx` | src/analytics/ | Animated SVG funnel (Click→Launch→Score→Open) |
| `src/analytics/BallEngagementV2.jsx` | src/analytics/ | Enhanced ball table + FunnelViz + category chips |
| `src/analytics/AnalyticsDashboardV2.jsx` | src/analytics/ | 8-section dashboard with Device, Flow, Architecture |
