/**
 * BallEngagementV2.jsx — Ball interaction funnel visualization + table
 *
 * Accepts optional `liveData` prop from the GA4 worker.
 * Falls back to mock BALL_ENGAGEMENT data when liveData is null.
 *
 * Features:
 *   - Visual funnel diagram (Launch→Score→Open→CTA Click)
 *   - Per-ball data table with metric toggle for volume bars
 *   - Columns: Ball, Volume, Launches, Scores, Opens, Clicks*, Acc%, Conv%
 *     *Clicks = CTA clicks on the detail modal links
 *   - Acc% = scores / launches
 *   - Conv% = ctaClicks / opens
 *   - Category conversion chips
 *   - Auto-generated insight
 */

import { useState } from 'react';
import { BALL_ENGAGEMENT, FUNNEL_TOTALS } from './data.js';
import FunnelViz from './FunnelViz.jsx';

const BAR_METRICS = [
  { key: 'launches',  label: 'Launches' },
  { key: 'scores',    label: 'Scores' },
  { key: 'opens',     label: 'Opens' },
  { key: 'ctaClicks', label: 'Clicks' },
];

function BallRow({ ball, maxBarVal, barMetric, index }) {
  const accuracy = ball.launches > 0 ? ((ball.scores / ball.launches) * 100).toFixed(1) : '0.0';
  const convRate = ball.opens > 0 ? (((ball.ctaClicks || 0) / ball.opens) * 100).toFixed(1) : '0.0';
  const barVal = ball[barMetric] || 0;
  const barWidth = maxBarVal > 0 ? `${(barVal / maxBarVal) * 100}%` : '0%';

  return (
    <div className="ball-row fade-in" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="ball-name">
        <span className="ball-dot" style={{ background: ball.color }} />
        <span>{ball.ball}</span>
      </div>
      <div className="ball-funnel-bar">
        <div
          className="ball-funnel-fill"
          style={{
            width: barWidth,
            background: `linear-gradient(90deg, ${ball.color}88, ${ball.color}22)`,
          }}
        />
      </div>
      <span className="ball-stat">{ball.launches}</span>
      <span className="ball-stat">{ball.scores}</span>
      <span className="ball-stat">{ball.opens}</span>
      <span className="ball-stat">{ball.ctaClicks || 0}</span>
      <span className={`ball-stat ball-acc ${parseFloat(accuracy) > 80 ? 'high' : 'mid'}`}>
        {accuracy}%
      </span>
      <span className={`ball-stat ball-conv ${parseFloat(convRate) > 70 ? 'high' : 'mid'}`}>
        {convRate}%
      </span>
    </div>
  );
}

export default function BallEngagement({ liveData }) {
  const [barMetric, setBarMetric] = useState('launches');

  // Use live data from the worker if available, otherwise fall back to mock
  const data = (liveData && liveData.length > 0) ? liveData : BALL_ENGAGEMENT;

  // Compute funnel totals dynamically from whichever data source we're using
  const funnelTotals = (liveData && liveData.length > 0)
    ? data.reduce(
        (acc, b) => ({
          clicks:    acc.clicks + (b.clicks || 0),
          launches:  acc.launches + (b.launches || 0),
          scores:    acc.scores + (b.scores || 0),
          opens:     acc.opens + (b.opens || 0),
          ctaClicks: acc.ctaClicks + (b.ctaClicks || 0),
        }),
        { clicks: 0, launches: 0, scores: 0, opens: 0, ctaClicks: 0 },
      )
    : FUNNEL_TOTALS;

  const maxBarVal = Math.max(...data.map((b) => b[barMetric] || 0));

  const sorted = [...data].sort((a, b) => (b.launches || 0) - (a.launches || 0));
  const topLaunches = sorted[0];
  const topConv = [...data].sort(
    (a, b) => {
      const aConv = a.opens > 0 ? ((a.ctaClicks || 0) / a.opens) : 0;
      const bConv = b.opens > 0 ? ((b.ctaClicks || 0) / b.opens) : 0;
      return bConv - aConv;
    },
  )[0];

  // Category breakdown
  const categories = {};
  data.forEach((b) => {
    if (!categories[b.category]) categories[b.category] = { launches: 0, opens: 0, ctaClicks: 0, count: 0 };
    categories[b.category].launches += (b.launches || 0);
    categories[b.category].opens += (b.opens || 0);
    categories[b.category].ctaClicks += (b.ctaClicks || 0);
    categories[b.category].count++;
  });

  return (
    <div className="panel ball-engagement-section" style={{ animationDelay: '700ms' }}>
      <div className="panel-header">
        <span className="panel-title">Ball Engagement Funnel</span>
        <span className="panel-badge">physics playground metrics</span>
      </div>

      {/* Visual funnel + table side by side on desktop */}
      <div className="engagement-layout">
        <FunnelViz totals={funnelTotals} />

        <div className="engagement-table-wrap">
          {/* Bar metric toggle */}
          <div className="engagement-bar-toggle">
            <span className="bar-toggle-label">Volume bars:</span>
            {BAR_METRICS.map((m) => (
              <button
                key={m.key}
                className={`bar-toggle-btn ${barMetric === m.key ? 'active' : ''}`}
                onClick={() => setBarMetric(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Column headers */}
          <div className="ball-row ball-header">
            <span>Ball</span>
            <span>Volume</span>
            <span className="ball-stat">Launches</span>
            <span className="ball-stat">Scores</span>
            <span className="ball-stat">Opens</span>
            <span className="ball-stat">Clicks</span>
            <span className="ball-stat">Acc%</span>
            <span className="ball-stat">Conv%</span>
          </div>

          {data.map((ball, i) => (
            <BallRow key={ball.id} ball={ball} maxBarVal={maxBarVal} barMetric={barMetric} index={i} />
          ))}
        </div>
      </div>

      {/* Category breakdown chips */}
      <div className="category-breakdown">
        {Object.entries(categories).map(([cat, catData]) => {
          const conv = catData.opens > 0 ? (((catData.ctaClicks) / catData.opens) * 100).toFixed(0) : '0';
          return (
            <div key={cat} className="cat-chip">
              <span className="cat-name">{cat}</span>
              <span className="cat-count">{catData.count} balls</span>
              <span className="cat-conv">{conv}%</span>
            </div>
          );
        })}
      </div>

      {/* Insight */}
      {topLaunches && topConv && (
        <div className="insight-box">
          <span className="insight-icon">Insight:</span>{' '}
          <span className="insight-text">
            &ldquo;{topLaunches.ball}&rdquo; drives the most engagement ({topLaunches.launches} launches),
            while &ldquo;{topConv.ball}&rdquo; converts best at
            {' '}{topConv.opens > 0 ? (((topConv.ctaClicks || 0) / topConv.opens) * 100).toFixed(0) : 0}% open-to-CTA.
            Overall accuracy is{' '}
            {funnelTotals.launches > 0 ? ((funnelTotals.scores / funnelTotals.launches) * 100).toFixed(1) : '0.0'}% and{' '}
            {funnelTotals.opens > 0 ? ((funnelTotals.ctaClicks / funnelTotals.opens) * 100).toFixed(1) : '0.0'}% of
            detail views lead to a CTA click.
          </span>
        </div>
      )}
    </div>
  );
}
