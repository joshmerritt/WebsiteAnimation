/**
 * AnalyticsDashboard.jsx — Main dashboard layout
 *
 * Composed from smaller components. Uses mock data (swap for real
 * analytics API calls in production).
 */

import { useState, useMemo } from 'react';
import { generateTimeSeriesData, REFERRER_DATA, PAGE_DATA, METRIC_COLORS } from './data.js';
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

  const fullData = useMemo(() => generateTimeSeriesData(90), []);

  // Slice data based on selected time range
  const rangeDays = TIME_RANGES.find((r) => r.key === timeRange)?.days ?? 90;
  const timeSeriesData = fullData.slice(-rangeDays);

  // Compute KPIs
  const totalVisitors  = timeSeriesData.reduce((s, d) => s + d.visitors, 0);
  const totalPageviews = timeSeriesData.reduce((s, d) => s + d.pageviews, 0);
  const avgBounce      = Math.round(timeSeriesData.reduce((s, d) => s + d.bounceRate, 0) / timeSeriesData.length);
  const avgDuration    = Math.round(timeSeriesData.reduce((s, d) => s + d.avgDuration, 0) / timeSeriesData.length);

  const metrics = [
    { key: 'visitors',  label: 'Visitors', color: METRIC_COLORS.visitors },
    { key: 'pageviews', label: 'Views',    color: METRIC_COLORS.pageviews },
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
            <div className="live-badge">
              <span className="live-dot" />
              Live
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
          trend={18} delay={100}
          sparkData={timeSeriesData.slice(-30).map((d) => d.visitors)}
          color={METRIC_COLORS.visitors}
        />
        <StatCard
          label="Pageviews" value={totalPageviews}
          trend={24} delay={200}
          sparkData={timeSeriesData.slice(-30).map((d) => d.pageviews)}
          color={METRIC_COLORS.pageviews}
        />
        <StatCard
          label="Avg. Duration" value={avgDuration} suffix="s"
          trend={12} delay={300}
          sparkData={timeSeriesData.slice(-30).map((d) => d.avgDuration)}
          color={METRIC_COLORS.avgDuration}
        />
        <StatCard
          label="Bounce Rate" value={avgBounce} suffix="%"
          trend={-8} delay={400}
          sparkData={timeSeriesData.slice(-30).map((d) => d.bounceRate)}
          color={METRIC_COLORS.bounceRate}
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
            <DonutChart segments={REFERRER_DATA} size={115} strokeWidth={17} />
            <div className="sources-list">
              {REFERRER_DATA.map((r, i) => (
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
          {PAGE_DATA.map((pg, i) => (
            <div
              key={pg.path}
              className={`page-row fade-in ${i < PAGE_DATA.length - 1 ? 'bordered' : ''}`}
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
                  {pg.trend >= 0 ? '+' : ''}{pg.trend}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Ball Engagement ── */}
      <BallEngagement />

      {/* ── Footer ── */}
      <footer className="dash-footer">
        <a href="/">← Back to Portfolio</a>
        <span>Built by Da Data Dad &middot; Powered by curiosity and too much coffee</span>
      </footer>
    </div>
  );
}
