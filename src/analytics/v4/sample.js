/**
 * sample.js — Made-up data, for when the real data can't be reached.
 *
 * Shown ONLY when the analytics API fails (and during offline development),
 * always under a banner that says so. It is here so the dashboard can still
 * demonstrate itself, not to stand in for real numbers.
 *
 * It fabricates the same three row sets the worker gets from PostHog and feeds
 * them through the worker's own buildPayload(). So the sample document is the
 * live document's shape by construction — there is no second aggregator to keep
 * in step. This module is loaded on demand; the live path never downloads it.
 */

import { buildPayload } from '../../../analytics-worker/aggregate.js';
import projects from '../../data/projects.js';
import { computeLayout } from './court.js';

/** Small seeded PRNG (mulberry32): the sample is identical on every load. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PLACES = [
  // [timezone, country, UTC offset (h), weight]
  ['America/Los_Angeles', 'United States', -8, 26],
  ['America/New_York',    'United States', -5, 24],
  ['America/Toronto',     'Canada',        -5, 8],
  ['Europe/London',       'United Kingdom', 0, 12],
  ['Europe/Berlin',       'Germany',        1, 9],
  ['Asia/Kolkata',        'India',        5.5, 11],
  ['Australia/Sydney',    'Australia',     11, 6],
  ['America/Sao_Paulo',   'Brazil',        -3, 4],
];
const REFERRERS = [['$direct', 36], ['www.linkedin.com', 28], ['www.google.com', 17], ['github.com', 9], ['www.upwork.com', 7], ['www.bing.com', 3]];
const DEVICES   = [['Desktop', 62], ['Mobile', 32], ['Tablet', 6]];
const SCREENS   = {
  Desktop: [[1920, 1080], [1536, 864], [1440, 900], [2560, 1440]],
  Mobile:  [[390, 844], [412, 915], [360, 800]],
  Tablet:  [[1180, 820], [820, 1180]],
};
// Local hour of day: quiet overnight, busy through the working day.
const HOURS = [1, 1, 0, 0, 0, 1, 2, 4, 7, 10, 11, 10, 8, 9, 10, 9, 8, 6, 5, 5, 4, 3, 2, 1].map((w, h) => [h, w]);
// How much each ball gets launched, in projects.js order.
const BALL_WEIGHTS = [10, 6, 7, 5, 4, 8, 7, 6];
// The game stacks category bars longest-name first (Game._createBalls).
const CATEGORY_ORDER = [...new Set(projects.map((p) => p.category))].sort((a, b) => b.length - a.length);

export function buildSamplePayload(now = new Date()) {
  const rand = rng(20260913);
  const pick = (table) => {
    const total = table.reduce((a, row) => a + row[row.length - 1], 0);
    let r = rand() * total;
    for (const row of table) { r -= row[row.length - 1]; if (r < 0) return row; }
    return table[table.length - 1];
  };
  const between = (lo, hi) => lo + rand() * (hi - lo);
  const chance = (p) => rand() < p;

  const today = now.toISOString().slice(0, 10);
  const dayStart = Date.parse(`${today}T00:00:00Z`) / 1000;

  const sessions = [];
  const ballDays = new Map();
  const shots = [];
  let people = 0;

  const bump = (daysAgo, ball, field) => {
    const key = `${daysAgo}|${ball}`;
    const row = ballDays.get(key) || { days_ago: daysAgo, ball, launches: 0, scores: 0, opens: 0, ctas: 0 };
    row[field]++;
    ballDays.set(key, row);
  };

  for (let d = 179; d >= 0; d--) {
    const weekday = new Date((dayStart - d * 86400) * 1000).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    // A little growth over the period, quieter at weekends.
    const rate = (weekend ? 1.0 : 2.3) * (0.7 + (179 - d) / 300);
    const visits = Math.max(0, Math.round(rate + (rand() - 0.5) * 3));

    for (let v = 0; v < visits; v++) {
      const sid = `sample-${d}-${v}`;
      const [tz, country, offset] = pick(PLACES);
      const [device] = pick(DEVICES);
      const [referrer] = pick(REFERRERS);
      const [hour] = pick(HOURS);
      const pid = people > 6 && chance(0.12) ? `sample-person-${Math.floor(rand() * people)}` : `sample-person-${people++}`;
      const started = Math.round(dayStart - d * 86400 + (hour - offset) * 3600 + rand() * 3600);

      const row = {
        sid, pid,
        day: new Date((dayStart - d * 86400) * 1000).toISOString().slice(0, 10),
        days_ago: d, started_unix: started, tz, duration_s: 0,
        pv_site: 1, pv_dash: 0, pv_portfolio: 0,
        loads: 0, shots: 0, makes: 0, opens: 0, ctas: 0, hints: 0,
        device, country, referrer,
        load_ms: null, first_shot_ms: null, fps_avg: null, fps_min: null, lcp: null, fcp: null, inp: null, cls: null,
      };
      sessions.push(row);

      if (chance(0.11)) {            // a crawler: UTC clock, gone before the game loads
        row.tz = 'UTC';
        row.referrer = '$direct';
        row.duration_s = Math.round(between(0, 3));
        continue;
      }
      if (!chance(0.93)) { row.duration_s = Math.round(between(1, 6)); continue; }

      const desktop = device === 'Desktop';
      row.loads = 1;
      row.load_ms = Math.round(between(700, 1900) + (desktop ? 0 : 900) + (chance(0.15) ? between(1500, 4000) : 0));
      row.fcp = Math.round(between(450, 1500) + (desktop ? 0 : 500));
      row.lcp = Math.round(row.fcp + between(200, 2200));
      row.duration_s = Math.round(between(4, 22));
      if (chance(0.5)) row.cls = Number(between(0, 0.04).toFixed(4));
      if (chance(0.03)) row.pv_portfolio = 1;

      if (!chance(desktop ? 0.6 : 0.42)) continue;

      // ── This visitor plays ──
      const [vw, vh] = SCREENS[device][Math.floor(rand() * SCREENS[device].length)];
      const L = computeLayout(vw, vh, projects.length, CATEGORY_ORDER.length);
      const ballR = L.ballRadius;
      const total = 1 + Math.floor(-Math.log(1 - rand()) * 3.2);
      let missRun = 0;

      for (let n = 1; n <= total; n++) {
        const p = projects[pick(BALL_WEIGHTS.map((w, i) => [i, w]))[0]];
        const made = chance(desktop ? 0.23 : 0.16);
        row.shots++;
        bump(d, p.name, 'launches');
        if (made) { row.makes++; row.opens++; missRun = 0; bump(d, p.name, 'scores'); bump(d, p.name, 'opens'); }
        else if (++missRun === 3) row.hints++;

        // Where it first touched something. A clean make drops straight onto
        // its category bar; most misses catch the net, a wall or a post.
        const hit = made
          ? pick([['menu', 45], ['net', 35], ['wall', 20]])[0]
          : pick([['net', 44], ['wall', 30], ['goal', 13], ['ball', 8], ['menu', 5]])[0];
        let px, py;
        if (hit === 'wall') {
          const left = chance(0.88);
          px = left ? ballR * between(0.93, 1) : vw - ballR * between(0.93, 1);
          py = L.dotY + L.iconSize * between(-2.4, 1.3);
        } else if (hit === 'goal') {
          const post = chance(0.7) ? L.rightDotX : L.leftDotX;
          const angle = between(-2.6, -0.5);                       // from above
          const reach = (ballR + L.dotRadius) * between(0.93, 1);
          px = post + Math.cos(angle) * reach;
          py = L.dotY + Math.sin(angle) * reach;
        } else if (hit === 'net') {
          const right = chance(0.75);
          const post = right ? L.rightDotX : L.leftDotX;
          const side = chance(0.6) ? (right ? 1 : -1) : (right ? -1 : 1);   // outside face more often than inside
          px = post + side * (L.netWidth / 2 + ballR * between(0.92, 1));
          py = L.dotY + L.iconSize * between(0.05, 1.5);
        } else if (hit === 'menu') {
          const bar = L.menuYs[Math.max(0, CATEGORY_ORDER.indexOf(p.category))];
          px = L.dotCenterX + L.iconSize * between(-0.12, 0.12);
          py = bar - (L.menuHeight / 2 + ballR) * between(0.95, 1);
        } else {
          const other = L.balls[Math.floor(rand() * L.balls.length)];
          const angle = between(0, Math.PI * 2);
          px = other.x + Math.cos(angle) * ballR * 1.95;
          py = other.y + Math.sin(angle) * ballR * 1.95;
        }
        shots.push({
          sid, shot: n, ball: p.name,
          x: Number((px / vw).toFixed(3)), y: Number((py / vh).toFixed(3)),
          hit, vw, vh, days_ago: d, scored: made ? 1 : 0,
        });
      }

      // After the miss hint, people open projects by double-clicking instead.
      const extraOpens = row.hints ? Math.floor(between(0, 4)) : (chance(0.2) ? 1 : 0);
      for (let i = 0; i < extraOpens; i++) {
        row.opens++;
        bump(d, projects[Math.floor(rand() * projects.length)].name, 'opens');
      }
      for (let i = 0; i < row.opens; i++) {
        if (chance(0.32)) { row.ctas++; bump(d, projects[Math.floor(rand() * projects.length)].name, 'ctas'); }
      }
      if (chance(0.1)) row.pv_dash = 1;

      row.duration_s = Math.round(between(25, 70) + total * between(6, 14) + row.opens * between(5, 25));
      row.first_shot_ms = Math.round(between(6000, 26000));
      row.fps_avg = Math.round(desktop ? between(55, 60) : between(44, 60));
      row.fps_min = Math.round(desktop ? between(12, 45) : between(8, 30));
      row.inp = Math.round(between(16, 140));
    }
  }

  const payload = buildPayload(
    {
      sessions: sessions.reverse(),                        // newest first, as the query returns them
      ballDays: [...ballDays.values()].filter((r) => r.days_ago < 90),
      shots: shots.filter((s) => s.days_ago < 90).reverse(),
    },
    { now },
  );
  payload.source = 'sample';
  return payload;
}
