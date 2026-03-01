/**
 * App.jsx — Root component
 *
 * Layers:
 *   1. GameCanvas (p5.js physics + rendering)
 *   2. React overlay (modal + HUD buttons)
 *
 * Listens to EventBus for game ↔ UI communication.
 */

import { useState, useEffect, useCallback } from 'react';
import GameCanvas from './components/GameCanvas.jsx';
import DetailModal from './components/DetailModal.jsx';
import HUD from './components/HUD.jsx';
import bus from './game/EventBus.js';

export default function App() {
  const [detail, setDetail] = useState(null);

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
    <>
      <GameCanvas />
      <div className="ui-overlay">
        <DetailModal detail={detail} onClose={handleClose} />
        {!detail && <HUD />}
      </div>
    </>
  );
}
