/**
 * analytics-worker.js — Cloudflare Worker: PostHog → dashboard JSON
 *
 * The site's dashboards (analytics-v4.html directly; v1–v3 through the adapter
 * in src/analytics/data.js) read ONE JSON document from this worker. It runs
 * three HogQL queries against PostHog, aggregates the rows, and returns only
 * aggregates: no person ids, session ids or timestamps ever leave the worker.
 *
 * Why a worker at all: reading PostHog needs a *personal* API key, which is a
 * secret and must never reach the browser. The project key baked into the site
 * (phc_…) is write-only. So the key lives here.
 *
 * This file is the Worker: the fetch handler, caching, and the calls to
 * PostHog. The queries and all the aggregation live in aggregate.js, which is
 * pure and is where the document's shape is described.
 *
 * ── Design constraints worth knowing before changing this ───────────────────
 *
 * 1. PostHog allows THREE API queries running at once per project. The first
 *    version of this worker fired seven in parallel, which would have been
 *    rejected on every single request. There are exactly three queries now, and
 *    that is a ceiling, not a coincidence: a fourth has to replace one or run
 *    after the others.
 *
 * 2. The /query endpoint is for embedded analytics, not exports. So the rows we
 *    pull are already rolled up (one per session, one per day × project, one per
 *    shot) and capped, never raw events.
 *
 * 3. One response covers every range the dashboard offers (7/30/90 days). The
 *    browser switches ranges without another request, so there is no second
 *    fetch that can fail and no loading state between ranges.
 *
 * 4. Nothing from the request reaches the SQL. The only inputs are operator
 *    config (wrangler.toml), and those are validated before use.
 *
 * 5. This module has a default export and nothing else. On Workers, every named
 *    export of the entry module is treated as a possible entrypoint or Durable
 *    Object class, so helpers are exported from aggregate.js instead.
 *
 * Secrets (wrangler secret put):
 *   POSTHOG_API_KEY     personal API key, scope: query:read, project 605146
 * Vars (wrangler.toml):
 *   POSTHOG_PROJECT_ID  605146
 *   POSTHOG_HOST        https://us.posthog.com
 *   SITE_HOST           dadatadad.com — only events from this $host are counted
 *   DATA_EPOCH_UTC      events before this instant are ignored (see aggregate.js)
 *   ALLOWED_ORIGINS     comma-separated origins allowed to read the JSON
 *   BATCH_BUDGET_MS     optional: time allowed for the query batch (default 9000)
 *
 * Tests: `npm test` (analytics-worker.test.mjs) — stubs fetch, so they run
 * without a key or a network.
 */

import { SQL, queryConfig, rowsToObjects, buildPayload } from './aggregate.js';

const CACHE_TTL_S = 120;    // PostHog ingestion lags ~1 min anyway

/**
 * Time allowed for the whole batch of queries, retries included. It has to be
 * shorter than the dashboard's own request timeout (12 s, src/analytics/v4/api.js)
 * so that a slow PostHog produces a short error from here rather than the
 * browser giving up on a worker that is still waiting.
 */
const BATCH_BUDGET_MS = 9000;
const MIN_ATTEMPT_MS  = 2000;   // don't start a retry with less than this left

// ── Entry point ─────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(env, request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'GET') {
      return json({ error: 'method_not_allowed' }, 405, cors);
    }
    if (!env.POSTHOG_API_KEY || !env.POSTHOG_PROJECT_ID) {
      // Deployed without `wrangler secret put POSTHOG_API_KEY`. Say so plainly:
      // the alternative is a 401 from PostHog that reads like an outage.
      return json({ error: 'not_configured', detail: 'POSTHOG_API_KEY secret is not set on this worker.' }, 500, cors);
    }

    try {
      const { body, cache } = await getPayload(env, ctx);
      return new Response(body, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          // No HTTP caching: the dashboard keeps its own per-tab copy, and a
          // cached response here would make its Refresh button do nothing.
          'Cache-Control': 'no-store',
          'X-Cache': cache,
          ...cors,
        },
      });
    } catch (err) {
      // Log the detail for `wrangler tail`; send the browser a short reason.
      // Never echo SQL or upstream bodies — they describe the project.
      console.error('site-analytics: upstream failure:', err?.message || err);
      return json({ error: 'upstream_failed', detail: String(err?.message || err).slice(0, 160) }, 502, cors);
    }
  },
};

// ── Caching ─────────────────────────────────────────────────────────────────
//
// One layer: the last answer, kept as a string in this isolate's memory. It
// covers the back-to-back case (v4 → v3 → reload) and is served as a fall-back
// if PostHog is failing. Traffic here is a visit every few days, so most
// requests find it empty and query PostHog.
//
// Two things are deliberately NOT here:
//
//   · A shared in-flight promise, so that simultaneous requests could reuse one
//     batch. On Workers a promise belongs to the request that created it. If
//     that request is cancelled — the visitor closes the tab while it loads —
//     its work stops, the promise never settles, and every later request that
//     awaits it hangs until Cloudflare kills it with an error page that has no
//     CORS headers. Each request runs its own batch instead; only the finished
//     string is shared.
//
//   · The Cache API. It does nothing on *.workers.dev, where this is served.

let memo = null;   // { at: epoch ms, body: string }

async function getPayload(env, ctx) {
  if (memo && Date.now() - memo.at < CACHE_TTL_S * 1000) {
    return { body: memo.body, cache: 'memory' };
  }

  const work = loadFromPostHog(env).then((body) => {
    memo = { at: Date.now(), body };
    return body;
  });
  // Let the batch finish and fill the memo even if this visitor has gone.
  ctx?.waitUntil?.(work.catch(() => {}));

  try {
    return { body: await work, cache: 'miss' };
  } catch (err) {
    // PostHog hiccup with an older answer still in memory: serve that rather
    // than an error. The body carries fetchedAt, so the dashboard shows its age.
    if (memo) return { body: memo.body, cache: 'stale' };
    throw err;
  }
}

async function loadFromPostHog(env) {
  const started = Date.now();
  const cfg = queryConfig(env);
  const budget = Number(env.BATCH_BUDGET_MS) > 0 ? Number(env.BATCH_BUDGET_MS) : BATCH_BUDGET_MS;
  const deadline = started + budget;

  // Exactly three, all at once — PostHog's concurrency ceiling (constraint 1).
  const [sessions, ballDays, shots] = await Promise.all([
    hogql(env, SQL.sessions(cfg), 'site-analytics: sessions', deadline),
    hogql(env, SQL.ballDays(cfg), 'site-analytics: balls by day', deadline),
    hogql(env, SQL.shots(cfg),    'site-analytics: shots', deadline),
  ]);

  const payload = buildPayload({ sessions, ballDays, shots }, { epochUtc: cfg.epoch, siteHost: cfg.host });
  payload.queryMs = Date.now() - started;
  return JSON.stringify(payload);
}

// ── PostHog query API ───────────────────────────────────────────────────────

async function hogql(env, sql, name, deadline) {
  const host = String(env.POSTHOG_HOST || 'https://us.posthog.com').replace(/\/$/, '');
  const url = `${host}/api/projects/${encodeURIComponent(env.POSTHOG_PROJECT_ID)}/query/`;
  const init = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.POSTHOG_API_KEY}`,
      'Content-Type': 'application/json',
    },
    // `name` shows up in PostHog's query_log, so these are identifiable there.
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query: sql }, name }),
  };
  const left = () => deadline - Date.now();

  // At most one retry, and only for answers that came back quickly: 429 (the
  // concurrency ceiling or the rate limit) and 5xx or network blips.
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(Math.max(left(), 250)) });
    } catch (err) {
      // A timeout is never retried. The query may still be running at PostHog,
      // and a second copy would count against the three-at-once limit.
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') throw new Error(`${name}: timed out`);
      if (attempt < 1 && left() - 400 >= MIN_ATTEMPT_MS) { await sleep(400); continue; }
      throw new Error(`${name}: network error`);
    }

    if (res.ok) return rowsToObjects(await res.json());

    const wait = retryDelayMs(res);
    if ((res.status === 429 || res.status >= 500) && attempt < 1 && left() - wait >= MIN_ATTEMPT_MS) {
      await sleep(wait);
      continue;
    }
    throw new Error(`${name}: PostHog responded ${res.status}`);
  }
}

function retryDelayMs(res) {
  const seconds = Number(res.headers.get('Retry-After'));
  // Honour a short Retry-After; a long one means the hourly budget is spent
  // and waiting inside a request won't help, so fail fast after a brief pause.
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 1500) : 600;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── HTTP helpers ────────────────────────────────────────────────────────────

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

function parseAllowedOrigins(env) {
  if (env.ALLOWED_ORIGINS) {
    return String(env.ALLOWED_ORIGINS).split(',').map((o) => o.trim()).filter(Boolean);
  }
  return ['https://dadatadad.com'];
}

function corsHeaders(env, request) {
  const requestOrigin = request.headers.get('Origin');
  const allowList = parseAllowedOrigins(env);
  const allowOrigin = requestOrigin && allowList.includes(requestOrigin)
    ? requestOrigin
    : allowList[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
