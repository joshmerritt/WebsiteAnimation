/**
 * StatsOverlay.jsx — Live stats pill
 *
 * Shows shots, makes, and opens count in a compact overlay.
 * Appears after the first shot, positioned bottom-left.
 * Listens to EventBus for stats:update events.
 */

import { useState, useEffect } from 'react';
import bus from '../game/EventBus.js';

export default function StatsOverlay() {
  const [stats, setStats] = useState({ shots: 0, makes: 0, opens: 0 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const unsub = bus.on('stats:update', (data) => {
      setStats(data);
      if (data.shots > 0) setVisible(true);
    });
    return unsub;
  }, []);

  if (!visible) return null;

  const pct = stats.shots > 0
    ? Math.round((stats.makes / stats.shots) * 100)
    : 0;

  return (
    <div className="stats-overlay">
      <div className="stats-item">
        <span className="stats-value">{stats.shots}</span>
        <span className="stats-label">shots</span>
      </div>
      <div className="stats-divider" />
      <div className="stats-item">
        <span className="stats-value">{stats.makes}</span>
        <span className="stats-label">makes</span>
      </div>
      <div className="stats-divider" />
      <div className="stats-item">
        <span className="stats-value stats-value--accent">{pct}%</span>
        <span className="stats-label">accuracy</span>
      </div>
    </div>
  );
}
