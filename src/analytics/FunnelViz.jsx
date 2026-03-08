/**
 * FunnelViz.jsx — Animated visual funnel for the 4-step ball engagement
 *
 * Launch → Score → Open → CTA Click
 * Renders as a narrowing SVG trapezoid with animated fill and labels.
 */

const STEPS = [
  { key: 'launches',  label: 'Launch',    desc: 'Released with power' },
  { key: 'scores',    label: 'Score',     desc: 'Hit matching goal' },
  { key: 'opens',     label: 'Open',      desc: 'Detail page viewed' },
  { key: 'ctaClicks', label: 'CTA Click', desc: 'Clicked project link' },
];

const COLORS = ['#5985B1', '#D4A843', '#6B9F6B', '#D4A843'];

export default function FunnelViz({ totals }) {
  const w = 520;
  const h = 280;
  const padX = 20;
  const labelSpace = 140;
  const maxWidth = w - padX * 2 - labelSpace;
  const cx = padX + maxWidth / 2;
  const stepH = (h - 50) / STEPS.length;
  const topY = 24;

  const maxVal = totals.launches || 1;
  const overallConv = totals.launches > 0
    ? ((totals.ctaClicks / totals.launches) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="funnel-viz">
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          {STEPS.map((_, i) => (
            <linearGradient key={i} id={`funnel-grad-${i}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={COLORS[i]} stopOpacity="0.65" />
              <stop offset="100%" stopColor={COLORS[i]} stopOpacity="0.15" />
            </linearGradient>
          ))}
        </defs>

        {STEPS.map((step, i) => {
          const val = totals[step.key] || 0;
          const barW = (val / maxVal) * maxWidth;
          const nextVal = i < STEPS.length - 1 ? (totals[STEPS[i + 1].key] || 0) : val * 0.85;
          const nextBarW = (nextVal / maxVal) * maxWidth;
          const y = topY + i * stepH;
          const nextY = topY + (i + 1) * stepH;
          const pct = i > 0
            ? (totals[STEPS[i - 1].key] > 0
                ? ((val / totals[STEPS[i - 1].key]) * 100).toFixed(0)
                : '0')
            : '100';

          const x1 = cx - barW / 2;
          const x2 = cx + barW / 2;
          const x3 = cx + nextBarW / 2;
          const x4 = cx - nextBarW / 2;

          const labelX = cx + maxWidth / 2 + 18;

          return (
            <g key={step.key}>
              {/* Trapezoid */}
              <path
                d={`M${x1},${y} L${x2},${y} L${x3},${nextY} L${x4},${nextY} Z`}
                fill={`url(#funnel-grad-${i})`}
                className="funnel-step"
                style={{ animationDelay: `${i * 150}ms` }}
              />

              {/* Top edge */}
              <line
                x1={x1} y1={y} x2={x2} y2={y}
                stroke={COLORS[i]} strokeWidth="2" strokeLinecap="round" opacity="0.8"
                className="funnel-edge"
                style={{ animationDelay: `${i * 150}ms` }}
              />

              {/* Step label */}
              <text x={labelX} y={y + stepH / 2 - 7} className="funnel-label" fill={COLORS[i]}>
                {step.label}
              </text>

              {/* Value */}
              <text x={labelX} y={y + stepH / 2 + 13} className="funnel-value">
                {val.toLocaleString()}
              </text>

              {/* Step-to-step conversion % */}
              {i > 0 && (
                <text x={cx} y={y + 4} textAnchor="middle" className="funnel-pct" fill={COLORS[i]}>
                  {pct}%
                </text>
              )}
            </g>
          );
        })}

        {/* Overall label */}
        <text x={cx} y={h - 6} textAnchor="middle" className="funnel-overall">
          {overallConv}% overall launch-to-CTA conversion
        </text>
      </svg>
    </div>
  );
}
