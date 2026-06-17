/**
 * ga4-worker.js — Cloudflare Worker proxy for GA4 Data API
 *
 * Authenticates with a Google service account, runs GA4 reports,
 * and returns JSON that the DaDataDad analytics dashboard consumes.
 *
 * Environment variables (set via wrangler secret):
 *   GA4_SERVICE_ACCOUNT_JSON — the full JSON key file contents
 *   GA4_PROPERTY_ID          — numeric GA4 property ID (not measurement ID)
 *   ALLOWED_ORIGIN           — e.g. "https://dadatadad.com"
 */

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env, request) });
    }

    try {
      const url = new URL(request.url);
      const daysParam = url.searchParams.get('days') || '90';
      const days = daysParam === 'all' || daysParam === '0' ? 0 : parseInt(daysParam, 10);

      const accessToken = await getAccessToken(env);
      const propertyId = env.GA4_PROPERTY_ID;

      // Run all reports in parallel
      const [timeSeries, sources, pages, ballEvents, geography, impactDistribution] = await Promise.all([
        fetchTimeSeries(accessToken, propertyId, days),
        fetchSources(accessToken, propertyId, days),
        fetchTopPages(accessToken, propertyId, days),
        fetchBallEvents(accessToken, propertyId, days),
        fetchGeography(accessToken, propertyId, days),
        fetchImpactDistribution(accessToken, propertyId, days),
      ]);

      const body = JSON.stringify({
        timeSeries,
        sources,
        pages,
        ballEvents,
        geography,
        impactDistribution,
        _ctaDebug: ballEvents._debug || null,
        fetchedAt: new Date().toISOString(),
        days: days || 'all',
      });

      return new Response(body, {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(env, request) },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(env, request) } },
      );
    }
  },
};

function corsHeaders(env, request) {
  const requestOrigin = request.headers.get('Origin');
  const allowList = parseAllowedOrigins(env);

  const allowOrigin = requestOrigin && allowList.includes(requestOrigin)
    ? requestOrigin
    : allowList[0] || '*';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function parseAllowedOrigins(env) {
  if (env.ALLOWED_ORIGINS) {
    return env.ALLOWED_ORIGINS
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  if (env.ALLOWED_ORIGIN) return [env.ALLOWED_ORIGIN];

  // Safe defaults for this project.
  return ['https://dadatadad.com', 'https://www.dadatadad.com'];
}

// ═══════════════════════════════════════════════════════════════════════════
//  Google Service Account JWT → Access Token
// ═══════════════════════════════════════════════════════════════════════════

async function getAccessToken(env) {
  const sa = JSON.parse(env.GA4_SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const jwt = await signJWT(header, payload, sa.private_key);

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

async function signJWT(header, payload, privateKeyPem) {
  const enc = new TextEncoder();

  // Import RSA private key
  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '');
  const input = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    enc.encode(input),
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${input}.${sigB64}`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  GA4 Data API Report Helpers
// ═══════════════════════════════════════════════════════════════════════════

// Resolve the start date: days=0 means "all time" (from GA4 property creation)
function startDate(days) {
  return days > 0 ? `${days}daysAgo` : '2020-01-01';
}

async function runReport(accessToken, propertyId, body) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 API ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Time series: daily visitors, pageviews, duration, bounce rate ────────

async function fetchTimeSeries(token, propId, days) {
  const report = await runReport(token, propId, {
    dateRanges: [{ startDate: startDate(days), endDate: 'today' }],
    dimensions: [{ name: 'date' }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'screenPageViews' },
      { name: 'averageSessionDuration' },
      { name: 'bounceRate' },
      { name: 'eventCount' },
    ],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
    limit: days > 0 ? days + 1 : 10000,
  });

  // Also fetch ball_launch and cta_click event counts per day
  const [ballReport, ctaReport] = await Promise.all([
    runReport(token, propId, {
      dateRanges: [{ startDate: startDate(days), endDate: 'today' }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: 'ball_launch' },
        },
      },
      orderBys: [{ dimension: { dimensionName: 'date' } }],
      limit: days > 0 ? days + 1 : 10000,
    }),
    runReport(token, propId, {
      dateRanges: [{ startDate: startDate(days), endDate: 'today' }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: 'cta_click' },
        },
      },
      orderBys: [{ dimension: { dimensionName: 'date' } }],
      limit: days > 0 ? days + 1 : 10000,
    }),
  ]);

  // Index event counts by date
  const ballByDate = {};
  (ballReport.rows || []).forEach((row) => {
    ballByDate[row.dimensionValues[0].value] = parseInt(row.metricValues[0].value, 10);
  });
  const ctaByDate = {};
  (ctaReport.rows || []).forEach((row) => {
    ctaByDate[row.dimensionValues[0].value] = parseInt(row.metricValues[0].value, 10);
  });

  return (report.rows || []).map((row) => {
    const dateStr = row.dimensionValues[0].value; // "20250301"
    const y = dateStr.slice(0, 4);
    const m = dateStr.slice(4, 6);
    const d = dateStr.slice(6, 8);
    const dateObj = new Date(`${y}-${m}-${d}`);

    return {
      date: `${y}-${m}-${d}`,
      label: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      visitors: parseInt(row.metricValues[0].value, 10),
      pageviews: parseInt(row.metricValues[1].value, 10),
      avgDuration: Math.round(parseFloat(row.metricValues[2].value)),
      bounceRate: Math.round(parseFloat(row.metricValues[3].value) * 100),
      ballInteractions: ballByDate[dateStr] || 0,
      ctaClicks: ctaByDate[dateStr] || 0,
    };
  });
}

// ── Traffic sources ─────────────────────────────────────────────────────

const SOURCE_COLORS = {
  linkedin:  '#0A66C2',
  google:    '#4285F4',
  '(direct)': '#6B9F6B',
  github:    '#C9D1D9',
  upwork:    '#14A800',
  bing:      '#008373',
  twitter:   '#1DA1F2',
  facebook:  '#1877F2',
};

async function fetchSources(token, propId, days) {
  const report = await runReport(token, propId, {
    dateRanges: [{ startDate: startDate(days), endDate: 'today' }],
    dimensions: [{ name: 'sessionSource' }],
    metrics: [{ name: 'sessions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 8,
  });

  const rows = report.rows || [];
  const total = rows.reduce((s, r) => s + parseInt(r.metricValues[0].value, 10), 0);
  const palette = ['#D4A843', '#5985B1', '#6B9F6B', '#5985B1', '#C05050', '#14A800', '#4285F4', '#C9D1D9'];

  return rows.map((row, i) => {
    const source = row.dimensionValues[0].value;
    const visits = parseInt(row.metricValues[0].value, 10);
    const key = source.toLowerCase();
    return {
      source: source === '(direct)' ? 'Direct' : source.charAt(0).toUpperCase() + source.slice(1),
      visits,
      pct: total > 0 ? parseFloat(((visits / total) * 100).toFixed(1)) : 0,
      color: SOURCE_COLORS[key] || palette[i % palette.length],
    };
  });
}

// ── Top pages ───────────────────────────────────────────────────────────

async function fetchTopPages(token, propId, days) {
  // Current period
  const report = await runReport(token, propId, {
    dateRanges: [
      { startDate: startDate(days), endDate: 'today' },
      { startDate: days > 0 ? `${days * 2}daysAgo` : '2020-01-01', endDate: days > 0 ? `${days + 1}daysAgo` : '2020-01-01' },
    ],
    dimensions: [{ name: 'pagePath' }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'averageSessionDuration' },
    ],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 8,
  });

  return (report.rows || []).map((row) => {
    const path = row.dimensionValues[0].value;
    const views = parseInt(row.metricValues[0].value, 10);
    const duration = Math.round(parseFloat(row.metricValues[1].value));
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;

    // Previous period views for trend
    const prevViews = parseInt(row.metricValues[2]?.value || '0', 10);
    const trend = prevViews > 0
      ? Math.round(((views - prevViews) / prevViews) * 100)
      : 0;

    return {
      path,
      title: friendlyPageTitle(path),
      views,
      avgTime: `${mins}:${String(secs).padStart(2, '0')}`,
      trend,
    };
  });
}

function friendlyPageTitle(path) {
  const map = {
    '/': 'Home (Physics Playground)',
    '/analytics-dashboard.html': 'Site Analytics Dashboard',
  };
  if (map[path]) return map[path];
  // "/detail/powerBI" → "Power BI"
  const slug = path.split('/').pop();
  return slug
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

// ── Ball engagement events ──────────────────────────────────────────────

async function fetchBallEvents(token, propId, days) {
  // Get ball_launch, ball_score, detail_open, and cta_click counts by project
  const [launchReport, scoreReport, openReport, ctaReport] = await Promise.all([
    runReport(token, propId, {
      dateRanges: [{ startDate: startDate(days), endDate: 'today' }],
      dimensions: [{ name: 'customEvent:project_name' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: 'ball_launch' },
        },
      },
      limit: 20,
    }),
    runReport(token, propId, {
      dateRanges: [{ startDate: startDate(days), endDate: 'today' }],
      dimensions: [{ name: 'customEvent:project_name' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: 'ball_score' },
        },
      },
      limit: 20,
    }),
    runReport(token, propId, {
      dateRanges: [{ startDate: startDate(days), endDate: 'today' }],
      dimensions: [{ name: 'customEvent:project_name' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: 'detail_open' },
        },
      },
      limit: 20,
    }),
    runReport(token, propId, {
      dateRanges: [{ startDate: startDate(days), endDate: 'today' }],
      dimensions: [{ name: 'customEvent:project_name' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: 'cta_click' },
        },
      },
      limit: 20,
    }),
  ]);

  // Index by project name
  const launches  = indexByDimension(launchReport);
  const scores    = indexByDimension(scoreReport);
  const opens     = indexByDimension(openReport);
  const ctaClicks = indexByDimension(ctaReport);

  // Merge all known project names
  const allNames = new Set([
    ...Object.keys(launches),
    ...Object.keys(scores),
    ...Object.keys(opens),
    ...Object.keys(ctaClicks),
  ]);

  const palette = ['#D4A843', '#5985B1', '#6B9F6B', '#5985B1', '#C05050', '#BF360C', '#4285F4', '#8B1A32'];

  const result = [];
  let i = 0;
  for (const name of allNames) {
    const meta = BALL_META_LOOKUP[name] || { id: name, color: palette[i % palette.length], category: 'Other' };
    const launchCount   = launches[name] || 0;
    const scoreCount    = scores[name] || 0;
    const openCount     = opens[name] || 0;
    const ctaClickCount = ctaClicks[name] || 0;
    result.push({
      ball: name,
      id: meta.id,
      clicks: launchCount,      // V1 compat: clicks = launches
      launches: launchCount,
      scores: scoreCount,
      opens: openCount,
      ctaClicks: ctaClickCount,
      color: meta.color,
      category: meta.category,
    });
    i++;
  }

  // Attach diagnostic info for debugging CTA click data
  const sorted = result.sort((a, b) => b.launches - a.launches);
  sorted._debug = {
    ctaReportRowCount: (ctaReport.rows || []).length,
    ctaReportRaw: ctaReport.rows || [],
    ctaClicksMap: ctaClicks,
  };
  return sorted;
}

// ── Visitor geography ─────────────────────────────────────────────────

async function fetchGeography(token, propId, days) {
  const report = await runReport(token, propId, {
    dateRanges: [{ startDate: startDate(days), endDate: 'today' }],
    dimensions: [{ name: 'country' }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
    ],
    orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
    limit: 15,
  });

  const rows = report.rows || [];
  const totalUsers = rows.reduce((s, r) => s + parseInt(r.metricValues[0].value, 10), 0);

  return rows.map(row => {
    const country = row.dimensionValues[0].value;
    const users = parseInt(row.metricValues[0].value, 10);
    const sessions = parseInt(row.metricValues[1].value, 10);
    return {
      country: country === '(not set)' ? 'Unknown' : country,
      users,
      sessions,
      pct: totalUsers > 0 ? parseFloat(((users / totalUsers) * 100).toFixed(1)) : 0,
    };
  }).filter(g => g.country !== 'Unknown');
}

// ── Impact distribution — per-shot coordinate data from GA4 ───────────
// impact_x/impact_y are registered as custom dimensions, so each unique
// (project_name, impact_x, impact_y, is_goal) tuple is its own row.
// Coordinates are rounded to 3 decimals on send, so most rows represent
// individual shots (eventCount=1), with occasional collisions.

async function fetchImpactDistribution(token, propId, days) {
  const report = await runReport(token, propId, {
    dateRanges: [{ startDate: startDate(days), endDate: 'today' }],
    dimensions: [
      { name: 'customEvent:project_name' },
      { name: 'customEvent:is_goal' },
      { name: 'customEvent:impact_x' },
      { name: 'customEvent:impact_y' },
    ],
    metrics: [
      { name: 'eventCount' },
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        stringFilter: { matchType: 'EXACT', value: 'ball_impact' },
      },
    },
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 500,
  });

  return (report.rows || []).map(row => {
    const meta = BALL_META_LOOKUP[row.dimensionValues[0].value];
    return {
      projectName: row.dimensionValues[0].value,
      ballId:      meta?.id || row.dimensionValues[0].value,
      isGoal:      row.dimensionValues[1].value === 'true',
      x:           parseFloat(row.dimensionValues[2].value),
      y:           parseFloat(row.dimensionValues[3].value),
      count:       parseInt(row.metricValues[0].value, 10),
    };
  }).filter(r => !isNaN(r.x) && !isNaN(r.y));
}

// Shared ball metadata for both fetchBallEvents and fetchImpactDistribution
const BALL_META_LOOKUP = {
  'Josh Merritt':       { id: 'aboutMe',                      color: '#6B9F6B',  category: 'Me' },
  'Microsoft Power BI': { id: 'powerBIMetrics',               color: '#D4A843',  category: 'Business' },
  'The Wine You Drink': { id: 'thewineyoudrink',              color: '#8B1A32',  category: 'Apps' },
  'Black Sheep Dart League': { id: 'dartleague',              color: '#5985B1',  category: 'Apps' },
  'Smart Chicken Coop': { id: 'arduinoCoopDoor',              color: '#BF360C',  category: 'Technology' },
  'Site Analytics':     { id: 'SiteAnalytics',                color: '#5985B1',  category: 'Technology' },
  'Google Data Studio Streaming Dashboard': { id: 'googleDataStudioServiceTechs', color: '#4285F4', category: 'Business' },
  'Portfolio Website':  { id: 'thisWebsite',                  color: '#5985B1',  category: 'Technology' },
};

function indexByDimension(report) {
  const map = {};
  (report.rows || []).forEach((row) => {
    map[row.dimensionValues[0].value] = parseInt(row.metricValues[0].value, 10);
  });
  return map;
}
