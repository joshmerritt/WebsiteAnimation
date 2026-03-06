/**
 * DaDataDad.com — Analytics Dashboard V3
 * Consolidated dashboard: Analytics + Data Architecture tabs
 *
 * Fetches live data from the GA4 Cloudflare Worker.
 * Falls back to deterministic mock data if the fetch fails.
 */
import { useState, useEffect, useMemo, useRef } from "react";
import {
  fetchGA4Data,
  generateTimeSeriesData,
  REFERRER_DATA as MOCK_REFERRER,
  PAGE_DATA as MOCK_PAGES,
  BALL_ENGAGEMENT as MOCK_BALLS,
  DEVICE_DATA as MOCK_DEVICES,
  SESSION_FLOW as MOCK_FLOW,
  ARCHITECTURE,
  METRIC_COLORS,
} from './data.js';

// ═══ SUPPLEMENTARY DATA (not from GA4) ══════════════════════════════════
// Device icons for V3 display (MOCK_DEVICES has different shape)
const DEVICE_ICONS = { Desktop: "\uD83D\uDDA5\uFE0F", Mobile: "\uD83D\uDCF1", Tablet: "\uD83D\uDCBB" };

// Module-level aliases — used by standalone components (insights, bonus charts).
// AnalyticsTab overrides these locally with live data when available.
const BALL_ENGAGEMENT = MOCK_BALLS;
const DEVICE_DATA = MOCK_DEVICES.map(d => ({
  ...d, icon: DEVICE_ICONS[d.device] || "\uD83D\uDCBB",
  interactionRate: d.ballRate || d.interactionRate || 0,
  avgShots: d.avgShots || 0, accuracy: d.accuracy || 0,
}));

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

const MC = { visitors: "#D4A843", pageviews: "#5985B1", bounceRate: "#C05050", avgDuration: "#6B9F6B", ballInteractions: "#7B5EA7", shots: "#5985B1", ctaClicks: "#6B9F6B" };

const CUSTOM_EVENTS = [
  { name: "ball_launch", params: ["shot_number", "total_makes", "accuracy"], color: "#D4A843" },
  { name: "ball_score", params: ["shot_number", "make_number", "accuracy"], color: "#6B9F6B" },
  { name: "detail_open", params: ["project_name", "project_link"], color: "#5985B1" },
  { name: "detail_close", params: [], color: "#5985B1" },
  { name: "cta_click", params: ["project_name", "project_link", "project_category"], color: "#7B5EA7" },
  { name: "portfolio_loaded", params: ["load_time_ms"], color: "#C05050" },
];

const PIPELINE_STEPS = [
  { label: "User Action", icon: "\uD83D\uDC46", tags: ["Drag ball", "Release (launch)", "Collision (score)", "Double-tap (open)", "CTA link click"], color: "#D4A843", border: "#D4A843" },
  { label: "Game.js", icon: "\u2699\uFE0F", tags: ["Physics engine", "Collision detection", "State management"], color: "#5985B1", border: "#5985B1" },
  { label: "EventBus", icon: "\uD83D\uDCE1", tags: ["stats:update", "detail:open", "detail:close", "cta:click", "load:complete"], color: "#6B9F6B", border: "#6B9F6B" },
  { label: "ga4.js", icon: "\uD83D\uDD17", tags: ["Delta detection", "Event mapping", "Parameter enrichment"], color: "#6B9F6B", border: "#6B9F6B" },
  { label: "GA4", icon: "\uD83D\uDCCA", tags: ["ball_launch", "ball_score", "detail_open", "cta_click", "portfolio_loaded"], color: "#5985B1", border: "#5985B1" },
];

// ═══ INSIGHTS ENGINE ════════════════════════════════════════════════════
function generateInsights(timeSeriesData) {
  const insights = [];
  const totals = BALL_ENGAGEMENT.reduce((a, b) => ({
    clicks: a.clicks + b.clicks, launches: a.launches + b.launches,
    scores: a.scores + b.scores, opens: a.opens + b.opens, ctaClicks: a.ctaClicks + b.ctaClicks,
  }), { clicks: 0, launches: 0, scores: 0, opens: 0, ctaClicks: 0 });

  const byClicks = [...BALL_ENGAGEMENT].sort((a, b) => b.clicks - a.clicks);
  const byConv = [...BALL_ENGAGEMENT].sort((a, b) => (b.ctaClicks / b.clicks) - (a.ctaClicks / a.clicks));
  const byDropoff = [...BALL_ENGAGEMENT].sort((a, b) => (1 - a.opens / a.scores) - (1 - b.opens / b.scores)).reverse();

  const topVol = byClicks[0], topConv = byConv[0];
  const topVolConv = ((topVol.ctaClicks / topVol.clicks) * 100).toFixed(0);
  const topConvConv = ((topConv.ctaClicks / topConv.clicks) * 100).toFixed(0);
  if (topVol.id !== topConv.id) {
    const lost = Math.round(topVol.clicks * (topConv.ctaClicks / topConv.clicks)) - topVol.ctaClicks;
    insights.push({ type: "opportunity", icon: "\uD83C\uDFAF", title: "Conversion Efficiency Gap",
      body: `"${topVol.ball}" gets the most traffic (${topVol.clicks} clicks) but converts to CTA at ${topVolConv}%, while "${topConv.ball}" converts at ${topConvConv}%. If the top-volume ball matched that rate, it would generate ~${lost} additional CTA click-throughs.`,
      recommendation: `Investigate what makes "${topConv.ball}" convert better — is the CTA more prominent in its detail modal? Apply those patterns to "${topVol.ball}".`,
      metric: `+${lost} CTAs`, metricColor: "#6B9F6B", severity: "high" });
  }

  const worstLeaker = byDropoff[0];
  const leakPct = ((1 - worstLeaker.opens / worstLeaker.scores) * 100).toFixed(0);
  insights.push({ type: "warning", icon: "\uD83D\uDEA8", title: "Score-to-Open Leakage",
    body: `"${worstLeaker.ball}" loses ${leakPct}% of users between scoring and viewing the detail page (${worstLeaker.scores - worstLeaker.opens} lost opens). Users score but don't see the project content.`,
    recommendation: "Add a brief visual celebration on score that naturally transitions into the detail modal, or add a pulsing 'View Project' prompt after a successful score.",
    metric: `${leakPct}% drop`, metricColor: "#C05050", severity: "high" });

  const cats = {};
  BALL_ENGAGEMENT.forEach(b => {
    if (!cats[b.category]) cats[b.category] = { clicks: 0, ctaClicks: 0, balls: 0 };
    cats[b.category].clicks += b.clicks; cats[b.category].ctaClicks += b.ctaClicks; cats[b.category].balls += 1;
  });
  const catArr = Object.entries(cats).map(([n, d]) => ({ name: n, ...d, conv: d.ctaClicks / d.clicks * 100 })).sort((a, b) => b.conv - a.conv);
  const bestCat = catArr[0], worstCat = catArr[catArr.length - 1];
  const catGap = (bestCat.conv - worstCat.conv).toFixed(0);
  insights.push({ type: "analysis", icon: "\uD83D\uDCCA", title: "Category Performance Disparity",
    body: `"${bestCat.name}" converts at ${bestCat.conv.toFixed(0)}% vs "${worstCat.name}" at ${worstCat.conv.toFixed(0)}% — a ${catGap}pp gap.`,
    recommendation: `A/B test moving "${worstCat.name}" balls to more central positions. If conversion stays flat, refresh project descriptions or images for that category.`,
    metric: `${catGap}pp gap`, metricColor: "#D4A843", severity: "medium" });

  const mob = DEVICE_DATA.find(d => d.device === "Mobile"), desk = DEVICE_DATA.find(d => d.device === "Desktop");
  if (mob && desk) {
    insights.push({ type: "opportunity", icon: "\uD83D\uDCF1", title: "Mobile Experience Bottleneck",
      body: `Mobile is ${mob.pct}% of traffic but has ${desk.accuracy - mob.accuracy}pp lower accuracy and ${(desk.avgShots - mob.avgShots).toFixed(1)} fewer shots/session. The drag-to-aim mechanic is harder on small screens.`,
      recommendation: "Consider: (1) Larger goal hitboxes on mobile, (2) A tap-to-aim alternative, (3) Visual aim guides showing trajectory. Even a 10pp accuracy improvement would significantly lift conversion.",
      metric: `-${desk.accuracy - mob.accuracy}pp acc`, metricColor: "#C05050", severity: "high" });
  }

  const tab = DEVICE_DATA.find(d => d.device === "Tablet");
  if (tab) {
    insights.push({ type: "positive", icon: "\u2728", title: "High-Intent Tablet Cohort",
      body: `Tablet users show ${tab.interactionRate}% interaction rate and ${tab.avgShots} shots/session — the highest of any device despite only ${tab.pct}% of traffic. Likely recruiter deep-dives or repeat visitors.`,
      recommendation: "This is your highest-quality audience. Optimize the tablet layout specifically — the larger touch target + screen real estate combo is working. Track if these sessions correlate with CTA clicks.",
      metric: `${tab.avgShots} shots/sess`, metricColor: "#6B9F6B", severity: "low" });
  }

  const recent = timeSeriesData.slice(-7), prev = timeSeriesData.slice(-14, -7);
  if (recent.length === 7 && prev.length === 7) {
    const rAvg = recent.reduce((s, d) => s + (d.visitors || 0), 0) / 7;
    const pAvg = prev.reduce((s, d) => s + (d.visitors || 0), 0) / 7;
    const delta = ((rAvg - pAvg) / pAvg * 100).toFixed(0);
    const dir = parseInt(delta) >= 0 ? "up" : "down";
    insights.push({ type: dir === "up" ? "positive" : "warning", icon: dir === "up" ? "\uD83D\uDCC8" : "\uD83D\uDCC9", title: "Week-over-Week Momentum",
      body: `Traffic ${dir} ${Math.abs(delta)}% WoW (${rAvg.toFixed(0)} vs ${pAvg.toFixed(0)} daily avg).`,
      recommendation: parseInt(delta) >= 0 ? "Engagement quality is holding as volume grows — continue current LinkedIn posting cadence." : "Check if a referral source dropped off. Review LinkedIn posting cadence and consider a content refresh.",
      metric: `${parseInt(delta) >= 0 ? "+" : ""}${delta}% WoW`, metricColor: dir === "up" ? "#6B9F6B" : "#C05050", severity: "medium" });
  }

  const lR = ((totals.launches / totals.clicks) * 100).toFixed(0);
  const sR = ((totals.scores / totals.launches) * 100).toFixed(0);
  const oR = ((totals.opens / totals.scores) * 100).toFixed(0);
  const cR = ((totals.ctaClicks / totals.opens) * 100).toFixed(0);
  const steps = [
    { name: "Click \u2192 Shot", rate: parseFloat(lR), label: `${lR}%` },
    { name: "Shot \u2192 Make", rate: parseFloat(sR), label: `${sR}%` },
    { name: "Make \u2192 Open", rate: parseFloat(oR), label: `${oR}%` },
    { name: "Open \u2192 CTA", rate: parseFloat(cR), label: `${cR}%` },
  ];
  const worst = steps.reduce((a, b) => a.rate < b.rate ? a : b);
  const recs = {
    "Click \u2192 Shot": "Users touch balls but don't drag hard enough. Reduce minimum launch power or add a visual power indicator.",
    "Shot \u2192 Make": "Balls launched but miss goals. Widen goal hitboxes or add subtle aim guides for first-time visitors.",
    "Make \u2192 Open": "Users score but don't view details. Try auto-opening the modal with a dismiss option.",
    "Open \u2192 CTA": "Users view details but don't click through. Strengthen CTA visibility, add preview screenshots, or make project links more prominent.",
  };
  insights.push({ type: "analysis", icon: "\uD83D\uDD0D", title: "Primary Funnel Friction",
    body: `Biggest drop-off at "${worst.name}" (${worst.label} pass-through). This is where the most potential conversions are lost.`,
    recommendation: recs[worst.name], metric: worst.label, metricColor: "#D4A843", severity: "high" });

  return insights;
}

// ═══ HOOKS ══════════════════════════════════════════════════════════════
function useAnimatedNumber(target, duration = 1000, delay = 0) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      const start = performance.now();
      const anim = (now) => { const p = Math.min((now - start) / duration, 1); setValue(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(anim); };
      requestAnimationFrame(anim);
    }, delay);
    return () => clearTimeout(t);
  }, [target, duration, delay]);
  return value;
}

// ═══ SUB-COMPONENTS ═════════════════════════════════════════════════════
function StatCard({ label, value, suffix = "", prefix = "", trend, sparkData, color, delay = 0, compact }) {
  const animVal = useAnimatedNumber(value, 1000, delay);
  return (
    <div style={{ ...SS.statCard, ...(compact ? { padding: "12px 14px" } : {}), animationDelay: `${delay}ms` }} className="fade-in-card">
      <div style={SS.statLabel}>{label}</div>
      <div style={SS.statRow}>
        <div style={SS.statValueGroup}>
          <span style={{ ...SS.statValue, ...(compact ? { fontSize: "clamp(1.1rem, 3vw, 1.4rem)" } : {}) }}>{prefix}{animVal.toLocaleString()}{suffix}</span>
          {trend !== undefined && <span style={{ ...SS.statTrend, color: trend >= 0 ? "#6B9F6B" : "#C05050" }}>{trend >= 0 ? "\u2191" : "\u2193"} {Math.abs(trend)}%</span>}
        </div>
        {sparkData && <Sparkline data={sparkData} color={color} width={compact ? 64 : 80} height={compact ? 24 : 28} filled />}
      </div>
    </div>
  );
}

function Sparkline({ data, width = 120, height = 32, color = "#D4A843", filled = false }) {
  if (!data.length) return null;
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(" ");
  const endY = height - ((data[data.length - 1] - min) / range) * (height - 4) - 2;
  return (<svg width={width} height={height}>{filled && <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`${color}15`} />}<polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx={width} cy={endY} r="2" fill={color} /></svg>);
}

function DonutChart({ segments, size = 120, strokeWidth = 18 }) {
  const r = (size - strokeWidth) / 2, c = 2 * Math.PI * r; let off = 0;
  return (<svg width={size} height={size}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} />{segments.map((seg, i) => { const d = (seg.pct / 100) * c, g = c - d, o = off; off += d; return <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={seg.color} strokeWidth={strokeWidth} strokeDasharray={`${d} ${g}`} strokeDashoffset={-o} strokeLinecap="butt" style={{ opacity: 0.85 }} />; })}</svg>);
}

function MultiLineChart({ data, metrics, width = 680, height = 220 }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const svgRef = useRef(null);
  const padL = 44, padR = 12, padT = 16, padB = 28;
  const chartW = width - padL - padR, chartH = height - padT - padB;
  // Single shared Y scale — all metrics on the same axis so values are visually comparable
  const globalMax = useMemo(() => {
    let mx = 1;
    metrics.forEach(m => { data.forEach(d => { const v = d[m.key] || 0; if (v > mx) mx = v; }); });
    return mx * 1.15;
  }, [data, metrics]);
  const toX = (i) => padL + (i / (data.length - 1)) * chartW;
  const toY = (val) => { const v = val || 0; return padT + chartH - (v / globalMax) * chartH; };
  const buildPath = (key) => data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(d[key] || 0)}`).join(" ");
  const buildArea = (key) => `${buildPath(key)} L${toX(data.length - 1)},${padT + chartH} L${toX(0)},${padT + chartH} Z`;
  const handleMove = (e) => { if (!svgRef.current) return; const rect = svgRef.current.getBoundingClientRect(); const cx = e.touches ? e.touches[0].clientX : e.clientX; const x = (cx - rect.left) / rect.width * width - padL; setHoverIdx(Math.max(0, Math.min(data.length - 1, Math.round((x / chartW) * (data.length - 1))))); };
  const pMax = globalMax;
  const gridVals = Array.from({ length: 5 }, (_, i) => (pMax / 4) * i);
  const xStep = Math.ceil(data.length / 8);
  return (
    <svg ref={svgRef} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" style={{ cursor: "crosshair", display: "block" }} onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)} onTouchMove={handleMove} onTouchEnd={() => setHoverIdx(null)}>
      <defs>{metrics.map(m => <linearGradient key={m.key} id={`g3-${m.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={m.color} stopOpacity="0.15" /><stop offset="100%" stopColor={m.color} stopOpacity="0.01" /></linearGradient>)}</defs>
      {gridVals.map((v, i) => { const y = padT + chartH - (v / pMax) * chartH; return <g key={i}><line x1={padL} y1={y} x2={width - padR} y2={y} stroke="rgba(255,255,255,0.06)" /><text x={padL - 8} y={y + 4} fill="rgba(255,255,255,0.25)" fontSize="9" fontFamily="'JetBrains Mono', monospace" textAnchor="end">{Math.round(v)}</text></g>; })}
      {data.filter((_, i) => i % xStep === 0).map(d => { const idx = data.indexOf(d); return <text key={idx} x={toX(idx)} y={height - 4} fill="rgba(255,255,255,0.25)" fontSize="9" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">{d.label}</text>; })}
      {[...metrics].reverse().map(m => <g key={m.key}><path d={buildArea(m.key)} fill={`url(#g3-${m.key})`} /><path d={buildPath(m.key)} fill="none" stroke={m.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" /></g>)}
      {hoverIdx !== null && <g>
        <line x1={toX(hoverIdx)} y1={padT} x2={toX(hoverIdx)} y2={padT + chartH} stroke="rgba(255,255,255,0.2)" strokeDasharray="3,3" />
        {metrics.map(m => <circle key={m.key} cx={toX(hoverIdx)} cy={toY(data[hoverIdx][m.key] || 0)} r="4" fill={m.color} stroke="#0a0a0f" strokeWidth="2" />)}
        <foreignObject x={Math.min(toX(hoverIdx) - 70, width - 155)} y={4} width="140" height="80">
          <div xmlns="http://www.w3.org/1999/xhtml" style={{ background: "rgba(0,0,0,0.88)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 8px", fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#fff", lineHeight: 1.6 }}>
            <div style={{ color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>{data[hoverIdx].label}</div>
            {metrics.map(m => <div key={m.key} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span style={{ color: m.color }}>{m.label}</span><span>{(data[hoverIdx][m.key] || 0).toLocaleString()}</span></div>)}
          </div>
        </foreignObject>
      </g>}
    </svg>
  );
}

function FunnelVisual({ data, color, label }) {
  const steps = [
    { key: "launches", name: "Shots", val: data.launches },
    { key: "scores", name: "Makes", val: data.scores },
    { key: "opens", name: "Opens", val: data.opens },
    { key: "ctaClicks", name: "CTA Clicks", val: data.ctaClicks },
  ];
  const maxVal = steps[0].val;
  return (
    <div>
      {label && <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} /><span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{label}</span></div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {steps.map((step, i) => {
          const w = maxVal > 0 ? (step.val / maxVal) * 100 : 0;
          const rate = i > 0 ? ((step.val / steps[i - 1].val) * 100).toFixed(0) : null;
          return (<div key={step.key}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600 }}>{step.name}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                {rate && <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: parseFloat(rate) > 85 ? "#6B9F6B" : parseFloat(rate) > 70 ? "#D4A843" : "#C05050" }}>{rate}%</span>}
                <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: "#fff", minWidth: 36, textAlign: "right" }}>{step.val.toLocaleString()}</span>
              </div>
            </div>
            <div style={{ height: 18, background: "rgba(255,255,255,0.03)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${w}%`, background: `linear-gradient(90deg, ${color}cc, ${color}55)`, borderRadius: 4, transition: "width 0.5s cubic-bezier(0.22,1,0.36,1)" }} />
            </div>
            {i < steps.length - 1 && <div style={{ textAlign: "center", padding: "1px 0", fontSize: 8, color: "rgba(255,255,255,0.12)" }}>{"\u25BC"}</div>}
          </div>);
        })}
      </div>
      <div style={{ marginTop: 10, padding: "7px 12px", borderRadius: 6, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.8px" }}>Shot-to-CTA</span>
        <span style={{ fontSize: 16, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color }}>{maxVal > 0 ? ((data.ctaClicks / data.launches) * 100).toFixed(1) : 0}%</span>
      </div>
    </div>
  );
}

function InsightsPanel({ timeSeriesData }) {
  const insights = useMemo(() => generateInsights(timeSeriesData), [timeSeriesData]);
  const [expanded, setExpanded] = useState(null);
  const sevOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...insights].sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
  const tc = { opportunity: { bg: "rgba(107,159,107,0.06)", border: "rgba(107,159,107,0.15)" }, warning: { bg: "rgba(192,80,80,0.06)", border: "rgba(192,80,80,0.15)" }, analysis: { bg: "rgba(212,168,67,0.06)", border: "rgba(212,168,67,0.15)" }, positive: { bg: "rgba(89,133,177,0.06)", border: "rgba(89,133,177,0.15)" } };
  const sevLabels = { high: "HIGH IMPACT", medium: "MEDIUM", low: "SIGNAL" };
  const sevColors = { high: "#C05050", medium: "#D4A843", low: "#5985B1" };
  return (
    <div style={{ ...SS.panel, marginTop: 20 }}>
      <div style={SS.panelHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ ...SS.panelTitle, marginBottom: 0 }}>Insights Engine</span>
          <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: "#C05050", padding: "2px 8px", borderRadius: 4, background: "rgba(192,80,80,0.1)", border: "1px solid rgba(192,80,80,0.2)" }}>{sorted.filter(i => i.severity === "high").length} action items</span>
        </div>
        <span style={SS.panelBadge}>{sorted.length} findings</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((ins, i) => {
          const c = tc[ins.type] || tc.analysis; const isExp = expanded === i;
          return (<div key={i} onClick={() => setExpanded(isExp ? null : i)} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer", transition: "all 0.2s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{ins.icon}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{ins.title}</span>
                    <span style={{ fontSize: 8, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: sevColors[ins.severity], letterSpacing: "1px", padding: "1px 5px", borderRadius: 3, background: `${sevColors[ins.severity]}15` }}>{sevLabels[ins.severity]}</span>
                  </div>
                  {!isExp && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ins.body.substring(0, 90)}...</p>}
                  {isExp && <div style={{ marginTop: 8 }}>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, marginBottom: 10 }}>{ins.body}</p>
                    <div style={{ padding: "10px 12px", borderRadius: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: 4 }}>Recommendation</div>
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>{ins.recommendation}</p>
                    </div>
                  </div>}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: ins.metricColor }}>{ins.metric}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>{isExp ? "\u25B2" : "\u25BC"}</div>
              </div>
            </div>
          </div>);
        })}
      </div>
    </div>
  );
}

// ═══ DAY-OF-WEEK BAR CHART ══════════════════════════════════════════════
function DayOfWeekChart({ data }) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const buckets = Array.from({ length: 7 }, () => ({ visitors: 0, shots: 0, cta: 0, count: 0 }));
  data.forEach(d => { const b = buckets[d.dayOfWeek]; b.visitors += (d.visitors || 0); b.shots += (d.shots || 0); b.cta += (d.ctaClicks || 0); b.count++; });
  const vals = buckets.map(b => ({
    visitors: b.visitors, shots: b.shots, cta: b.cta,
    shotsPerUser: b.visitors > 0 ? parseFloat((b.shots / b.visitors).toFixed(1)) : 0,
  }));
  const [metric, setMetric] = useState("shotsPerUser");
  const metricOpts = [{ key: "shotsPerUser", label: "Shots/User", color: "#7B5EA7" }, { key: "visitors", label: "Visitors", color: "#D4A843" }, { key: "shots", label: "Shots", color: "#5985B1" }, { key: "cta", label: "CTAs", color: "#6B9F6B" }];
  const activeColor = metricOpts.find(m => m.key === metric)?.color || "#7B5EA7";
  const isFloat = metric === "shotsPerUser";
  const maxForMetric = Math.max(...vals.map(a => a[metric]), 1);

  const w = 320, h = 140, padL = 32, padB = 20, padT = 18;
  const barW = (w - padL - 10) / 7 - 4;
  const chartH = h - padB - padT;

  return (
    <div>
      <div style={{ display: "flex", gap: 3, marginBottom: 10 }}>
        {metricOpts.map(m => (
          <button key={m.key} onClick={() => setMetric(m.key)} style={{
            padding: "3px 8px", borderRadius: 4, fontSize: 9, fontFamily: "'JetBrains Mono', monospace",
            border: "none", cursor: "pointer", transition: "all 0.15s",
            background: metric === m.key ? `${m.color}22` : "transparent",
            color: metric === m.key ? m.color : "rgba(255,255,255,0.3)",
          }}>{m.label}</button>
        ))}
      </div>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const y = padT + chartH * (1 - pct);
          return <g key={i}>
            <line x1={padL} y1={y} x2={w - 5} y2={y} stroke="rgba(255,255,255,0.04)" />
            {i > 0 && <text x={padL - 4} y={y + 3} fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="'JetBrains Mono', monospace" textAnchor="end">{isFloat ? (maxForMetric * pct).toFixed(1) : Math.round(maxForMetric * pct)}</text>}
          </g>;
        })}
        {/* Bars */}
        {days.map((day, i) => {
          const val = vals[i][metric];
          const barH = maxForMetric > 0 ? (val / maxForMetric) * chartH : 0;
          const x = padL + 2 + i * (barW + 4);
          const y = padT + chartH - barH;
          const isWeekend = i === 0 || i === 6;
          return (
            <g key={day}>
              <rect x={x} y={y} width={barW} height={barH} rx={3}
                fill={activeColor} opacity={isWeekend ? 0.45 : 0.75} />
              {/* Data label above bar */}
              <text x={x + barW / 2} y={y - 4} fill={activeColor} fontSize="9" fontWeight="600"
                fontFamily="'JetBrains Mono', monospace" textAnchor="middle" opacity="0.9">
                {isFloat ? val.toFixed(1) : val}
              </text>
              <text x={x + barW / 2} y={h - 4} fill={isWeekend ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.4)"}
                fontSize="8" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">
                {day}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ═══ ACCURACY BY BALL — HORIZONTAL BAR CHART ════════════════════════════
function AccuracyByBallChart() {
  const sorted = [...BALL_ENGAGEMENT].sort((a, b) => (b.scores / b.launches) - (a.scores / a.launches));
  const overallAcc = sorted.reduce((s, b) => s + b.scores, 0) / sorted.reduce((s, b) => s + b.launches, 0) * 100;

  return (
    <div>
      {sorted.map((ball, i) => {
        const acc = (ball.scores / ball.launches * 100);
        const isAbove = acc >= overallAcc;
        return (
          <div key={ball.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: i < sorted.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
            <div style={{ width: 70, display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: ball.color, display: "inline-block" }} />
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ball.ball.split(" ")[0]}</span>
            </div>
            <div style={{ flex: 1, position: "relative", height: 14, background: "rgba(255,255,255,0.03)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                position: "absolute", top: 0, left: 0, height: "100%",
                width: `${acc}%`, background: `linear-gradient(90deg, ${ball.color}aa, ${ball.color}55)`,
                borderRadius: 3, transition: "width 0.4s ease",
              }} />
              {/* Overall average line */}
              <div style={{ position: "absolute", top: -1, left: `${overallAcc}%`, width: 1, height: 16, background: "rgba(255,255,255,0.3)" }} />
            </div>
            <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: isAbove ? "#6B9F6B" : "#D4A843", width: 38, textAlign: "right" }}>
              {acc.toFixed(0)}%
            </span>
          </div>
        );
      })}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 8, gap: 12 }}>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>│ = avg {overallAcc.toFixed(0)}%</span>
      </div>
    </div>
  );
}

// ═══ ENGAGEMENT RADAR — SPIDER CHART ════════════════════════════════════
function EngagementRadar() {
  const devices = DEVICE_DATA;
  const axes = [
    { key: "interactionRate", label: "Interact %", max: 100 },
    { key: "avgShots", label: "Shots/Sess", max: 8 },
    { key: "accuracy", label: "Accuracy %", max: 100 },
    { key: "avgDuration", label: "Duration", max: 200 },
    { key: "pct", label: "Traffic %", max: 70 },
  ];
  const cx = 120, cy = 110, maxR = 80;
  const angleStep = (2 * Math.PI) / axes.length;
  const startAngle = -Math.PI / 2;

  const getPoint = (axisIdx, value, max) => {
    const angle = startAngle + axisIdx * angleStep;
    const r = (value / max) * maxR;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  };

  const deviceColors = ["#D4A843", "#5985B1", "#7B5EA7"];

  return (
    <div>
      <svg width="100%" height={220} viewBox="0 0 240 220" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
        {/* Grid rings */}
        {[0.25, 0.5, 0.75, 1].map((pct, i) => {
          const pts = axes.map((_, ai) => {
            const angle = startAngle + ai * angleStep;
            return `${cx + Math.cos(angle) * maxR * pct},${cy + Math.sin(angle) * maxR * pct}`;
          }).join(" ");
          return <polygon key={i} points={pts} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />;
        })}
        {/* Axis lines + labels */}
        {axes.map((axis, i) => {
          const angle = startAngle + i * angleStep;
          const ex = cx + Math.cos(angle) * maxR;
          const ey = cy + Math.sin(angle) * maxR;
          const lx = cx + Math.cos(angle) * (maxR + 18);
          const ly = cy + Math.sin(angle) * (maxR + 18);
          return (
            <g key={axis.key}>
              <line x1={cx} y1={cy} x2={ex} y2={ey} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
              <text x={lx} y={ly + 3} fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">{axis.label}</text>
            </g>
          );
        })}
        {/* Device polygons */}
        {devices.map((device, di) => {
          const pts = axes.map((axis, ai) => {
            const p = getPoint(ai, device[axis.key], axis.max);
            return `${p.x},${p.y}`;
          }).join(" ");
          return (
            <g key={device.device}>
              <polygon points={pts} fill={`${deviceColors[di]}15`} stroke={deviceColors[di]} strokeWidth="1.5" opacity="0.8" />
              {axes.map((axis, ai) => {
                const p = getPoint(ai, device[axis.key], axis.max);
                return <circle key={ai} cx={p.x} cy={p.y} r="2.5" fill={deviceColors[di]} />;
              })}
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "center", gap: 14 }}>
        {devices.map((d, i) => (
          <span key={d.device} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: deviceColors[i], fontFamily: "'JetBrains Mono', monospace" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: deviceColors[i], display: "inline-block" }} />{d.device}
          </span>
        ))}
      </div>
    </div>
  );
}

// ═══ CONVERSION WATERFALL ════════════════════════════════════════════════
function ConversionWaterfall() {
  const totals = BALL_ENGAGEMENT.reduce((a, b) => ({
    clicks: a.clicks + b.clicks, launches: a.launches + b.launches,
    scores: a.scores + b.scores, opens: a.opens + b.opens, ctaClicks: a.ctaClicks + b.ctaClicks,
  }), { clicks: 0, launches: 0, scores: 0, opens: 0, ctaClicks: 0 });

  const steps = [
    { label: "Shots", val: totals.launches, color: "#5985B1" },
    { label: "Makes", val: totals.scores, color: "#5985B1" },
    { label: "Opens", val: totals.opens, color: "#6B9F6B" },
    { label: "CTAs", val: totals.ctaClicks, color: "#6B9F6B" },
  ];
  const maxVal = steps[0].val;
  const w = 320, h = 160, padL = 48, padR = 10, padT = 20, padB = 24;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const barW = chartW / steps.length - 8;

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      {/* Grid */}
      {[0, 0.5, 1].map((pct, i) => {
        const y = padT + chartH * (1 - pct);
        return <g key={i}>
          <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="rgba(255,255,255,0.04)" />
          <text x={padL - 4} y={y + 3} fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="'JetBrains Mono', monospace" textAnchor="end">{Math.round(maxVal * pct)}</text>
        </g>;
      })}
      {steps.map((step, i) => {
        const barH = maxVal > 0 ? (step.val / maxVal) * chartH : 0;
        const x = padL + 4 + i * (barW + 8);
        const y = padT + chartH - barH;
        const dropPct = i > 0 ? (((steps[i - 1].val - step.val) / steps[i - 1].val) * 100).toFixed(0) : null;
        return (
          <g key={step.label}>
            {/* Connector line from previous bar's top to this bar's top */}
            {i > 0 && (
              <line
                x1={padL + 4 + (i - 1) * (barW + 8) + barW}
                y1={padT + chartH - (steps[i - 1].val / maxVal) * chartH}
                x2={x}
                y2={y}
                stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="3,2"
              />
            )}
            {/* Bar */}
            <rect x={x} y={y} width={barW} height={barH} rx={3} fill={step.color} opacity="0.7" />
            {/* Value label */}
            <text x={x + barW / 2} y={y - 5} fill="#fff" fontSize="10" fontWeight="600" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">{step.val.toLocaleString()}</text>
            {/* Drop percentage */}
            {dropPct && <text x={x + barW / 2} y={y - 16} fill="#C05050" fontSize="8" fontFamily="'JetBrains Mono', monospace" textAnchor="middle" opacity="0.7">-{dropPct}%</text>}
            {/* Label */}
            <text x={x + barW / 2} y={h - 6} fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">{step.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ═══ SHOT CHART HEATMAP ═════════════════════════════════════════════════
function ShotChart({ selectedBall }) {
  const width = 680, height = 340;

  // Ball positions (simulating the 3-col grid on right side)
  const ballPositions = BALL_ENGAGEMENT.map((ball, i) => ({
    ...ball,
    cx: 440 + (i % 3) * 80,
    cy: 65 + Math.floor(i / 3) * 90,
  }));

  // Goal zones (left side, matching category layout)
  const cats = ["Me", "Technology", "Business", "Apps"];
  const goalX = 60;
  const goalZones = cats.map((cat, i) => ({ cat, x: goalX, y: 55 + i * 72, w: 55, h: 55 }));

  // Use live session impact data if available, otherwise seeded demo dots
  const [liveImpactCount, setLiveImpactCount] = useState(0);

  // Read impacts from sessionStorage (persisted by ga4.js on the main site)
  const getSessionImpacts = () => {
    try {
      const stored = sessionStorage.getItem('__dadatadad_impacts');
      return stored ? JSON.parse(stored) : [];
    } catch (_) { return []; }
  };

  // Poll for live impact data (checks sessionStorage for cross-page data)
  useEffect(() => {
    const check = () => {
      const impacts = getSessionImpacts();
      if (impacts.length !== liveImpactCount) setLiveImpactCount(impacts.length);
    };
    check();
    const interval = setInterval(check, 2000);
    return () => clearInterval(interval);
  }, [liveImpactCount]);

  const isLiveShots = liveImpactCount > 0;

  const shots = useMemo(() => {
    // Prefer live session data from sessionStorage
    const liveImpacts = getSessionImpacts();
    if (liveImpacts.length > 0) {
      return liveImpacts.map(imp => {
        const fx = Math.max(20, Math.min(width - 20, imp.x * width));
        const fy = Math.max(15, Math.min(height - 15, imp.y * height));
        const ball = BALL_ENGAGEMENT.find(b => b.id === imp.ballId);
        return { x: fx, y: fy, scored: imp.isGoal, ballId: imp.ballId, color: ball?.color || '#5985B1' };
      });
    }

    // Fallback: seeded demo data
    const r = seededRandom(777);
    const dots = [];
    ballPositions.forEach(ball => {
      const goalZone = goalZones.find(g => g.cat === ball.category);
      if (!goalZone) return;
      const numShots = Math.round((ball.launches || 0) * 0.35);
      for (let s = 0; s < numShots; s++) {
        const scored = r() < ((ball.scores || 0) / (ball.launches || 1));
        const t = 0.3 + r() * 0.55;
        const baseX = ball.cx + (goalZone.x + goalZone.w / 2 - ball.cx) * t;
        const baseY = ball.cy + (goalZone.y + goalZone.h / 2 - ball.cy) * t;
        const spread = scored ? 12 + r() * 18 : 25 + r() * 45;
        const angle = r() * Math.PI * 2;
        const dx = Math.cos(angle) * spread * (r() * 0.7 + 0.3);
        const dy = Math.sin(angle) * spread * (r() * 0.7 + 0.3);
        const fx = Math.max(20, Math.min(width - 20, baseX + dx));
        const fy = Math.max(15, Math.min(height - 15, baseY + dy));
        dots.push({ x: fx, y: fy, scored, ballId: ball.id, color: ball.color });
      }
    });
    return dots;
  }, [liveImpactCount]);

  const filteredShots = selectedBall ? shots.filter(s => s.ballId === selectedBall) : shots;

  const visibleScored = filteredShots.filter(s => s.scored).length;
  const visibleTotal = filteredShots.length;
  const visiblePct = visibleTotal > 0 ? ((visibleScored / visibleTotal) * 100).toFixed(0) : 0;

  return (
    <div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
        <defs>
          <radialGradient id="glow-green" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#6B9F6B" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#6B9F6B" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width={width} height={height} rx="10" fill="rgba(255,255,255,0.015)" />
        <line x1="220" y1="10" x2="220" y2={height - 10} stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="4,4" />

        {goalZones.map(g => (
          <g key={g.cat}>
            <rect x={g.x - 8} y={g.y - 5} width={g.w + 16} height={g.h + 10} rx="6" fill="rgba(107,159,107,0.06)" stroke="rgba(107,159,107,0.15)" strokeWidth="1" />
            <text x={g.x + g.w / 2} y={g.y + g.h + 18} fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">{g.cat}</text>
          </g>
        ))}

        {filteredShots.map((dot, i) => (
          <circle key={i} cx={dot.x} cy={dot.y} r={dot.scored ? 2.5 : 2}
            fill={dot.scored ? "#6B9F6B" : "#C05050"}
            opacity={dot.scored ? 0.7 : 0.35} />
        ))}

        {goalZones.map(g => {
          const near = filteredShots.filter(s => {
            const dx = s.x - (g.x + g.w / 2), dy = s.y - (g.y + g.h / 2);
            return Math.sqrt(dx * dx + dy * dy) < 50 && s.scored;
          });
          return near.length >= 3 ? <circle key={`gl-${g.cat}`} cx={g.x + g.w / 2} cy={g.y + g.h / 2} r={35} fill="url(#glow-green)" /> : null;
        })}

        {ballPositions.map(ball => {
          const isActive = !selectedBall || selectedBall === ball.id;
          const shotScale = ball.launches / Math.max(...BALL_ENGAGEMENT.map(b => b.launches));
          const r = 12 + shotScale * 14;
          return (
            <g key={ball.id} opacity={isActive ? 1 : 0.2}>
              <circle cx={ball.cx} cy={ball.cy} r={r} fill={`${ball.color}25`} stroke={`${ball.color}66`} strokeWidth="1.5" />
              <circle cx={ball.cx} cy={ball.cy} r={3} fill={ball.color} />
              <text x={ball.cx} y={ball.cy + r + 12} fill={isActive ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.15)"} fontSize="8" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">{ball.ball.split(" ")[0]}</text>
            </g>
          );
        })}

        <text x={goalX + 20} y={20} fill="rgba(255,255,255,0.2)" fontSize="9" fontFamily="'JetBrains Mono', monospace" textAnchor="middle" letterSpacing="2">GOALS</text>
        <text x={520} y={20} fill="rgba(255,255,255,0.2)" fontSize="9" fontFamily="'JetBrains Mono', monospace" textAnchor="middle" letterSpacing="2">BALLS</text>
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 14 }}>
          {[["\u25CF Score", "#6B9F6B"], ["\u25CF Miss", "#C05050"], ["\u25CB Ball (sized by volume)", "rgba(255,255,255,0.4)"]].map(([l, c]) => (
            <span key={l} style={{ fontSize: 9, color: c, fontFamily: "'JetBrains Mono', monospace" }}>{l}</span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
            {isLiveShots ? `Live session: ${visibleTotal} shots` : `${visibleTotal} shots (demo)`}
          </span>
          <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: parseInt(visiblePct) > 75 ? "#6B9F6B" : "#D4A843" }}>{visiblePct}% accuracy</span>
        </div>
      </div>
    </div>
  );
}

// ═══ ANALYTICS TAB ══════════════════════════════════════════════════════
function AnalyticsTab({ timeSeriesData, rangeDays, ballData, sourcesData, pagesData, deviceData, sessionFlow, isLive }) {
  const BALL_ENGAGEMENT = ballData;
  const REFERRER_DATA = sourcesData;
  const PAGE_DATA = pagesData;
  const DEVICE_DATA = deviceData;
  const SESSION_FLOW = sessionFlow;
  const totalVisitors = timeSeriesData.reduce((s, d) => s + (d.visitors || 0), 0);
  const avgDuration = timeSeriesData.length > 0 ? Math.round(timeSeriesData.reduce((s, d) => s + (d.avgDuration || 0), 0) / timeSeriesData.length) : 0;
  const totalInteractions = timeSeriesData.reduce((s, d) => s + (d.ballInteractions || 0), 0);
  const interactionRate = totalVisitors > 0 ? Math.round((totalInteractions / totalVisitors) * 100) : 0;
  const totals = BALL_ENGAGEMENT.reduce((a, b) => ({ clicks: a.clicks + (b.clicks || 0), launches: a.launches + (b.launches || 0), scores: a.scores + (b.scores || 0), opens: a.opens + (b.opens || 0), ctaClicks: a.ctaClicks + (b.ctaClicks || 0) }), { clicks: 0, launches: 0, scores: 0, opens: 0, ctaClicks: 0 });
  const overallAccuracy = Math.round((totals.scores / totals.launches) * 100);
  const [selectedBall, setSelectedBall] = useState(null);
  const funnelData = selectedBall ? BALL_ENGAGEMENT.find(b => b.id === selectedBall) : totals;
  const funnelColor = selectedBall ? BALL_ENGAGEMENT.find(b => b.id === selectedBall)?.color || "#5985B1" : "#5985B1";
  const funnelLabel = selectedBall ? BALL_ENGAGEMENT.find(b => b.id === selectedBall)?.ball : null;
  const categories = {};
  BALL_ENGAGEMENT.forEach(b => { if (!categories[b.category]) categories[b.category] = { clicks: 0, ctaClicks: 0 }; categories[b.category].clicks += (b.clicks || 0); categories[b.category].ctaClicks += (b.ctaClicks || 0); });
  const metrics = [{ key: "visitors", label: "Visitors", color: MC.visitors }, { key: "shots", label: "Shots", color: MC.shots }, { key: "ctaClicks", label: "CTA Clicks", color: MC.ctaClicks }];
  // Engagement depth
  const avgBallsPerSession = (totals.clicks / totalVisitors).toFixed(1);

  return (<div>
    {/* KPI Strip 2x2 */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20, position: "relative", zIndex: 1 }} className="v3-kpi-row">
      <StatCard label="Unique Visitors" value={totalVisitors} trend={15} delay={80} sparkData={timeSeriesData.slice(-30).map(d => d.visitors)} color={MC.visitors} compact />
      <StatCard label="Avg. Duration" value={avgDuration} suffix="s" trend={8} delay={120} sparkData={timeSeriesData.slice(-30).map(d => d.avgDuration)} color={MC.avgDuration} compact />
      <StatCard label="Shot Accuracy" value={overallAccuracy} suffix="%" trend={5} delay={160} sparkData={timeSeriesData.slice(-14).map((_, i) => overallAccuracy + Math.round(Math.sin(i) * 4))} color="#D4A843" compact />
      <StatCard label="Interaction Rate" value={interactionRate} suffix="%" trend={12} delay={200} sparkData={timeSeriesData.slice(-30).map(d => d.visitors > 0 ? Math.round((d.ballInteractions / d.visitors) * 100) : 0)} color={MC.ballInteractions} compact />
    </div>

    {/* Multi-Metric Traffic Chart */}
    <div style={{ ...SS.panel, marginBottom: 20, padding: "18px 20px 12px" }}>
      <div style={SS.panelHeader}>
        <span style={{ ...SS.panelTitle, marginBottom: 0 }}>Traffic Over Time</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {metrics.map(m => <div key={m.key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: m.color, padding: "3px 8px", borderRadius: 4, background: `${m.color}15`, border: `1px solid ${m.color}30` }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: m.color, display: "inline-block" }} />{m.label}</div>)}
        </div>
      </div>
      <MultiLineChart data={timeSeriesData} metrics={metrics} />
    </div>

    {/* Shot Chart */}
    <div style={{ ...SS.panel, marginBottom: 20 }}>
      <div style={SS.panelHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ ...SS.panelTitle, marginBottom: 0 }}>Shot Chart</span>
          <span style={SS.panelBadge}>first-contact heatmap</span>
        </div>
        {selectedBall && <button onClick={() => setSelectedBall(null)} style={{ ...SS.timeBtn, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", fontSize: 10, padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>{"\u2190"} Show All</button>}
      </div>
      <ShotChart selectedBall={selectedBall} />
    </div>

    {/* Ball Engagement Funnel */}
    <div style={{ ...SS.panel, marginBottom: 20 }}>
      <div style={SS.panelHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ ...SS.panelTitle, marginBottom: 0 }}>Ball Engagement Funnel</span>
          <span style={SS.panelBadge}>{"\uD83C\uDFB1"} shot → make → open → CTA</span>
        </div>
      </div>
      <div style={{ maxWidth: 480, margin: "0 auto 16px" }}><FunnelVisual data={funnelData} color={funnelColor} label={funnelLabel} /></div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 48px 48px 48px 48px 56px", gap: 4, padding: "0 0 6px", fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span>Ball</span><span style={{ textAlign: "right" }}>Shots</span><span style={{ textAlign: "right" }}>Makes</span><span style={{ textAlign: "right" }}>Opens</span><span style={{ textAlign: "right" }}>CTAs</span><span style={{ textAlign: "right" }}>Cat</span>
        </div>
        {BALL_ENGAGEMENT.map((ball, i) => {
          const isSel = selectedBall === ball.id;
          return (<div key={ball.id} onClick={() => setSelectedBall(isSel ? null : ball.id)} style={{ display: "grid", gridTemplateColumns: "1fr 48px 48px 48px 48px 56px", gap: 4, padding: "7px 4px", fontSize: 11, cursor: "pointer", alignItems: "center", borderBottom: i < BALL_ENGAGEMENT.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none", background: isSel ? `${ball.color}12` : "transparent", borderLeft: isSel ? `2px solid ${ball.color}` : "2px solid transparent", transition: "all 0.15s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: ball.color, flexShrink: 0 }} /><span style={{ color: isSel ? "#fff" : "rgba(255,255,255,0.7)", fontWeight: isSel ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ball.ball}</span></div>
            {[ball.launches || 0, ball.scores || 0, ball.opens || 0, ball.ctaClicks || 0].map((v, j) => <span key={j} style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.65)" }}>{v}</span>)}
            <span style={{ textAlign: "right", fontSize: 9, fontWeight: 500, color: "rgba(255,255,255,0.35)" }}>{ball.category}</span>
          </div>);
        })}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {Object.entries(categories).map(([cat, d]) => <div key={cat} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 6, alignItems: "center" }}><span style={{ color: "rgba(255,255,255,0.6)" }}>{cat}</span><span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#D4A843", fontWeight: 600 }}>{((d.ctaClicks / d.clicks) * 100).toFixed(0)}%</span></div>)}
      </div>
    </div>

    {/* Device + Day-of-Week */}
    <div style={SS.twoCol} className="v3-two-col">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={SS.panel}>
          <span style={SS.panelTitle}>Day-of-Week Pattern</span>
          <DayOfWeekChart data={timeSeriesData} />
        </div>
      </div>
      <div style={SS.panel}>
        <div style={SS.panelHeader}>
          <span style={{ ...SS.panelTitle, marginBottom: 0 }}>Physics by Device</span>
          <span style={SS.panelBadge}>engagement quality</span>
        </div>
        {DEVICE_DATA.map((d, i) => <div key={d.device} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px 16px", marginBottom: i < DEVICE_DATA.length - 1 ? 10 : 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 16 }}>{d.icon}</span><span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{d.device}</span></div><span style={{ fontSize: 15, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: MC.visitors }}>{d.pct}%</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
            {[["INTERACT RATE", `${d.interactionRate}%`], ["AVG SHOTS", d.avgShots], ["ACCURACY", `${d.accuracy}%`], ["AVG DURATION", `${d.avgDuration}s`]].map(([l, v]) => <div key={l} style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: "0.8px", textTransform: "uppercase" }}>{l}</span><span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, color: "#fff" }}>{v}</span></div>)}
          </div>
        </div>)}
        {/* Engagement depth callout */}
        <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(89,133,177,0.06)", border: "1px solid rgba(89,133,177,0.12)", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.8px" }}>Avg Balls Touched / Session</span>
          <span style={{ fontSize: 18, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: "#5985B1" }}>{avgBallsPerSession}</span>
        </div>
      </div>
    </div>

    <InsightsPanel timeSeriesData={timeSeriesData} />

    {/* Bonus Charts Row */}
    <div style={{ ...SS.twoCol, marginTop: 20 }} className="v3-two-col">
      <div style={SS.panel}>
        <div style={SS.panelHeader}>
          <span style={{ ...SS.panelTitle, marginBottom: 0 }}>Accuracy by Ball</span>
          <span style={SS.panelBadge}>makes / shots</span>
        </div>
        <AccuracyByBallChart />
      </div>
      <div style={SS.panel}>
        <div style={SS.panelHeader}>
          <span style={{ ...SS.panelTitle, marginBottom: 0 }}>Conversion Waterfall</span>
          <span style={SS.panelBadge}>full funnel drop-off</span>
        </div>
        <ConversionWaterfall />
      </div>
    </div>

    {/* Engagement Radar */}
    <div style={{ ...SS.twoCol, marginTop: 20 }} className="v3-two-col">
      <div style={SS.panel}>
        <div style={SS.panelHeader}>
          <span style={{ ...SS.panelTitle, marginBottom: 0 }}>Device Engagement Radar</span>
          <span style={SS.panelBadge}>multi-axis comparison</span>
        </div>
        <EngagementRadar />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Quick stats cards */}
        <div style={SS.panel}>
          <span style={SS.panelTitle}>Quick Stats</span>
          {[
            ["Total Shots Fired", totals.launches.toLocaleString(), "#5985B1"],
            ["Goals Scored", totals.scores.toLocaleString(), "#6B9F6B"],
            ["CTA Click-Throughs", totals.ctaClicks.toLocaleString(), "#7B5EA7"],
            ["Full Funnel Conv.", `${((totals.launches > 0 ? totals.ctaClicks / totals.launches : 0) * 100).toFixed(1)}%`, "#D4A843"],
            ["Avg Balls / Session", avgBallsPerSession, "#5985B1"],
          ].map(([label, val, color]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{label}</span>
              <span style={{ fontSize: 14, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Traffic Sources */}
    <div style={{ marginTop: 20 }}>
      <div style={SS.panel}>
        <span style={SS.panelTitle}>Traffic Sources</span>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <DonutChart segments={REFERRER_DATA} size={115} strokeWidth={17} />
          <div style={{ flex: 1, minWidth: 150 }}>
            {REFERRER_DATA.map(r => <div key={r.source} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0" }}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: r.color, display: "inline-block" }} /><span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>{r.source}</span></div><div style={{ display: "flex", gap: 10, alignItems: "baseline" }}><span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: "#fff" }}>{r.visits}</span><span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: r.color }}>{r.pct}%</span></div></div>)}
          </div>
        </div>
      </div>
    </div>
    {/* Session Flow */}
    <div style={{ ...SS.panel, marginTop: 20 }}>
      <span style={SS.panelTitle}>Session Flow</span>
      {SESSION_FLOW.map((f, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < SESSION_FLOW.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}><div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><span style={{ color: "rgba(255,255,255,0.7)" }}>{f.from}</span><span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>{"\u2192"}</span><span style={{ color: "rgba(255,255,255,0.9)" }}>{f.to}</span></div><span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: f.color }}>{f.pct}%</span></div>)}
    </div>

    <div style={{ marginTop: 24, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.7 }}>
        {isLive
          ? "Real-time analytics powered by a custom GA4 Data API pipeline \u2014 a Cloudflare Worker authenticates via service account, queries the GA4 reporting endpoint, and returns structured JSON that this React dashboard consumes. Device breakdown, session flow, and architecture sections use supplementary demonstration data."
          : "Deterministic mock data shown for demonstration. In production, this dashboard connects to a Cloudflare Worker proxy that authenticates with the GA4 Data API and returns real visitor metrics, traffic sources, and ball engagement funnels."
        }
      </p>
    </div>
  </div>);
}

// ═══ DATA ARCHITECTURE TAB ══════════════════════════════════════════════
function DataArchitectureTab() {
  return (<div>
    {/* Pipeline */}
    <div style={SS.panel}>
      <div style={SS.panelHeader}><span style={{ ...SS.panelTitle, marginBottom: 0 }}>Tracking Architecture</span><span style={SS.panelBadge}>EventBus → GA4 pipeline</span></div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {PIPELINE_STEPS.map((step, i) => <div key={step.label} style={{ width: "100%", maxWidth: 440 }}>
          <div style={{ border: `1px solid ${step.border}55`, borderRadius: 10, padding: "14px 16px", background: `${step.border}08` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><span style={{ fontSize: 16 }}>{step.icon}</span><span style={{ fontSize: 14, fontWeight: 600, color: step.color }}>{step.label}</span></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{step.tags.map(t => <span key={t} style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.06)" }}>{t}</span>)}</div>
          </div>
          {i < PIPELINE_STEPS.length - 1 && <div style={{ textAlign: "center", padding: "4px 0", color: step.color, fontSize: 14, opacity: 0.6 }}>{"\u25BC"}</div>}
        </div>)}
      </div>
    </div>

    {/* Ball Physics Engine */}
    <div style={{ ...SS.panel, marginTop: 20 }}>
      <div style={SS.panelHeader}><span style={{ ...SS.panelTitle, marginBottom: 0 }}>Ball Physics Engine</span><span style={SS.panelBadge}>matter.js + p5.js</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="v3-two-col">
        {[
          { title: "Physics Properties", icon: "\u26A1", items: [["Friction", "0.5"], ["Air Friction", "0.001"], ["Restitution", "0.66"], ["Goal Restitution", "0.3"], ["Boundary Bounce", "0.5"]] },
          { title: "Interaction Thresholds", icon: "\uD83C\uDFAF", items: [["Min Launch Power", "2 (x or y)"], ["Double-Tap Window", "500ms"], ["Desktop Power Scale", "33"], ["Mobile Power Scale", "6.6 (33/5)"], ["Speed Scale", "Desktop 0.25 / Mobile 0.35"]] },
        ].map(section => (
          <div key={section.title} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}><span style={{ fontSize: 14 }}>{section.icon}</span><span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{section.title}</span></div>
            {section.items.map(([k, v]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}><span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{k}</span><span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.75)" }}>{v}</span></div>)}
          </div>
        ))}
      </div>
      {/* Category collision system */}
      <div style={{ marginTop: 12, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><span style={{ fontSize: 14 }}>{"\uD83D\uDCA5"}</span><span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>Category Collision System</span></div>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, marginBottom: 8 }}>Each ball is assigned a collision bitmask based on its category (Me, Technology, Business, Apps). Goals share the same bitmask. When a ball enters a goal zone, matter.js checks <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#5985B1" }}>bodyA.category === bodyB.category</span> — a match triggers the detail modal. Non-matching balls bounce off the net barriers.</p>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {["Me → 0x0001", "Technology → 0x0002", "Business → 0x0004", "Apps → 0x0008"].map(b => <span key={b} style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", background: "rgba(89,133,177,0.1)", color: "#5985B1", border: "1px solid rgba(89,133,177,0.15)" }}>{b}</span>)}
        </div>
      </div>
    </div>

    {/* Auto-Launch Power & Demo System */}
    <div style={{ ...SS.panel, marginTop: 20 }}>
      <div style={SS.panelHeader}><span style={{ ...SS.panelTitle, marginBottom: 0 }}>Auto-Launch Power System</span><span style={SS.panelBadge}>adaptive physics</span></div>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, marginBottom: 14 }}>Launch power dynamically adapts to viewport size so balls reach goals consistently across all devices. The system calculates power from screen area and icon dimensions, with separate scaling for portrait/mobile vs landscape/desktop.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="v3-two-col">
        <div style={{ background: "rgba(212,168,67,0.06)", border: "1px solid rgba(212,168,67,0.12)", borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#D4A843", marginBottom: 8 }}>Portrait / Mobile</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.8 }}>
            power = area / iconSize<sup>2.7</sup><br />
            sensitivity = area<sup>1/3</sup><br />
            powerScale = 33 / 5 = 6.6<br />
            speedScale = 0.35
          </div>
        </div>
        <div style={{ background: "rgba(89,133,177,0.06)", border: "1px solid rgba(89,133,177,0.12)", borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#5985B1", marginBottom: 8 }}>Landscape / Desktop</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.8 }}>
            power = √iconSize × (area / 350K)<br />
            sensitivity = area<sup>1/3</sup><br />
            powerScale = 33<br />
            speedScale = 0.25
          </div>
        </div>
      </div>
      {/* Demo launch */}
      <div style={{ marginTop: 12, background: "rgba(107,159,107,0.06)", border: "1px solid rgba(107,159,107,0.12)", borderRadius: 10, padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><span style={{ fontSize: 14 }}>{"\uD83D\uDE80"}</span><span style={{ fontSize: 12, fontWeight: 600, color: "#6B9F6B" }}>Demo Launch System</span></div>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, marginBottom: 8 }}>On first load, the first ball auto-launches to teach the mechanic. It fires at a 60° angle (cos 60° = 0.5, sin 60° = 0.866) with power reduced to 67% of normal. Power accumulates incrementally over 100 frames, and the ball launches once cumulative force exceeds the target.</p>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {["60° angle", "67% power", "100-frame ramp", "Auto-aim arrow"].map(t => <span key={t} style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", background: "rgba(107,159,107,0.1)", color: "#6B9F6B", border: "1px solid rgba(107,159,107,0.15)" }}>{t}</span>)}
        </div>
      </div>
    </div>

    {/* Ball Lifecycle State Machine */}
    <div style={{ ...SS.panel, marginTop: 20 }}>
      <div style={SS.panelHeader}><span style={{ ...SS.panelTitle, marginBottom: 0 }}>Ball Lifecycle</span><span style={SS.panelBadge}>state machine</span></div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
        {[
          { state: "Idle", desc: "Static body in grid. Displays project image with canvas clipping.", color: "#5985B1", next: "Drag" },
          { state: "Aiming", desc: "User dragging — power accumulates from mouse delta / sensitivity. Arrow indicator shows trajectory.", color: "#D4A843", next: "Release" },
          { state: "Launched", desc: "Dynamic body with velocity. Collision filter set to category bitmask. Bounces off walls and nets.", color: "#6B9F6B", next: "Goal match?" },
          { state: "Scored", desc: "Category match detected. Detail modal opens. Ball freezes. Stats emitted via EventBus.", color: "#7B5EA7", next: "Close modal" },
          { state: "Reset", desc: "Velocity zeroed. Position restored. Body set back to static. Removed from physics world.", color: "#C05050", next: null },
        ].map((s, i) => (
          <div key={s.state} style={{ width: "100%", maxWidth: 440 }}>
            <div style={{ border: `1px solid ${s.color}44`, borderRadius: 8, padding: "10px 14px", background: `${s.color}08` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: s.color }}>{s.state}</span>
                <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.3)" }}>state {i + 1}/5</span>
              </div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{s.desc}</p>
            </div>
            {s.next && <div style={{ textAlign: "center", padding: "3px 0", fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "'JetBrains Mono', monospace" }}>{"\u25BC"} {s.next}</div>}
          </div>
        ))}
      </div>
    </div>

    {/* Responsive Viewport Adaptation */}
    <div style={{ ...SS.panel, marginTop: 20 }}>
      <div style={SS.panelHeader}><span style={{ ...SS.panelTitle, marginBottom: 0 }}>Responsive Viewport</span><span style={SS.panelBadge}>adaptive layout</span></div>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, marginBottom: 14 }}>The Game class recalculates all layout values on resize — icon size, grid positions, goal placement, power scaling, and font sizes are all derived from viewport dimensions. No CSS breakpoints — pure JavaScript layout engine.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="v3-two-col">
        {[
          { mode: "Portrait", items: [["Icon size", "width / iconScale (6)"], ["Grid cols", "Auto-fit from available width"], ["Goals", "Top-center dots"], ["Power", "area / iconSize^2.7"]] },
          { mode: "Landscape", items: [["Icon size", "min(height-derived, width/7, height/4)"], ["Grid cols", "3 fixed"], ["Goals", "Left 3% of width"], ["Power", "√iconSize × (area / 350K)"]] },
        ].map(s => (
          <div key={s.mode} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", marginBottom: 8 }}>{s.mode}</div>
            {s.items.map(([k, v]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}><span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{k}</span><span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.65)", textAlign: "right", maxWidth: "55%" }}>{v}</span></div>)}
          </div>
        ))}
      </div>
    </div>

    {/* Custom Events */}
    <div style={{ ...SS.panel, marginTop: 20 }}>
      <span style={SS.panelTitle}>Custom Events Tracked</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {CUSTOM_EVENTS.map(evt => <div key={evt.name} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: evt.color, marginBottom: evt.params.length ? 6 : 0 }}>{evt.name}</div>
          {evt.params.length > 0 && <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{evt.params.map(p => <span key={p} style={{ padding: "2px 7px", borderRadius: 3, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.45)" }}>{p}</span>)}</div>}
        </div>)}
      </div>
    </div>

    {/* Implementation */}
    <div style={{ ...SS.panel, marginTop: 20 }}>
      <span style={SS.panelTitle}>Implementation Details</span>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.8 }}>
        <p style={{ marginBottom: 12 }}>Real-time analytics powered by a custom GA4 Data API pipeline — a Cloudflare Worker authenticates via service account, queries the GA4 reporting endpoint, and returns structured JSON that this React dashboard consumes.</p>
        <p>Six custom GA4 events track the full user journey from ball interaction through project discovery and CTA conversion, with enriched parameters for per-project attribution and accuracy tracking.</p>
      </div>
      <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
        {[["Event Bridge", "src/game/ga4.js"], ["Communication", "EventBus pub/sub"], ["Delta Detection", "Prevents double-counting via lastShots / lastMakes"], ["Dashboard", "React + custom SVG charts"], ["Hosting", "Namecheap cPanel + Cloudflare Worker"], ["Stack", "Vite + React 18 + p5.js + matter.js"]].map(([k, v], i) => <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 5 ? "1px solid rgba(255,255,255,0.03)" : "none" }}><span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{k}</span><span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.7)" }}>{v}</span></div>)}
      </div>
    </div>
  </div>);
}

// ═══ MAIN DASHBOARD ═════════════════════════════════════════════════════
const TIME_RANGES = [{ key: "7d", label: "7D", days: 7 }, { key: "30d", label: "30D", days: 30 }, { key: "90d", label: "90D", days: 90 }];
const TABS = [{ key: "analytics", label: "Analytics" }, { key: "architecture", label: "Data Architecture" }];

export default function AnalyticsDashboardV3() {
  const [activeTab, setActiveTab] = useState("analytics");
  const [timeRange, setTimeRange] = useState("90d");

  // Live data state
  const [liveData, setLiveData] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);

  const mockData = useMemo(() => generateTimeSeriesData(90), []);
  const rangeDays = TIME_RANGES.find(r => r.key === timeRange)?.days ?? 90;

  // Fetch live data when time range changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchGA4Data(rangeDays).then((result) => {
      if (cancelled) return;
      if (result) { setLiveData(result); setIsLive(true); }
      else { setIsLive(false); }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [rangeDays]);

  // Resolve data — live or mock
  // Worker returns: visitors, pageviews, avgDuration, bounceRate, ballInteractions
  // V3 charts need: shots (= ballInteractions), ctaClicks, dayOfWeek
  const rawTimeSeries = isLive
    ? (liveData?.timeSeries || []).filter(d => d && d.visitors != null)
    : mockData.slice(-rangeDays);

  // Normalize: add computed fields the charts expect
  const timeSeriesData = rawTimeSeries.map(d => {
    const dateObj = d.date ? new Date(d.date + 'T12:00:00') : new Date();
    return {
      ...d,
      visitors: d.visitors || 0,
      pageviews: d.pageviews || 0,
      avgDuration: d.avgDuration || 0,
      bounceRate: d.bounceRate || 0,
      ballInteractions: d.ballInteractions || 0,
      // "shots" = ball_launch count per day (Worker calls it ballInteractions)
      shots: d.shots || d.ballInteractions || 0,
      // ctaClicks per day — only show real data, 0 if not tracked yet
      ctaClicks: d.ctaClicks || 0,
      dayOfWeek: d.dayOfWeek != null ? d.dayOfWeek : dateObj.getDay(),
      label: d.label || dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
  });
  const sourcesData = isLive ? (liveData?.sources || MOCK_REFERRER) : MOCK_REFERRER;
  const pagesData = isLive ? (liveData?.pages || MOCK_PAGES) : MOCK_PAGES;
  const ballData = (isLive && liveData?.ballEvents?.length > 0) ? liveData.ballEvents : MOCK_BALLS;

  // Device data — adapt shape from data.js for V3 display
  const deviceData = MOCK_DEVICES.map(d => ({
    ...d,
    icon: DEVICE_ICONS[d.device] || "\uD83D\uDCBB",
    interactionRate: d.ballRate || d.interactionRate || 0,
    avgShots: d.avgShots || 0,
    accuracy: d.accuracy || 0,
  }));

  // Session flow — adapt shape from data.js (value → pct)
  const sessionFlow = MOCK_FLOW.map(f => ({ ...f, pct: f.value || f.pct || 0 }));

  return (
    <div style={SS.root}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .fade-in-card { animation: fadeSlideIn 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        @media (max-width:700px) {
          .v3-two-col { grid-template-columns:1fr !important; }
          .v3-kpi-row { grid-template-columns:1fr 1fr !important; }
        }
        @media (max-width:380px) { .v3-kpi-row { grid-template-columns:1fr !important; } }
      `}</style>
      <div style={{ ...SS.glow, top: -100, right: -100, background: "radial-gradient(circle, rgba(89,133,177,0.06) 0%, transparent 70%)" }} />
      <div style={{ ...SS.glow, bottom: -100, left: -100, background: "radial-gradient(circle, rgba(212,168,67,0.05) 0%, transparent 70%)" }} />
      <header style={SS.header}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={SS.title}>Site Analytics</h1>
            <div style={isLive ? SS.liveBadge : { ...SS.liveBadge, background: "rgba(212,168,67,0.12)", color: "#D4A843" }}>
              <span style={isLive ? SS.liveDot : { ...SS.liveDot, background: "#D4A843", boxShadow: "0 0 6px rgba(212,168,67,0.5)" }} />
              {loading ? "Loading\u2026" : isLive ? "Live" : "Demo"}
            </div>
            <span style={SS.versionBadge}>V3</span>
          </div>
          <p style={SS.subtitle}>DaDataDad.com &middot; Last {rangeDays} days</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={SS.tabGroup}>{TABS.map(t => <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ ...SS.tabBtn, background: activeTab === t.key ? "rgba(255,255,255,0.1)" : "transparent", color: activeTab === t.key ? "#fff" : "rgba(255,255,255,0.4)", borderColor: activeTab === t.key ? "rgba(255,255,255,0.15)" : "transparent" }}>{t.label}</button>)}</div>
          {activeTab === "analytics" && <div style={SS.timeGroup}>{TIME_RANGES.map(r => <button key={r.key} onClick={() => setTimeRange(r.key)} style={{ ...SS.timeBtn, background: timeRange === r.key ? "rgba(255,255,255,0.1)" : "transparent", color: timeRange === r.key ? "#fff" : "rgba(255,255,255,0.35)" }}>{r.label}</button>)}</div>}
          {/* Version nav */}
          <div style={{ display: "flex", gap: 4, marginLeft: 4 }}>
            <a href="/analytics-dashboard.html" style={SS.navLink}>V1</a>
            <a href="/analytics-v2.html" style={SS.navLink}>V2</a>
            <span style={{ ...SS.navLink, color: "#fff", background: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.15)" }}>V3</span>
            <a href="/" style={SS.navLink}>Portfolio</a>
          </div>
        </div>
      </header>
      {activeTab === "analytics"
        ? <AnalyticsTab timeSeriesData={timeSeriesData} rangeDays={rangeDays}
            ballData={ballData} sourcesData={sourcesData} pagesData={pagesData}
            deviceData={deviceData} sessionFlow={sessionFlow} isLive={isLive} />
        : <DataArchitectureTab />
      }
    </div>
  );
}

// ═══ STYLES ═════════════════════════════════════════════════════════════
const SS = {
  root: { minHeight: "100vh", background: "linear-gradient(160deg, #0a0a0f 0%, #0d1117 50%, #0a0a0f 100%)", padding: "28px clamp(16px, 4vw, 36px) 48px", position: "relative", overflow: "hidden", maxWidth: 960, margin: "0 auto", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", color: "#fff", lineHeight: 1.5 },
  glow: { position: "absolute", width: 400, height: 400, borderRadius: "50%", filter: "blur(80px)", pointerEvents: "none", zIndex: 0 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16, position: "relative", zIndex: 1 },
  title: { fontFamily: "'Syne', sans-serif", fontSize: "clamp(1.4rem, 4vw, 1.8rem)", fontWeight: 800, letterSpacing: "-0.5px" },
  subtitle: { fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" },
  liveBadge: { display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: "rgba(107,159,107,0.12)", fontSize: 11, fontWeight: 600, color: "#6B9F6B" },
  liveDot: { width: 6, height: 6, borderRadius: "50%", background: "#6B9F6B", display: "inline-block", boxShadow: "0 0 6px rgba(107,159,107,0.5)" },
  versionBadge: { padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", background: "rgba(89,133,177,0.15)", color: "#5985B1", border: "1px solid rgba(89,133,177,0.3)" },
  tabGroup: { display: "flex", gap: 2, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 2 },
  tabBtn: { padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500, border: "1px solid transparent", cursor: "pointer", transition: "all 0.2s", fontFamily: "'DM Sans', sans-serif" },
  timeGroup: { display: "flex", gap: 2, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 2 },
  timeBtn: { padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 500, border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s" },
  statCard: { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "16px 18px" },
  statLabel: { fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 6, fontWeight: 600 },
  statRow: { display: "flex", alignItems: "flex-end", justifyContent: "space-between" },
  statValueGroup: { display: "flex", alignItems: "baseline" },
  statValue: { fontSize: "clamp(1.3rem, 3.5vw, 1.7rem)", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-1px", color: "#fff" },
  statTrend: { fontSize: 11, fontWeight: 600, marginLeft: 8 },
  panel: { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 18, position: "relative", zIndex: 1 },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 },
  panelTitle: { fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.6)", display: "block", marginBottom: 14 },
  panelBadge: { fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.25)", padding: "3px 8px", borderRadius: 4, background: "rgba(255,255,255,0.04)" },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  navLink: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.35)", textDecoration: "none", padding: "4px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)", transition: "all 0.15s" },
};


