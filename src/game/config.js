/**
 * config.js — Game configuration
 *
 * All tunable values live here. The Game class computes derived values
 * (iconSize, sensitivity, power, etc.) from these + the current viewport.
 */

const config = {
  // ── Identity ──────────────────────────────────────────────────────────
  titleText: 'Hello world, I am Josh Merritt.',
  subtitleText: 'Honest. Analytical. Data Dreamer.',
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
  iconScale: 7,          // viewport / iconScale = icon size
  gridSpacingMultiplier: 2,

  // ── Physics tuning ────────────────────────────────────────────────────
  ball: {
    friction:    0.5,
    frictionAir: 0.001,
    restitution: 0.66,
  },
  goal: {
    restitution: 0.99,
  },
  boundary: {
    restitution: 0.5,
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
