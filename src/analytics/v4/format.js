/**
 * format.js — How the dashboard writes numbers, durations and dates.
 * One place, so the same quantity never appears two ways on one page.
 */

const DASH = '—';

/** 1,284 · 12.9K · 4.2M */
export function fmtInt(n) {
  if (n == null || !Number.isFinite(n)) return DASH;
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 1e4) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return Math.round(n).toLocaleString('en-US');
}

/** Share of `whole`, as a rounded percentage. A dash when there is no whole. */
export function fmtPct(part, whole, digits = 0) {
  if (!whole || part == null) return DASH;
  return `${((part / whole) * 100).toFixed(digits)}%`;
}

/** 8s · 2m 05s · 1h 12m */
export function fmtDuration(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return DASH;
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

/** 650 ms · 2.2 s · 13 s */
export function fmtMs(ms) {
  if (ms == null || !Number.isFinite(ms)) return DASH;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  return `${s < 10 ? s.toFixed(1) : Math.round(s)} s`;
}

// Dates arrive as 'YYYY-MM-DD' in the project's timezone. Parse and format in
// UTC so the viewer's own timezone can't move them to the day before.
const utc = (dateStr) => new Date(`${dateStr}T00:00:00Z`);
const SHORT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const LONG  = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const FULL  = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** Oct 28 */
export const fmtDay = (dateStr) => (dateStr ? SHORT.format(utc(dateStr)) : DASH);
/** Wed, Oct 28 */
export const fmtDayLong = (dateStr) => (dateStr ? LONG.format(utc(dateStr)) : DASH);
/** Sep 13, 2026 */
export const fmtDayFull = (dateStr) => (dateStr ? FULL.format(utc(dateStr)) : DASH);

/** just now · 4 min ago · 3 h ago · 2 days ago */
export function fmtAgo(isoOrMs, now = Date.now()) {
  const then = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(isoOrMs);
  if (!Number.isFinite(then)) return DASH;
  const min = Math.round((now - then) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

/** today · yesterday · 17 days ago */
export function fmtDaysAgo(d) {
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  return `${d} days ago`;
}

/** 12am · 9am · 12pm · 6pm */
export function fmtHour(h) {
  const suffix = h < 12 ? 'am' : 'pm';
  return `${h % 12 === 0 ? 12 : h % 12}${suffix}`;
}

/** "1 visit" / "3 visits" */
export const plural = (n, one, many = `${one}s`) => `${fmtInt(n)} ${n === 1 ? one : many}`;

/**
 * Change against a previous value, for a stat tile.
 * Returns null when there is nothing honest to say (no previous period, or a
 * previous value of zero, where a percentage would be infinite).
 */
export function change(current, previous) {
  if (previous == null || current == null || previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  return { pct, up: pct > 0, flat: Math.abs(pct) < 0.5 };
}
