/**
 * HUD.jsx — Overlay button: Contact Me
 *
 * Reset button removed per user preference.
 */

import config from '../game/config.js';

export default function HUD() {
  return (
    <div className="hud">
      <a
        className="hud-btn hud-contact"
        href={`mailto:${config.contactEmail}`}
      >
        <span className="hud-icon">✉</span>
        <span className="hud-label">Contact Me</span>
      </a>
    </div>
  );
}
