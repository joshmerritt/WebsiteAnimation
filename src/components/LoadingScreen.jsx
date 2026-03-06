/**
 * LoadingScreen.jsx — Full-screen loader shown while p5 preloads images
 *
 * Listens to EventBus for load:progress and load:complete events.
 * Fades out smoothly when loading finishes.
 *
 * Uses module-level state to capture events that fire before React mounts,
 * then hands off to React state once the component mounts and cleans up
 * the early listeners to avoid leaks.
 */

import { useState, useEffect } from 'react';
import bus from '../game/EventBus.js';

// Capture early events before React mounts — unsubscribed once the component takes over
let _latestProgress = 0;
let _isComplete = false;
const _earlyUnsubs = [
  bus.on('load:progress', (pct) => { _latestProgress = pct; }),
  bus.on('load:complete', () => { _isComplete = true; }),
];

export default function LoadingScreen() {
  const [progress, setProgress] = useState(() => _latestProgress);
  const [complete, setComplete] = useState(() => _isComplete);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    // Clean up early listeners now that React owns the state
    _earlyUnsubs.forEach((fn) => fn());
    _earlyUnsubs.length = 0;

    // Sync any progress that fired before mount
    if (_latestProgress > 0) setProgress(_latestProgress);
    if (_isComplete) {
      setComplete(true);
      setTimeout(() => setHidden(true), 600);
      return;
    }

    const unsubs = [
      bus.on('load:progress', (pct) => setProgress(pct)),
      bus.on('load:complete', () => {
        setComplete(true);
        setTimeout(() => setHidden(true), 600);
      }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, []);

  if (hidden) return null;

  return (
    <div className={`loading-screen ${complete ? 'loading-screen--out' : ''}`}>
      <div className="loading-content">
        <h1 className="loading-title">Da Data Dad</h1>
        <p className="loading-subtitle">Loading playground&hellip;</p>
        <div className="loading-track">
          <div
            className="loading-fill"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <span className="loading-pct">{Math.round(progress * 100)}%</span>
      </div>
    </div>
  );
}
