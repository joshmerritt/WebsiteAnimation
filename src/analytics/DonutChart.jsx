/**
 * DonutChart.jsx — Animated segmented donut
 */

export default function DonutChart({ segments, size = 120, strokeWidth = 18 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg width={size} height={size} className="donut-chart">
      {/* Background track */}
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="rgba(255,255,255,0.04)"
        strokeWidth={strokeWidth}
      />
      {/* Segments */}
      {segments.map((seg, i) => {
        const dash = (seg.pct / 100) * circumference;
        const gap = circumference - dash;
        const thisOffset = offset;
        offset += dash;
        return (
          <circle
            key={i}
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-thisOffset}
            strokeLinecap="butt"
            className="donut-segment"
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        );
      })}
    </svg>
  );
}
