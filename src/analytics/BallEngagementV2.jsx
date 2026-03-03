/**
 * BallEngagement.jsx — Ball interaction funnel visualization + table
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
  const convRate = ((ball.opens / ball.clicks) * 100).toFixed(1);
  const barWidth = `${(ball.clicks / maxClicks) * 100}%`;

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

export default function BallEngagement() {
  const maxClicks = Math.max(...BALL_ENGAGEMENT.map((b) => b.clicks));

  const sorted = [...BALL_ENGAGEMENT].sort((a, b) => b.clicks - a.clicks);
  const topClicks = sorted[0];
  const topConv = [...BALL_ENGAGEMENT].sort(
    (a, b) => (b.opens / b.clicks) - (a.opens / a.clicks),
  )[0];

  // Category breakdown
  const categories = {};
  BALL_ENGAGEMENT.forEach((b) => {
    if (!categories[b.category]) categories[b.category] = { clicks: 0, opens: 0, count: 0 };
    categories[b.category].clicks += b.clicks;
    categories[b.category].opens += b.opens;
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
        <FunnelViz totals={FUNNEL_TOTALS} />

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

          {BALL_ENGAGEMENT.map((ball, i) => (
            <BallRow key={ball.id} ball={ball} maxClicks={maxClicks} index={i} />
          ))}
        </div>
      </div>

      {/* Category breakdown chips */}
      <div className="category-breakdown">
        {Object.entries(categories).map(([cat, data]) => {
          const conv = ((data.opens / data.clicks) * 100).toFixed(0);
          return (
            <div key={cat} className="cat-chip">
              <span className="cat-name">{cat}</span>
              <span className="cat-count">{data.count} balls</span>
              <span className="cat-conv">{conv}%</span>
            </div>
          );
        })}
      </div>

      {/* Insight */}
      <div className="insight-box">
        <span className="insight-icon">Insight:</span>{' '}
        <span className="insight-text">
          &ldquo;{topClicks.ball}&rdquo; drives the most engagement ({topClicks.clicks} clicks),
          while &ldquo;{topConv.ball}&rdquo; converts best at
          {' '}{((topConv.opens / topConv.clicks) * 100).toFixed(0)}% click-to-open.
          Overall, {((FUNNEL_TOTALS.opens / FUNNEL_TOTALS.clicks) * 100).toFixed(1)}% of
          ball interactions lead to a project detail view — the demo ball drives most initial exploration.
        </span>
      </div>
    </div>
  );
}
