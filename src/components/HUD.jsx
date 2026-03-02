/**
 * HUD.jsx — Overlay button: Contact Me
 *
 * Uses explicit onClick + onTouchEnd handlers to ensure mailto works
 * on mobile, where p5's touchStarted returning false calls preventDefault()
 * and can interfere with native <a> tag behavior.
 */

import { useRef } from 'react';
import config from '../game/config.js';

export default function HUD() {
  const handledRef = useRef(false);

  const openMailto = () => {
    // Prevent double-fire from both touchEnd and click
    if (handledRef.current) return;
    handledRef.current = true;
    setTimeout(() => { handledRef.current = false; }, 400);
    window.location.href = `mailto:${config.contactEmail}`;
  };

  const handleTouchEnd = (e) => {
    e.stopPropagation();
    openMailto();
  };

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openMailto();
  };

  return (
    <div className="hud">
      <a
        className="hud-btn hud-contact"
        href={`mailto:${config.contactEmail}`}
        onClick={handleClick}
        onTouchEnd={handleTouchEnd}
      >
        <span className="hud-icon">✉</span>
        <span className="hud-label">Contact Me</span>
      </a>
    </div>
  );
}
