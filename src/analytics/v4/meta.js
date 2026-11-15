/**
 * meta.js — Names, colours and labels the dashboard's panels share.
 */

import projects from '../../data/projects.js';

/**
 * Chart colours. Validated, not eyeballed: the three series pass the
 * colour-vision-deficiency and contrast checks as an all-pairs set on the card
 * surface (they sit in separate small charts, so any two can be compared).
 * These hexes are repeated in analytics-v4.css as --s-visits / --s-shots /
 * --s-opens; SVG fills need the literal value, CSS uses the variable.
 */
export const COLOR = {
  visits: '#3987e5',
  shots:  '#d95926',
  opens:  '#199e70',
  quiet:  '#5d6c7e',   // de-emphasised marks: sparkline history, context bars
  made:   '#0ca30c',   // status "good" — a scored shot
  missed: '#c4cdd8',   // neutral ink — a miss is told apart by its × shape, not its hue
};

/** One-hue ramps, dark → light: on a dark surface, more is lighter. */
export const RAMP = {
  shots:  ['#45240e', '#703504', '#994a08', '#c3610d', '#ea7d2e', '#fda670', '#fdd5bd'],
  visits: ['#182e4b', '#1d487c', '#2063b0', '#3280dd', '#56a0fc', '#92c1fd', '#cbe0fc'],
};
/** Ordered stages (the funnel): one hue, first stage lightest. */
export const FUNNEL_RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf'];

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Colour at t ∈ [0, 1] along a ramp, interpolating between its steps. */
export function rampColor(ramp, t) {
  const clamped = Math.min(1, Math.max(0, t));
  const pos = clamped * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(pos));
  const f = pos - i;
  const [a, b] = [hexToRgb(ramp[i]), hexToRgb(ramp[i + 1])];
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(', ')})`;
}

// ── Projects ────────────────────────────────────────────────────────────────

const SHORT = {
  aboutMe: 'Josh',
  thisWebsite: 'Portfolio',
  SiteAnalytics: 'Analytics',
  arduinoCoopDoor: 'Coop',
  googleDataStudioServiceTechs: 'Data Studio',
  powerBIMetrics: 'Power BI',
  thewineyoudrink: 'Wine',
  dartleague: 'Darts',
};

export const PROJECTS = projects.map((p) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  short: SHORT[p.id] || p.name,
}));

export const PROJECT_COUNT = PROJECTS.length;

/**
 * Category bars, top to bottom. The game sorts categories longest name first
 * (Game._createBalls), so the stack order here matches the playground.
 */
export const CATEGORIES = [...new Set(PROJECTS.map((p) => p.category))].sort((a, b) => b.length - a.length);

const byName = new Map(PROJECTS.map((p) => [p.name, p]));

/** Look up a project by the name the game sent. Unknown names still render. */
export function projectByName(name) {
  return byName.get(name) || { id: name, name, category: '', short: name };
}

// ── Labels ──────────────────────────────────────────────────────────────────

export const FUNNEL_STEPS = [
  { key: 'visited',    label: 'Visited the site' },
  { key: 'loaded',     label: 'Game finished loading' },
  { key: 'interacted', label: 'Launched a ball or opened a project' },
  { key: 'opened',     label: 'Opened a project' },
  { key: 'clicked',    label: 'Clicked through to it' },
];

export const PAGE_LABELS = {
  playground: 'Physics playground (/)',
  portfolio:  'Accessible portfolio',
  dashboards: 'Analytics dashboards',
};

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Display order: weeks start on Monday. Values index into the worker's grid. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
