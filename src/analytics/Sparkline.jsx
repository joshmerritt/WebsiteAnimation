/**
 * Sparkline.jsx — Compact inline chart
 */

export default function Sparkline({ data, width = 120, height = 32, color = '#D4A843', filled = false }) {
  if (!data.length) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  const lastVal = data[data.length - 1];
  const endY = height - ((lastVal - min) / range) * (height - 4) - 2;

  return (
    <svg width={width} height={height} className="sparkline">
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
      <circle cx={width} cy={endY} r="2.5" fill={color} />
    </svg>
  );
}
