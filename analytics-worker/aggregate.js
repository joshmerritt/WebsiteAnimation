/**
 * aggregate.js — From PostHog rows to the dashboard's JSON. Pure functions.
 *
 * Everything here is free of Worker APIs, network and state, so it can be
 * tested with plain Node (analytics-worker.test.mjs) and reused by the site:
 * the dashboard's sample data is built with this same buildPayload(), which is
 * why the sample document can never drift from the live one.
 *
 * The Worker itself — fetch handler, caching, the calls to PostHog — is
 * analytics-worker.js, which imports from here.
 *
 * The document it produces (`v: 2`):
 *
 *   { v, source, fetchedAt, today, since, windows: [7, 30, 90], truncated,
 *     days:   [ 90 zero-filled days { date, visits, visitors, pageviews, players,
 *               shots, makes, opens, ctas, bounces, avgDurationSec } ],
 *     ranges: { 7: {...}, 30: {...}, 90: {
 *                 totals, prev | null, funnel, sources, countries, devices,
 *                 pages, perf, activity (7 × 24), balls } },
 *     shots:  [ { x, y, ar, long, ball, hit, made, d } ] }
 *
 * Nothing in it identifies a person: no ids, no timestamps, no IP addresses, no
 * referrer hostnames beyond a short list of public sites, no exact screen sizes.
 * It is still a count of real visits — when a range holds one visit, its row of
 * numbers describes that one visit.
 */

/** Ranges the dashboard offers, in days. The payload carries all of them. */
export const WINDOWS = [7, 30, 90];

const CHART_DAYS    = 90;    // length of the zero-filled daily series
const LOOKBACK_DAYS = 180;   // 90 current + 90 previous, for "vs previous period"
const MAX_SESSIONS  = 3000;  // row caps: /query is for embedded analytics, not exports
const MAX_BALL_DAYS = 2000;
const MAX_SHOTS     = 1500;

/**
 * Events before this instant are ignored. Until release 3.2.1 (deployed
 * 2026-09-13 ~16:10 UTC) the intro demo logged a fake score and project open on
 * every page load, and everything before 2026-09-11 is test traffic. Starting
 * the dashboard's clock after both keeps every number on it trustworthy.
 */
const DEFAULT_EPOCH_UTC = '2026-09-13 16:15:00';

/**
 * The HogQL endpoint returns `results` as positional arrays alongside
 * `columns`. Key every row by column name so the aggregation below never
 * depends on SELECT order — reordering a query can't silently swap two fields.
 */
export function rowsToObjects(body) {
  const rows = Array.isArray(body?.results) ? body.results : [];
  const columns = Array.isArray(body?.columns) ? body.columns : null;
  if (!rows.length) return [];
  if (!Array.isArray(rows[0])) return rows;               // already objects
  if (!columns) throw new Error('PostHog response had rows but no columns');
  return rows.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

// ── Queries ─────────────────────────────────────────────────────────────────

export function queryConfig(env) {
  const host  = String(env.SITE_HOST || 'dadatadad.com').trim().toLowerCase();
  const epoch = String(env.DATA_EPOCH_UTC || DEFAULT_EPOCH_UTC).trim();
  // These are interpolated into SQL. They come from wrangler.toml, not from a
  // request, but a typo there should fail loudly rather than build odd SQL.
  if (!/^[a-z0-9.-]+$/.test(host)) throw new Error('SITE_HOST is not a hostname');
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(epoch)) throw new Error('DATA_EPOCH_UTC must be "YYYY-MM-DD HH:MM:SS"');
  return { host, epoch };
}

/** Shared WHERE fragment: the time window, the data epoch, and this site only. */
const scope = ({ host, epoch }, days) => `
      timestamp >= now() - INTERVAL ${days} DAY
      AND timestamp >= toDateTime('${epoch}', 'UTC')
      AND properties.$host = '${host}'`;

// Dashboard pages are tracked too, but they are not visits to the portfolio:
// the owner checking his own numbers would otherwise be the site's top visitor.
const ON_DASHBOARD = `match(coalesce(properties.$pathname, '/'), '^/analytics')`;

// The dashboards report their own Web Vitals too. Left in, a few slow dashboard
// loads would be published as the playground's paint times.
const SITE_VITALS = `event = '$web_vitals' AND NOT ${ON_DASHBOARD}`;

export const SQL = {
  /**
   * One row per session. Everything about traffic, devices, sources, geography,
   * the funnel and performance is derived from these rows in JS, for whichever
   * range is asked — which is what lets one response serve all three ranges.
   *
   * `days_ago` is computed in the project's timezone by PostHog, so the worker
   * never does timezone arithmetic of its own on dates.
   */
  sessions: (cfg) => `
    SELECT
        properties.$session_id                                    AS sid,
        toString(any(person_id))                                  AS pid,
        toString(toDate(min(timestamp)))                          AS day,
        dateDiff('day', toDate(min(timestamp)), toDate(now()))    AS days_ago,
        toUnixTimestamp(min(timestamp))                           AS started_unix,
        any(properties.$timezone)                                 AS tz,
        dateDiff('second', min(timestamp), max(timestamp))        AS duration_s,
        countIf(event = '$pageview' AND NOT ${ON_DASHBOARD})      AS pv_site,
        countIf(event = '$pageview' AND ${ON_DASHBOARD})          AS pv_dash,
        countIf(event = '$pageview' AND properties.$pathname = '/portfolio.html') AS pv_portfolio,
        countIf(event = 'portfolio_loaded')                       AS loads,
        countIf(event = 'ball_launch')                            AS shots,
        countIf(event = 'ball_score')                             AS makes,
        countIf(event = 'detail_open')                            AS opens,
        countIf(event = 'cta_click')                              AS ctas,
        countIf(event = 'miss_hint_shown')                        AS hints,
        any(properties.$device_type)                              AS device,
        any(properties.$geoip_country_name)                       AS country,
        argMinIf(properties.$referring_domain, timestamp, event = '$pageview') AS referrer,
        minIf(toFloat(properties.load_time_ms), event = 'portfolio_loaded')    AS load_ms,
        minIf(toFloat(properties.ms_since_navigation), event = 'first_launch') AS first_shot_ms,
        avgIf(toFloat(properties.avg_fps), event = 'game_perf')                AS fps_avg,
        minIf(toFloat(properties.min_fps), event = 'game_perf')                AS fps_min,
        maxIf(toFloat(properties.$web_vitals_LCP_value), ${SITE_VITALS}) AS lcp,
        maxIf(toFloat(properties.$web_vitals_FCP_value), ${SITE_VITALS}) AS fcp,
        maxIf(toFloat(properties.$web_vitals_INP_value), ${SITE_VITALS}) AS inp,
        maxIf(toFloat(properties.$web_vitals_CLS_value), ${SITE_VITALS}) AS cls
    FROM events
    WHERE ${scope(cfg, LOOKBACK_DAYS)}
      AND coalesce(properties.$session_id, '') != ''
    GROUP BY sid
    ORDER BY started_unix DESC
    LIMIT ${MAX_SESSIONS}`,

  /** Per-project counts by day; summed per range in JS. */
  ballDays: (cfg) => `
    SELECT
        dateDiff('day', toDate(timestamp), toDate(now())) AS days_ago,
        properties.project_name                           AS ball,
        countIf(event = 'ball_launch')                    AS launches,
        countIf(event = 'ball_score')                     AS scores,
        countIf(event = 'detail_open')                    AS opens,
        countIf(event = 'cta_click')                      AS ctas
    FROM events
    WHERE event IN ('ball_launch', 'ball_score', 'detail_open', 'cta_click')
      AND ${scope(cfg, CHART_DAYS)}
      AND coalesce(properties.project_name, '') != ''
    GROUP BY days_ago, ball
    ORDER BY days_ago
    LIMIT ${MAX_BALL_DAYS}`,

  /**
   * One row per shot that touched something: where it first made contact, and
   * whether it went on to score.
   *
   * `ball_impact` never says whether the shot scored (its is_goal flag describes
   * the first contact only), so the outcome comes from pairing it with the
   * `ball_score` of the same shot.
   *
   * A shot is identified by ORDER IN TIME, per session and per ball: `seq` counts
   * that ball's launches so far, so an impact and a score both belong to the
   * launch that most recently preceded them. The game's shot numbers can't be
   * used for this. `shot_number` on an impact and `total_shots` on a score are
   * the game's running total at that moment, so if ball B is launched while
   * ball A is still in the air, A's score carries B's number and the two halves
   * of A's shot would never meet — the chart would draw a make as a miss.
   *
   * seq > 0 drops an impact with no launch before it in the session: the intro
   * demo (pre-3.2.1), or a session id that rotated mid-flight.
   */
  shots: (cfg) => `
    SELECT
        sid,
        ball,
        seq,
        anyIf(x, event = 'ball_impact')      AS x,
        anyIf(y, event = 'ball_impact')      AS y,
        anyIf(hit, event = 'ball_impact')    AS hit,
        anyIf(vw, event = 'ball_impact')     AS vw,
        anyIf(vh, event = 'ball_impact')     AS vh,
        min(days_ago)                        AS days_ago,
        countIf(event = 'ball_score')        AS scored
    FROM (
        SELECT
            sid, ball, event, x, y, hit, vw, vh, days_ago, ts,
            sum(if(event = 'ball_launch', 1, 0)) OVER (
                PARTITION BY sid, ball ORDER BY ts ASC
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) AS seq
        FROM (
            SELECT
                properties.$session_id AS sid,
                if(event = 'ball_impact', properties.ball_name, properties.project_name) AS ball,
                event,
                toFloat(properties.impact_x)          AS x,
                toFloat(properties.impact_y)          AS y,
                properties.hit_type                   AS hit,
                toFloat(properties.$viewport_width)   AS vw,
                toFloat(properties.$viewport_height)  AS vh,
                dateDiff('day', toDate(timestamp), toDate(now())) AS days_ago,
                timestamp AS ts
            FROM events
            WHERE event IN ('ball_launch', 'ball_impact', 'ball_score')
              AND ${scope(cfg, CHART_DAYS)}
        )
    )
    GROUP BY sid, ball, seq
    HAVING countIf(event = 'ball_impact') > 0 AND seq > 0
    ORDER BY max(ts) DESC
    LIMIT ${MAX_SHOTS}`,
};

// ── Aggregation ─────────────────────────────────────────────────────────────
//
// Pure functions from query rows to the dashboard's JSON. Exported so the tests
// can drive them directly with fixture rows.

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const numOrNull = (v) => { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const asc = (a, b) => a - b;

/** Linear-interpolated quantile of an ascending array; null when empty. */
export function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** 'YYYY-MM-DD' ± n days, in pure UTC so no local timezone can shift it. */
export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const DEVICES = ['Desktop', 'Mobile', 'Tablet'];
const normalizeDevice = (d) => (DEVICES.includes(d) ? d : 'Other');

function normalizeSession(r) {
  return {
    pid:         String(r.pid ?? ''),
    day:         String(r.day ?? ''),
    daysAgo:     Math.max(0, Math.round(num(r.days_ago))),
    startedUnix: num(r.started_unix),
    tz:          r.tz || null,
    duration:    num(r.duration_s),
    pvSite:      num(r.pv_site),
    pvDash:      num(r.pv_dash),
    pvPortfolio: num(r.pv_portfolio),
    loads:       num(r.loads),
    shots:       num(r.shots),
    makes:       num(r.makes),
    opens:       num(r.opens),
    ctas:        num(r.ctas),
    hints:       num(r.hints),
    device:      normalizeDevice(r.device),
    country:     r.country || null,
    referrer:    r.referrer || null,
    loadMs:      numOrNull(r.load_ms),
    firstShotMs: numOrNull(r.first_shot_ms),
    fpsAvg:      numOrNull(r.fps_avg),
    fpsMin:      numOrNull(r.fps_min),
    lcp:         numOrNull(r.lcp),
    fcp:         numOrNull(r.fcp),
    inp:         numOrNull(r.inp),
    cls:         numOrNull(r.cls),
    // Day of week and hour on the visitor's own clock. Worked out once here
    // rather than once per range: Intl formatting is the costliest step.
    at:          num(r.started_unix) > 0 ? localDowHour(num(r.started_unix), r.tz || null) : null,
  };
}

/**
 * A visit to the portfolio: a page view outside the dashboards, or play.
 *
 * Play counts on its own because PostHog starts a new session id after 30
 * minutes idle, so someone who comes back to an open tab and keeps shooting has
 * events but no page view. Rows that are neither (a stray performance sample,
 * a dashboard-only session) still feed the performance stats, just not traffic.
 */
const isVisit = (s) => s.pvSite > 0 || s.loads > 0 || s.shots > 0 || s.opens > 0 || s.ctas > 0;

/**
 * Left before the game finished loading, within seconds, on a UTC clock. That
 * combination is what headless browsers in datacentres look like. It is a
 * heuristic and is labelled as one on the dashboard.
 */
const looksAutomated = (s) =>
  s.loads === 0 && s.shots === 0 && s.opens === 0 && s.ctas === 0 &&
  s.duration < 10 && (!s.tz || s.tz === 'UTC');

/** One page view, no play, gone inside 10 seconds. */
const isBounce = (s) => s.pvSite <= 1 && s.shots === 0 && s.opens === 0 && s.ctas === 0 && s.duration < 10;

function totalsOf(rows) {
  const visits = rows.filter(isVisit);
  const sum = (k) => visits.reduce((a, s) => a + s[k], 0);
  const count = (fn) => visits.filter(fn).length;
  const durations = visits.map((s) => s.duration).sort(asc);
  return {
    visits:            visits.length,
    visitors:          new Set(visits.map((s) => s.pid)).size,
    pageviews:         sum('pvSite'),
    players:           count((s) => s.shots > 0),
    scorers:           count((s) => s.makes > 0),
    openers:           count((s) => s.opens > 0),
    clickers:          count((s) => s.ctas > 0),
    hinted:            count((s) => s.hints > 0),
    shots:             sum('shots'),
    makes:             sum('makes'),
    opens:             sum('opens'),
    ctas:              sum('ctas'),
    bounces:           count(isBounce),
    avgDurationSec:    visits.length ? Math.round(sum('duration') / visits.length) : 0,
    medianDurationSec: Math.round(quantile(durations, 0.5) ?? 0),
    suspectedBots:     count(looksAutomated),
    dashboardSessions: rows.filter((s) => s.pvDash > 0).length,
  };
}

/**
 * Session funnel. Built from the bottom up so each step contains the next by
 * construction: a click-through implies an open, an open implies interaction,
 * and so on. (Counted independently they would not nest — a project can be
 * opened by double-click without ever launching a ball.)
 */
function funnelOf(rows) {
  const visits = rows.filter(isVisit);
  const clicked    = (s) => s.ctas > 0;
  const opened     = (s) => s.opens > 0 || clicked(s);
  const interacted = (s) => s.shots > 0 || opened(s);
  const loaded     = (s) => s.loads > 0 || interacted(s);
  const n = (fn) => visits.filter(fn).length;
  return {
    visited:    visits.length,
    loaded:     n(loaded),
    interacted: n(interacted),
    opened:     n(opened),
    clicked:    n(clicked),
  };
}

/**
 * The only referrers ever named on the dashboard. Anything else is counted
 * under "Other sites" and its hostname is never sent to the browser.
 *
 * This endpoint is public, and a referrer can be somebody's private address:
 * a company webmail host, an intranet page, an internal chat tool. With a
 * handful of visits, publishing "1 visit from mail.their-employer.com" would
 * point at a person. The full list stays in PostHog, for the owner.
 */
const SOURCE_NAMES = [
  [/(^|\.)google\./,                      'Google'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/,     'LinkedIn'],
  [/(^|\.)github\.com$/,                  'GitHub'],
  [/(^|\.)upwork\.com$/,                  'Upwork'],
  [/(^|\.)bing\.com$/,                    'Bing'],
  [/(^|\.)duckduckgo\.com$/,              'DuckDuckGo'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/,  'X / Twitter'],
  [/(^|\.)facebook\.com$/,                'Facebook'],
  [/(^|\.)instagram\.com$/,               'Instagram'],
  [/(^|\.)reddit\.com$/,                  'Reddit'],
  [/(^|\.)youtube\.com$/,                 'YouTube'],
  [/(^|\.)yahoo\.com$/,                   'Yahoo'],
  [/(^|\.)(chatgpt\.com|openai\.com)$/,   'ChatGPT'],
  [/(^|\.)claude\.ai$/,                   'Claude'],
  [/(^|\.)perplexity\.ai$/,               'Perplexity'],
  [/(^|\.)posthog\.com$/,                 'PostHog'],
  // Links opened from inside a chat app: the product is named, never the workspace.
  [/(^|\.)teams\.(microsoft\.com|live\.com)$|^teams\..*\.microsoft$/, 'Microsoft Teams'],
  [/(^|\.)slack\.com$/,                   'Slack'],
];
const OTHER_SOURCES = 'Other sites';

/** A referring domain as the dashboard may show it: Direct, a named site, or "Other sites". */
export function friendlySource(referrer, siteHost) {
  if (!referrer || referrer === '$direct') return 'Direct';
  const bare = String(referrer).toLowerCase().replace(/^www\./, '');
  // A page view that arrived from the site's own pages (the session id rotates
  // after 30 idle minutes) is not a referral from anywhere.
  if (siteHost && bare === String(siteHost).toLowerCase().replace(/^www\./, '')) return 'Direct';
  for (const [pattern, name] of SOURCE_NAMES) if (pattern.test(bare)) return name;
  return OTHER_SOURCES;
}

/**
 * Group rows and rank the groups by visits. At most `limit` groups are
 * returned; the rest are folded into one called `other`, always listed last.
 */
function ranked(rows, keyOf, measure, limit, other = 'Other') {
  const groups = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const named = [...groups.keys()].filter((name) => name !== other)
    .map((name) => ({ name, ...measure(groups.get(name)) }))
    .sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name));
  const fits = named.length + (groups.has(other) ? 1 : 0) <= limit;
  const head = fits ? named : named.slice(0, limit - 1);
  const kept = new Set(head.map((g) => g.name));
  const rest = rows.filter((row) => !kept.has(keyOf(row)));
  return rest.length ? [...head, { name: other, ...measure(rest) }] : head;
}

const sourcesOf = (visits, siteHost) => ranked(visits, (s) => friendlySource(s.referrer, siteHost), (m) => ({
  visits:  m.length,
  players: m.filter((s) => s.shots > 0).length,
}), 7, OTHER_SOURCES);

const countriesOf = (visits) => ranked(visits, (s) => s.country || 'Unknown', (m) => ({
  visits:   m.length,
  visitors: new Set(m.map((s) => s.pid)).size,
}), 8, 'Other countries');

function devicesOf(visits) {
  const order = [...DEVICES, 'Other'];
  return order.map((device) => {
    const m = visits.filter((s) => s.device === device);
    const sum = (k) => m.reduce((a, s) => a + s[k], 0);
    return {
      device,
      visits:  m.length,
      players: m.filter((s) => s.shots > 0).length,
      openers: m.filter((s) => s.opens > 0).length,
      shots:   sum('shots'),
      makes:   sum('makes'),
      avgDurationSec: m.length ? Math.round(sum('duration') / m.length) : 0,
    };
  }).filter((d) => d.visits > 0);
}

function pagesOf(rows) {
  const sum = (fn) => rows.reduce((a, s) => a + fn(s), 0);
  return [
    { key: 'playground', views: sum((s) => Math.max(0, s.pvSite - s.pvPortfolio)) },
    { key: 'portfolio',  views: sum((s) => s.pvPortfolio) },
    { key: 'dashboards', views: sum((s) => s.pvDash) },
  ];
}

function perfOf(rows) {
  const values = (k) => rows.map((s) => s[k]).filter((v) => v != null).sort(asc);
  const q = (k, p, digits = 0) => {
    const v = values(k);
    if (!v.length) return null;
    const f = 10 ** digits;
    return Math.round(quantile(v, p) * f) / f;
  };
  const fpsAvg = values('fpsAvg');
  return {
    loadMs:      { n: values('loadMs').length,      p50: q('loadMs', 0.5), p75: q('loadMs', 0.75) },
    firstShotMs: { n: values('firstShotMs').length, p50: q('firstShotMs', 0.5) },
    fps: {
      n:   fpsAvg.length,
      avg: fpsAvg.length ? Math.round(fpsAvg.reduce((a, b) => a + b, 0) / fpsAvg.length) : null,
      // Median of each session's worst frame: "how bad does a typical dip get".
      low: q('fpsMin', 0.5),
    },
    lcp: { n: values('lcp').length, p75: q('lcp', 0.75) },
    fcp: { n: values('fcp').length, p75: q('fcp', 0.75) },
    inp: { n: values('inp').length, p75: q('inp', 0.75) },
    cls: { n: values('cls').length, p75: q('cls', 0.75, 3) },
  };
}

const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const formatters = new Map();

/** Day of week (0 = Sunday) and hour (0–23) on the visitor's own clock. */
export function localDowHour(unix, tz) {
  const zone = tz || 'UTC';
  let fmt = formatters.get(zone);
  if (fmt === undefined) {
    try {
      fmt = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short', hour: 'numeric', hourCycle: 'h23' });
    } catch {
      fmt = null;   // unknown zone name — fall back to UTC below
    }
    formatters.set(zone, fmt);
  }
  if (!fmt) return zone === 'UTC' ? null : localDowHour(unix, 'UTC');
  const parts = fmt.formatToParts(new Date(unix * 1000));
  const dow = WEEKDAYS[parts.find((p) => p.type === 'weekday')?.value];
  const hour = Number(parts.find((p) => p.type === 'hour')?.value) % 24;
  return dow == null || !Number.isFinite(hour) ? null : { dow, hour };
}

/** 7 × 24 grid of visit counts, [day of week][hour], in each visitor's own time. */
function activityOf(visits) {
  const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (const s of visits) {
    if (s.at) grid[s.at.dow][s.at.hour]++;
  }
  return grid;
}

function ballsOf(ballDays, days) {
  const byName = new Map();
  for (const r of ballDays) {
    if (num(r.days_ago) >= days) continue;
    const name = String(r.ball);
    const b = byName.get(name) || { ball: name, launches: 0, scores: 0, opens: 0, ctas: 0 };
    b.launches += num(r.launches);
    b.scores   += num(r.scores);
    b.opens    += num(r.opens);
    b.ctas     += num(r.ctas);
    byName.set(name, b);
  }
  return [...byName.values()].sort((a, b) =>
    b.launches - a.launches || b.opens - a.opens || a.ball.localeCompare(b.ball));
}

const PREV_KEYS = ['visits', 'visitors', 'pageviews', 'players', 'openers', 'clickers', 'shots', 'makes', 'opens', 'ctas', 'avgDurationSec'];

export function buildPayload(raw, opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date();
  const epochDay = opts.epochUtc ? String(opts.epochUtc).slice(0, 10) : null;

  const sessions = (raw.sessions || []).map(normalizeSession);
  const ballDays = raw.ballDays || [];

  // "Today" in the project's timezone. Derived from a row (its date plus its
  // age) so it always agrees with the days_ago values PostHog computed; the
  // UTC fallback only matters when there are no rows to disagree with.
  const anchor = sessions.find((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.day));
  const today = anchor ? addDays(anchor.day, anchor.daysAgo) : now.toISOString().slice(0, 10);

  // ── Daily series, zero-filled so charts always have a continuous axis ──
  const byDay = new Map();
  for (const s of sessions) {
    if (!byDay.has(s.daysAgo)) byDay.set(s.daysAgo, []);
    byDay.get(s.daysAgo).push(s);
  }
  const days = [];
  for (let d = CHART_DAYS - 1; d >= 0; d--) {
    const t = totalsOf(byDay.get(d) || []);
    days.push({
      date: addDays(today, -d),
      visits: t.visits, visitors: t.visitors, pageviews: t.pageviews, players: t.players,
      shots: t.shots, makes: t.makes, opens: t.opens, ctas: t.ctas,
      bounces: t.bounces, avgDurationSec: t.avgDurationSec,
    });
  }

  // ── One block per range ──
  const ranges = {};
  for (const w of WINDOWS) {
    const rows   = sessions.filter((s) => s.daysAgo < w);
    const visits = rows.filter(isVisit);

    // "vs previous period" is only honest when the whole previous window falls
    // after the data epoch. Otherwise it compares against days with no
    // tracking at all and reports nonsense growth.
    const prevStart = addDays(today, -(2 * w - 1));
    const comparable = !epochDay || prevStart > epochDay;
    let prev = null;
    if (comparable) {
      const t = totalsOf(sessions.filter((s) => s.daysAgo >= w && s.daysAgo < 2 * w));
      prev = Object.fromEntries(PREV_KEYS.map((k) => [k, t[k]]));
    }

    ranges[w] = {
      totals:    totalsOf(rows),
      prev,
      funnel:    funnelOf(rows),
      sources:   sourcesOf(visits, opts.siteHost),
      countries: countriesOf(visits),
      devices:   devicesOf(visits),
      pages:     pagesOf(rows),
      perf:      perfOf(rows),
      activity:  activityOf(visits),
      balls:     ballsOf(ballDays, w),
    };
  }

  // ── Shots: first contact + outcome. x/y are fractions of the visitor's
  //    viewport. To redraw the court a shot happened on, the dashboard needs
  //    that viewport's shape — so it gets the aspect ratio and the long side
  //    rounded to 100px, not the exact pixel size, which is distinctive enough
  //    to single out one visitor's machine. The game's layout is almost all
  //    ratios, so the rounding moves a mark by a fraction of a percent. ──
  const shots = (raw.shots || [])
    .map((r) => {
      const [vw, vh] = [num(r.vw), num(r.vh)];
      // The game picks its layout on two tests: taller than wide, and longest
      // side <= 1000px. Round so neither test can flip: the ratio never crosses
      // 1, and the long side only ever rounds UP to the next 100.
      let ar = vh > 0 ? Math.round((vw / vh) * 100) / 100 : 0;
      if (ar > 0) ar = vh > vw ? Math.min(ar, 0.99) : Math.max(ar, 1);
      return {
        x: numOrNull(r.x), y: numOrNull(r.y),
        ar,
        long: Math.max(100, Math.ceil(Math.max(vw, vh) / 100) * 100),
        ball: String(r.ball ?? ''),
        hit: String(r.hit ?? 'unknown'),
        made: num(r.scored) > 0,
        d: Math.max(0, Math.round(num(r.days_ago))),
      };
    })
    .filter((s) => s.x != null && s.y != null && s.ar > 0);

  return {
    v: 2,
    source: 'posthog',
    fetchedAt: now.toISOString(),
    today,
    since: epochDay,
    windows: WINDOWS,
    // True when a row cap was hit: the oldest data is missing and totals for
    // the longest range are undercounts. The dashboard says so when this is set.
    truncated: sessions.length >= MAX_SESSIONS || ballDays.length >= MAX_BALL_DAYS || (raw.shots || []).length >= MAX_SHOTS,
    days,
    ranges,
    shots,
  };
}
