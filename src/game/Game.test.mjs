/**
 * The scoring path: what counts as a make, and when the project panel opens.
 * Run with `npm test`.
 *
 * The game cannot be played in a test (it needs p5 and a canvas), but its
 * rules can be run: these build a Game and its Balls without their
 * constructors, hand `_handleCollisions` the same `{ pairs }` objects Matter
 * emits, and step the game's clock by hand. Every rule here was a real bug
 * first: the intro demo counted as a visitor's make, one contact counted as
 * several, and the panel opened before the visitor saw the ball land.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import Game from './Game.js';
import Ball from './Ball.js';
import config from './config.js';
import bus from './EventBus.js';

let nextId = 1;

/** A Game with only the state the scoring path reads, and a clock we control. */
function makeGame() {
  const game = Object.create(Game.prototype);
  Object.assign(game, {
    p: { mouseX: -1, mouseY: -1 },
    balls: [], menus: [],
    detailOpen: false, _pendingOpen: null,
    totalShots: 0, totalMakes: 0, totalOpens: 0, consecutiveMisses: 0,
    currentPage: 0, ballsPerPage: 999, selectedCategory: 'All',
  });
  let now = 5000;
  game._now = () => now;
  /** Let `ms` pass, running the per-frame check the way draw() does. */
  game.wait = (ms) => { now += ms; game._tickScorePause(); };
  return game;
}

function makeBall(game, name, category, extra = {}) {
  const ball = Object.create(Ball.prototype);
  Object.assign(ball, {
    project: { id: name, name, category, link: `https://example.test/${name}` },
    imageSrc: '', index: game.balls.length,
    pageOpen: false, makes: 0, launchCount: 1,
    clicked: false, xPower: 0, yPower: 0,
    inOriginalPosition: false, _demoShot: false, _shotPending: true,
    ...extra,
  });
  ball.body = { id: nextId++, label: 'Ball', category, ballRef: ball };
  game.balls.push(ball);
  return ball;
}

/** The category bar a ball has to land on, as Matter reports it. */
const bar = (category) => ({ id: nextId++, label: `Menu_${category}`, category });
const contact = (...pairs) => ({ pairs: pairs.map(([a, b]) => ({ bodyA: a, bodyB: b })) });

/** Record what the game announces, in order. */
function listen() {
  const log = [];
  const offs = ['ball:scored', 'detail:open', 'miss:hint'].map((name) =>
    bus.on(name, (data) => log.push({ name, data })));
  return {
    log,
    count: (name) => log.filter((e) => e.name === name).length,
    stop: () => offs.forEach((off) => off()),
  };
}

test('a make is counted as the ball lands; the panel opens only after the pause', () => {
  const game = makeGame();
  const ball = makeBall(game, 'Coop', 'Technology');
  const heard = listen();
  try {
    game.totalShots = 1;
    game._handleCollisions(contact([ball.body, bar('Technology')]));

    // Landed: the scoreboard and analytics know at once…
    assert.equal(game.totalMakes, 1);
    assert.equal(ball.makes, 1);
    assert.equal(ball._shotPending, false);
    assert.equal(heard.count('ball:scored'), 1);
    assert.equal(heard.log.find((e) => e.name === 'ball:scored').data.ballMakes, 1, 'the score reports this make');
    // …but the playground stays in view.
    assert.equal(game.detailOpen, false);
    assert.equal(heard.count('detail:open'), 0);

    game.wait(config.scorePause - 1);
    assert.equal(game.detailOpen, false, 'still closed just before the pause ends');

    game.wait(1);
    assert.equal(game.detailOpen, true);
    assert.equal(heard.count('detail:open'), 1);
    assert.equal(heard.log.at(-1).data.name, 'Coop');
    assert.equal(heard.log.at(-1).data.demo, undefined);
    assert.equal(game.totalOpens, 1);
    // Opening the panel must not count the make a second time.
    assert.equal(game.totalMakes, 1);
    assert.equal(ball.makes, 1);
    assert.deepEqual(heard.log.map((e) => e.name), ['miss:hint', 'ball:scored', 'detail:open'], 'score first, then the panel');
  } finally {
    heard.stop();
  }
});

test('the pause is a real one: a noticeable part of a second, not a frame and not a wait', () => {
  assert.ok(config.scorePause >= 250, 'long enough to see the ball land');
  assert.ok(config.scorePause <= 800, 'short enough not to read as a hang');
});

test('a ball resting on its bar for the whole pause is one make, however often Matter reports it', () => {
  const game = makeGame();
  const ball = makeBall(game, 'Coop', 'Technology');
  const target = bar('Technology');
  const heard = listen();
  try {
    // One collision event can carry several pairs for the same ball…
    game._handleCollisions(contact([ball.body, target], [target, ball.body], [ball.body, target]));
    // …and collisionActive repeats on every frame the ball stays in contact.
    for (let frame = 0; frame < 20; frame++) {
      game.wait(1000 / 60);
      game._handleCollisions(contact([ball.body, target]));
    }
    assert.equal(game.totalMakes, 1);
    assert.equal(ball.makes, 1);
    assert.equal(heard.count('ball:scored'), 1);

    game.wait(config.scorePause);
    game._handleCollisions(contact([ball.body, target]));   // still touching once the panel is up
    assert.equal(game.totalMakes, 1);
    assert.equal(game.totalOpens, 1);
    assert.equal(heard.count('detail:open'), 1);
  } finally {
    heard.stop();
  }
});

test('a second ball cannot score while the first is waiting to open', () => {
  const game = makeGame();
  const first = makeBall(game, 'Coop', 'Technology');
  const second = makeBall(game, 'Darts', 'Play');
  const heard = listen();
  try {
    game._handleCollisions(contact([first.body, bar('Technology')]));
    game.wait(100);
    game._handleCollisions(contact([second.body, bar('Play')]));

    assert.equal(game.totalMakes, 1);
    assert.equal(second.makes, 0);
    assert.equal(second._shotPending, true, 'its shot is still unresolved, not a make');

    game.wait(config.scorePause);
    assert.equal(heard.count('detail:open'), 1);
    assert.equal(heard.log.at(-1).data.name, 'Coop', 'the panel is the first ball\'s');
  } finally {
    heard.stop();
  }
});

test('the intro demo waits the same beat, and still counts nowhere', () => {
  const game = makeGame();
  const demo = makeBall(game, 'Josh Merritt', 'Me', { _demoShot: true, _shotPending: false, launchCount: 0 });
  const target = bar('Me');
  const heard = listen();
  try {
    game._handleCollisions(contact([demo.body, target], [demo.body, target]));
    assert.equal(game.detailOpen, false, 'the demo does not snap the panel open either');

    game.wait(config.scorePause);
    assert.equal(game.detailOpen, true);
    assert.equal(heard.count('detail:open'), 1);
    assert.equal(heard.log.at(-1).data.demo, true, 'flagged so analytics listeners skip it');

    // Not the visitor's shot: no make, no open, no score event.
    assert.equal(game.totalMakes, 0);
    assert.equal(game.totalOpens, 0);
    assert.equal(demo.makes, 0);
    assert.equal(heard.count('ball:scored'), 0);
  } finally {
    heard.stop();
  }
});

test('nothing new can start during the pause', () => {
  const game = makeGame();
  const scored = makeBall(game, 'Coop', 'Technology');
  // A second ball the visitor was already aiming when the first one landed.
  const aimed = makeBall(game, 'Darts', 'Play', { inOriginalPosition: true, _shotPending: false, clicked: true, xPower: 80, yPower: 80 });
  const heard = listen();
  try {
    game._handleCollisions(contact([scored.body, bar('Technology')]));

    assert.equal(game.mousePressed(), false, 'a press (or double-click) is ignored');
    assert.equal(game.mouseReleased(), false);
    assert.equal(game.totalShots, 0, 'releasing does not launch the aimed ball');
    assert.equal(game.detailOpen, false);

    game.wait(config.scorePause);
    assert.equal(heard.count('detail:open'), 1, 'and exactly one panel opens');
  } finally {
    heard.stop();
  }
});

test('a scored ball that drops off the screen during the pause is not a miss', () => {
  const game = makeGame();
  const ball = makeBall(game, 'Coop', 'Technology');
  const heard = listen();
  try {
    game.consecutiveMisses = 2;
    game._handleCollisions(contact([ball.body, bar('Technology')]));
    game._onBallExit(ball);

    assert.equal(game.consecutiveMisses, 0, 'the make cleared the run of misses, and leaving did not add one');
    assert.ok(!heard.log.some((e) => e.name === 'miss:hint' && e.data === true));

    game.wait(config.scorePause);
    assert.equal(game.detailOpen, true, 'the panel still opens');
  } finally {
    heard.stop();
  }
});

test('a resize during the pause opens the panel at once instead of losing the ball', () => {
  const game = makeGame();
  const ball = makeBall(game, 'Coop', 'Technology');
  // windowResized() rebuilds the layout; none of that is under test here.
  game.p = { pixelDensity: () => 1, resizeCanvas() {}, windowWidth: 800, windowHeight: 600 };
  game._targetPixelDensity = () => 1;
  game._computeLayout = () => {};
  let rebuilt = false;
  game._teardownWorld = () => { rebuilt = true; };
  game._buildWorld = () => {};
  ball.reset = () => { throw new Error('the scored ball must not be reset while its panel is opening'); };
  const heard = listen();
  try {
    game._handleCollisions(contact([ball.body, bar('Technology')]));
    game.windowResized();

    assert.equal(game._pendingOpen, null);
    assert.equal(game.detailOpen, true);
    assert.equal(heard.count('detail:open'), 1);
    assert.equal(rebuilt, false, 'the world is left alone while a panel is open');

    game.wait(config.scorePause * 2);
    assert.equal(heard.count('detail:open'), 1, 'and it does not open a second time later');
  } finally {
    heard.stop();
  }
});

test('opening by double-click is immediate and is not a make on the scoreboard', () => {
  const game = makeGame();
  const ball = makeBall(game, 'Coop', 'Technology', { inOriginalPosition: true, _shotPending: false });
  const heard = listen();
  try {
    assert.equal(game._openBallDetail(ball), true);
    assert.equal(game.detailOpen, true, 'no pause on this path');
    assert.equal(game.totalOpens, 1);
    assert.equal(game.totalMakes, 0);
    assert.equal(heard.count('ball:scored'), 0);
    assert.equal(game._openBallDetail(ball), false, 'already open');
    assert.equal(game.totalOpens, 1);
  } finally {
    heard.stop();
  }
});
