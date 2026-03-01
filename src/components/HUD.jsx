/**
 * HUD.jsx — Overlay buttons: Contact + Reset
 *
 * On mobile: bottom bar with Contact centered (plain link) and Reset right.
 * On desktop: top-right pill buttons.
 */

import config from '../game/config.js';
import bus from '../game/EventBus.js';

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
      <button className="hud-btn hud-reset" onClick={() => bus.emit('game:reset')}>
        <span className="hud-reset-icon">↺</span>
        <span className="hud-label">Reset</span>
      </button>
    </div>
  );
}
