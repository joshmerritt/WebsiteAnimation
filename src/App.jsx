/**
 * App.jsx — Root component
 *
 * Layers:
 *   1. LoadingScreen (fades out when p5 finishes preloading)
 *   2. GameCanvas (p5.js physics + rendering)
 *   3. React overlay (modal + HUD + stats)
 *   4. GA4 event tracking (wired to EventBus)
 */

import { Component, useState, useEffect, useCallback } from 'react';
import GameCanvas from './components/GameCanvas.jsx';
import DetailModal from './components/DetailModal.jsx';
import HUD from './components/HUD.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import bus from './game/EventBus.js';
import { initGA4Tracking } from './game/ga4.js';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error('App error:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: '#c7d6d5', textAlign: 'center', padding: '4rem 1rem', fontFamily: 'DM Sans, sans-serif' }}>
          <h1 style={{ marginBottom: '0.5rem' }}>Something went wrong</h1>
          <p>Try refreshing the page.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [detail, setDetail] = useState(null);
  const [missHint, setMissHint] = useState(false);

  const handleClose = useCallback(() => {
    setDetail(null);
    bus.emit('detail:close');
  }, []);

  useEffect(() => {
    const unsub = bus.on('detail:open', (data) => {
      setDetail(data);
    });
    return unsub;
  }, []);

  // Miss hint popup — shown after 3 consecutive misses
  useEffect(() => {
    const unsub = bus.on('miss:hint', (show) => {
      setMissHint(show);
    });
    return unsub;
  }, []);

  // Initialize GA4 tracking on mount
  useEffect(() => {
    const cleanup = initGA4Tracking();
    return cleanup;
  }, []);

  // ESC to close
  useEffect(() => {
    const onKey = (e) => {
      if (detail && (e.key === 'Escape' || e.key === 'Backspace')) {
        handleClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detail, handleClose]);

  return (
    <ErrorBoundary>
      <LoadingScreen />
      <GameCanvas />
      <div className="ui-overlay">
        <DetailModal detail={detail} onClose={handleClose} />
        {!detail && (
          <>
            <HUD />
            {missHint && (
              <div className="miss-hint">
                <span className="miss-hint-icon">💡</span>
                <span>Try <strong>double-clicking</strong> a ball to view project details!</span>
              </div>
            )}
          </>
        )}
      </div>
    </ErrorBoundary>
  );
}
