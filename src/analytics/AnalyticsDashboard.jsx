/**
 * AnalyticsDashboard.jsx — Main dashboard layout
 *
 * Fetches live data from the GA4 Cloudflare Worker via useAnalyticsData hook.
 * Falls back to deterministic mock data if the fetch fails.
 */

import { useState } from 'react';
import { METRIC_COLORS } from './data.js';
import { useAnalyticsData } from './hooks.js';
import StatCard from './StatCard.jsx';
import AreaChart from './AreaChart.jsx';
import DonutChart from './DonutChart.jsx';
import BallEngagement from './BallEngagement.jsx';

const TIME_RANGES = [
  { key: '7d',  label: '7D',  days: 7 },
  { key: '30d', label: '30D', days: 30 },
  { key: '90d', label: '90D', days: 90 },
];

export default function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState('90d');
  const [activeMetric, setActiveMetric] = useState('visitors');

  const rangeDays = TIME_RANGES.find((r) => r.key === timeRange)?.days ?? 90;

  // Fetch live data (falls back to mock automatically via hooks.js)
  const { data, isLive, loading } = useAnalyticsData(rangeDays);

  // Resolve display data from the unified shape
  const timeSeriesData = data?.timeSeries || [];
  const sourcesData    = data?.sources || [];
  const pagesData      = data?.pages || [];
  const ballEventsData = data?.ballEvents || [];

  // Compute KPIs
  const totalVisitors      = timeSeriesData.reduce((s, d) => s + d.visitors, 0);
  const totalPageviews     = timeSeriesData.reduce((s, d) => s + d.pageviews, 0);
  const avgBounce          = timeSeriesData.length > 0
    ? Math.round(timeSeriesData.reduce((s, d) => s + d.bounceRate, 0) / timeSeriesData.length)
    : 0;
  const avgDuration        = timeSeriesData.length > 0
    ? Math.round(timeSeriesData.reduce((s, d) => s + d.avgDuration, 0) / timeSeriesData.length)
    : 0;
  const totalInteractions  = timeSeriesData.reduce((s, d) => s + d.ballInteractions, 0);
  const interactionRate    = totalVisitors > 0
    ? Math.round((totalInteractions / totalVisitors) * 100)
    : 0;

  const metrics = [
    { key: 'visitors',         label: 'Visitors',     color: METRIC_COLORS.visitors },
    { key: 'pageviews',        label: 'Views',        color: METRIC_COLORS.pageviews },
    { key: 'ballInteractions', label: 'Interactions', color: METRIC_COLORS.ballInteractions },
  ];

  return (
    <div className="analytics-root">
      <div className="ambient-glow ambient-glow--tr" />
      <div className="ambient-glow ambient-glow--bl" />

      <header className="dash-header fade-in">
        <div>
          <div className="dash-title-row">
            <h1 className="dash-title">Site Analytics</h1>
            <div className={`live-badge${isLive ? '' : ' demo-badge'}`}>
              <span className="live-dot" />
              {loading ? 'Loading\u2026' : isLive ? 'Live' : 'Demo'}
            </div>
          </div>
          <p className="dash-subtitle">DaDataDad.com &middot; Last {rangeDays} days</p>
        </div>
        <div className="time-range-group">
          {TIME_RANGES.map((r) => (
            <button
              key={r.key}
              className={`time-range-btn ${timeRange === r.key ? 'active' : ''}`}
              onClick={() => setTimeRange(r.key)}
            >{r.label}</button>
          ))}
        </div>
      </header>

      <div className="kpi-row">
        <StatCard label="Unique Visitors" value={totalVisitors} trend={15} delay={100} sparkData={timeSeriesData.slice(-30).map((d) => d.visitors)} color={METRIC_COLORS.visitors} />
        <StatCard label="Pageviews" value={totalPageviews} trend={22} delay={200} sparkData={timeSeriesData.slice(-30).map((d) => d.pageviews)} color={METRIC_COLORS.pageviews} />
        <StatCard label="Avg. Duration" value={avgDuration} suffix="s" trend={8} delay={300} sparkData={timeSeriesData.slice(-30).map((d) => d.avgDuration)} color={METRIC_COLORS.avgDuration} />
        <StatCard label="Bounce Rate" value={avgBounce} suffix="%" trend={-5} delay={400} sparkData={timeSeriesData.slice(-30).map((d) => d.bounceRate)} color={METRIC_COLORS.bounceRate} />
        <StatCard label="Ball Interaction Rate" value={interactionRate} suffix="%" trend={12} delay={500} sparkData={timeSeriesData.slice(-30).map((d) => d.visitors > 0 ? Math.round((d.ballInteractions / d.visitors) * 100) : 0)} color={METRIC_COLORS.ballInteractions} />
      </div>

      <div className="panel chart-panel" style={{ animationDelay: '300ms' }}>
        <div className="panel-header">
          <span className="panel-title">Traffic Over Time</span>
          <div className="metric-toggle">
            {metrics.map((m) => (
              <button key={m.key} className={`metric-btn ${activeMetric === m.key ? 'active' : ''}`} style={activeMetric === m.key ? { background: `${m.color}22`, color: m.color } : {}} onClick={() => setActiveMetric(m.key)}>
                <span className="metric-dot" style={{ background: m.color }} />
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <AreaChart data={timeSeriesData} dataKey={activeMetric} color={METRIC_COLORS[activeMetric]} />
      </div>

      <div className="two-col">
        <div className="panel" style={{ animationDelay: '500ms' }}>
          <span className="panel-title">Traffic Sources</span>
          <div className="sources-layout">
            <DonutChart segments={sourcesData} size={115} strokeWidth={17} />
            <div className="sources-list">
              {sourcesData.map((r, i) => (
                <div key={r.source} className="source-row fade-in" style={{ animationDelay: `${600 + i * 80}ms` }}>
                  <div className="source-name">
                    <span className="source-dot" style={{ background: r.color }} />
                    <span>{r.source}</span>
                  </div>
                  <div className="source-stats">
                    <span className="source-visits">{r.visits}</span>
                    <span className="source-pct" style={{ color: r.color }}>{r.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel" style={{ animationDelay: '600ms' }}>
          <span className="panel-title">Top Pages</span>
          {pagesData.map((pg, i) => (
            <div key={pg.path} className={`page-row fade-in ${i < pagesData.length - 1 ? 'bordered' : ''}`} style={{ animationDelay: `${700 + i * 80}ms` }}>
              <div className="page-info">
                <div className="page-title">{pg.title}</div>
                <div className="page-path">{pg.path}</div>
              </div>
              <div className="page-stats">
                <span className="page-views">{pg.views.toLocaleString()}</span>
                <span className="page-time">{pg.avgTime}</span>
                <span className={`page-trend ${pg.trend >= 0 ? 'up' : 'down'}`}>
                  {pg.trend >= 0 ? '\u2191' : '\u2193'} {Math.abs(pg.trend)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BallEngagement liveData={ballEventsData} />

      <div className="dash-footer fade-in" style={{ animationDelay: '1000ms' }}>
        <p>
          {isLive ? (
            <>Live data from GA4 property <code>G-JXCE49FJ7J</code> via Cloudflare Worker. See <code>src/game/ga4.js</code> for event tracking implementation.</>
          ) : (
            <>Mock data shown above. Connect GA4 property <code>G-JXCE49FJ7J</code> via the Data API to display real metrics. See <code>src/game/ga4.js</code> for event tracking implementation.</>
          )}
        </p>
      </div>
    </div>
  );
}
