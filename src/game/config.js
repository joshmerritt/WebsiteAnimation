/**
 * config.js — Game configuration
 *
 * All tunable values live here. The Game class computes derived values
 * (iconSize, sensitivity, power, etc.) from these + the current viewport.
 */

const config = {
  // ── Identity ──────────────────────────────────────────────────────────
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0',
  titleText: 'Honest. Analytical. Data Dreamer.',
  ctaText: 'What can I build for you?',
  contactEmail: 'josh@DaDataDad.com',

  // ── Colors (CSS values — also used by p5 draw calls) ─────────────────
  colors: {
    bg:        'rgba(10, 14, 18, 1)',
    main:      'rgba(199, 214, 213, 1)',
    secondary: 'rgba(89, 133, 177, 1)',
    accent:    'rgba(89, 133, 177, 1)',
    glow:      'rgba(89, 133, 177, 0.45)',
  },

  // ── Layout ────────────────────────────────────────────────────────────
  iconScale: 6,          // viewport / iconScale = icon size
  gridSpacingMultiplier: 1.6,

  // ── Physics tuning ────────────────────────────────────────────────────
  ball: {
    friction:    0.5,
    frictionAir: 0.001,
    restitution: 0.66,
  },
  goal: {
    // Posts and side nets. Only takes effect because Game._dampGoalContacts
    // applies it: Matter resolves contacts at max(ball, body), so on its own the
    // ball's value above always won and this setting did nothing.
    // 0.15 chosen by simulating shots into the real goal geometry (1280x800,
    // 1920x1080, 402x670): it scored best on all three, 0.30 was close behind,
    // and going lower (0.05) gained nothing.
    restitution: 0.15,
  },
  boundary: {
    // ⚠ Not currently in effect: walls are not covered by _dampGoalContacts, so
    // ball-on-wall contacts resolve at max(ball.restitution, this) = the ball's
    // value. Kept as-is because wall bounce has always played at 0.66.
    restitution: 0.5,
    leftRestitution: 0.25,     // left wall — 50% less bounce (see note above)
  },
  menu: {
    restitution: 0.03,         // ~10% of old 0.3 — heavy dampen on category hit
  },

  // ── Interaction ───────────────────────────────────────────────────────
  doubleTapWindow: 500,    // ms
  minLaunchPower:  2,      // minimum xPower or yPower to count as a real launch
  powerScaleDesktop: 33,
  powerScaleMobile:  33 / 5,

  // ── Category collision bitmasks ───────────────────────────────────────
  categoryBits: [0x0001, 0x0002, 0x0004, 0x0008, 0x0010, 0x0020, 0x0040, 0x0080],
};

export default config;
