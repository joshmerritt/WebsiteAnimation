/**
 * GameCanvas.jsx — p5.js in instance mode, wrapped as a React component
 *
 * Creates a p5 instance bound to a DOM container, wires all p5 lifecycle
 * and input events to the Game class. Cleans up on unmount.
 */

import { useEffect, useRef } from 'react';
import p5 from 'p5';
import Game from '../game/Game.js';

export default function GameCanvas() {
  const containerRef = useRef(null);

  useEffect(() => {
    let game;

    const sketch = (p) => {
      game = new Game(p);

      p.preload = () => game.preload();
      p.setup   = () => game.setup();
      p.draw    = () => game.draw();

      p.windowResized = () => game.windowResized();
      p.keyPressed    = () => game.keyPressed();
      p.mousePressed  = () => game.mousePressed();
      p.mouseDragged  = () => game.mouseDragged();
      p.mouseReleased = () => game.mouseReleased();

      // Touch equivalents for mobile
      p.touchStarted = () => game.mousePressed();
      p.touchMoved   = () => game.mouseDragged();
      p.touchEnded   = () => game.mouseReleased();
    };

    const instance = new p5(sketch, containerRef.current);

    return () => {
      game?.destroy();
      instance.remove();
    };
  }, []);

  return <div ref={containerRef} className="game-canvas" />;
}
