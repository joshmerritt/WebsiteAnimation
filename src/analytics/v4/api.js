/**
 * api.js — Loading the dashboard's data
 *
 * One request to the analytics worker returns everything, for every range
 * (see analytics-worker/analytics-worker.js for the shape). This module adds
 * what a browser needs around that request:
 *
 *   - a timeout and one retry, because a cold worker plus a cold PostHog query
 *     can take a few seconds and a single slow answer shouldn't mean "no data"
 *   - a short per-tab cache, so a reload or a hop between dashboard versions is
 *     instant and never shows a loading state twice
 *   - a clearly labelled fall-back to sample data when the API can't be
 *     reached, so the page still demonstrates itself — and says that it is
 *
 * Two entry points:
 *   loadDashboard()  never rejects. Resolves { data, mode, error } where mode
 *                    is 'live' or 'sample', and the UI must show which. (v4)
 *   loadLive()       resolves live data or rejects with a DashboardError. For
 *                    callers with their own fall-back. (v1–v3, via data.js)
 */

const API_URL = import.meta.env.VITE_ANALYTICS_API_URL || '';

const CACHE_KEY    = '__dadatadad_dash_v2';
const CACHE_TTL_MS = 5 * 60 * 1000;
// Longer than the worker's own budget for its queries (9 s), so that a slow
// PostHog reaches us as a short error from the worker, not as our own timeout.
const TIMEOUT_MS   = 12_000;
const RETRY_AFTER_MS = 600;

export class DashboardError extends Error {
  /** @param {'not_configured'|'timeout'|'network'|'server'|'http'|'shape'} code */
  constructor(code, message) {
    super(message);
    this.name = 'DashboardError';
    this.code = code;
  }
}

/**
 * Is this the worker's v2 document? Checked before anything renders: an older
 * worker (or anything else answering at that URL) returns a different shape,
 * and rendering it would mean charts full of undefined.
 */
export function isPayload(d) {
  return !!d && d.v === 2
    && Array.isArray(d.days) && d.days.length > 0
    && Array.isArray(d.windows) && d.windows.length > 0
    && d.ranges && d.windows.every((w) => d.ranges[w]?.totals)
    && Array.isArray(d.shots);
}

// ── Per-tab cache ───────────────────────────────────────────────────────────

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    if (typeof at !== 'number' || Date.now() - at > CACHE_TTL_MS || !isPayload(data)) return null;
    return data;
  } catch {
    return null;   // storage unavailable or corrupt — just fetch
  }
}

function writeCache(data) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data })); } catch { /* best-effort */ }
}

// ── Fetch ───────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchOnce() {
  if (!API_URL) {
    throw new DashboardError('not_configured', 'This build has no analytics API configured.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // no-store: the per-tab cache above is the only cache. An HTTP-cached copy
    // would make the Refresh button hand back the answer it already has.
    const res = await fetch(API_URL, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) {
      throw new DashboardError(
        res.status >= 500 ? 'server' : 'http',
        `The analytics API answered with an error (${res.status}).`,
      );
    }
    const data = await res.json();
    if (!isPayload(data)) {
      throw new DashboardError('shape', 'The analytics API answered in a format this dashboard does not understand.');
    }
    return data;
  } catch (err) {
    if (err instanceof DashboardError) throw err;
    if (err?.name === 'AbortError') {
      throw new DashboardError('timeout', `The analytics API took longer than ${TIMEOUT_MS / 1000} seconds to answer.`);
    }
    // TypeError from fetch (DNS, offline, CORS, CSP) or a JSON parse failure.
    // A worker that isn't deployed lands here too: its 404 carries no CORS
    // headers, so the browser withholds the status and reports a network error.
    throw new DashboardError('network', 'The analytics API could not be reached.');
  } finally {
    clearTimeout(timer);
  }
}

/** Errors a second attempt can't fix: asking again only delays the fall-back. */
const PERMANENT = new Set(['not_configured', 'shape', 'http']);

let inflight = null;

/**
 * Live data, from the per-tab cache or the API (one retry).
 *
 * @param {{ fresh?: boolean }} [opts]  fresh: ask the API even if the per-tab
 *   cache has an answer (the Refresh button). A failed fresh request leaves the
 *   cached answer in place: refreshing must never cost the reader what they have.
 * @returns {Promise<{ data: object, fromCache: boolean, attempts: number, ms: number }>}
 * @throws {DashboardError} with `attempts` and `ms` attached
 */
export function loadLive({ fresh = false } = {}) {
  if (fresh) return live(true);    // never answered by an older, cache-reading request
  if (inflight) return inflight;   // callers that overlap share one request
  inflight = live(false).finally(() => { inflight = null; });
  return inflight;
}

async function live(fresh) {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);

  if (!fresh) {
    const cached = readCache();
    if (cached) return { data: cached, fromCache: true, attempts: 0, ms: elapsed() };
  }

  for (let attempts = 1; ; attempts++) {
    try {
      const data = await fetchOnce();
      writeCache(data);
      return { data, fromCache: false, attempts, ms: elapsed() };
    } catch (err) {
      if (PERMANENT.has(err.code) || attempts === 2) {
        err.attempts = attempts;
        err.ms = elapsed();
        throw err;
      }
      await sleep(RETRY_AFTER_MS);
    }
  }
}

/**
 * Live data, or — if it can't be had — sample data. Never rejects for an API
 * failure; the only way this rejects is the sample module failing to download.
 *
 * @returns {Promise<{ data: object, mode: 'live'|'sample', fromCache: boolean,
 *                     attempts: number, ms: number, error: DashboardError|null }>}
 */
export async function loadDashboard(opts) {
  try {
    return { ...(await loadLive(opts)), mode: 'live', error: null };
  } catch (error) {
    // Sample data is only downloaded when it is actually needed.
    const { buildSamplePayload } = await import('./sample.js');
    return { data: buildSamplePayload(), mode: 'sample', fromCache: false, attempts: error.attempts ?? 0, ms: error.ms ?? 0, error };
  }
}
