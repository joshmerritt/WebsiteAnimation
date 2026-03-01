/**
 * HUD.jsx — Overlay buttons: Contact + Reset
 *
 * Only visible when the detail modal is not open.
 */

import config from '../game/config.js';
import bus from '../game/EventBus.js';

export default function HUD() {
  return (
    <div className="hud">
      <a
        className="hud-btn hud-contact"
        href={`mailto:${config.contactEmail}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        \u2709 Contact Me
      </a>
      <button className="hud-btn hud-reset" onClick={() => bus.emit('game:reset')}>
        \u21BA Reset
      </button>
    </div>
  );
}
