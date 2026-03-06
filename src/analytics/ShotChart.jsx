/**
 * ShotChart.jsx — Physics playground shot visualization (v3)
 *
 * Two-zone court diagram matching the portfolio layout:
 *   LEFT  — "First Point of Contact": score/miss heatmap dots + category labels + goal posts
 *   RIGHT — "Launch Frequency": area-scaled project balls with accuracy ring overlay
 *
 * Features:
 *   - Area-proportional ball sizing (r = base × √(launches/max))
 *   - Accuracy shown as outer ring arc on each ball (no separate gauge)
 *   - Score/miss dots scattered in the contact zone
 *   - Category highlight on label hover, ball hover tooltips
 *   - All-time / session toggle (centered top)
 *   - Legend includes accuracy ring examples (50%, 90%)
 *   - Compact stat strip
 *
 * Props:
 *   liveData    — array of ball objects from GA4 worker (optional)
 *   sessionData — { shots, makes, ballStats: Map<id, {launches,scores}> } (optional)
 */

import { useState, useMemo } from 'react';
import { BALL_ENGAGEMENT } from './data.js';

// ── Seeded random ─────────────────────────────────────────────────────
function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

// ── Generate score/miss dots ──────────────────────────────────────────
function generateDots(balls, seed = 7) {
  const rand = seededRand(seed);
  const dots = [];
  balls.forEach((ball) => {
    const misses = Math.max(0, (ball.launches || 0) - (ball.scores || 0));
    const scores = ball.scores || 0;
    for (let i = 0; i < Math.min(scores, 40); i++) {
      dots.push({ x: 55 + rand() * 200, y: 60 + rand() * 290, type: 'score', ballId: ball.id, color: ball.color, category: ball.category });
    }
    for (let i = 0; i < Math.min(misses, 20); i++) {
      dots.push({ x: 90 + rand() * 260, y: 50 + rand() * 310, type: 'miss', ballId: ball.id, color: ball.color, category: ball.category });
    }
  });
  return dots;
}

// ── Ball grid layout (right zone — matching portfolio 3-col grid) ─────
function layoutBalls(balls) {
  const cols = 3, startX = 440, startY = 80, spacingX = 100, spacingY = 110;
  return balls.map((b, i) => ({
    ...b,
    cx: startX + (i % cols) * spacingX,
    cy: startY + Math.floor(i / cols) * spacingY,
  }));
}

const CATEGORY_ORDER = ['Technology', 'Business', 'Apps', 'Me'];
const CATEGORY_Y = { Technology: 100, Business: 165, Apps: 230, Me: 295 };

function shortName(name) {
  const map = {
    'Black Sheep Dart League': 'Dart League',
    'Microsoft Power BI': 'Power BI',
    'Google Data Studio Streaming Dashboard': 'Data Studio',
    'Google Data Studio': 'Data Studio',
    'The Wine You Drink': 'Wine App',
    'Smart Chicken Coop': 'Chicken Coop',
    'Portfolio Website': 'Portfolio',
    'Site Analytics': 'Analytics',
    'Josh Merritt': 'Josh',
  };
  return map[name] || (name.length <= 14 ? name : name.slice(0, 12) + '\u2026');
}


export default function ShotChart({ liveData, sessionData }) {
  const [mode, setMode] = useState('all');
  const [hoveredBall, setHoveredBall] = useState(null);
  const [hoveredCat, setHoveredCat] = useState(null);

  const allTimeData = (liveData && liveData.length > 0) ? liveData : BALL_ENGAGEMENT;

  const sessionBalls = useMemo(() => {
    if (!sessionData?.ballStats) return allTimeData.map(b => ({ ...b, launches: 0, scores: 0, opens: 0, ctaClicks: 0 }));
    return allTimeData.map(b => {
      const s = sessionData.ballStats.get(b.id) || { launches: 0, scores: 0 };
      return { ...b, launches: s.launches, scores: s.scores, opens: 0, ctaClicks: 0 };
    });
  }, [allTimeData, sessionData]);

  const data = mode === 'session' ? sessionBalls : allTimeData;
  const maxLaunches = Math.max(...data.map(b => b.launches || 0), 1);
  const BASE_R = 34, MIN_R = 10;

  const ballsWithPos = useMemo(() =>
    layoutBalls(data).map(b => ({
      ...b,
      r: Math.max(MIN_R, BASE_R * Math.sqrt((b.launches || 0) / maxLaunches)),
      acc: b.launches > 0 ? b.scores / b.launches : 0,
    })),
    [data, maxLaunches]);

  const dots = useMemo(() => generateDots(data, mode === 'session' ? 99 : 7), [data, mode]);

  const totalShots = data.reduce((s, b) => s + (b.launches || 0), 0);
  const totalScores = data.reduce((s, b) => s + (b.scores || 0), 0);
  const accuracy = totalShots > 0 ? ((totalScores / totalShots) * 100).toFixed(1) : '0.0';
  const topBall = [...data].sort((a, b) => (b.launches || 0) - (a.launches || 0))[0];

  const anyHover = hoveredBall || hoveredCat;
  const isLit = (b) => (!hoveredCat || b.category === hoveredCat) && (!hoveredBall || b.id === hoveredBall);
  const isDotLit = (d) => (!hoveredCat || d.category === hoveredCat) && (!hoveredBall || d.ballId === hoveredBall);
  const tooltipBall = hoveredBall ? ballsWithPos.find(b => b.id === hoveredBall) : null;

  const W = 740, H = 410;

  // Goal post positions (matching portfolio — two dots above categories)
  const goalDotY = 58;
  const goalDot1X = 42;
  const goalDot2X = 110;

  return (
    <div className="shot-chart-wrap">
      {/* Toggle — centered top */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
        <div className="shot-chart-toggle">
          <button className={`sct-btn ${mode === 'all' ? 'sct-btn--active' : ''}`} onClick={() => setMode('all')}>all-time</button>
          <button className={`sct-btn ${mode === 'session' ? 'sct-btn--active' : ''}`} onClick={() => setMode('session')}>session</button>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="shot-chart-svg"
        onMouseLeave={() => { setHoveredBall(null); setHoveredCat(null); }}>
        <defs>
          <filter id="ball-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <rect width={W} height={H} rx="8" fill="rgba(8,12,18,0.6)" />

        {/* Zone titles */}
        <text x={200} y={26} textAnchor="middle" className="shot-zone-title shot-zone-title--lg">FIRST POINT OF CONTACT</text>
        <text x={540} y={26} textAnchor="middle" className="shot-zone-title">LAUNCH FREQUENCY</text>

        {/* Zone divider */}
        <line x1="380" y1="36" x2="380" y2={H - 48} stroke="rgba(255,255,255,0.035)" strokeWidth="1" />

        {/* Goal posts — two dots like the portfolio */}
        <circle cx={goalDot1X} cy={goalDotY} r="5" fill="none" stroke="rgba(89,133,177,0.4)" strokeWidth="1.2" />
        <circle cx={goalDot2X} cy={goalDotY} r="5" fill="none" stroke="rgba(89,133,177,0.4)" strokeWidth="1.2" />

        {/* Net lines from goal posts down */}
        <line x1={goalDot1X} y1={goalDotY + 6} x2={goalDot1X} y2={H - 60} stroke="rgba(89,133,177,0.08)" strokeWidth="1" strokeDasharray="3,5" />
        <line x1={goalDot2X} y1={goalDotY + 6} x2={goalDot2X} y2={H - 60} stroke="rgba(89,133,177,0.08)" strokeWidth="1" strokeDasharray="3,5" />

        {/* Dots */}
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.type === 'score' ? 3.2 : 2.4}
            fill={d.type === 'score' ? '#6B9F6B' : '#C05050'}
            opacity={!anyHover || isDotLit(d) ? (d.type === 'score' ? 0.5 : 0.3) : 0.04}
            className="shot-dot" style={{ animationDelay: `${600 + i * 6}ms` }} />
        ))}

        {/* Category labels — positioned between goal posts, matching portfolio order */}
        {CATEGORY_ORDER.map(cat => {
          const y = CATEGORY_Y[cat], active = hoveredCat === cat, dim = anyHover && !active && hoveredCat;
          return (
            <g key={cat}>
              <rect x="0" y={y - 18} width="130" height="36" fill="transparent" style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredCat(cat)} onMouseLeave={() => setHoveredCat(null)} />
              <text x={76} y={y + 4} textAnchor="middle" className="shot-cat-label"
                opacity={dim ? 0.12 : active ? 1 : 0.4} fontWeight={active ? 700 : 500}>{cat}</text>
            </g>
          );
        })}

        {/* Balls with accuracy ring overlay */}
        {ballsWithPos.map((ball, i) => {
          const lit = isLit(ball), isHov = hoveredBall === ball.id;
          const ringR = ball.r + 5;
          const circ = 2 * Math.PI * ringR;
          const accPct = ball.acc;
          const accColor = accPct > 0.8 ? '#6B9F6B' : accPct > 0.6 ? '#D4A843' : '#C05050';

          return (
            <g key={ball.id} onMouseEnter={() => setHoveredBall(ball.id)} onMouseLeave={() => setHoveredBall(null)} style={{ cursor: 'pointer' }}>
              {/* Glow on hover */}
              {isHov && <circle cx={ball.cx} cy={ball.cy} r={ball.r + 8} fill="none" stroke={ball.color} strokeWidth="1.5" opacity="0.3" filter="url(#ball-glow)" />}

              {/* Accuracy ring — background track */}
              <circle cx={ball.cx} cy={ball.cy} r={ringR} fill="none"
                stroke="rgba(255,255,255,0.04)" strokeWidth="2.5"
                opacity={anyHover && !lit ? 0.08 : 1} />

              {/* Accuracy ring — filled arc */}
              {accPct > 0 && (
                <circle cx={ball.cx} cy={ball.cy} r={ringR} fill="none"
                  stroke={accColor} strokeWidth="2.5" strokeLinecap="round"
                  strokeDasharray={`${circ * accPct} ${circ * (1 - accPct)}`}
                  strokeDashoffset={circ * 0.25}
                  opacity={anyHover && !lit ? 0.06 : 0.65}
                  className="shot-acc-ring" style={{ animationDelay: `${300 + i * 60}ms` }} />
              )}

              {/* Ball fill */}
              <circle cx={ball.cx} cy={ball.cy} r={ball.r}
                fill={`${ball.color}${lit ? '28' : '06'}`} stroke={ball.color} strokeWidth={isHov ? 2 : 1.2}
                opacity={anyHover && !lit ? 0.12 : 1}
                className="shot-ball" style={{ animationDelay: `${i * 70}ms` }} />

              {/* Ball name */}
              <text x={ball.cx} y={ball.cy + ball.r + 18} textAnchor="middle" className="shot-ball-name"
                opacity={anyHover && !lit ? 0.08 : 0.55}>{shortName(ball.ball)}</text>
            </g>
          );
        })}

        {/* Tooltip */}
        {tooltipBall && (() => {
          const b = tooltipBall;
          const acc = b.launches > 0 ? ((b.scores / b.launches) * 100).toFixed(0) : '0';
          const conv = b.opens > 0 ? (((b.ctaClicks || 0) / b.opens) * 100).toFixed(0) : '\u2014';
          const tw = 138, th = 72;
          const tx = b.cx - b.r - tw - 10 > 0 ? b.cx - b.r - tw - 8 : b.cx + b.r + 8;
          const ty = Math.min(Math.max(b.cy - th / 2, 4), H - th - 4);
          return (
            <g className="shot-tooltip">
              <rect x={tx} y={ty} width={tw} height={th} rx="6" fill="rgba(6,10,16,0.93)" stroke={`${b.color}55`} strokeWidth="1" />
              <text x={tx + 10} y={ty + 16} fill="#fff" fontSize="11" fontWeight="600" fontFamily="'DM Sans', sans-serif">{b.ball}</text>
              <text x={tx + 10} y={ty + 32} fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="'JetBrains Mono', monospace">Launches</text>
              <text x={tx + 76} y={ty + 32} fill="rgba(255,255,255,0.7)" fontSize="9" fontFamily="'JetBrains Mono', monospace" fontWeight="600">{b.launches}</text>
              <text x={tx + 10} y={ty + 46} fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="'JetBrains Mono', monospace">Scores</text>
              <text x={tx + 76} y={ty + 46} fill="rgba(255,255,255,0.7)" fontSize="9" fontFamily="'JetBrains Mono', monospace" fontWeight="600">{b.scores}</text>
              <text x={tx + 100} y={ty + 46} fill={parseFloat(acc) > 75 ? '#6B9F6B' : '#D4A843'} fontSize="9" fontFamily="'JetBrains Mono', monospace" fontWeight="700">{acc}%</text>
              <text x={tx + 10} y={ty + 60} fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="'JetBrains Mono', monospace">CTA Conv</text>
              <text x={tx + 76} y={ty + 60} fill={conv !== '\u2014' && parseFloat(conv) > 70 ? '#6B9F6B' : '#D4A843'} fontSize="9" fontFamily="'JetBrains Mono', monospace" fontWeight="600">{conv}{conv !== '\u2014' ? '%' : ''}</text>
            </g>
          );
        })()}

        {/* Legend — bottom left: Score/Miss dots */}
        <g transform={`translate(60, ${H - 28})`}>
          <circle cx="0" cy="0" r="4.5" fill="#6B9F6B" opacity="0.55" />
          <text x="10" y="4" className="shot-legend-text">Score</text>
          <circle cx="62" cy="0" r="4" fill="#C05050" opacity="0.45" />
          <text x="72" y="4" className="shot-legend-text">Miss</text>
        </g>

        {/* Legend — bottom right: Ball scale + accuracy ring examples */}
        <g transform={`translate(420, ${H - 28})`}>
          {/* Ball scale */}
          <circle cx="0" cy="0" r="6" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />
          <circle cx="24" cy="0" r="11" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />
          <text x="42" y="4" className="shot-legend-text">area = launches</text>

          {/* Accuracy ring examples */}
          {/* 50% ring */}
          <circle cx="170" cy="0" r="10" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2" />
          <circle cx="170" cy="0" r="10" fill="none" stroke="#D4A843" strokeWidth="2" strokeLinecap="round"
            strokeDasharray={`${Math.PI * 10} ${Math.PI * 10}`}
            strokeDashoffset={Math.PI * 10 * 0.25}
            opacity="0.65" />
          <text x="170" y="3" textAnchor="middle" className="shot-legend-text" style={{ fontSize: '7px' }}>50%</text>

          {/* 90% ring */}
          <circle cx="200" cy="0" r="10" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2" />
          <circle cx="200" cy="0" r="10" fill="none" stroke="#6B9F6B" strokeWidth="2" strokeLinecap="round"
            strokeDasharray={`${Math.PI * 20 * 0.9} ${Math.PI * 20 * 0.1}`}
            strokeDashoffset={Math.PI * 20 * 0.25}
            opacity="0.65" />
          <text x="200" y="3" textAnchor="middle" className="shot-legend-text" style={{ fontSize: '7px' }}>90%</text>

          <text x="220" y="4" className="shot-legend-text">= accuracy</text>
        </g>
      </svg>

      {/* Stat strip */}
      <div className="shot-stat-strip">
        <div className="shot-stat">
          <span className="shot-stat-val">{totalShots.toLocaleString()}</span>
          <span className="shot-stat-lbl">{mode === 'session' ? 'session shots' : 'total launches'}</span>
        </div>
        <span className="shot-stat-div" />
        <div className="shot-stat">
          <span className="shot-stat-val shot-stat-accent">{accuracy}%</span>
          <span className="shot-stat-lbl">accuracy</span>
        </div>
        <span className="shot-stat-div" />
        <div className="shot-stat">
          <span className="shot-stat-val">{totalScores.toLocaleString()}</span>
          <span className="shot-stat-lbl">scores</span>
        </div>
        {topBall?.launches > 0 && (
          <>
            <span className="shot-stat-div" />
            <div className="shot-stat">
              <span className="shot-stat-val" style={{ color: topBall.color }}>{shortName(topBall.ball)}</span>
              <span className="shot-stat-lbl">most launched</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
