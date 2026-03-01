/**
 * GameCanvas.jsx — p5.js in instance mode, wrapped as a React component
 *
 * Creates a p5 instance bound to a DOM container, wires all p5 lifecycle
 * and input events to the Game class. Cleans up on unmount.
 *
 * IMPORTANT: Touch/mouse handlers only return false (preventDefault) when
 * the event originates on the canvas itself, so React UI buttons stay clickable.
 */

import { useEffect, useRef } from 'react';
import p5 from 'p5';
import Game from '../game/Game.js';

export default function GameCanvas() {
  const containerRef = useRef(null);

  useEffect(() => {
    let game;
    let canvasEl = null;

    const sketch = (p) => {
      game = new Game(p);

      p.preload = () => game.preload();
      p.setup   = () => {
        game.setup();
        canvasEl = containerRef.current?.querySelector('canvas');
      };
      p.draw    = () => game.draw();

      p.windowResized = () => game.windowResized();
      p.keyPressed    = () => game.keyPressed();

      // Only handle mouse/touch if the event is on our canvas
      p.mousePressed  = (e) => {
        if (e?.target && e.target !== canvasEl) return;
        return game.mousePressed();
      };
      p.mouseDragged  = (e) => {
        if (e?.target && e.target !== canvasEl) return;
        return game.mouseDragged();
      };
      p.mouseReleased = (e) => {
        // Always handle release (to clear drag state) but only preventDefault on canvas
        game.mouseReleased();
        if (e?.target === canvasEl) return false;
      };

      // Touch equivalents — same canvas-only filtering
      p.touchStarted = (e) => {
        if (e?.target && e.target !== canvasEl) return;
        return game.mousePressed();
      };
      p.touchMoved = (e) => {
        if (e?.target && e.target !== canvasEl) return;
        return game.mouseDragged();
      };
      p.touchEnded = (e) => {
        game.mouseReleased();
        if (e?.target === canvasEl) return false;
      };
    };

    const instance = new p5(sketch, containerRef.current);

    return () => {
      game?.destroy();
      instance.remove();
    };
  }, []);

  return <div ref={containerRef} className="game-canvas" />;
}
