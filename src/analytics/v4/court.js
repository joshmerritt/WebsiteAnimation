/**
 * court.js — The playground's geometry, for drawing the shot chart.
 *
 * ⚠ computeLayout() MIRRORS Game._computeLayout(), _createGoals() and
 * _createMenus() in src/game/Game.js. It is a copy, not an import, because the
 * Game class can't be loaded without p5 and matter-js. If the game's layout
 * maths changes, change it here too — otherwise the goal on the shot chart
 * drifts away from where the shots actually landed. court.test.mjs pins it to
 * recorded contacts from real sessions (a 'goal' first contact must sit one
 * ball radius + one post radius from a post), so drift shows up in `npm test`
 * once newer shots are added there.
 *
 * Why the layout is needed at all: shots are recorded as fractions of the
 * visitor's own viewport, and the goal sits at a different fraction on every
 * screen shape. To put shots from a 2347×1180 monitor and a 1640×997 laptop on
 * one court, each shot is re-expressed against its own goal first.
 */

import config from '../../game/config.js';

/** The game's three layout branches, keyed the way the dashboard labels them. */
export const COURTS = {
  desktop:   { label: 'Desktop', ref: [1440, 900] },
  portrait:  { label: 'Phone',   ref: [390, 844] },
  landscape: { label: 'Phone (landscape)', ref: [844, 390] },
};

/** Which branch of the game's layout a viewport gets. Same tests as the game. */
export function courtKind(w, h) {
  if (h > w) return 'portrait';
  if (Math.max(w, h) <= 1000) return 'landscape';
  return 'desktop';
}

/**
 * Everything needed to draw the court for a viewport, in that viewport's pixels.
 * `projectCount` and `categoryCount` come from src/data/projects.js.
 */
export function computeLayout(w, h, projectCount = 8, categoryCount = 4) {
  const kind = courtKind(w, h);
  let iconSize, gridCols, gridRows, spacing, dotCenterX, gridStartX, gridStartY;

  if (kind === 'portrait') {
    gridCols = 2;
    gridRows = Math.ceil(projectCount / gridCols);
    const titleZoneBottom = h * 0.15;
    const goalX = w * 0.04;
    const goalWidth = w * 0.18;
    const totalVertical = 0.8 + (gridRows - 1) * 1.30 + 0.5 + 1.0;
    iconSize = Math.min((h - titleZoneBottom) / totalVertical, (w * 0.55) / (gridCols * 1.30));
    const dotSpan = iconSize * 1.3;
    const dotRadius = iconSize / 15;
    dotCenterX = Math.max(dotSpan / 2 + iconSize / 5, goalX + goalWidth / 2);
    const rightDotEdge = dotCenterX + dotSpan / 2 + dotRadius;
    const availW = w - rightDotEdge;
    const gap = Math.max((availW - gridCols * iconSize) / (gridCols + 1), iconSize * 0.08);
    const totalGridW = gridCols * iconSize + (gridCols - 1) * gap;
    gridStartX = rightDotEdge + (availW - totalGridW) / 2 + iconSize / 2;
    spacing = iconSize + gap;
    gridStartY = titleZoneBottom + iconSize * 0.8;
  } else if (kind === 'landscape') {
    gridCols = Math.ceil(projectCount / 2);
    gridRows = Math.ceil(projectCount / gridCols);
    const goalX = w * 0.02;
    const goalWidth = w * 0.09;
    const titleZoneBottom = h * 0.35;
    const totalVertical = 0.65 + (gridRows - 1) * 1.20 + 0.5 + 0.7;
    const iconFromH = (h - titleZoneBottom) / totalVertical;
    const menuAreaW = goalX + goalWidth / 2 + (iconFromH * 1.3) / 2 + iconFromH * 0.3;
    const iconFromW = (w - menuAreaW) / (gridCols * 1.20 + 0.5);
    iconSize = Math.min(iconFromH, iconFromW, Math.min(w / 10, h / 3.2));
    spacing = iconSize * 1.20;
    const dotSpan = iconSize * 1.3;
    const dotRadius = iconSize / 15;
    dotCenterX = Math.max(dotSpan / 2 + dotRadius + 4, goalX + goalWidth / 2);
    const menuRightEdge = dotCenterX + dotSpan / 2 + dotRadius + iconSize * 0.15;
    const gridW = (gridCols - 1) * spacing;
    gridStartX = Math.max(menuRightEdge + iconSize * 0.7, (menuRightEdge + w) / 2 - gridW / 2);
    gridStartY = titleZoneBottom + iconSize * 0.65;
  } else {
    gridCols = 3;
    gridRows = Math.ceil(projectCount / gridCols);
    const goalX = w * 0.03;
    const goalWidth = w * 0.12;
    const titleZoneBottom = h * 0.28;
    const totalVertical = 0.7 + (gridRows - 1) * 1.30 + 0.5 + 1.2;
    iconSize = Math.min((h - titleZoneBottom) / totalVertical, Math.min(w / 7, h / 4));
    spacing = iconSize * 1.30;
    const dotSpan = iconSize * 1.3;
    const dotRadius = iconSize / 15;
    dotCenterX = goalX + goalWidth / 2;
    const menuRightEdge = dotCenterX + dotSpan / 2 + dotRadius + iconSize * 0.15;
    const gridW = (gridCols - 1) * spacing;
    gridStartX = Math.max(menuRightEdge + iconSize, w / 2 - gridW / 2);
    gridStartY = titleZoneBottom + iconSize * 0.7;
  }

  // ── Goal: two posts, a net barrier under each, category bars between ──
  const dotSpan = iconSize * 1.3;
  const dotRadius = iconSize / 15;
  const dotY = gridStartY;                       // posts sit level with the top row of balls
  const leftDotX = Math.min(dotCenterX - dotSpan / 2, dotRadius + iconSize * 0.4);
  const rightDotX = dotCenterX + dotSpan / 2;
  const menuStartY = gridStartY + dotRadius * 2 + iconSize * 0.35;
  const menuYs = Array.from({ length: categoryCount }, (_, i) => menuStartY + i * 0.4 * iconSize);
  const netBottomY = menuYs[menuYs.length - 1] + iconSize * 0.1;

  // ── Balls: where each project starts, in projects.js order ──
  const balls = [];
  for (let i = 0; i < projectCount; i++) {
    balls.push({
      x: gridStartX + (i % gridCols) * spacing,
      y: gridStartY + Math.floor(i / gridCols) * spacing,
    });
  }

  // Portrait draws its balls smaller than the grid slot they sit in (when the
  // game's config sets portraitBallScale). The goal and grid do not shrink.
  const ballRadius = (iconSize / 2) * (kind === 'portrait' ? (config.portraitBallScale ?? 1) : 1);

  return {
    kind, width: w, height: h, iconSize, ballRadius,
    dotCenterX, dotSpan, dotRadius, dotY, leftDotX, rightDotX,
    netWidth: dotSpan / 8, netBottomY,
    menuYs, menuWidth: dotSpan, menuHeight: iconSize / 5,
    balls, gridCols, spacing,
  };
}

/**
 * The viewport a shot was recorded on, as [width, height].
 *
 * The viewer's own shots carry it exactly (vw, vh). Everyone else's arrive from
 * the worker as a shape only — aspect ratio `ar` and the long side rounded up to
 * 100px — because an exact screen size is distinctive enough to single out one
 * visitor. The game's layout is almost entirely ratios, so the rebuilt viewport
 * gives the same court to within a fraction of a percent.
 */
export function shotViewport(shot) {
  if (shot.vw > 0 && shot.vh > 0) return [shot.vw, shot.vh];
  const long = shot.long > 0 ? shot.long : 1400;
  return shot.ar >= 1 ? [long, long / shot.ar] : [long * shot.ar, long];
}

/**
 * Place a shot recorded on one viewport onto a reference court.
 *
 * A first contact sits on the surface of whatever the ball hit, so each shot is
 * measured from THAT thing, in ball diameters, and re-drawn the same distance
 * from the same thing on the reference court:
 *
 *   wall          → from the wall it hit
 *   goal / net    → from the nearer post (the nets hang under the posts)
 *   category bar  → from the centre of the goal
 *   another ball  → from the ball grid, in grid spacings
 *
 * That keeps a wall hit exactly one ball radius off the wall and a rim clip on
 * the rim, whatever screen it came from. (Scaling by screen fraction instead
 * smears them: the left post sits 0.35 ball diameters from the wall on a 16:10
 * screen and 0.47 on a 2:1 one.) Height is always measured from the goal line.
 *
 * `shot` is { x, y, hit } plus its viewport (see shotViewport), with x/y as
 * fractions of that viewport; `ref` is a computeLayout() result. Returns
 * { cx, cy } in the reference court's px.
 */
export function placeShot(shot, ref, projectCount, categoryCount) {
  const [vw, vh] = shotViewport(shot);
  const own = vw === ref.width && vh === ref.height
    ? ref
    : computeLayout(vw, vh, projectCount, categoryCount);

  const px = shot.x * own.width;
  const py = shot.y * own.height;

  if (shot.hit === 'ball') {
    const [o, r] = [own.balls[0], ref.balls[0]];
    return {
      cx: r.x + ((px - o.x) / own.spacing) * ref.spacing,
      cy: r.y + ((py - o.y) / own.spacing) * ref.spacing,
    };
  }

  let from, to;   // the landmark's x on the visitor's court and on the reference
  if (shot.hit === 'wall') {
    const left = px < own.width / 2;
    [from, to] = left ? [0, 0] : [own.width, ref.width];
  } else if (shot.hit === 'goal' || shot.hit === 'net') {
    const left = Math.abs(px - own.leftDotX) < Math.abs(px - own.rightDotX);
    [from, to] = left ? [own.leftDotX, ref.leftDotX] : [own.rightDotX, ref.rightDotX];
  } else {
    [from, to] = [own.dotCenterX, ref.dotCenterX];
  }

  return {
    cx: to + ((px - from) / own.iconSize) * ref.iconSize,
    cy: ref.dotY + ((py - own.dotY) / own.iconSize) * ref.iconSize,
  };
}

/** What the ball touched first, in words. Keys are Game._classifyBody() values. */
export const HIT_LABELS = {
  net:     'Net',
  wall:    'Side wall',
  goal:    'Goal post',
  menu:    'Category bar',
  ball:    'Another ball',
  unknown: 'Something else',
};
