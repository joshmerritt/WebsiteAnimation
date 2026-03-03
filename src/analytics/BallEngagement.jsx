import { BALL_ENGAGEMENT } from './data.js';

function BallRow({ ball, maxClicks, index }) {
  const convRate = ball.clicks > 0 ? ((ball.opens / ball.clicks) * 100).toFixed(1) : '0.0';
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

export default function BallEngagement({ liveData }) {
  const data = (liveData && liveData.length > 0) ? liveData : BALL_ENGAGEMENT;

  const maxClicks = Math.max(...data.map((b) => b.clicks));
  const sorted = [...data].sort((a, b) => b.clicks - a.clicks);
  const topClicks = sorted[0];
  const topConv = [...data].sort(
    (a, b) => (b.opens / b.clicks) - (a.opens / a.clicks),
  )[0];

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
          {'\uD83C\uDFB1'} physics playground metrics
        </span>
      </div>

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

      <div className="category-breakdown">
        {Object.entries(categories).map(([cat, catData]) => {
          const conv = catData.clicks > 0 ? ((catData.opens / catData.clicks) * 100).toFixed(0) : '0';
          return (
            <div key={cat} className="cat-chip">
              <span className="cat-name">{cat}</span>
              <span className="cat-conv">{conv}%</span>
            </div>
          );
        })}
      </div>

      {topClicks && topConv && (
        <div className="insight-box">
          <span className="insight-icon">{'\uD83D\uDCA1'} Insight:</span>{' '}
          <span className="insight-text">
            &ldquo;{topClicks.ball}&rdquo; has the highest engagement ({topClicks.clicks} clicks)
            while &ldquo;{topConv.ball}&rdquo; converts best at
            {' '}{topConv.clicks > 0 ? ((topConv.opens / topConv.clicks) * 100).toFixed(0) : 0}% click-to-open.
            The demo ball (first launch) drives most initial exploration.
          </span>
        </div>
      )}
    </div>
  );
}
