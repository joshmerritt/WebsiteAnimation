/**
 * AreaChart.jsx — Interactive area/line chart with hover tooltip
 */

import { useState, useRef } from 'react';

export default function AreaChart({ data, dataKey, color, width = 680, height = 200 }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const svgRef = useRef(null);

  const max = Math.max(...data.map((d) => d[dataKey])) * 1.1;
  const min = 0;
  const range = max - min || 1;

  const padL = 44, padR = 12, padT = 12, padB = 28;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const toX = (i) => padL + (i / (data.length - 1)) * chartW;
  const toY = (v) => padT + chartH - ((v - min) / range) * chartH;

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d[dataKey])}`)
    .join(' ');
  const areaPath = `${linePath} L${toX(data.length - 1)},${padT + chartH} L${toX(0)},${padT + chartH} Z`;

  const gridLines = 4;
  const gridVals = Array.from(
    { length: gridLines + 1 },
    (_, i) => min + (range / gridLines) * i,
  );

  const handleMouseMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const scaledX = (x / rect.width) * width - padL;
    const idx = Math.round((scaledX / chartW) * (data.length - 1));
    setHoverIdx(Math.max(0, Math.min(data.length - 1, idx)));
  };

  const handleTouchMove = (e) => {
    if (!svgRef.current || !e.touches[0]) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const scaledX = (x / rect.width) * width - padL;
    const idx = Math.round((scaledX / chartW) * (data.length - 1));
    setHoverIdx(Math.max(0, Math.min(data.length - 1, idx)));
  };

  // X-axis: show ~8 evenly spaced labels
  const xStep = Math.ceil(data.length / 8);
  const xLabels = data.filter((_, i) => i % xStep === 0);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className="area-chart"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverIdx(null)}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => setHoverIdx(null)}
    >
      <defs>
        <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Grid */}
      {gridVals.map((v, i) => (
        <g key={i}>
          <line
            x1={padL} y1={toY(v)} x2={width - padR} y2={toY(v)}
            className="chart-grid-line"
          />
          <text
            x={padL - 8} y={toY(v) + 4}
            className="chart-axis-label" textAnchor="end"
          >
            {Math.round(v)}
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {xLabels.map((d) => {
        const idx = data.indexOf(d);
        return (
          <text
            key={idx} x={toX(idx)} y={height - 4}
            className="chart-axis-label" textAnchor="middle"
          >
            {d.label}
          </text>
        );
      })}

      {/* Area fill + line */}
      <path d={areaPath} fill={`url(#grad-${dataKey})`} />
      <path
        d={linePath} fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        className="chart-line-animated"
      />

      {/* Hover */}
      {hoverIdx !== null && (
        <g>
          <line
            x1={toX(hoverIdx)} y1={padT}
            x2={toX(hoverIdx)} y2={padT + chartH}
            stroke={color} strokeWidth="1"
            strokeDasharray="3,3" opacity="0.45"
          />
          <circle
            cx={toX(hoverIdx)}
            cy={toY(data[hoverIdx][dataKey])}
            r="4.5" fill={color}
            stroke="var(--a-bg)" strokeWidth="2"
          />
          <rect
            x={toX(hoverIdx) - 50}
            y={toY(data[hoverIdx][dataKey]) - 30}
            width="100" height="24" rx="5"
            className="chart-tooltip-bg"
            stroke={`${color}44`} strokeWidth="1"
          />
          <text
            x={toX(hoverIdx)}
            y={toY(data[hoverIdx][dataKey]) - 15}
            textAnchor="middle"
            className="chart-tooltip-text"
          >
            {data[hoverIdx].label}: {data[hoverIdx][dataKey].toLocaleString()}
          </text>
        </g>
      )}
    </svg>
  );
}
