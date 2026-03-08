/**
 * ShotChart.jsx — Physics playground shot visualization (v3 redesign)
 *
 * Two-zone court diagram matching the portfolio layout:
 *   LEFT  — "First Point of Contact": score/miss heatmap dots + category labels + goal posts
 *   RIGHT — "Launch Frequency": horizontally arranged balls sorted by launches (most→least)
 *
 * Features:
 *   - Area-proportional ball sizing (r = base × √(launches/max))
 *   - Accuracy shown as outer ring arc on each ball
 *   - Score/miss dots from real impact data when available, fallback to seeded scatter
 *   - Category highlight on label hover, ball hover tooltips
 *   - All-time / session toggle (centered top)
 *   - Rich HTML legend below the SVG
 *   - Compact stat strip
 *   - Filters out "(not set)" events
 *
 * Props:
 *   liveData    — array of ball objects from GA4 worker (optional)
 *   sessionData — { shots, makes, ballStats: Map<id, {launches,scores}>, impacts: [] } (optional)
 */

import { useState, useMemo } from 'react';
import { BALL_ENGAGEMENT } from './data.js';

// ── Seeded random ─────────────────────────────────────────────────────
function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

// ── Filter out "(not set)" balls ──────────────────────────────────────
function filterValid(balls) {
  return balls.filter(b =>
    b.ball !== '(not set)' && b.id !== '(not set)' &&
    b.ball !== 'not set' && b.id !== 'not set' &&
    b.ball && b.id
  );
}

// ── Generate score/miss dots ──────────────────────────────────────────
// Uses real impact data (from __dadatadad_impacts) when available,
// falls back to seeded random scatter based on score/miss counts.
function generateDots(balls, seed = 7, impacts) {
  // If we have real impact data, use actual coordinates
  if (impacts && impacts.length > 0) {
    const dots = [];
    impacts.forEach(imp => {
      if (!imp.ballId || !imp.x || !imp.y) return;
      // Map normalized coords (0-1) to SVG left zone (x: 20-320, y: 50-370)
      const svgX = 20 + imp.x * 300;
      const svgY = 50 + imp.y * 320;
      const ball = balls.find(b => b.id === imp.ballId);
      dots.push({
        x: svgX, y: svgY,
        type: imp.hitType === 'menu' ? 'score' : 'miss',
        ballId: imp.ballId,
        color: ball?.color || '#888',
        category: ball?.category || imp.ballCategory || '',
      });
    });
    return dots;
  }

  // Fallback: seeded random scatter
  const rand = seededRand(seed);
  const dots = [];
  balls.forEach((ball) => {
    const misses = Math.max(0, (ball.launches || 0) - (ball.scores || 0));
    const scores = ball.scores || 0;
    // Score dots cluster near the upper zone (x: 30–280, y: 55–250)
    for (let i = 0; i < Math.min(scores, 40); i++) {
      dots.push({ x: 30 + rand() * 250, y: 55 + rand() * 200, type: 'score', ballId: ball.id, color: ball.color, category: ball.category });
    }
    // Miss dots scatter wider (x: 40–310, y: 45–300)
    for (let i = 0; i < Math.min(misses, 20); i++) {
      dots.push({ x: 40 + rand() * 270, y: 45 + rand() * 260, type: 'miss', ballId: ball.id, color: ball.color, category: ball.category });
    }
  });
  return dots;
}

// ── Horizontal ball layout sorted by launches (most→least, left→right) ──
function layoutBalls(balls) {
  const sorted = [...balls].sort((a, b) => (b.launches || 0) - (a.launches || 0));
  const count = sorted.length;
  if (count === 0) return [];

  // Horizontal band: x from 355 to 720, vertically centered at ~190
  const startX = 355, endX = 720, centerY = 190;
  const totalWidth = endX - startX;
  const step = count > 1 ? totalWidth / (count - 1) : 0;

  return sorted.map((b, i) => ({
    ...b,
    cx: count === 1 ? (startX + endX) / 2 : startX + i * step,
    cy: centerY,
  }));
}

const CATEGORY_ORDER = ['Technology', 'Business', 'Apps', 'Me'];
// Push categories to the bottom of the left zone to leave room for contact dots above
const CATEGORY_Y = { Technology: 280, Business: 310, Apps: 340, Me: 370 };

function shortName(name) {
  const map = {
    'Black Sheep Dart League': 'Dart League',
    'Microsoft Power BI': 'Power BI',
    'Google Data Studio Streaming Dashboard': 'Data Studio',
    'Google Data Studio': 'Data Studio',
    'The Wine You Drink': 'Wine App',
    'Smart Chicken Coop': 'Coop',
    'Portfolio Website': 'Portfolio',
    'Site Analytics': 'Analytics',
    'Josh Merritt': 'Josh',
  };
  return map[name] || (name.length <= 12 ? name : name.slice(0, 10) + '\u2026');
}


export default function ShotChart({ liveData, sessionData }) {
  const [mode, setMode] = useState('all');
  const [hoveredBall, setHoveredBall] = useState(null);
  const [hoveredCat, setHoveredCat] = useState(null);

  const allTimeData = useMemo(() => {
    const raw = (liveData && liveData.length > 0) ? liveData : BALL_ENGAGEMENT;
    return filterValid(raw);
  }, [liveData]);

  const sessionBalls = useMemo(() => {
    if (!sessionData?.ballStats) return allTimeData.map(b => ({ ...b, launches: 0, scores: 0, opens: 0, ctaClicks: 0 }));
    return allTimeData.map(b => {
      const s = sessionData.ballStats.get(b.id) || { launches: 0, scores: 0 };
      return { ...b, launches: s.launches, scores: s.scores, opens: 0, ctaClicks: 0 };
    });
  }, [allTimeData, sessionData]);

  const data = mode === 'session' ? sessionBalls : allTimeData;
  const maxLaunches = Math.max(...data.map(b => b.launches || 0), 1);
  const BASE_R = 30, MIN_R = 9;

  const ballsWithPos = useMemo(() =>
    layoutBalls(data).map(b => ({
      ...b,
      r: Math.max(MIN_R, BASE_R * Math.sqrt((b.launches || 0) / maxLaunches)),
      acc: b.launches > 0 ? b.scores / b.launches : 0,
    })),
    [data, maxLaunches]);

  const dots = useMemo(() =>
    generateDots(data, mode === 'session' ? 99 : 7, mode === 'session' ? sessionData?.impacts : null),
    [data, mode, sessionData]);

  const totalShots = data.reduce((s, b) => s + (b.launches || 0), 0);
  const totalScores = data.reduce((s, b) => s + (b.scores || 0), 0);
  const accuracy = totalShots > 0 ? ((totalScores / totalShots) * 100).toFixed(1) : '0.0';
  const topBall = [...data].sort((a, b) => (b.launches || 0) - (a.launches || 0))[0];

  const anyHover = hoveredBall || hoveredCat;
  const isLit = (b) => (!hoveredCat || b.category === hoveredCat) && (!hoveredBall || b.id === hoveredBall);
  const isDotLit = (d) => (!hoveredCat || d.category === hoveredCat) && (!hoveredBall || d.ballId === hoveredBall);
  const tooltipBall = hoveredBall ? ballsWithPos.find(b => b.id === hoveredBall) : null;

  const W = 740, H = 410;

  // Goal post positions — pushed down to leave room for contact dots above
  const goalDotY = 250;
  const goalDot1X = 42;
  const goalDot2X = 110;

  return (
    <div className="shot-chart-wrap">
      {/* Toggle — centered top */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
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

        {/* Zone titles — compact */}
        <text x={170} y={28} textAnchor="middle" className="shot-zone-title shot-zone-title--lg">FIRST POINT OF CONTACT</text>
        <text x={170} y={40} textAnchor="middle" className="shot-zone-title shot-zone-title--sub">score &amp; miss heatmap</text>
        <text x={530} y={28} textAnchor="middle" className="shot-zone-title shot-zone-title--lg">LAUNCH FREQUENCY</text>
        <text x={530} y={40} textAnchor="middle" className="shot-zone-title shot-zone-title--sub">sorted by volume</text>

        {/* Zone divider */}
        <line x1="340" y1="50" x2="340" y2={H - 20} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

        {/* Dots — contact heatmap */}
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.type === 'score' ? 3.2 : 2.4}
            fill={d.type === 'score' ? '#6B9F6B' : '#C05050'}
            opacity={!anyHover || isDotLit(d) ? (d.type === 'score' ? 0.5 : 0.3) : 0.04}
            className="shot-dot" style={{ animationDelay: `${600 + i * 6}ms` }} />
        ))}

        {/* Goal posts — pushed down below the dot scatter zone */}
        <circle cx={goalDot1X} cy={goalDotY} r="5" fill="none" stroke="rgba(89,133,177,0.4)" strokeWidth="1.5" />
        <circle cx={goalDot2X} cy={goalDotY} r="5" fill="none" stroke="rgba(89,133,177,0.4)" strokeWidth="1.5" />
        <text x={76} y={goalDotY + 4} textAnchor="middle" className="shot-goal-label">GOAL</text>

        {/* Net lines from goal posts down */}
        <line x1={goalDot1X} y1={goalDotY + 6} x2={goalDot1X} y2={H - 25} stroke="rgba(89,133,177,0.08)" strokeWidth="1" strokeDasharray="3,5" />
        <line x1={goalDot2X} y1={goalDotY + 6} x2={goalDot2X} y2={H - 25} stroke="rgba(89,133,177,0.08)" strokeWidth="1" strokeDasharray="3,5" />

        {/* Category labels — at bottom of left zone, compact */}
        {CATEGORY_ORDER.map(cat => {
          const y = CATEGORY_Y[cat], active = hoveredCat === cat, dim = anyHover && !active && hoveredCat;
          return (
            <g key={cat}>
              <rect x="0" y={y - 12} width="150" height="26" fill="transparent" style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredCat(cat)} onMouseLeave={() => setHoveredCat(null)} />
              <text x={76} y={y + 4} textAnchor="middle" className="shot-cat-label"
                opacity={dim ? 0.12 : active ? 1 : 0.55} fontWeight={active ? 700 : 500}>{cat}</text>
            </g>
          );
        })}

        {/* Balls with accuracy ring overlay — horizontal layout */}
        {ballsWithPos.map((ball, i) => {
          const lit = isLit(ball), isHov = hoveredBall === ball.id;
          const ringR = ball.r + 4;
          const circ = 2 * Math.PI * ringR;
          const accPct = ball.acc;
          const accColor = accPct > 0.8 ? '#6B9F6B' : accPct > 0.6 ? '#D4A843' : '#C05050';

          return (
            <g key={ball.id} onMouseEnter={() => setHoveredBall(ball.id)} onMouseLeave={() => setHoveredBall(null)} style={{ cursor: 'pointer' }}>
              {/* Glow on hover */}
              {isHov && <circle cx={ball.cx} cy={ball.cy} r={ball.r + 8} fill="none" stroke={ball.color} strokeWidth="1.5" opacity="0.3" filter="url(#ball-glow)" />}

              {/* Accuracy ring — background track */}
              <circle cx={ball.cx} cy={ball.cy} r={ringR} fill="none"
                stroke="rgba(255,255,255,0.06)" strokeWidth="2.5"
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

              {/* Launch count inside ball (if big enough) */}
              {ball.r >= 16 && (
                <text x={ball.cx} y={ball.cy + 3} textAnchor="middle" className="shot-ball-count"
                  opacity={anyHover && !lit ? 0.08 : 0.5}>{ball.launches}</text>
              )}

              {/* Ball name below — compact */}
              <text x={ball.cx} y={ball.cy + ball.r + 14} textAnchor="middle" className="shot-ball-name"
                opacity={anyHover && !lit ? 0.08 : 0.65}>{shortName(ball.ball)}</text>
            </g>
          );
        })}

        {/* Tooltip — redesigned: Scores → Launches = Acc%, CTA % */}
        {tooltipBall && (() => {
          const b = tooltipBall;
          const acc = b.launches > 0 ? ((b.scores / b.launches) * 100).toFixed(0) : '0';
          const conv = b.opens > 0 ? (((b.ctaClicks || 0) / b.opens) * 100).toFixed(0) : '\u2014';
          const tw = 160, th = 84;
          const tx = b.cx - b.r - tw - 10 > 0 ? b.cx - b.r - tw - 8 : b.cx + b.r + 8;
          const ty = Math.min(Math.max(b.cy - th / 2, 4), H - th - 4);
          const accColor = parseFloat(acc) > 75 ? '#6B9F6B' : parseFloat(acc) > 50 ? '#D4A843' : '#C05050';
          return (
            <g className="shot-tooltip">
              <rect x={tx} y={ty} width={tw} height={th} rx="6" fill="rgba(6,10,16,0.95)" stroke={`${b.color}55`} strokeWidth="1" />
              {/* Ball name */}
              <text x={tx + 10} y={ty + 16} fill="#fff" fontSize="11" fontWeight="600" fontFamily="'DM Sans', sans-serif">{b.ball}</text>
              {/* Scores row */}
              <text x={tx + 10} y={ty + 33} fill="rgba(255,255,255,0.45)" fontSize="9" fontFamily="'JetBrains Mono', monospace">Scores</text>
              <text x={tx + 62} y={ty + 33} fill="#6B9F6B" fontSize="10" fontFamily="'JetBrains Mono', monospace" fontWeight="600">{b.scores}</text>
              {/* Launches row with = accuracy */}
              <text x={tx + 10} y={ty + 48} fill="rgba(255,255,255,0.45)" fontSize="9" fontFamily="'JetBrains Mono', monospace">Launches</text>
              <text x={tx + 62} y={ty + 48} fill="rgba(255,255,255,0.8)" fontSize="10" fontFamily="'JetBrains Mono', monospace" fontWeight="600">{b.launches}</text>
              <text x={tx + 96} y={ty + 48} fill="rgba(255,255,255,0.25)" fontSize="10" fontFamily="'JetBrains Mono', monospace">=</text>
              <text x={tx + 108} y={ty + 48} fill={accColor} fontSize="11" fontFamily="'JetBrains Mono', monospace" fontWeight="700">{acc}%</text>
              {/* Divider line */}
              <line x1={tx + 10} y1={ty + 56} x2={tx + tw - 10} y2={ty + 56} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
              {/* CTA Conv row */}
              <text x={tx + 10} y={ty + 72} fill="rgba(255,255,255,0.35)" fontSize="9" fontFamily="'JetBrains Mono', monospace">CTA Conv</text>
              <text x={tx + 62} y={ty + 72} fill={conv !== '\u2014' && parseFloat(conv) > 70 ? '#7B5EA7' : '#D4A843'} fontSize="10" fontFamily="'JetBrains Mono', monospace" fontWeight="600">{conv}{conv !== '\u2014' ? '%' : ''}</text>
            </g>
          );
        })()}
      </svg>

      {/* Legend — rich HTML section below SVG */}
      <div className="shot-legend">
        <div className="shot-legend-group">
          <span className="shot-legend-heading">Impact Dots</span>
          <div className="shot-legend-items">
            <div className="shot-legend-item">
              <span className="shot-legend-dot shot-legend-dot--score" />
              <span className="shot-legend-label">Score</span>
            </div>
            <div className="shot-legend-item">
              <span className="shot-legend-dot shot-legend-dot--miss" />
              <span className="shot-legend-label">Miss</span>
            </div>
          </div>
        </div>
        <span className="shot-legend-sep" />
        <div className="shot-legend-group">
          <span className="shot-legend-heading">Ball Size</span>
          <div className="shot-legend-items">
            <div className="shot-legend-item">
              <span className="shot-legend-circle shot-legend-circle--sm" />
              <span className="shot-legend-circle shot-legend-circle--lg" />
              <span className="shot-legend-label">area = launches</span>
            </div>
          </div>
        </div>
        <span className="shot-legend-sep" />
        <div className="shot-legend-group">
          <span className="shot-legend-heading">Accuracy Ring</span>
          <div className="shot-legend-items">
            <div className="shot-legend-item">
              <svg width="20" height="20" viewBox="0 0 20 20" className="shot-legend-ring-svg">
                <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                <circle cx="10" cy="10" r="8" fill="none" stroke="#D4A843" strokeWidth="2" strokeLinecap="round"
                  strokeDasharray={`${Math.PI * 16 * 0.5} ${Math.PI * 16 * 0.5}`}
                  strokeDashoffset={Math.PI * 16 * 0.25} opacity="0.7" />
              </svg>
              <span className="shot-legend-label shot-legend-label--gold">50%</span>
            </div>
            <div className="shot-legend-item">
              <svg width="20" height="20" viewBox="0 0 20 20" className="shot-legend-ring-svg">
                <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                <circle cx="10" cy="10" r="8" fill="none" stroke="#6B9F6B" strokeWidth="2" strokeLinecap="round"
                  strokeDasharray={`${Math.PI * 16 * 0.9} ${Math.PI * 16 * 0.1}`}
                  strokeDashoffset={Math.PI * 16 * 0.25} opacity="0.7" />
              </svg>
              <span className="shot-legend-label shot-legend-label--green">90%</span>
            </div>
          </div>
        </div>
      </div>

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
