/**
 * BallEngagement.jsx — Ball interaction funnel table
 *
 * Unique to DaDataDad.com — tracks clicks → scores → opens
 * for each project ball in the physics playground.
 */

import { BALL_ENGAGEMENT } from './data.js';

function BallRow({ ball, index }) {
  const convRate = ((ball.opens / ball.clicks) * 100).toFixed(1);
  const barWidth = `${(ball.clicks / 320) * 100}%`;

  return (
    <div
      className="ball-row"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="ball-name">
        <span className="ball-dot" style={{ background: ball.color }} />
        <span>{ball.ball}</span>
      </div>
      <div className="ball-funnel-bar">
        <div
          className="ball-funnel-fill"
          style={{
            width: barWidth,
            background: `linear-gradient(90deg, ${ball.color}88, ${ball.color}33)`,
          }}
        />
      </div>
      <span className="ball-stat">{ball.clicks}</span>
      <span className="ball-stat">{ball.scores}</span>
      <span className="ball-stat">{ball.opens}</span>
      <span className={`ball-stat ball-conv ${parseFloat(convRate) > 70 ? 'high' : 'mid'}`}>
        {convRate}%
      </span>
    </div>
  );
}

export default function BallEngagement() {
  // Find the highest conv rate and longest session ball for insight
  const sorted = [...BALL_ENGAGEMENT].sort((a, b) => b.clicks - a.clicks);
  const topClicks = sorted[0];
  const topConv = [...BALL_ENGAGEMENT].sort(
    (a, b) => (b.opens / b.clicks) - (a.opens / a.clicks),
  )[0];

  return (
    <div className="panel ball-engagement" style={{ animationDelay: '800ms' }}>
      <div className="panel-header">
        <span className="panel-title">Ball Engagement Funnel</span>
        <span className="panel-badge">
          \uD83C\uDFB1 physics playground metrics
        </span>
      </div>

      {/* Column headers */}
      <div className="ball-row ball-header">
        <span>Ball</span>
        <span>Funnel</span>
        <span className="ball-stat">Clicks</span>
        <span className="ball-stat">Scores</span>
        <span className="ball-stat">Opens</span>
        <span className="ball-stat">Conv%</span>
      </div>

      {BALL_ENGAGEMENT.map((ball, i) => (
        <BallRow key={ball.ball} ball={ball} index={i} />
      ))}

      {/* Insight */}
      <div className="insight-box">
        <span className="insight-icon">\uD83D\uDCA1 Insight:</span>{' '}
        <span className="insight-text">
          &ldquo;{topClicks.ball}&rdquo; has the highest click volume ({topClicks.clicks})
          but &ldquo;{topConv.ball}&rdquo; has the best conversion rate
          ({((topConv.opens / topConv.clicks) * 100).toFixed(0)}%).
          Visitors who engage with it are more likely to view the full project detail.
        </span>
      </div>
    </div>
  );
}
