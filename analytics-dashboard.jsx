import React, { useState, useEffect, useRef, useMemo } from 'react';

// ─── Simulated Analytics Data ────────────────────────────────────────
// In production, replace with real GA4/Plausible/PostHog API calls
const generateTimeSeriesData = () => {
  const now = new Date();
  const data = [];
  for (let i = 89; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const base = isWeekend ? 35 : 65;
    const trend = Math.max(0, (90 - i) * 0.4);
    const noise = (Math.random() - 0.5) * 30;
    const spike = (i === 12 || i === 28 || i === 45) ? 80 : 0;
    data.push({
      date: date.toISOString().split('T')[0],
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      visitors: Math.round(Math.max(8, base + trend + noise + spike)),
      pageviews: Math.round(Math.max(12, (base + trend + noise + spike) * 2.3)),
      avgDuration: Math.round(45 + Math.random() * 180),
      bounceRate: Math.round(30 + Math.random() * 35),
    });
  }
  return data;
};

const REFERRER_DATA = [
  { source: 'LinkedIn', visits: 342, pct: 31.2, color: '#0A66C2', icon: 'in' },
  { source: 'Google Search', visits: 289, pct: 26.4, color: '#4285F4', icon: '🔍' },
  { source: 'Twitter/X', visits: 156, pct: 14.2, color: '#8B8B8B', icon: '𝕏' },
  { source: 'Direct', visits: 198, pct: 18.1, color: '#6B9F6B', icon: '→' },
  { source: 'GitHub', visits: 112, pct: 10.2, color: '#C9D1D9', icon: '⌘' },
];

const PAGE_DATA = [
  { path: '/', title: 'Home (Physics Playground)', views: 1847, avgTime: '1:42', trend: 12 },
  { path: '/powerBI', title: 'Power BI Dashboards', views: 623, avgTime: '2:58', trend: 24 },
  { path: '/analytics', title: 'Analytics Portfolio', views: 512, avgTime: '3:12', trend: 18 },
  { path: '/about', title: 'About Me', views: 445, avgTime: '1:15', trend: -3 },
  { path: '/wine-cellar', title: 'Wine Cellar App', views: 398, avgTime: '4:31', trend: 67 },
  { path: '/arduino', title: 'Arduino Coop Door', views: 201, avgTime: '2:05', trend: 5 },
];

const BALL_ENGAGEMENT = [
  { ball: 'Power BI', clicks: 234, scores: 189, opens: 178, color: '#D4A843' },
  { ball: 'Analytics', clicks: 198, scores: 156, opens: 149, color: '#5985B1' },
  { ball: 'Wine Cellar', clicks: 176, scores: 134, opens: 128, color: '#8B1A32' },
  { ball: 'About Me', clicks: 312, scores: 267, opens: 251, color: '#6B9F6B' },
  { ball: 'Arduino', clicks: 145, scores: 112, opens: 98, color: '#BF360C' },
];

// ─── Animated Number Hook ────────────────────────────────────────────
function useAnimatedNumber(target, duration = 1200, delay = 0) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = performance.now();
      const animate = (now) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, duration, delay]);
  return value;
}

// ─── Sparkline Component ─────────────────────────────────────────────
function Sparkline({ data, width = 120, height = 32, color = '#D4A843', filled = false }) {
  if (!data.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {filled && (
        <polygon
          points={`0,${height} ${points} ${width},${height}`}
          fill={`${color}15`}
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      {(() => {
        const last = data[data.length - 1];
        const x = width;
        const y = height - ((last - min) / range) * (height - 4) - 2;
        return <circle cx={x} cy={y} r="2.5" fill={color} />;
      })()}
    </svg>
  );
}

// ─── Mini Bar Chart ──────────────────────────────────────────────────
function MiniBarChart({ data, maxVal, color, height = 40, animate = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height }}>
      {data.map((v, i) => {
        const h = (v / maxVal) * height;
        return (
          <div
            key={i}
            style={{
              width: 6, borderRadius: '2px 2px 0 0',
              backgroundColor: i === data.length - 1 ? color : `${color}55`,
              height: animate ? h : 0,
              transition: `height 0.6s ease-out ${i * 0.03}s`,
              minHeight: 2,
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Area Chart Component ────────────────────────────────────────────
function AreaChart({ data, dataKey, color, width = 680, height = 200, showTooltip = true }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const svgRef = useRef(null);

  const max = Math.max(...data.map(d => d[dataKey])) * 1.1;
  const min = 0;
  const range = max - min || 1;
  const padL = 40, padR = 12, padT = 12, padB = 28;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const toX = (i) => padL + (i / (data.length - 1)) * chartW;
  const toY = (v) => padT + chartH - ((v - min) / range) * chartH;

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d[dataKey])}`).join(' ');
  const areaPath = `${linePath} L${toX(data.length - 1)},${padT + chartH} L${toX(0)},${padT + chartH} Z`;

  // Y-axis grid lines
  const gridLines = 4;
  const gridVals = Array.from({ length: gridLines + 1 }, (_, i) => min + (range / gridLines) * i);

  const handleMouseMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - padL;
    const idx = Math.round((x / chartW) * (data.length - 1));
    setHoverIdx(Math.max(0, Math.min(data.length - 1, idx)));
  };

  return (
    <svg
      ref={svgRef}
      width="100%" height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverIdx(null)}
      style={{ cursor: 'crosshair' }}
    >
      <defs>
        <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid */}
      {gridVals.map((v, i) => (
        <g key={i}>
          <line x1={padL} y1={toY(v)} x2={width - padR} y2={toY(v)}
            stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <text x={padL - 6} y={toY(v) + 4} textAnchor="end"
            fontSize="9" fill="rgba(255,255,255,0.25)"
            fontFamily="'DM Mono', monospace">
            {Math.round(v)}
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {data.filter((_, i) => i % Math.ceil(data.length / 8) === 0).map((d, i) => {
        const idx = data.indexOf(d);
        return (
          <text key={i} x={toX(idx)} y={height - 4} textAnchor="middle"
            fontSize="8" fill="rgba(255,255,255,0.25)"
            fontFamily="'DM Mono', monospace">
            {d.label}
          </text>
        );
      })}

      {/* Area + Line */}
      <path d={areaPath} fill={`url(#grad-${dataKey})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        style={{ animation: 'chartDraw 1.5s ease-out both' }} />

      {/* Hover indicator */}
      {hoverIdx !== null && showTooltip && (
        <g>
          <line x1={toX(hoverIdx)} y1={padT} x2={toX(hoverIdx)} y2={padT + chartH}
            stroke={color} strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
          <circle cx={toX(hoverIdx)} cy={toY(data[hoverIdx][dataKey])} r="4"
            fill={color} stroke="#0A0A0F" strokeWidth="2" />
          <rect x={toX(hoverIdx) - 45} y={toY(data[hoverIdx][dataKey]) - 28}
            width="90" height="22" rx="4" fill="rgba(0,0,0,0.85)"
            stroke={`${color}44`} strokeWidth="1" />
          <text x={toX(hoverIdx)} y={toY(data[hoverIdx][dataKey]) - 14}
            textAnchor="middle" fontSize="10" fill="#fff"
            fontFamily="'DM Sans', sans-serif" fontWeight="500">
            {data[hoverIdx].label}: {data[hoverIdx][dataKey]}
          </text>
        </g>
      )}
    </svg>
  );
}

// ─── Donut Chart ─────────────────────────────────────────────────────
function DonutChart({ segments, size = 120, strokeWidth = 18 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} />
      {segments.map((seg, i) => {
        const dash = (seg.pct / 100) * circumference;
        const gap = circumference - dash;
        const thisOffset = offset;
        offset += dash;
        return (
          <circle key={i} cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={seg.color} strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-thisOffset}
            strokeLinecap="butt"
            style={{
              animation: `donutGrow 1s ease-out ${i * 0.12}s both`,
              opacity: 0.85,
            }}
          />
        );
      })}
    </svg>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────
function StatCard({ label, value, suffix = '', prefix = '', trend, sparkData, color, delay = 0 }) {
  const animVal = useAnimatedNumber(value, 1000, delay);
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12, padding: '16px 18px',
      flex: '1 1 0', minWidth: 140,
      animation: `cardFadeIn 0.6s ease-out ${delay}ms both`,
    }}>
      <div style={{
        fontSize: 10, color: 'rgba(255,255,255,0.35)',
        textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8,
        fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
      }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <span style={{
            fontSize: 28, fontWeight: 700, color: '#fff',
            fontFamily: "'DM Mono', monospace", letterSpacing: -1,
          }}>
            {prefix}{animVal.toLocaleString()}{suffix}
          </span>
          {trend !== undefined && (
            <span style={{
              fontSize: 11, marginLeft: 8,
              color: trend >= 0 ? '#6B9F6B' : '#C05050',
              fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
            }}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
          )}
        </div>
        {sparkData && (
          <Sparkline data={sparkData} color={color || '#D4A843'} width={80} height={28} filled />
        )}
      </div>
    </div>
  );
}

// ─── Ball Engagement Row ─────────────────────────────────────────────
function BallEngagementRow({ ball, index }) {
  const convRate = ((ball.opens / ball.clicks) * 100).toFixed(1);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '110px 1fr 60px 60px 60px 55px',
      alignItems: 'center', gap: 8,
      padding: '10px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      animation: `cardFadeIn 0.4s ease-out ${index * 80}ms both`,
      fontSize: 12, fontFamily: "'DM Mono', monospace",
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: ball.color, flexShrink: 0,
        }} />
        <span style={{ color: '#fff', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12 }}>
          {ball.ball}
        </span>
      </div>
      {/* Funnel bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 18 }}>
        <div style={{
          height: '100%', borderRadius: 3,
          width: `${(ball.clicks / 320) * 100}%`,
          background: `linear-gradient(90deg, ${ball.color}88, ${ball.color}33)`,
          transition: 'width 1s ease-out',
        }} />
      </div>
      <span style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'right' }}>{ball.clicks}</span>
      <span style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'right' }}>{ball.scores}</span>
      <span style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'right' }}>{ball.opens}</span>
      <span style={{
        color: parseFloat(convRate) > 70 ? '#6B9F6B' : '#D4A843',
        textAlign: 'right', fontWeight: 600,
      }}>{convRate}%</span>
    </div>
  );
}

// ═══ MAIN DASHBOARD COMPONENT ═══════════════════════════════════════
export default function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState('90d');
  const [activeMetric, setActiveMetric] = useState('visitors');
  const [isLoaded, setIsLoaded] = useState(false);
  const timeSeriesData = useMemo(() => generateTimeSeriesData(), []);

  useEffect(() => {
    setTimeout(() => setIsLoaded(true), 100);
  }, []);

  const totalVisitors = timeSeriesData.reduce((s, d) => s + d.visitors, 0);
  const totalPageviews = timeSeriesData.reduce((s, d) => s + d.pageviews, 0);
  const avgBounce = Math.round(timeSeriesData.reduce((s, d) => s + d.bounceRate, 0) / timeSeriesData.length);
  const avgDuration = Math.round(timeSeriesData.reduce((s, d) => s + d.avgDuration, 0) / timeSeriesData.length);

  const metricColor = {
    visitors: '#D4A843',
    pageviews: '#5985B1',
    bounceRate: '#C05050',
    avgDuration: '#6B9F6B',
  };

  const ranges = [
    { key: '7d', label: '7D' },
    { key: '30d', label: '30D' },
    { key: '90d', label: '90D' },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0A0A0F 0%, #0D1117 50%, #0A0A0F 100%)',
      color: '#fff',
      fontFamily: "'DM Sans', sans-serif",
      padding: '24px 28px 40px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet" />

      <style>{`
        @keyframes cardFadeIn {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes chartDraw {
          0% { stroke-dashoffset: 2000; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes donutGrow {
          0% { stroke-dashoffset: 800; opacity: 0; }
          100% { stroke-dashoffset: 0; opacity: 0.85; }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(107, 159, 107, 0.3); }
          50% { box-shadow: 0 0 8px 4px rgba(107, 159, 107, 0.15); }
        }
      `}</style>

      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: -100, right: -100,
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(89,133,177,0.06) 0%, transparent 70%)',
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />

      {/* ── Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 24, animation: 'cardFadeIn 0.5s ease-out both',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{
              fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: -0.5,
              fontFamily: "'Playfair Display', serif",
            }}>
              Site Analytics
            </h1>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(107,159,107,0.12)',
              border: '1px solid rgba(107,159,107,0.2)',
              borderRadius: 20, padding: '3px 10px',
              fontSize: 10, color: '#6B9F6B', fontWeight: 600,
              animation: 'pulseGlow 3s ease-in-out infinite',
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#6B9F6B',
              }} />
              Live
            </div>
          </div>
          <p style={{
            fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: 0,
            fontFamily: "'DM Mono', monospace",
          }}>
            DaDataDad.com · Last 90 days
          </p>
        </div>

        {/* Time Range Selector */}
        <div style={{
          display: 'flex', gap: 2,
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 8, padding: 3,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          {ranges.map(r => (
            <button key={r.key} onClick={() => setTimeRange(r.key)} style={{
              padding: '5px 14px', borderRadius: 6, border: 'none',
              background: timeRange === r.key ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: timeRange === r.key ? '#fff' : 'rgba(255,255,255,0.35)',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              transition: 'all 0.2s',
            }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard
          label="Unique Visitors" value={totalVisitors}
          trend={18} delay={100}
          sparkData={timeSeriesData.slice(-30).map(d => d.visitors)}
          color="#D4A843"
        />
        <StatCard
          label="Pageviews" value={totalPageviews}
          trend={24} delay={200}
          sparkData={timeSeriesData.slice(-30).map(d => d.pageviews)}
          color="#5985B1"
        />
        <StatCard
          label="Avg. Duration" value={avgDuration} suffix="s"
          trend={12} delay={300}
          sparkData={timeSeriesData.slice(-30).map(d => d.avgDuration)}
          color="#6B9F6B"
        />
        <StatCard
          label="Bounce Rate" value={avgBounce} suffix="%"
          trend={-8} delay={400}
          sparkData={timeSeriesData.slice(-30).map(d => d.bounceRate)}
          color="#C05050"
        />
      </div>

      {/* ── Main Chart ── */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14, padding: '18px 20px 12px',
        marginBottom: 24,
        animation: 'cardFadeIn 0.6s ease-out 300ms both',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 12,
        }}>
          <span style={{
            fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)',
          }}>Traffic Over Time</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { key: 'visitors', label: 'Visitors', c: '#D4A843' },
              { key: 'pageviews', label: 'Views', c: '#5985B1' },
            ].map(m => (
              <button key={m.key} onClick={() => setActiveMetric(m.key)} style={{
                padding: '3px 10px', borderRadius: 4, border: 'none',
                background: activeMetric === m.key ? `${m.c}22` : 'transparent',
                color: activeMetric === m.key ? m.c : 'rgba(255,255,255,0.3)',
                fontSize: 10, fontWeight: 600, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                transition: 'all 0.2s',
              }}>
                ● {m.label}
              </button>
            ))}
          </div>
        </div>
        <AreaChart
          data={timeSeriesData}
          dataKey={activeMetric}
          color={metricColor[activeMetric]}
        />
      </div>

      {/* ── Two-Column Section ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

        {/* Referral Sources */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 14, padding: 18,
          animation: 'cardFadeIn 0.6s ease-out 500ms both',
        }}>
          <span style={{
            fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)',
            display: 'block', marginBottom: 16,
          }}>Traffic Sources</span>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <DonutChart segments={REFERRER_DATA} size={110} strokeWidth={16} />
            <div style={{ flex: 1 }}>
              {REFERRER_DATA.map((r, i) => (
                <div key={r.source} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '5px 0',
                  animation: `cardFadeIn 0.4s ease-out ${600 + i * 80}ms both`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: 2,
                      background: r.color,
                    }} />
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{r.source}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{
                      fontSize: 11, color: 'rgba(255,255,255,0.35)',
                      fontFamily: "'DM Mono', monospace",
                    }}>{r.visits}</span>
                    <span style={{
                      fontSize: 10, color: r.color, fontWeight: 600,
                      fontFamily: "'DM Mono', monospace",
                      minWidth: 36, textAlign: 'right',
                    }}>{r.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Pages */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 14, padding: 18,
          animation: 'cardFadeIn 0.6s ease-out 600ms both',
        }}>
          <span style={{
            fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)',
            display: 'block', marginBottom: 12,
          }}>Top Pages</span>
          {PAGE_DATA.map((p, i) => (
            <div key={p.path} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: i < PAGE_DATA.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              animation: `cardFadeIn 0.4s ease-out ${700 + i * 80}ms both`,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11, color: '#fff', fontWeight: 500,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{p.title}</div>
                <div style={{
                  fontSize: 9, color: 'rgba(255,255,255,0.25)',
                  fontFamily: "'DM Mono', monospace",
                }}>{p.path}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                <span style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.5)',
                  fontFamily: "'DM Mono', monospace",
                }}>{p.views.toLocaleString()}</span>
                <span style={{
                  fontSize: 10, color: 'rgba(255,255,255,0.3)',
                  fontFamily: "'DM Mono', monospace",
                  minWidth: 30,
                }}>{p.avgTime}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: p.trend >= 0 ? '#6B9F6B' : '#C05050',
                  fontFamily: "'DM Mono', monospace",
                  minWidth: 30, textAlign: 'right',
                }}>
                  {p.trend >= 0 ? '+' : ''}{p.trend}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Ball Engagement (unique to Da Data Dad!) ── */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14, padding: 18,
        animation: 'cardFadeIn 0.6s ease-out 800ms both',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 14,
        }}>
          <span style={{
            fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)',
          }}>Ball Engagement Funnel</span>
          <span style={{
            fontSize: 9, color: 'rgba(255,255,255,0.25)',
            fontFamily: "'DM Mono', monospace",
            padding: '3px 8px', borderRadius: 4,
            background: 'rgba(255,255,255,0.04)',
          }}>
            🎱 physics playground metrics
          </span>
        </div>

        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '110px 1fr 60px 60px 60px 55px',
          gap: 8, padding: '0 0 8px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          fontSize: 9, color: 'rgba(255,255,255,0.25)',
          textTransform: 'uppercase', letterSpacing: 1,
          fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
        }}>
          <span>Ball</span>
          <span>Funnel</span>
          <span style={{ textAlign: 'right' }}>Clicks</span>
          <span style={{ textAlign: 'right' }}>Scores</span>
          <span style={{ textAlign: 'right' }}>Opens</span>
          <span style={{ textAlign: 'right' }}>Conv%</span>
        </div>

        {BALL_ENGAGEMENT.map((ball, i) => (
          <BallEngagementRow key={ball.ball} ball={ball} index={i} />
        ))}

        {/* Summary insight */}
        <div style={{
          marginTop: 14, padding: '10px 14px',
          background: 'rgba(212,168,67,0.06)',
          border: '1px solid rgba(212,168,67,0.12)',
          borderRadius: 8,
          fontSize: 11, color: 'rgba(255,255,255,0.5)',
          lineHeight: 1.5,
        }}>
          <span style={{ color: '#D4A843', fontWeight: 600 }}>💡 Insight:</span>{' '}
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>
            "About Me" has the highest click volume but "Wine Cellar" has the longest avg. session time (4:31).
            Consider promoting the wine cellar ball more prominently — engaged visitors spend 3× longer exploring that content.
          </span>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        marginTop: 24, textAlign: 'center',
        fontSize: 10, color: 'rgba(255,255,255,0.2)',
        fontFamily: "'DM Mono', monospace",
      }}>
        Built by Da Data Dad · Powered by curiosity and too much coffee
      </div>
    </div>
  );
}
