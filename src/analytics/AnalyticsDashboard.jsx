/**
 * AnalyticsDashboard.jsx — Main dashboard layout
 *
 * Fetches live data from GA4 via Cloudflare Worker proxy.
 * Falls back to deterministic mock data if worker is unreachable.
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
  const { data, isLive, loading, error, refresh } = useAnalyticsData(rangeDays);

  // Loading state
  if (loading && !data) {
    return (
      <div className="analytics-root">
        <div className="ambient-glow ambient-glow--tr" />
        <div className="ambient-glow ambient-glow--bl" />
        <header className="dash-header fade-in">
          <div>
            <h1 className="dash-title">Site Analytics</h1>
            <p className="dash-subtitle">Loading...</p>
          </div>
        </header>
        <div className="loading-panel">
          <div className="loading-spinner" />
          <p>Fetching analytics data...</p>
        </div>
      </div>
    );
  }

  const timeSeries = data?.timeSeries || [];
  const sources = data?.sources || [];
  const pages = data?.pages || [];
  const ballEvents = data?.ballEvents || [];

  // Slice time series for selected range (live data already filtered by worker,
  // but mock data returns full 90 days)
  const timeSeriesData = isLive ? timeSeries : timeSeries.slice(-rangeDays);

  // Compute KPIs
  const totalVisitors      = timeSeriesData.reduce((s, d) => s + d.visitors, 0);
  const totalPageviews     = timeSeriesData.reduce((s, d) => s + d.pageviews, 0);
  const avgBounce          = timeSeriesData.length
    ? Math.round(timeSeriesData.reduce((s, d) => s + d.bounceRate, 0) / timeSeriesData.length)
    : 0;
  const avgDuration        = timeSeriesData.length
    ? Math.round(timeSeriesData.reduce((s, d) => s + d.avgDuration, 0) / timeSeriesData.length)
    : 0;
  const totalInteractions  = timeSeriesData.reduce((s, d) => s + d.ballInteractions, 0);
  const interactionRate    = totalVisitors > 0
    ? Math.round((totalInteractions / totalVisitors) * 100)
    : 0;

  // Compute trends (compare first half vs second half of period)
  const half = Math.floor(timeSeriesData.length / 2);
  const firstHalf = timeSeriesData.slice(0, half);
  const secondHalf = timeSeriesData.slice(half);
  function trendPct(key) {
    const a = firstHalf.reduce((s, d) => s + d[key], 0) / (firstHalf.length || 1);
    const b = secondHalf.reduce((s, d) => s + d[key], 0) / (secondHalf.length || 1);
    return a > 0 ? Math.round(((b - a) / a) * 100) : 0;
  }

  const metrics = [
    { key: 'visitors',         label: 'Visitors',     color: METRIC_COLORS.visitors },
    { key: 'pageviews',        label: 'Views',        color: METRIC_COLORS.pageviews },
    { key: 'ballInteractions', label: 'Interactions', color: METRIC_COLORS.ballInteractions },
  ];

  return (
    <div className="analytics-root">
      {/* Ambient glow */}
      <div className="ambient-glow ambient-glow--tr" />
      <div className="ambient-glow ambient-glow--bl" />

      {/* ── Header ── */}
      <header className="dash-header fade-in">
        <div>
          <div className="dash-title-row">
            <h1 className="dash-title">Site Analytics</h1>
            <div className={`live-badge ${isLive ? '' : 'live-badge--mock'}`}>
              <span className={`live-dot ${isLive ? '' : 'live-dot--mock'}`} />
              {isLive ? 'Live' : 'Demo'}
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
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── KPI Cards ── */}
      <div className="kpi-row">
        <StatCard
          label="Unique Visitors" value={totalVisitors}
          trend={trendPct('visitors')} delay={100}
          sparkData={timeSeriesData.slice(-30).map((d) => d.visitors)}
          color={METRIC_COLORS.visitors}
        />
        <StatCard
          label="Pageviews" value={totalPageviews}
          trend={trendPct('pageviews')} delay={200}
          sparkData={timeSeriesData.slice(-30).map((d) => d.pageviews)}
          color={METRIC_COLORS.pageviews}
        />
        <StatCard
          label="Avg. Duration" value={avgDuration} suffix="s"
          trend={trendPct('avgDuration')} delay={300}
          sparkData={timeSeriesData.slice(-30).map((d) => d.avgDuration)}
          color={METRIC_COLORS.avgDuration}
        />
        <StatCard
          label="Bounce Rate" value={avgBounce} suffix="%"
          trend={trendPct('bounceRate')} delay={400}
          sparkData={timeSeriesData.slice(-30).map((d) => d.bounceRate)}
          color={METRIC_COLORS.bounceRate}
        />
        <StatCard
          label="Ball Interaction Rate" value={interactionRate} suffix="%"
          trend={trendPct('ballInteractions')} delay={500}
          sparkData={timeSeriesData.slice(-30).map((d) =>
            d.visitors > 0 ? Math.round((d.ballInteractions / d.visitors) * 100) : 0
          )}
          color={METRIC_COLORS.ballInteractions}
        />
      </div>

      {/* ── Traffic Chart ── */}
      <div className="panel chart-panel" style={{ animationDelay: '300ms' }}>
        <div className="panel-header">
          <span className="panel-title">Traffic Over Time</span>
          <div className="metric-toggle">
            {metrics.map((m) => (
              <button
                key={m.key}
                className={`metric-btn ${activeMetric === m.key ? 'active' : ''}`}
                style={activeMetric === m.key ? { background: `${m.color}22`, color: m.color } : {}}
                onClick={() => setActiveMetric(m.key)}
              >
                <span className="metric-dot" style={{ background: m.color }} />
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <AreaChart
          data={timeSeriesData}
          dataKey={activeMetric}
          color={METRIC_COLORS[activeMetric]}
        />
      </div>

      {/* ── Two Column: Sources + Top Pages ── */}
      <div className="two-col">
        {/* Traffic Sources */}
        <div className="panel" style={{ animationDelay: '500ms' }}>
          <span className="panel-title">Traffic Sources</span>
          <div className="sources-layout">
            <DonutChart segments={sources} size={115} strokeWidth={17} />
            <div className="sources-list">
              {sources.map((r, i) => (
                <div
                  key={r.source}
                  className="source-row fade-in"
                  style={{ animationDelay: `${600 + i * 80}ms` }}
                >
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

        {/* Top Pages */}
        <div className="panel" style={{ animationDelay: '600ms' }}>
          <span className="panel-title">Top Pages</span>
          {pages.map((pg, i) => (
            <div
              key={pg.path}
              className={`page-row fade-in ${i < pages.length - 1 ? 'bordered' : ''}`}
              style={{ animationDelay: `${700 + i * 80}ms` }}
            >
              <div className="page-info">
                <div className="page-title">{pg.title}</div>
                <div className="page-path">{pg.path}</div>
              </div>
              <div className="page-stats">
                <span className="page-views">{pg.views.toLocaleString()}</span>
                <span className="page-time">{pg.avgTime}</span>
                <span className={`page-trend ${pg.trend >= 0 ? 'up' : 'down'}`}>
                  {pg.trend >= 0 ? '↑' : '↓'} {Math.abs(pg.trend)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Ball Engagement Funnel ── */}
      <BallEngagement data={ballEvents} />

      {/* ── Footer ── */}
      <div className="dash-footer fade-in" style={{ animationDelay: '1000ms' }}>
        {isLive ? (
          <p>
            Live data from GA4 property <code>G-JXCE49FJ7J</code>.
            Last fetched: {data?.fetchedAt ? new Date(data.fetchedAt).toLocaleString() : '—'}
            {' '}<button className="refresh-btn" onClick={refresh}>↻ Refresh</button>
          </p>
        ) : (
          <p>
            Demo data shown — live GA4 connection not configured.
            See <code>src/game/ga4.js</code> for event tracking implementation.
          </p>
        )}
      </div>
    </div>
  );
}
