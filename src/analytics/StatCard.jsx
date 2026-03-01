/**
 * StatCard.jsx — KPI metric card
 */

import { useAnimatedNumber } from './hooks.js';
import Sparkline from './Sparkline.jsx';

export default function StatCard({
  label, value, suffix = '', prefix = '',
  trend, sparkData, color, delay = 0,
}) {
  const animVal = useAnimatedNumber(value, 1000, delay);

  return (
    <div className="stat-card" style={{ animationDelay: `${delay}ms` }}>
      <div className="stat-label">{label}</div>
      <div className="stat-row">
        <div className="stat-value-group">
          <span className="stat-value">
            {prefix}{animVal.toLocaleString()}{suffix}
          </span>
          {trend !== undefined && (
            <span className={`stat-trend ${trend >= 0 ? 'up' : 'down'}`}>
              {trend >= 0 ? '\u2191' : '\u2193'} {Math.abs(trend)}%
            </span>
          )}
        </div>
        {sparkData && (
          <Sparkline data={sparkData} color={color} width={80} height={28} filled />
        )}
      </div>
    </div>
  );
}
