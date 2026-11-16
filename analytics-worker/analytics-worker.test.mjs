/**
 * Tests for the analytics worker. Run with `npm test`.
 *
 * The worker can't be run for real without a PostHog personal API key, so these
 * stub `fetch` and feed it rows in the exact shape the HogQL endpoint returns
 * ({ columns, results } with positional arrays). The fixture rows are modelled
 * on real sessions from the Website project.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPayload, localDowHour, quantile, addDays, friendlySource } from './aggregate.js';

const ENV = {
  POSTHOG_API_KEY: 'phx_test_key',
  POSTHOG_PROJECT_ID: '605146',
  POSTHOG_HOST: 'https://us.posthog.com',
  SITE_HOST: 'dadatadad.com',
  DATA_EPOCH_UTC: '2026-09-13 16:15:00',
  ALLOWED_ORIGINS: 'https://dadatadad.com,http://localhost:4173',
};

// Each import gets a private module instance, so the worker's in-memory cache
// never leaks between tests.
let importCount = 0;
const loadWorker = () => import(`./analytics-worker.js?instance=${++importCount}`);

// ── Fixtures ────────────────────────────────────────────────────────────────

const SESSION_COLUMNS = [
  'sid', 'pid', 'day', 'days_ago', 'started_unix', 'tz', 'duration_s',
  'pv_site', 'pv_dash', 'pv_portfolio', 'loads', 'shots', 'makes', 'opens', 'ctas', 'hints',
  'device', 'country', 'referrer', 'load_ms', 'first_shot_ms', 'fps_avg', 'fps_min', 'lcp', 'fcp', 'inp', 'cls',
];

// "Today" is 2026-11-14 in every fixture (day + days_ago).
const SESSION_ROWS = [
  // A bot-like hit: UTC clock, no load, gone instantly.
  ['s1', 'p-bot', '2026-11-09', 5, 1794280674, 'UTC', 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 'Desktop', 'Canada', '$direct', null, null, null, null, null, null, null, null],
  // Loaded the game from Google, did nothing.
  ['s2', 'p-a', '2026-11-02', 12, 1793642357, 'America/Los_Angeles', 2, 1, 0, 0, 1, 0, 0, 0, 0, 0, 'Desktop', 'United States', 'www.google.com', 3345, null, null, null, null, null, null, null],
  // A real player: 6 shots, 1 make, 5 opens, 3 click-throughs.
  ['s3', 'p-b', '2026-10-28', 17, 1793205583, 'America/Monterrey', 183, 1, 0, 0, 1, 6, 1, 5, 3, 2, 'Desktop', 'Mexico', '$direct', 1934, 19666, 60, 1, 1380, 1296, 48, 0.0007],
  // A stray performance sample in its own session: not a visit, but real perf data.
  ['s4', 'p-c', '2026-10-26', 19, 1793071573, 'America/Monterrey', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'Mobile', 'United States', null, null, null, 59, 18, null, null, null, null],
  // Phone visit, loaded, no play.
  ['s5', 'p-c', '2026-10-26', 19, 1793065561, 'America/Monterrey', 13, 1, 0, 0, 1, 0, 0, 0, 0, 0, 'Mobile', 'United States', '$direct', 1511, null, null, null, 4484, 844, 32, null],
  // Came back to an open tab after idle: play with no page view. Still a visit.
  ['s6', 'p-d', '2026-09-13', 62, 1789327283, 'America/Los_Angeles', 198, 0, 0, 0, 0, 1, 1, 1, 1, 0, 'Desktop', 'United States', null, null, null, null, null, null, null, 48, null],
  // The owner checking the dashboard: tracked, but not a portfolio visit.
  ['s7', 'p-owner', '2026-11-13', 1, 1794600000, 'America/Los_Angeles', 40, 0, 2, 0, 0, 0, 0, 0, 0, 0, 'Desktop', 'United States', '$direct', null, null, null, null, null, null, null, null],
  // Previous 7-day window (days 7–13), to exercise "vs previous period".
  ['s8', 'p-e', '2026-11-04', 10, 1793800000, 'Europe/London', 25, 2, 0, 1, 1, 0, 0, 0, 0, 0, 'Tablet', 'United Kingdom', 'www.linkedin.com', 900, null, null, null, null, null, null, null],
];

const BALL_COLUMNS = ['days_ago', 'ball', 'launches', 'scores', 'opens', 'ctas'];
const BALL_ROWS = [
  [17, 'Smart Chicken Coop', 3, 0, 1, 0],
  [17, 'Portfolio Website', 1, 1, 1, 0],
  [17, 'Site Analytics', 0, 0, 1, 1],
  [62, 'Portfolio Website', 1, 1, 1, 1],
];

const SHOT_COLUMNS = ['sid', 'ball', 'seq', 'x', 'y', 'hit', 'vw', 'vh', 'days_ago', 'scored'];
const SHOT_ROWS = [
  ['s3', 'Portfolio Website', 1, 0.041, 0.211, 'wall', 1640, 997, 17, 1],
  ['s3', 'Google Data Studio Streaming Dashboard', 2, 0.197, 0.469, 'net', 1640, 997, 17, 0],
  ['s6', 'Portfolio Website', 1, 0.07, 0.363, 'net', 2347, 1180, 62, 1],
  ['s3', 'Broken Row', 1, null, null, 'wall', 1640, 997, 17, 0],   // no coordinates → dropped
];

const FIXTURES = {
  'site-analytics: sessions':     { columns: SESSION_COLUMNS, results: SESSION_ROWS },
  'site-analytics: balls by day': { columns: BALL_COLUMNS, results: BALL_ROWS },
  'site-analytics: shots':        { columns: SHOT_COLUMNS, results: SHOT_ROWS },
};

/**
 * Replace global fetch with a stub that answers like PostHog's /query endpoint.
 * `plan(name, callIndex)` may return a Response to override the default answer.
 */
function stubPostHog(plan = () => null) {
  const calls = [];
  let running = 0;
  let peak = 0;
  const original = globalThis.fetch;

  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    const call = { url: String(url), name: body.name, sql: body.query.query, auth: init.headers.Authorization };
    calls.push(call);
    running++;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, 5));   // let the three overlap
    running--;

    const override = plan(body.name, calls.filter((c) => c.name === body.name).length - 1);
    if (override) return override;
    const fixture = FIXTURES[body.name];
    if (!fixture) return new Response('unknown query', { status: 400 });
    return new Response(JSON.stringify(fixture), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  return {
    calls,
    get peak() { return peak; },
    restore() { globalThis.fetch = original; },
  };
}

const get = (worker, origin = 'https://dadatadad.com') =>
  worker.fetch(new Request('https://site-analytics.example.workers.dev/', { headers: { Origin: origin } }), ENV, {});

// ── End to end through the fetch handler ────────────────────────────────────

test('the Worker entry module exports the handler and nothing else', async () => {
  // On Workers every named export of the entry module is treated as a possible
  // entrypoint or Durable Object class. Helpers belong in aggregate.js.
  const mod = await loadWorker();
  assert.deepEqual(Object.keys(mod), ['default']);
  assert.equal(typeof mod.default.fetch, 'function');
});

test('returns the v2 payload from exactly three concurrent queries', async () => {
  const posthog = stubPostHog();
  try {
    const { default: worker } = await loadWorker();
    const res = await get(worker);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://dadatadad.com');
    assert.equal(res.headers.get('X-Cache'), 'miss');

    const data = await res.json();
    assert.equal(data.v, 2);
    assert.equal(data.source, 'posthog');
    assert.deepEqual(data.windows, [7, 30, 90]);
    assert.equal(data.today, '2026-11-14');
    assert.equal(data.since, '2026-09-13');
    assert.equal(data.truncated, false);

    // PostHog allows three concurrent API queries per project. More than three
    // calls, or more than three at once, would be rejected in production.
    assert.equal(posthog.calls.length, 3);
    assert.ok(posthog.peak <= 3, `peak concurrency was ${posthog.peak}`);
    assert.ok(posthog.calls.every((c) => c.url === 'https://us.posthog.com/api/projects/605146/query/'));
    assert.ok(posthog.calls.every((c) => c.auth === 'Bearer phx_test_key'));
  } finally {
    posthog.restore();
  }
});

test('never leaks ids, the API key or SQL to the browser', async () => {
  const posthog = stubPostHog();
  try {
    const { default: worker } = await loadWorker();
    const text = await (await get(worker)).text();
    for (const secret of ['p-bot', 'p-a', 'p-owner', '"s3"', 'phx_test_key', 'SELECT', 'started_unix']) {
      assert.ok(!text.includes(secret), `response contains ${secret}`);
    }
    // Exact screen sizes are distinctive; only a rounded shape may go out.
    for (const pixels of ['1640', '997', '2347', '1180']) {
      assert.ok(!text.includes(pixels), `response contains the exact viewport dimension ${pixels}`);
    }
  } finally {
    posthog.restore();
  }
});

test('every query is scoped to the site host, the data epoch and a time window', async () => {
  const posthog = stubPostHog();
  try {
    const { default: worker } = await loadWorker();
    await get(worker);
    for (const { name, sql } of posthog.calls) {
      assert.match(sql, /properties\.\$host = 'dadatadad\.com'/, `${name}: host filter`);
      assert.match(sql, /toDateTime\('2026-09-13 16:15:00', 'UTC'\)/, `${name}: epoch filter`);
      assert.match(sql, /timestamp >= now\(\) - INTERVAL \d+ DAY/, `${name}: time window`);
      assert.match(sql, /LIMIT \d+/, `${name}: row cap`);
    }
    const sql = Object.fromEntries(posthog.calls.map((c) => [c.name, c.sql]));
    // The dashboards send Web Vitals too; only the playground's may be reported.
    assert.equal((sql['site-analytics: sessions'].match(/event = '\$web_vitals' AND NOT match\(/g) || []).length, 4);
    // Shots are paired with their own launch by order in time, per session and ball.
    assert.match(sql['site-analytics: shots'], /'ball_launch', 'ball_impact', 'ball_score'/);
    assert.match(sql['site-analytics: shots'], /PARTITION BY sid, ball ORDER BY ts ASC/);
  } finally {
    posthog.restore();
  }
});

test('a second request inside the TTL is served from memory', async () => {
  const posthog = stubPostHog();
  try {
    const { default: worker } = await loadWorker();
    await get(worker);
    const again = await get(worker);
    assert.equal(again.headers.get('X-Cache'), 'memory');
    assert.equal(posthog.calls.length, 3, 'no further PostHog queries');
  } finally {
    posthog.restore();
  }
});

test('simultaneous cold requests each run their own batch', async () => {
  // Deliberately NOT shared: on Workers a promise belongs to the request that
  // created it, and awaiting one whose request was cancelled hangs forever.
  const posthog = stubPostHog();
  try {
    const { default: worker } = await loadWorker();
    const [a, b] = await Promise.all([get(worker), get(worker)]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(posthog.calls.length, 6);
    assert.equal((await get(worker)).headers.get('X-Cache'), 'memory', 'and the result is remembered');
  } finally {
    posthog.restore();
  }
});

test('a failed request leaves nothing behind for the next one to trip over', async () => {
  let failing = true;
  const posthog = stubPostHog(() => (failing ? new Response('down', { status: 503, headers: { 'Retry-After': '0' } }) : null));
  try {
    const { default: worker } = await loadWorker();
    assert.equal((await get(worker)).status, 502);
    failing = false;
    const ok = await get(worker);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('X-Cache'), 'miss');
  } finally {
    posthog.restore();
  }
});

test('the batch is handed to waitUntil, so it finishes even if the visitor leaves', async () => {
  const posthog = stubPostHog();
  try {
    const { default: worker } = await loadWorker();
    const kept = [];
    const res = await worker.fetch(new Request('https://x.workers.dev/', { headers: { Origin: 'https://dadatadad.com' } }), ENV, { waitUntil: (p) => kept.push(p) });
    assert.equal(res.status, 200);
    assert.equal(kept.length, 1);
    await kept[0];
  } finally {
    posthog.restore();
  }
});

test('a query that times out is not retried, and the worker answers inside its budget', async () => {
  // PostHog never answers: the stub settles only when the request is aborted.
  //
  // It also has to hold Node's event loop open while it waits, the way a real
  // request's socket does. The worker's AbortSignal.timeout() does not: its
  // timer is unref'd. With nothing else pending, Node 20 (what CI runs) ends
  // the process at once and cancels this test and every test after it in the
  // file — "30 passed, 20 cancelled, 0 failed", which is how the first 3.3.0
  // deploy failed. Node 24's runner waits for a pending test regardless, so it
  // passed locally. The timer is the stand-in socket; it lets go by itself
  // after 5 s so a worker that never aborts fails the test instead of hanging.
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (url, init) => new Promise((resolve, reject) => {
    calls++;
    const inFlight = setTimeout(() => {}, 5000);
    init.signal.addEventListener('abort', () => {
      clearTimeout(inFlight);
      reject(init.signal.reason);
    });
  });
  try {
    const { default: worker } = await loadWorker();
    const started = Date.now();
    const res = await worker.fetch(new Request('https://x.workers.dev/'), { ...ENV, BATCH_BUDGET_MS: '300' }, {});
    assert.equal(res.status, 502);
    assert.match((await res.json()).detail, /timed out/);
    assert.equal(calls, 3, 'one attempt per query: a second copy could trip the concurrency limit');
    assert.ok(Date.now() - started < 2000, 'answered promptly');
  } finally {
    globalThis.fetch = original;
  }
});

test('responses are never HTTP-cached, so a refresh always reaches the worker', async () => {
  const posthog = stubPostHog();
  try {
    const { default: worker } = await loadWorker();
    assert.equal((await get(worker)).headers.get('Cache-Control'), 'no-store');
  } finally {
    posthog.restore();
  }
});

test('retries once when PostHog answers 429', async () => {
  const posthog = stubPostHog((name, i) =>
    name === 'site-analytics: shots' && i === 0
      ? new Response('rate limited', { status: 429, headers: { 'Retry-After': '0' } })
      : null);
  try {
    const { default: worker } = await loadWorker();
    const res = await get(worker);
    assert.equal(res.status, 200);
    assert.equal(posthog.calls.length, 4, 'three queries plus one retry');
    assert.equal((await res.json()).shots.length, 3);
  } finally {
    posthog.restore();
  }
});

test('answers 502 with a short reason when PostHog keeps failing', async () => {
  const posthog = stubPostHog((name) =>
    name === 'site-analytics: sessions' ? new Response('{"detail":"secret upstream text"}', { status: 500 }) : null);
  try {
    const { default: worker } = await loadWorker();
    const res = await get(worker);
    assert.equal(res.status, 502);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://dadatadad.com', 'errors are still readable cross-origin');
    const body = await res.json();
    assert.equal(body.error, 'upstream_failed');
    assert.ok(!JSON.stringify(body).includes('secret upstream text'));
  } finally {
    posthog.restore();
  }
});

test('says so when the API key secret was never set', async () => {
  const { default: worker } = await loadWorker();
  const res = await worker.fetch(new Request('https://x.workers.dev/'), { ...ENV, POSTHOG_API_KEY: undefined }, {});
  assert.equal(res.status, 500);
  assert.equal((await res.json()).error, 'not_configured');
});

test('CORS: echoes an allowed origin, falls back to the first for others', async () => {
  const posthog = stubPostHog();
  try {
    const { default: worker } = await loadWorker();
    const local = await get(worker, 'http://localhost:4173');
    assert.equal(local.headers.get('Access-Control-Allow-Origin'), 'http://localhost:4173');
    const stranger = await get(worker, 'https://evil.example');
    assert.equal(stranger.headers.get('Access-Control-Allow-Origin'), 'https://dadatadad.com');

    const preflight = await worker.fetch(new Request('https://x.workers.dev/', { method: 'OPTIONS', headers: { Origin: 'https://dadatadad.com' } }), ENV, {});
    assert.equal(preflight.status, 204);
    const post = await worker.fetch(new Request('https://x.workers.dev/', { method: 'POST' }), ENV, {});
    assert.equal(post.status, 405);
  } finally {
    posthog.restore();
  }
});

test('rejects config that would build odd SQL', async () => {
  const posthog = stubPostHog();
  try {
    const { default: worker } = await loadWorker();
    const res = await worker.fetch(new Request('https://x.workers.dev/'), { ...ENV, SITE_HOST: "x' OR 1=1 --" }, {});
    assert.equal(res.status, 502);
    assert.equal(posthog.calls.length, 0, 'no query is sent');
  } finally {
    posthog.restore();
  }
});

// ── Aggregation ─────────────────────────────────────────────────────────────

const toObjects = ({ columns, results }) => results.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i]])));
const RAW = {
  sessions: toObjects(FIXTURES['site-analytics: sessions']),
  ballDays: toObjects(FIXTURES['site-analytics: balls by day']),
  shots:    toObjects(FIXTURES['site-analytics: shots']),
};
const build = async (raw = RAW) => buildPayload(raw, { now: new Date('2026-11-14T20:00:00Z'), epochUtc: ENV.DATA_EPOCH_UTC, siteHost: ENV.SITE_HOST });

test('counts visits, not sessions: dashboard-only and stray-sample sessions are excluded', async () => {
  const { ranges } = await build();
  const t = ranges[90].totals;
  // s1 s2 s3 s5 s6 s8 are visits; s4 (perf sample only) and s7 (dashboard only) are not.
  assert.equal(t.visits, 6);
  assert.equal(t.visitors, 6);                 // p-c appears once as a visit (s5); s4 is not one
  assert.equal(t.pageviews, 6);                // 1+1+1+1+0+2
  assert.equal(t.players, 2);                  // s3, s6
  assert.equal(t.scorers, 2);
  assert.equal(t.openers, 2);
  assert.equal(t.clickers, 2);
  assert.equal(t.shots, 7);
  assert.equal(t.makes, 2);
  assert.equal(t.opens, 6);
  assert.equal(t.ctas, 4);
  assert.equal(t.suspectedBots, 1);            // s1 only
  assert.equal(t.dashboardSessions, 1);        // s7
});

test('ranges filter by days_ago and compare against the previous window only when it is fully tracked', async () => {
  const { ranges } = await build();
  assert.equal(ranges[7].totals.visits, 1);    // s1 (5 days ago); s7 is not a visit
  assert.equal(ranges[30].totals.visits, 5);   // s1 s2 s3 s5 s8

  // Previous 7 days = days 7–13 ago → s2 (12) and s8 (10).
  assert.equal(ranges[7].prev.visits, 2);
  // Previous 30 days starts 2026-09-16, after the epoch → comparable.
  assert.notEqual(ranges[30].prev, null);
  // Previous 90 days reaches back before tracking began → no comparison.
  assert.equal(ranges[90].prev, null);
});

test('the funnel nests by construction', async () => {
  const { ranges } = await build();
  const f = ranges[90].funnel;
  assert.deepEqual(f, { visited: 6, loaded: 5, interacted: 2, opened: 2, clicked: 2 });
  assert.ok(f.visited >= f.loaded && f.loaded >= f.interacted && f.interacted >= f.opened && f.opened >= f.clicked);
});

test('the daily series is 90 zero-filled days ending today', async () => {
  const { days } = await build();
  assert.equal(days.length, 90);
  assert.equal(days.at(-1).date, '2026-11-14');
  assert.equal(days[0].date, '2026-08-17');
  const oct28 = days.find((d) => d.date === '2026-10-28');
  assert.deepEqual(
    { visits: oct28.visits, shots: oct28.shots, makes: oct28.makes, opens: oct28.opens, ctas: oct28.ctas },
    { visits: 1, shots: 6, makes: 1, opens: 5, ctas: 3 },
  );
  assert.equal(days.find((d) => d.date === '2026-11-13').visits, 0, 'dashboard-only day shows no visits');
  assert.equal(days.reduce((a, d) => a + d.visits, 0), 6);
});

test('only well-known public sites are named as sources', async () => {
  const visit = (referrer, i) => ({ ...RAW.sessions[1], sid: `r${i}`, pid: `rp${i}`, referrer });
  const { ranges } = await build({
    sessions: [
      'mail.acme-corp.com',           // somebody's employer: must not be published
      'intranet.example.internal',
      'teams.public.onecdn.static.microsoft',
      'www.dadatadad.com',            // arrived from the site's own pages
      'www.linkedin.com',
    ].map(visit),
    ballDays: [], shots: [],
  });
  const text = JSON.stringify(ranges);
  assert.ok(!text.includes('acme') && !text.includes('intranet'), 'no private hostname in the payload');
  assert.deepEqual(
    Object.fromEntries(ranges[90].sources.map((s) => [s.name, s.visits])),
    { Direct: 1, LinkedIn: 1, 'Microsoft Teams': 1, 'Other sites': 2 },
  );
  assert.equal(ranges[90].sources.at(-1).name, 'Other sites', 'the catch-all is listed last');
});

test('sources and countries are named, ranked, and counted per visit', async () => {
  const { ranges } = await build();
  const sources = Object.fromEntries(ranges[90].sources.map((s) => [s.name, s.visits]));
  assert.deepEqual(sources, { Direct: 4, Google: 1, LinkedIn: 1 });
  assert.equal(ranges[90].sources[0].name, 'Direct');

  const countries = Object.fromEntries(ranges[90].countries.map((c) => [c.name, c.visits]));
  assert.deepEqual(countries, { 'United States': 3, Canada: 1, Mexico: 1, 'United Kingdom': 1 });
});

test('devices, pages and per-project counts', async () => {
  const { ranges } = await build();
  const devices = Object.fromEntries(ranges[90].devices.map((d) => [d.device, d]));
  assert.equal(devices.Desktop.visits, 4);
  assert.equal(devices.Desktop.players, 2);
  assert.equal(devices.Mobile.visits, 1);
  assert.equal(devices.Tablet.visits, 1);

  assert.deepEqual(ranges[90].pages, [
    { key: 'playground', views: 5 },
    { key: 'portfolio',  views: 1 },
    { key: 'dashboards', views: 2 },
  ]);

  const balls = Object.fromEntries(ranges[90].balls.map((b) => [b.ball, b]));
  assert.deepEqual(balls['Portfolio Website'], { ball: 'Portfolio Website', launches: 2, scores: 2, opens: 2, ctas: 1 });
  assert.equal(ranges[90].balls[0].ball, 'Smart Chicken Coop', 'most launched first');
  assert.equal(ranges[30].balls.find((b) => b.ball === 'Portfolio Website').launches, 1, '30-day range drops the September shot');
});

test('performance uses every session with a sample, including non-visits', async () => {
  const { ranges } = await build();
  const p = ranges[90].perf;
  assert.equal(p.loadMs.n, 4);                 // s2 s3 s5 s8
  assert.equal(p.loadMs.p50, 1723);            // median of 900, 1511, 1934, 3345
  assert.equal(p.fps.n, 2);                    // s3 and the stray sample s4
  assert.equal(p.fps.avg, 60);                 // mean of 60 and 59, rounded
  assert.equal(p.firstShotMs.p50, 19666);
  assert.equal(p.cls.p75, 0.001);
  assert.equal(ranges[7].perf.loadMs.p50, null, 'no samples → null, not 0');
});

test('activity is bucketed on the visitor\'s own clock', async () => {
  // 2026-10-28 16:39:43 UTC is 10:39 in Monterrey (UTC−6), a Wednesday.
  assert.deepEqual(localDowHour(1793205583, 'America/Monterrey'), { dow: 3, hour: 10 });
  assert.deepEqual(localDowHour(1793205583, 'UTC'), { dow: 3, hour: 16 });
  assert.deepEqual(localDowHour(1793205583, 'Not/AZone'), { dow: 3, hour: 16 }, 'unknown zone falls back to UTC');

  const { ranges } = buildPayload(RAW, { now: new Date('2026-11-14T20:00:00Z'), epochUtc: ENV.DATA_EPOCH_UTC });
  const grid = ranges[90].activity;
  assert.equal(grid.length, 7);
  assert.ok(grid.every((row) => row.length === 24));
  assert.equal(grid.flat().reduce((a, b) => a + b, 0), 6, 'one cell increment per visit');
  assert.equal(grid[3][10], 1);
});

test('shots keep coordinates and outcome, and drop rows without a position', async () => {
  const { shots } = await build();
  assert.equal(shots.length, 3);
  // 1640×997 leaves as a shape: ratio 1.64, long side rounded up to 1700.
  assert.deepEqual(shots[0], { x: 0.041, y: 0.211, ar: 1.64, long: 1700, ball: 'Portfolio Website', hit: 'wall', made: true, d: 17 });
  assert.equal(shots[1].made, false);
  assert.deepEqual([shots[2].ar, shots[2].long], [1.99, 2400]);
});

test('rounding a screen never flips the layout the game would have used', async () => {
  const shape = (vw, vh) => {
    const { shots } = buildPayload({ sessions: [], ballDays: [], shots: [{ x: 0.5, y: 0.5, vw, vh, ball: 'b', hit: 'net', days_ago: 0, scored: 0 }] });
    return [shots[0].ar, shots[0].long];
  };
  assert.deepEqual(shape(1001, 700), [1.43, 1100], 'just over the 1000px line stays over it');
  assert.deepEqual(shape(1000, 700), [1.43, 1000], 'on the line stays on it');
  assert.deepEqual(shape(700, 701), [0.99, 800], 'barely portrait stays portrait');
  assert.deepEqual(shape(701, 700), [1, 800], 'barely landscape stays landscape');
});

test('an empty project produces a complete, all-zero payload', async () => {
  const data = await build({ sessions: [], ballDays: [], shots: [] });
  assert.equal(data.days.length, 90);
  assert.equal(data.today, '2026-11-14');
  assert.equal(data.ranges[7].totals.visits, 0);
  assert.deepEqual(data.ranges[90].funnel, { visited: 0, loaded: 0, interacted: 0, opened: 0, clicked: 0 });
  assert.deepEqual(data.ranges[90].sources, []);
  assert.deepEqual(data.shots, []);
});

test('helpers', async () => {
  assert.equal(quantile([], 0.5), null);
  assert.equal(quantile([10], 0.75), 10);
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(friendlySource('$direct'), 'Direct');
  assert.equal(friendlySource(null), 'Direct');
  assert.equal(friendlySource('www.google.com'), 'Google');
  assert.equal(friendlySource('lnkd.in'), 'LinkedIn');
  assert.equal(friendlySource('teams.public.onecdn.static.microsoft'), 'Microsoft Teams');
  assert.equal(friendlySource('teams.microsoft.com'), 'Microsoft Teams');
  assert.equal(friendlySource('www.example.org'), 'Other sites');
  assert.equal(friendlySource('dadatadad.com', 'dadatadad.com'), 'Direct');
  assert.equal(friendlySource('www.dadatadad.com', 'dadatadad.com'), 'Direct');
  assert.equal(friendlySource('notgoogle.example'), 'Other sites');
});
