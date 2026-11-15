/**
 * court.js mirrors the game's layout maths (it can't import the Game class).
 * These tests pin that copy to first contacts recorded in REAL sessions: if the
 * mirror is right, a ball that touched a goal post was one ball radius plus one
 * post radius away from it, and a ball that touched a wall was one ball radius
 * off it. Matter reports the contact a frame late, after the ball has sunk in a
 * few pixels, so the measured distance is a little under the ideal one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout, placeShot, shotViewport, courtKind, COURTS } from './court.js';
import config from '../../game/config.js';

// impact_x / impact_y from PostHog `ball_impact` events, with the viewport they
// were recorded on. Captured 2026-11-14 from the Website project.
const REAL = [
  { vw: 2347, vh: 1180, x: 0.152, y: 0.309, hit: 'goal' },
  { vw: 2347, vh: 1180, x: 0.153, y: 0.309, hit: 'goal' },
  { vw: 2347, vh: 1180, x: 0.035, y: 0.226, hit: 'wall' },
  { vw: 2347, vh: 1180, x: 0.034, y: -0.085, hit: 'wall' },
  { vw: 1640, vh: 997,  x: 0.041, y: 0.211, hit: 'wall' },
  { vw: 1640, vh: 997,  x: 0.04,  y: 0.032, hit: 'wall' },
];

const within = (value, lo, hi, what) =>
  assert.ok(value >= lo && value <= hi, `${what}: ${value.toFixed(3)} not in [${lo}, ${hi}]`);

test('goal-post contacts sit one ball radius + one post radius from a post', () => {
  for (const s of REAL.filter((r) => r.hit === 'goal')) {
    const L = computeLayout(s.vw, s.vh);
    const [px, py] = [s.x * s.vw, s.y * s.vh];
    const nearest = Math.min(
      Math.hypot(px - L.leftDotX, py - L.dotY),
      Math.hypot(px - L.rightDotX, py - L.dotY),
    );
    within(nearest / (L.iconSize / 2 + L.dotRadius), 0.9, 1.02, `${s.vw}×${s.vh} post contact`);
  }
});

test('wall contacts sit one ball radius off the wall', () => {
  for (const s of REAL.filter((r) => r.hit === 'wall')) {
    const L = computeLayout(s.vw, s.vh);
    within((s.x * s.vw) / (L.iconSize / 2), 0.88, 1.02, `${s.vw}×${s.vh} wall contact`);
  }
});

test('the three layouts match the game\'s branch conditions', () => {
  assert.equal(courtKind(1440, 900), 'desktop');
  assert.equal(courtKind(1001, 1000), 'desktop');
  assert.equal(courtKind(844, 390), 'landscape');
  assert.equal(courtKind(390, 844), 'portrait');
  assert.equal(courtKind(1200, 1600), 'portrait', 'a tall desktop window uses the portrait layout');
  for (const [kind, { ref }] of Object.entries(COURTS)) assert.equal(courtKind(...ref), kind);
});

test('geometry is ordered sensibly on every layout', () => {
  for (const [w, h] of [[1440, 900], [2347, 1180], [1640, 997], [390, 844], [402, 670], [844, 390], [1024, 768]]) {
    const L = computeLayout(w, h);
    assert.ok(L.iconSize > 0, `${w}×${h} icon size`);
    assert.ok(L.leftDotX < L.rightDotX, `${w}×${h} posts`);
    assert.ok(L.dotY < L.menuYs[0] && L.menuYs.at(-1) < L.netBottomY, `${w}×${h} goal stack`);
    assert.equal(L.menuYs.length, 4);
    assert.equal(L.balls.length, 8);
    assert.ok(L.balls.every((b) => b.x > L.rightDotX && b.x < w && b.y > 0 && b.y < h), `${w}×${h} balls on screen, right of the goal`);
    assert.equal(L.balls[0].y, L.dotY, 'posts are level with the top row of balls');
  }
});

test('placing a shot on its own court is the identity', () => {
  const ref = computeLayout(1440, 900);
  for (const hit of ['wall', 'goal', 'net', 'menu', 'ball', 'unknown']) {
    const { cx, cy } = placeShot({ x: 0.31, y: 0.42, vw: 1440, vh: 900, hit }, ref);
    within(cx, 0.31 * 1440 - 1e-6, 0.31 * 1440 + 1e-6, `${hit} x`);
    within(cy, 0.42 * 900 - 1e-6, 0.42 * 900 + 1e-6, `${hit} y`);
  }
});

test('shots from other screens keep their distance from what they hit', () => {
  const ref = computeLayout(...COURTS.desktop.ref);
  const ballR = ref.iconSize / 2;

  // Wall hits from a 2:1 monitor still land one ball radius off the reference wall.
  for (const s of REAL.filter((r) => r.hit === 'wall')) {
    within(placeShot(s, ref).cx / ballR, 0.88, 1.02, 'wall hit on reference court');
  }
  // Post contacts stay on the rim of the reference post.
  for (const s of REAL.filter((r) => r.hit === 'goal')) {
    const { cx, cy } = placeShot(s, ref);
    const d = Math.hypot(cx - ref.rightDotX, cy - ref.dotY);
    within(d / (ballR + ref.dotRadius), 0.9, 1.02, 'post contact on reference court');
  }
  // A right-wall hit is measured from the right wall.
  const right = placeShot({ x: 0.96, y: 0.3, vw: 2347, vh: 1180, hit: 'wall' }, ref);
  assert.ok(right.cx > ref.width - ballR * 1.2 && right.cx < ref.width, 'right wall');
  // Above-screen contacts keep a negative height.
  assert.ok(placeShot(REAL[3], ref).cy < 0);
});

test('a shot keeps its place when its screen arrives as a shape instead of exact pixels', () => {
  // The worker sends other visitors' screens as an aspect ratio (2 decimals) and
  // the long side rounded up to 100px. Same rounding as aggregate.js.
  const coarse = ({ vw, vh, ...rest }) => {
    let ar = Math.round((vw / vh) * 100) / 100;
    ar = vh > vw ? Math.min(ar, 0.99) : Math.max(ar, 1);
    return { ...rest, ar, long: Math.ceil(Math.max(vw, vh) / 100) * 100 };
  };
  const cases = [
    ...REAL,
    { vw: 390, vh: 844, x: 0.2, y: 0.25, hit: 'net' },
    { vw: 412, vh: 915, x: 0.1, y: 0.4, hit: 'wall' },
    { vw: 844, vh: 390, x: 0.12, y: 0.55, hit: 'goal' },
    { vw: 1920, vh: 1080, x: 0.6, y: 0.7, hit: 'ball' },
    { vw: 1024, vh: 768, x: 0.09, y: 0.45, hit: 'menu' },
  ];
  for (const s of cases) {
    const [w, h] = shotViewport(coarse(s));
    assert.equal(courtKind(w, h), courtKind(s.vw, s.vh), `${s.vw}×${s.vh} keeps its layout`);

    const ref = computeLayout(...COURTS[courtKind(s.vw, s.vh)].ref);
    const exact = placeShot(s, ref);
    const rebuilt = placeShot(coarse(s), ref);
    // Within 3% of a ball diameter: invisible at the size the court is drawn.
    within(Math.hypot(exact.cx - rebuilt.cx, exact.cy - rebuilt.cy) / ref.iconSize, 0, 0.03, `${s.vw}×${s.vh} ${s.hit} drift`);
  }
  assert.deepEqual(shotViewport({ vw: 1280, vh: 800, ar: 9, long: 9 }), [1280, 800], 'exact pixels win when present');
});

test('balls are drawn at the size the game draws them', () => {
  const scale = config.portraitBallScale ?? 1;
  const portrait = computeLayout(390, 844);
  assert.equal(portrait.ballRadius, (portrait.iconSize / 2) * scale);
  const desktop = computeLayout(1440, 900);
  assert.equal(desktop.ballRadius, desktop.iconSize / 2, 'only portrait shrinks its balls');
});
