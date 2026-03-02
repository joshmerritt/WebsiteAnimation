/**
 * AnalyticsDashboard.jsx — Full analytics dashboard for DaDataDad.com
 *
 * Sections:
 *   1. KPI cards with sparklines
 *   2. Traffic over time (multi-metric toggle)
 *   3. Traffic sources (donut) + Top pages (table)
 *   4. Ball Engagement Funnel (visual + table)
 *   5. Device breakdown (physics engagement by device)
 *   6. Session journey flow (Sankey-style)
 *   7. Tracking architecture showcase
 *   8. Footer with integration notes
 */

import { useState, useMemo, useEffect } from 'react';
import {
  generateTimeSeriesData, REFERRER_DATA, PAGE_DATA,
  DEVICE_DATA, SESSION_FLOW, ARCHITECTURE,
  METRIC_COLORS,
} from './data.js';
import StatCard from './StatCard.jsx';
import AreaChart from './AreaChart.jsx';
import DonutChart from './DonutChart.jsx';
import BallEngagement from './BallEngagement.jsx';

const TIME_RANGES = [
  { key: '7d',  label: '7D',  days: 7 },
  { key: '30d', label: '30D', days: 30 },
  { key: '90d', label: '90D', days: 90 },
];


// ═══════════════════════════════════════════════════════════════════════════
//  DEVICE BREAKDOWN — inline component
// ═══════════════════════════════════════════════════════════════════════════

function DeviceBreakdown() {
  return (
    <div className="panel device-panel" style={{ animationDelay: '750ms' }}>
      <div className="panel-header">
        <span className="panel-title">Physics Engagement by Device</span>
        <span className="panel-badge">interaction quality</span>
      </div>

      <div className="device-cards">
        {DEVICE_DATA.map((d, i) => (
          <div key={d.device} className="device-card fade-in" style={{ animationDelay: `${800 + i * 100}ms` }}>
            <div className="device-header">
              <span className="device-icon">
                {d.device === 'Desktop' ? '🖥' : d.device === 'Mobile' ? '📱' : '📲'}
              </span>
              <span className="device-name">{d.device}</span>
              <span className="device-pct" style={{ color: d.color }}>{d.pct}%</span>
            </div>

            <div className="device-metrics">
              <div className="device-metric">
                <span className="dm-label">Interaction Rate</span>
                <div className="dm-bar-wrap">
                  <div
                    className="dm-bar"
                    style={{ width: `${d.ballRate}%`, background: d.color }}
                  />
                </div>
                <span className="dm-value" style={{ color: d.color }}>{d.ballRate}%</span>
              </div>
              <div className="device-metric">
                <span className="dm-label">Avg Shots/Session</span>
                <span className="dm-value">{d.avgShots}</span>
              </div>
              <div className="device-metric">
                <span className="dm-label">Shot Accuracy</span>
                <span className="dm-value">{d.accuracy}%</span>
              </div>
              <div className="device-metric">
                <span className="dm-label">Avg Duration</span>
                <span className="dm-value">{d.avgDuration}s</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="insight-box" style={{ marginTop: 14 }}>
        <span className="insight-icon">Insight:</span>{' '}
        <span className="insight-text">
          Tablet users show the highest engagement (82% interaction rate, 6.2 shots/session)
          despite being only 5.7% of traffic. Desktop converts well at 68% accuracy.
          Mobile users engage less deeply — the drag-to-aim mechanic is harder on small screens.
        </span>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
//  SESSION FLOW — simplified Sankey
// ═══════════════════════════════════════════════════════════════════════════

function SessionFlow() {
  const columns = [
    { label: 'Entry',       nodes: ['Landing'] },
    { label: 'Engagement',  nodes: ['Ball Interaction', 'Bounce', 'Scroll Only'] },
    { label: 'Depth',       nodes: ['Detail Page', 'Multiple Balls', 'Exit'] },
    { label: 'Outcome',     nodes: ['External Link', 'Back to Play', 'Exit'] },
  ];

  // Build node values
  const nodeValues = {};
  SESSION_FLOW.forEach(({ from, to, value }) => {
    nodeValues[from] = (nodeValues[from] || 0) + value;
  });
  // For leaf nodes, sum incoming
  SESSION_FLOW.forEach(({ to, value }) => {
    if (!nodeValues[to]) nodeValues[to] = 0;
    nodeValues[to] += value;
  });
  nodeValues['Landing'] = 100;

  return (
    <div className="panel" style={{ animationDelay: '850ms' }}>
      <div className="panel-header">
        <span className="panel-title">Session Journey Flow</span>
        <span className="panel-badge">user path analysis</span>
      </div>

      <div className="flow-columns">
        {columns.map((col, ci) => (
          <div key={col.label} className="flow-col">
            <div className="flow-col-label">{col.label}</div>
            {col.nodes.map((node) => {
              const val = nodeValues[node] || 0;
              if (val === 0) return null;
              const flow = SESSION_FLOW.find((f) => f.to === node || f.from === node);
              const color = flow?.color || '#5985B1';
              const isExit = node === 'Bounce' || node === 'Exit';

              return (
                <div
                  key={node}
                  className={`flow-node fade-in ${isExit ? 'flow-node--exit' : ''}`}
                  style={{
                    animationDelay: `${900 + ci * 120}ms`,
                    borderColor: `${color}44`,
                  }}
                >
                  <span className="flow-node-name">{node}</span>
                  <span className="flow-node-val" style={{ color }}>{val}%</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Flow connections as simple arrows */}
      <div className="flow-arrows">
        {SESSION_FLOW.slice(0, 6).map((f, i) => (
          <div key={i} className="flow-arrow fade-in" style={{ animationDelay: `${1000 + i * 60}ms` }}>
            <span className="flow-from">{f.from}</span>
            <span className="flow-arrow-icon" style={{ color: f.color }}>→</span>
            <span className="flow-to">{f.to}</span>
            <span className="flow-val" style={{ color: f.color }}>{f.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
//  ARCHITECTURE SHOWCASE — tracking pipeline visualization
// ═══════════════════════════════════════════════════════════════════════════

function ArchitectureShowcase() {
  const pipeline = [
    { label: 'User Action',  items: ['Drag ball', 'Release (launch)', 'Collision (score)', 'Double-tap (open)'], color: '#D4A843', icon: '👆' },
    { label: 'Game.js',      items: ['Physics engine', 'Collision detection', 'State management'],                color: '#5985B1', icon: '⚙️' },
    { label: 'EventBus',     items: ['stats:update', 'detail:open', 'detail:close', 'load:complete'],            color: '#6B9F6B', icon: '📡' },
    { label: 'ga4.js',       items: ['Delta detection', 'Event mapping', 'Parameter enrichment'],                color: '#7B5EA7', icon: '🔗' },
    { label: 'GA4',          items: ['ball_launch', 'ball_score', 'detail_open', 'portfolio_loaded'],            color: '#4285F4', icon: '📊' },
  ];

  return (
    <div className="panel arch-panel" style={{ animationDelay: '900ms' }}>
      <div className="panel-header">
        <span className="panel-title">Tracking Architecture</span>
        <span className="panel-badge">EventBus → GA4 pipeline</span>
      </div>

      <div className="arch-pipeline">
        {pipeline.map((stage, i) => (
          <div key={stage.label} className="arch-stage fade-in" style={{ animationDelay: `${950 + i * 100}ms` }}>
            <div className="arch-stage-header" style={{ borderColor: stage.color }}>
              <span className="arch-icon">{stage.icon}</span>
              <span className="arch-label" style={{ color: stage.color }}>{stage.label}</span>
            </div>
            <div className="arch-items">
              {stage.items.map((item) => (
                <div key={item} className="arch-item">{item}</div>
              ))}
            </div>
            {i < pipeline.length - 1 && (
              <div className="arch-connector">
                <span className="arch-arrow" style={{ color: stage.color }}>▼</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Custom Events Reference */}
      <div className="arch-events">
        <div className="arch-events-title">Custom Events Tracked</div>
        <div className="arch-events-grid">
          {ARCHITECTURE.events.map((evt) => (
            <div key={evt.name} className="arch-event-card fade-in">
              <code className="arch-event-name">{evt.name}</code>
              {evt.params.length > 0 && (
                <div className="arch-event-params">
                  {evt.params.map((p) => (
                    <span key={p} className="arch-param">{p}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
//  MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

export default function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState('90d');
  const [activeMetric, setActiveMetric] = useState('visitors');
  const [simTick, setSimTick] = useState(0);

  const fullData = useMemo(() => generateTimeSeriesData(90), []);

  // Live simulation pulse — subtle counter increment
  useEffect(() => {
    const timer = setInterval(() => setSimTick((t) => t + 1), 8000);
    return () => clearInterval(timer);
  }, []);

  const rangeDays = TIME_RANGES.find((r) => r.key === timeRange)?.days ?? 90;
  const timeSeriesData = fullData.slice(-rangeDays);

  // KPIs
  const totalVisitors      = timeSeriesData.reduce((s, d) => s + d.visitors, 0) + simTick;
  const totalPageviews     = timeSeriesData.reduce((s, d) => s + d.pageviews, 0) + simTick * 2;
  const avgBounce          = Math.round(timeSeriesData.reduce((s, d) => s + d.bounceRate, 0) / timeSeriesData.length);
  const avgDuration        = Math.round(timeSeriesData.reduce((s, d) => s + d.avgDuration, 0) / timeSeriesData.length);
  const totalInteractions  = timeSeriesData.reduce((s, d) => s + d.ballInteractions, 0) + simTick;
  const interactionRate    = Math.round((totalInteractions / totalVisitors) * 100);

  const metrics = [
    { key: 'visitors',         label: 'Visitors',     color: METRIC_COLORS.visitors },
    { key: 'pageviews',        label: 'Views',        color: METRIC_COLORS.pageviews },
    { key: 'ballInteractions', label: 'Interactions', color: METRIC_COLORS.ballInteractions },
  ];

  return (
    <div className="analytics-root">
      <div className="ambient-glow ambient-glow--tr" />
      <div className="ambient-glow ambient-glow--bl" />

      {/* ── Header ── */}
      <header className="dash-header fade-in">
        <div>
          <div className="dash-title-row">
            <h1 className="dash-title">Site Analytics</h1>
            <div className="live-badge">
              <span className="live-dot" />
              Simulated Live
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
        <StatCard label="Unique Visitors" value={totalVisitors} trend={15} delay={100}
          sparkData={timeSeriesData.slice(-30).map((d) => d.visitors)} color={METRIC_COLORS.visitors} />
        <StatCard label="Pageviews" value={totalPageviews} trend={22} delay={200}
          sparkData={timeSeriesData.slice(-30).map((d) => d.pageviews)} color={METRIC_COLORS.pageviews} />
        <StatCard label="Avg. Duration" value={avgDuration} suffix="s" trend={8} delay={300}
          sparkData={timeSeriesData.slice(-30).map((d) => d.avgDuration)} color={METRIC_COLORS.avgDuration} />
        <StatCard label="Bounce Rate" value={avgBounce} suffix="%" trend={-5} delay={400}
          sparkData={timeSeriesData.slice(-30).map((d) => d.bounceRate)} color={METRIC_COLORS.bounceRate} />
        <StatCard label="Ball Interaction Rate" value={interactionRate} suffix="%" trend={12} delay={500}
          sparkData={timeSeriesData.slice(-30).map((d) => Math.round((d.ballInteractions / d.visitors) * 100))} color={METRIC_COLORS.ballInteractions} />
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
        <AreaChart data={timeSeriesData} dataKey={activeMetric} color={METRIC_COLORS[activeMetric]} />
      </div>

      {/* ── Sources + Pages ── */}
      <div className="two-col">
        <div className="panel" style={{ animationDelay: '500ms' }}>
          <span className="panel-title">Traffic Sources</span>
          <div className="sources-layout">
            <DonutChart segments={REFERRER_DATA} size={115} strokeWidth={17} />
            <div className="sources-list">
              {REFERRER_DATA.map((r, i) => (
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
          {PAGE_DATA.map((pg, i) => (
            <div key={pg.path} className={`page-row fade-in ${i < PAGE_DATA.length - 1 ? 'bordered' : ''}`}
              style={{ animationDelay: `${700 + i * 80}ms` }}>
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

      {/* ── Ball Engagement ── */}
      <BallEngagement />

      {/* ── Device Breakdown ── */}
      <DeviceBreakdown />

      {/* ── Session Flow ── */}
      <SessionFlow />

      {/* ── Architecture ── */}
      <ArchitectureShowcase />

      {/* ── Footer ── */}
      <div className="dash-footer fade-in" style={{ animationDelay: '1100ms' }}>
        <p>
          Displaying deterministic mock data. Numbers increment in real-time to simulate live traffic.
          Connect GA4 property <code>G-JXCE49FJ7J</code> via the Data API for real metrics.
        </p>
        <p>
          Custom event tracking implemented in <code>src/game/ga4.js</code> — listens to the
          EventBus and forwards 5 custom events with enriched parameters to Google Analytics 4.
        </p>
      </div>
    </div>
  );
}
