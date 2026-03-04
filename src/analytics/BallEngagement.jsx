/**
 * BallEngagement.jsx — Ball engagement table (V1)
 *
 * Columns: Ball, Volume, Launches, Scores, Acc%, Opens, Clicks (CTA), %CTR
 *   - Acc% = scores / launches
 *   - Clicks = CTA clicks from the detail modal
 *   - %CTR = ctaClicks / opens
 *
 * Volume bar metric is toggleable: Launches, Scores, Opens, Clicks
 */

import { useState } from 'react';
import { BALL_ENGAGEMENT } from './data.js';

const BAR_METRICS = [
  { key: 'launches',  label: 'Launches' },
  { key: 'scores',    label: 'Scores' },
  { key: 'opens',     label: 'Opens' },
  { key: 'ctaClicks', label: 'Clicks' },
];

function BallRow({ ball, maxBarVal, barMetric, index }) {
  const accuracy = ball.launches > 0 ? ((ball.scores / ball.launches) * 100).toFixed(1) : '0.0';
  const ctr = ball.opens > 0 ? (((ball.ctaClicks || 0) / ball.opens) * 100).toFixed(1) : '0.0';
  const barVal = ball[barMetric] || 0;
  const barWidth = maxBarVal > 0 ? `${(barVal / maxBarVal) * 100}%` : '0%';

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
      <span className="ball-stat">{ball.launches}</span>
      <span className="ball-stat">{ball.scores}</span>
      <span className={`ball-stat ball-acc ${parseFloat(accuracy) > 80 ? 'high' : 'mid'}`}>
        {accuracy}%
      </span>
      <span className="ball-stat">{ball.opens}</span>
      <span className="ball-stat">{ball.ctaClicks || 0}</span>
      <span className={`ball-stat ball-conv ${parseFloat(ctr) > 70 ? 'high' : 'mid'}`}>
        {ctr}%
      </span>
    </div>
  );
}

export default function BallEngagement({ liveData }) {
  const [barMetric, setBarMetric] = useState('launches');

  const data = (liveData && liveData.length > 0) ? liveData : BALL_ENGAGEMENT;

  const maxBarVal = Math.max(...data.map((b) => b[barMetric] || 0));
  const sorted = [...data].sort((a, b) => (b.launches || 0) - (a.launches || 0));
  const topLaunches = sorted[0];
  const topCtr = [...data].sort(
    (a, b) => {
      const aCtr = a.opens > 0 ? ((a.ctaClicks || 0) / a.opens) : 0;
      const bCtr = b.opens > 0 ? ((b.ctaClicks || 0) / b.opens) : 0;
      return bCtr - aCtr;
    },
  )[0];

  const categories = {};
  data.forEach((b) => {
    if (!categories[b.category]) categories[b.category] = { opens: 0, ctaClicks: 0 };
    categories[b.category].opens += (b.opens || 0);
    categories[b.category].ctaClicks += (b.ctaClicks || 0);
  });

  return (
    <div className="panel ball-engagement" style={{ animationDelay: '800ms' }}>
      <div className="panel-header">
        <span className="panel-title">Ball Engagement Funnel</span>
        <span className="panel-badge">
          {'\uD83C\uDFB1'} physics playground metrics
        </span>
      </div>

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

      <div className="ball-row ball-header">
        <span>Ball</span>
        <span>Volume</span>
        <span className="ball-stat">Launches</span>
        <span className="ball-stat">Scores</span>
        <span className="ball-stat">Acc%</span>
        <span className="ball-stat">Opens</span>
        <span className="ball-stat">Clicks</span>
        <span className="ball-stat">%CTR</span>
      </div>

      {data.map((ball, i) => (
        <BallRow key={ball.id} ball={ball} maxBarVal={maxBarVal} barMetric={barMetric} index={i} />
      ))}

      <div className="category-breakdown">
        {Object.entries(categories).map(([cat, catData]) => {
          const ctr = catData.opens > 0 ? ((catData.ctaClicks / catData.opens) * 100).toFixed(0) : '0';
          return (
            <div key={cat} className="cat-chip">
              <span className="cat-name">{cat}</span>
              <span className="cat-conv">{ctr}%</span>
            </div>
          );
        })}
      </div>

      {topLaunches && topCtr && (
        <div className="insight-box">
          <span className="insight-icon">{'\uD83D\uDCA1'} Insight:</span>{' '}
          <span className="insight-text">
            &ldquo;{topLaunches.ball}&rdquo; has the highest engagement ({topLaunches.launches} launches)
            while &ldquo;{topCtr.ball}&rdquo; converts best at
            {' '}{topCtr.opens > 0 ? (((topCtr.ctaClicks || 0) / topCtr.opens) * 100).toFixed(0) : 0}% open-to-CTA.
          </span>
        </div>
      )}
    </div>
  );
}
