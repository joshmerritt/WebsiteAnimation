/**
 * analytics-worker.js — Cloudflare Worker proxy for the PostHog query API
 *
 * Replaces the old GA4 Data API worker. Runs HogQL queries against PostHog and
 * returns the same JSON shape the dashboard has always consumed, so
 * src/analytics/*.jsx needed no structural change:
 *
 *   { timeSeries, sources, pages, ballEvents, geography, fetchedAt, days }
 *
 * Why a worker at all: the PostHog *personal* API key needed to read data is a
 * secret and must never reach the browser. The project API key baked into the
 * site (phc_…) is write-only. So the key lives here and the browser only ever
 * sees aggregated JSON.
 *
 * Secrets (wrangler secret put):
 *   POSTHOG_API_KEY   — personal API key, scope: query:read (project 605146)
 * Vars (wrangler.toml):
 *   POSTHOG_PROJECT_ID — 605146
 *   POSTHOG_HOST       — https://us.posthog.com
 *   ALLOWED_ORIGINS    — https://dadatadad.com,...
 */

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env, request) });
    }

    try {
      const url = new URL(request.url);
      // Clamp: the dashboard offers 7/30/90; anything else is a caller bug.
      const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '90', 10) || 90, 1), 365);

      const [daily, sessionsDaily, sources, pagesNow, pagesPrev, ballEvents, geography] =
        await Promise.all([
          query(env, SQL.daily(days)),
          query(env, SQL.sessionsDaily(days)),
          query(env, SQL.sources(days)),
          query(env, SQL.pages(days, 0)),
          query(env, SQL.pages(days, days)),   // previous period, for the trend arrow
          query(env, SQL.ballEvents(days)),
          query(env, SQL.geography(days)),
        ]);

      const body = JSON.stringify({
        timeSeries: buildTimeSeries(daily, sessionsDaily),
        sources:    buildSources(sources),
        pages:      buildPages(pagesNow, pagesPrev),
        ballEvents: buildBallEvents(ballEvents),
        geography:  buildGeography(geography),
        fetchedAt:  new Date().toISOString(),
        source:     'posthog',
        days,
      });

      return new Response(body, {
        headers: {
          'Content-Type': 'application/json',
          // The dashboard polls on range change; a short cache keeps PostHog
          // query load down without making the numbers feel stale.
          'Cache-Control': 'public, max-age=300',
          ...corsHeaders(env, request),
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(env, request) },
      });
    }
  },
};

// ── PostHog query API ───────────────────────────────────────────────────

async function query(env, hogql) {
  const host = (env.POSTHOG_HOST || 'https://us.posthog.com').replace(/\/$/, '');
  const res = await fetch(`${host}/api/projects/${env.POSTHOG_PROJECT_ID}/query/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.POSTHOG_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query: hogql } }),
  });

  if (!res.ok) {
    const text = await res.text();
    // Never echo the response body wholesale — it can contain the query and
    // hints about the project. Surface the status and a short excerpt.
    throw new Error(`PostHog query failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  const results = json.results || [];

  // The HogQL endpoint returns `results` as positional arrays matching
  // `columns`. Normalise defensively: if a future version ever returns row
  // objects instead, re-project them into the same positional order so the
  // builders below keep working rather than silently producing zeros.
  if (results.length && !Array.isArray(results[0]) && json.columns) {
    return results.map((row) => json.columns.map((c) => row[c]));
  }
  return results;
}

// ── Queries ─────────────────────────────────────────────────────────────
//
// Every query is scoped to $host = 'dadatadad.com', which is the same rule the
// project's "filter out internal and test users" setting uses. That keeps
// localhost and preview traffic out of the dashboard.

const HOST_FILTER = "properties.$host = 'dadatadad.com'";

const SQL = {
  daily: (days) => `
    SELECT toString(toDate(timestamp))          AS date,
           uniqIf(person_id, event = '$pageview') AS visitors,
           countIf(event = '$pageview')         AS pageviews,
           countIf(event = 'ball_launch')       AS ballInteractions,
           countIf(event = 'cta_click')         AS ctaClicks
    FROM events
    WHERE timestamp >= now() - INTERVAL ${days} DAY AND ${HOST_FILTER}
    GROUP BY date ORDER BY date`,

  // Session duration and bounce rate are per-session, so they come from the
  // sessions table rather than being averaged over events (which would
  // over-weight sessions that produced more events).
  sessionsDaily: (days) => `
    SELECT toString(toDate($start_timestamp))          AS date,
           round(avg($session_duration))               AS avgDuration,
           round(100 * avg(if($is_bounce, 1, 0)))      AS bounceRate
    FROM sessions
    WHERE $start_timestamp >= now() - INTERVAL ${days} DAY
      AND $entry_hostname = 'dadatadad.com'
    GROUP BY date ORDER BY date`,

  sources: (days) => `
    SELECT if(coalesce(nullIf(properties.$referring_domain, ''), '$direct') = '$direct',
              'Direct', properties.$referring_domain)  AS source,
           uniq(properties.$session_id)                AS visits
    FROM events
    WHERE event = '$pageview' AND timestamp >= now() - INTERVAL ${days} DAY AND ${HOST_FILTER}
    GROUP BY source ORDER BY visits DESC LIMIT 8`,

  // offset = 0 for the current window, offset = days for the one before it.
  pages: (days, offset) => `
    SELECT coalesce(nullIf(properties.$pathname, ''), '/') AS path,
           count()                                         AS views,
           round(avg(session.$session_duration))           AS avgSeconds
    FROM events
    WHERE event = '$pageview'
      AND timestamp >= now() - INTERVAL ${days + offset} DAY
      AND timestamp <  now() - INTERVAL ${offset} DAY
      AND ${HOST_FILTER}
    GROUP BY path ORDER BY views DESC LIMIT 8`,

  ballEvents: (days) => `
    SELECT properties.project_name              AS ball,
           countIf(event = 'ball_launch')       AS launches,
           countIf(event = 'ball_score')        AS scores,
           countIf(event = 'detail_open')       AS opens,
           countIf(event = 'cta_click')         AS ctaClicks
    FROM events
    WHERE event IN ('ball_launch', 'ball_score', 'detail_open', 'cta_click')
      AND timestamp >= now() - INTERVAL ${days} DAY AND ${HOST_FILTER}
      AND coalesce(properties.project_name, '') != ''
    GROUP BY ball ORDER BY launches DESC, opens DESC LIMIT 20`,

  geography: (days) => `
    SELECT properties.$geoip_country_name AS country,
           uniq(person_id)                AS users,
           uniq(properties.$session_id)   AS sessions
    FROM events
    WHERE event = '$pageview' AND timestamp >= now() - INTERVAL ${days} DAY AND ${HOST_FILTER}
      AND coalesce(properties.$geoip_country_name, '') != ''
    GROUP BY country ORDER BY users DESC LIMIT 15`,
};

// ── Shaping ─────────────────────────────────────────────────────────────
//
// These builders keep the exact contract the dashboards already expect:
//   timeSeries[] { date, label, visitors, pageviews, avgDuration, bounceRate,
//                  ballInteractions, ctaClicks }
//   sources[]    { source, visits, pct, color }
//   pages[]      { path, title, views, avgTime, trend }
//   ballEvents[] { ball, id, clicks, launches, scores, opens, ctaClicks, color, category }
//   geography[]  { country, users, sessions, pct }

const num = (v) => (v == null || Number.isNaN(Number(v)) ? 0 : Number(v));

function buildTimeSeries(daily, sessionsDaily) {
  const sessionByDate = new Map(
    sessionsDaily.map((r) => [r[0], { avgDuration: num(r[1]), bounceRate: num(r[2]) }]),
  );

  return daily.map((r) => {
    const date = r[0];
    const s = sessionByDate.get(date) || { avgDuration: 0, bounceRate: 0 };
    // Parse as explicit UTC then format in UTC — `new Date('2026-09-11')` in a
    // negative-offset timezone lands on the previous day.
    const d = new Date(date + 'T00:00:00Z');
    return {
      date,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      visitors:         num(r[1]),
      pageviews:        num(r[2]),
      avgDuration:      s.avgDuration,
      bounceRate:       s.bounceRate,
      ballInteractions: num(r[3]),
      ctaClicks:        num(r[4]),
    };
  });
}

const SOURCE_COLORS = {
  'linkedin.com': '#0A66C2',
  'google.com':   '#4285F4',
  'direct':       '#6B9F6B',
  'github.com':   '#C9D1D9',
  'upwork.com':   '#14A800',
  'bing.com':     '#008373',
  't.co':         '#1DA1F2',
  'facebook.com': '#1877F2',
};

const SOURCE_NAMES = {
  'linkedin.com': 'LinkedIn',
  'google.com':   'Google Search',
  'github.com':   'GitHub',
  'upwork.com':   'Upwork',
  'bing.com':     'Bing',
  't.co':         'X / Twitter',
  'facebook.com': 'Facebook',
};

function buildSources(rows) {
  const total = rows.reduce((s, r) => s + num(r[1]), 0);
  const palette = ['#D4A843', '#5985B1', '#6B9F6B', '#5985B1', '#C05050', '#14A800', '#4285F4', '#C9D1D9'];

  return rows.map((r, i) => {
    const raw = String(r[0] == null ? 'Direct' : r[0]);
    const bare = raw === 'Direct' ? 'direct' : raw.toLowerCase().replace(/^www\./, '');
    const visits = num(r[1]);
    return {
      source: raw === 'Direct' ? 'Direct' : (SOURCE_NAMES[bare] || bare),
      visits,
      pct: total > 0 ? parseFloat(((visits / total) * 100).toFixed(1)) : 0,
      color: SOURCE_COLORS[bare] || palette[i % palette.length],
    };
  });
}

function friendlyPageTitle(path) {
  const map = {
    '/': 'Home (Physics Playground)',
    '/portfolio.html': 'Portfolio (Accessible)',
    '/analytics-dashboard.html': 'Site Analytics Dashboard',
    '/analytics-v2.html': 'Site Analytics Dashboard (V2)',
    '/analytics-v3.html': 'Site Analytics Dashboard (V3)',
  };
  if (map[path]) return map[path];
  const slug = String(path).split('/').pop() || path;
  return slug.replace(/\.html$/, '').replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();
}

function buildPages(nowRows, prevRows) {
  const prevViews = new Map(prevRows.map((r) => [r[0], num(r[1])]));

  return nowRows.map((r) => {
    const path = String(r[0]);
    const views = num(r[1]);
    const duration = num(r[2]);
    const prev = prevViews.get(path) || 0;
    return {
      path,
      title: friendlyPageTitle(path),
      views,
      avgTime: Math.floor(duration / 60) + ':' + String(duration % 60).padStart(2, '0'),
      trend: prev > 0 ? Math.round(((views - prev) / prev) * 100) : 0,
    };
  });
}

// project_name as the game sends it -> the ball's id, colour and category.
const BALL_META = {
  'Josh Merritt':                           { id: 'aboutMe',                      color: '#6B9F6B', category: 'Me' },
  'Microsoft Power BI':                     { id: 'powerBIMetrics',               color: '#D4A843', category: 'Business' },
  'The Wine You Drink':                     { id: 'thewineyoudrink',              color: '#8B1A32', category: 'Apps' },
  'Black Sheep Dart League':                { id: 'dartleague',                   color: '#5985B1', category: 'Apps' },
  'Smart Chicken Coop':                     { id: 'arduinoCoopDoor',              color: '#BF360C', category: 'Technology' },
  'Site Analytics':                         { id: 'SiteAnalytics',                color: '#5985B1', category: 'Technology' },
  'Google Data Studio Streaming Dashboard': { id: 'googleDataStudioServiceTechs', color: '#4285F4', category: 'Business' },
  'Google Data Studio':                     { id: 'googleDataStudioServiceTechs', color: '#4285F4', category: 'Business' },
  'Portfolio Website':                      { id: 'thisWebsite',                  color: '#5985B1', category: 'Technology' },
};

function buildBallEvents(rows) {
  const palette = ['#D4A843', '#5985B1', '#6B9F6B', '#5985B1', '#C05050', '#BF360C', '#4285F4', '#8B1A32'];

  return rows.map((r, i) => {
    const ball = String(r[0]);
    const meta = BALL_META[ball] || { id: ball, color: palette[i % palette.length], category: 'Other' };
    const launches = num(r[1]);
    return {
      ball,
      id: meta.id,
      clicks: launches,     // V1 compatibility: clicks === launches
      launches,
      scores:    num(r[2]),
      opens:     num(r[3]),
      ctaClicks: num(r[4]),
      color: meta.color,
      category: meta.category,
    };
  });
}

function buildGeography(rows) {
  const totalUsers = rows.reduce((s, r) => s + num(r[1]), 0);
  return rows.map((r) => ({
    country:  String(r[0]),
    users:    num(r[1]),
    sessions: num(r[2]),
    pct: totalUsers > 0 ? parseFloat(((num(r[1]) / totalUsers) * 100).toFixed(1)) : 0,
  }));
}

// ── CORS ────────────────────────────────────────────────────────────────

function parseAllowedOrigins(env) {
  if (env.ALLOWED_ORIGINS) {
    return env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
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
