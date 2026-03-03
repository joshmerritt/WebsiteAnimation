/**
 * BallEngagement.jsx — Ball interaction funnel table
 *
 * Unique to DaDataDad.com — tracks the 4-step engagement funnel:
 *   Click → Launch → Score → Open
 * for each of the 8 project balls in the physics playground.
 *
 * Accepts `data` prop (array of ball engagement objects).
 */

function BallRow({ ball, maxClicks, index }) {
  const convRate = ball.clicks > 0
    ? ((ball.opens / ball.clicks) * 100).toFixed(1)
    : '0.0';
  const barWidth = maxClicks > 0 ? `${(ball.clicks / maxClicks) * 100}%` : '0%';

  return (
    <div
      className="ball-row fade-in"
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
      <span className="ball-stat">{ball.launches}</span>
      <span className="ball-stat">{ball.scores}</span>
      <span className="ball-stat">{ball.opens}</span>
      <span className={`ball-stat ball-conv ${parseFloat(convRate) > 70 ? 'high' : 'mid'}`}>
        {convRate}%
      </span>
    </div>
  );
}

export default function BallEngagement({ data = [] }) {
  if (!data.length) {
    return (
      <div className="panel ball-engagement" style={{ animationDelay: '800ms' }}>
        <div className="panel-header">
          <span className="panel-title">Ball Engagement Funnel</span>
        </div>
        <p className="empty-state">No ball engagement data yet. Play with the portfolio to generate events!</p>
      </div>
    );
  }

  const maxClicks = Math.max(...data.map((b) => b.clicks));
  const sorted = [...data].sort((a, b) => b.clicks - a.clicks);
  const topClicks = sorted[0];
  const topConv = [...data].sort(
    (a, b) => (b.clicks > 0 ? b.opens / b.clicks : 0) - (a.clicks > 0 ? a.opens / a.clicks : 0),
  )[0];

  // Category breakdown
  const categories = {};
  data.forEach((b) => {
    if (!categories[b.category]) categories[b.category] = { clicks: 0, opens: 0 };
    categories[b.category].clicks += b.clicks;
    categories[b.category].opens += b.opens;
  });

  return (
    <div className="panel ball-engagement" style={{ animationDelay: '800ms' }}>
      <div className="panel-header">
        <span className="panel-title">Ball Engagement Funnel</span>
        <span className="panel-badge">
          {'🎱'} physics playground metrics
        </span>
      </div>

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

      {sorted.map((ball, i) => (
        <BallRow key={ball.id} ball={ball} maxClicks={maxClicks} index={i} />
      ))}

      {/* Category breakdown */}
      <div className="category-breakdown">
        {Object.entries(categories).map(([cat, catData]) => {
          const conv = catData.clicks > 0
            ? ((catData.opens / catData.clicks) * 100).toFixed(0)
            : '0';
          return (
            <div key={cat} className="cat-chip">
              <span className="cat-name">{cat}</span>
              <span className="cat-conv">{conv}%</span>
            </div>
          );
        })}
      </div>

      {/* Insight */}
      {topClicks && topConv && (
        <div className="insight-box">
          <span className="insight-icon">{'💡'} Insight:</span>{' '}
          <span className="insight-text">
            &ldquo;{topClicks.ball}&rdquo; has the highest engagement ({topClicks.clicks} clicks)
            while &ldquo;{topConv.ball}&rdquo; converts best at
            {' '}{topConv.clicks > 0 ? ((topConv.opens / topConv.clicks) * 100).toFixed(0) : 0}% click-to-open.
          </span>
        </div>
      )}
    </div>
  );
}
