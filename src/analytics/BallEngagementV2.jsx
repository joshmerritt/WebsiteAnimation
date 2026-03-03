/**
 * BallEngagementV2.jsx — Ball interaction funnel visualization + table
 *
 * Accepts optional `liveData` prop from the GA4 worker.
 * Falls back to mock BALL_ENGAGEMENT data when liveData is null.
 *
 * Features:
 *   - Visual funnel diagram (Click→Launch→Score→Open)
 *   - Per-ball data table with 7 columns
 *   - Category conversion chips
 *   - Auto-generated insight
 */

import { BALL_ENGAGEMENT, FUNNEL_TOTALS } from './data.js';
import FunnelViz from './FunnelViz.jsx';

function BallRow({ ball, maxClicks, index }) {
  const convRate = ball.clicks > 0 ? ((ball.opens / ball.clicks) * 100).toFixed(1) : '0.0';
  const barWidth = maxClicks > 0 ? `${(ball.clicks / maxClicks) * 100}%` : '0%';

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
      <span className="ball-stat">{ball.clicks}</span>
      <span className="ball-stat">{ball.launches}</span>
      <span className="ball-stat">{ball.scores}</span>
      <span className="ball-stat">{ball.opens}</span>
      <span className={`ball-stat ball-conv ${parseFloat(convRate) > 70 ? 'high' : 'mid'}`}>
        {convRate}%
      </span>
    </div>
  );
}

export default function BallEngagement({ liveData }) {
  // Use live data from the worker if available, otherwise fall back to mock
  const data = (liveData && liveData.length > 0) ? liveData : BALL_ENGAGEMENT;

  // Compute funnel totals dynamically from whichever data source we're using
  const funnelTotals = (liveData && liveData.length > 0)
    ? data.reduce(
        (acc, b) => ({
          clicks:   acc.clicks + (b.clicks || 0),
          launches: acc.launches + (b.launches || 0),
          scores:   acc.scores + (b.scores || 0),
          opens:    acc.opens + (b.opens || 0),
        }),
        { clicks: 0, launches: 0, scores: 0, opens: 0 },
      )
    : FUNNEL_TOTALS;

  const maxClicks = Math.max(...data.map((b) => b.clicks || 0));

  const sorted = [...data].sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
  const topClicks = sorted[0];
  const topConv = [...data].sort(
    (a, b) => {
      const aConv = a.clicks > 0 ? (a.opens / a.clicks) : 0;
      const bConv = b.clicks > 0 ? (b.opens / b.clicks) : 0;
      return bConv - aConv;
    },
  )[0];

  // Category breakdown
  const categories = {};
  data.forEach((b) => {
    if (!categories[b.category]) categories[b.category] = { clicks: 0, opens: 0, count: 0 };
    categories[b.category].clicks += (b.clicks || 0);
    categories[b.category].opens += (b.opens || 0);
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
          {/* Column headers */}
          <div className="ball-row ball-header">
            <span>Ball</span>
            <span>Volume</span>
            <span className="ball-stat">Clicks</span>
            <span className="ball-stat">Launches</span>
            <span className="ball-stat">Scores</span>
            <span className="ball-stat">Opens</span>
            <span className="ball-stat">Conv%</span>
          </div>

          {data.map((ball, i) => (
            <BallRow key={ball.id} ball={ball} maxClicks={maxClicks} index={i} />
          ))}
        </div>
      </div>

      {/* Category breakdown chips */}
      <div className="category-breakdown">
        {Object.entries(categories).map(([cat, catData]) => {
          const conv = catData.clicks > 0 ? ((catData.opens / catData.clicks) * 100).toFixed(0) : '0';
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
      {topClicks && topConv && (
        <div className="insight-box">
          <span className="insight-icon">Insight:</span>{' '}
          <span className="insight-text">
            &ldquo;{topClicks.ball}&rdquo; drives the most engagement ({topClicks.clicks} clicks),
            while &ldquo;{topConv.ball}&rdquo; converts best at
            {' '}{topConv.clicks > 0 ? ((topConv.opens / topConv.clicks) * 100).toFixed(0) : 0}% click-to-open.
            Overall, {funnelTotals.clicks > 0 ? ((funnelTotals.opens / funnelTotals.clicks) * 100).toFixed(1) : '0.0'}% of
            ball interactions lead to a project detail view — the demo ball drives most initial exploration.
          </span>
        </div>
      )}
    </div>
  );
}
