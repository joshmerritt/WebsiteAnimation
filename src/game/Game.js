/**
 * Game.js — Main game orchestrator
 *
 * Owns all state that was previously global in sketch.js:
 * engine, world, balls, goals, nets, menus, boundary, viewport, stats.
 *
 * Instantiated by the p5 sketch function inside GameCanvas.jsx.
 */

import Matter from 'matter-js';
import config from './config.js';
import bus from './EventBus.js';
import Ball from './Ball.js';
import Goal from './Goal.js';
import Net from './Net.js';
import MenuObj from './Menu.js';
import Boundary from './Boundary.js';
import projects from '../data/projects.js';

export default class Game {
  constructor(p) {
    this.p = p;

    // Matter.js
    this.engine = Matter.Engine.create();
    this.world  = this.engine.world;

    // Game objects
    this.balls    = [];
    this.goals    = [];
    this.nets     = [];
    this.menus    = [];
    this.boundary = null;

    // Data
    this.images     = [];
    this.categories = [];

    // Viewport (computed in _computeLayout)
    this.vp = {};

    // State
    this.detailOpen       = false;
    this.selectedCategory = 'All';
    this.showDemo         = true;
    this.totalShots       = 0;
    this.totalMakes       = 0;
    this.totalOpens       = 0;
    this.clickedToOpen    = false;

    // Double-tap tracking (sketch-level, survives mouseReleased)
    this._lastTapTime = 0;
    this._lastTappedBall = null;

    // Listen for React events
    this._unsubs = [
      bus.on('detail:close', () => this._onDetailClosed()),
      bus.on('game:reset', () => this._onReset()),
    ];
  }

  // ── p5 lifecycle ───────────────────────────────────────────────────────

  preload() {
    const p = this.p;
    for (const proj of projects) {
      this.images.push(p.loadImage(`assets/images/${proj.id}.jpg`));
    }
  }

  setup() {
    const p = this.p;
    p.createCanvas(p.windowWidth, p.windowHeight);
    this._computeLayout();
    this._buildWorld();
  }

  draw() {
    const p = this.p;
    Matter.Engine.update(this.engine);
    p.background(config.colors.bg);
    this._drawBackgroundGradient();

    if (!this.detailOpen) {
      this._drawTitle();
      this._drawGoals();
      this.menus.forEach((m) => m.show());
      this.nets.forEach((n) => n.show());
      this._drawHelpMessage();
    }

    if (this.showDemo) {
      this._runDemo();
    } else {
      this._drawBalls();
    }
  }

  windowResized() {
    const p = this.p;
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    this._computeLayout();

    this.balls.forEach((ball) => {
      if (ball.pageOpen) return;
      ball.reset();
    });

    if (!this.detailOpen) {
      this._teardownWorld();
      this._buildWorld();
    }
  }

  // ── Input handlers (called by p5 sketch) ───────────────────────────────

  mousePressed() {
    if (this.detailOpen) return false;
    const p = this.p;

    this.balls.forEach((ball) => {
      ball.display = this.selectedCategory === 'All' || ball.category === this.selectedCategory;

      if (ball.onBall(p.mouseX, p.mouseY)) {
        // Double-tap detection
        const now = Date.now();
        if (this._lastTappedBall === ball && now - this._lastTapTime < config.doubleTapWindow) {
          this._openBallDetail(ball);
          this.clickedToOpen = true;
          this._lastTappedBall = null;
        } else {
          this._lastTapTime = now;
          this._lastTappedBall = ball;
        }
        ball.clicked = true;
      } else {
        ball.clicked = false;
      }
    });
    return false;
  }

  mouseDragged() {
    const powerScale =
      this.vp.portrait || this.vp.mobile
        ? config.powerScaleMobile
        : config.powerScaleDesktop;

    this.balls.forEach((ball) => {
      if (ball.clicked) ball.aim(powerScale);
    });
    return false;
  }

  mouseReleased() {
    const p = this.p;

    // Menu selection
    this.menus.forEach((item) => {
      if (item.onMenu(p.mouseX, p.mouseY)) {
        if (item.selected) {
          item.selected = false;
          this.selectedCategory = 'All';
        } else {
          item.selected = true;
          this.selectedCategory = item.category;
        }
      }
    });
    // Sync menu selection state
    this.menus.forEach((item) => {
      item.selected = this.selectedCategory === item.category;
    });

    if (this.detailOpen) return false;

    this.balls.forEach((ball) => {
      ball.display = this.selectedCategory === 'All' || ball.category === this.selectedCategory;

      if (ball.clicked && (Math.abs(ball.xPower) > config.minLaunchPower || Math.abs(ball.yPower) > config.minLaunchPower)) {
        this._launchBall(ball);
        this.totalShots++;
        this._emitStats();
      }

      ball.clicked = false;
      ball.xPower = 0;
      ball.yPower = 0;
    });
    return false;
  }

  keyPressed() {
    const p = this.p;
    if (this.detailOpen && (p.keyCode === p.BACKSPACE || p.keyCode === p.ESCAPE)) {
      bus.emit('detail:close');
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────

  destroy() {
    this._unsubs.forEach((fn) => fn());
    Matter.Engine.clear(this.engine);
  }

  // ── Private: world management ──────────────────────────────────────────

  _buildWorld() {
    this._createBalls();
    this._createGoals();
    this._createMenus();
    this._createBoundary();
    this._trackCollisions();
  }

  _teardownWorld() {
    this.balls.forEach((b) => {
      try { Matter.Composite.remove(this.world, b.body); } catch (_) { /* already removed */ }
    });
    this.goals.forEach((g) => g.remove());
    this.nets.forEach((n) => n.remove());
    this.menus.forEach((m) => m.remove());
    if (this.boundary) this.boundary.remove();
    this.balls = [];
    this.goals = [];
    this.nets = [];
    this.menus = [];
    this.categories = [];
    this._lastTappedBall = null;
  }

  _createBalls() {
    let gx = this.vp.gridStartX;
    let gy = this.vp.gridStartY;
    const spacing = this.vp.iconSize * config.gridSpacingMultiplier;

    projects.forEach((proj, i) => {
      const ball = new Ball({
        p: this.p,
        world: this.world,
        project: proj,
        img: this.images[i],
        x: gx,
        y: gy,
        size: this.vp.iconSize,
        index: i,
      });
      this.balls.push(ball);

      if (gx + spacing <= this.vp.width) {
        gx += spacing;
      } else if (i < projects.length - 1) {
        gx = this.vp.gridStartX;
        gy += spacing;
      }

      if (!this.categories.includes(proj.category)) {
        this.categories.push(proj.category);
      }
    });
    this.categories.sort((a, b) => b.length - a.length);
  }

  _createGoals() {
    const { goalX, goalY, goalWidth, iconSize } = this.vp;
    const netHeight = 0.4 * this.categories.length * iconSize;

    for (let i = 0; i < 2; i++) {
      this.goals.push(new Goal({
        world: this.world, p: this.p,
        x: goalX + i * goalWidth,
        y: goalY,
        radius: iconSize / 7.5,
        index: i,
      }));
      this.nets.push(new Net({
        world: this.world, p: this.p,
        x: goalX + i * goalWidth,
        y: goalY + netHeight / 2,
        height: netHeight,
        goalWidth,
      }));
    }
  }

  _createMenus() {
    const { goalX, goalWidth, goalY, iconSize } = this.vp;
    this.categories.forEach((cat, i) => {
      this.menus.push(new MenuObj({
        world: this.world, p: this.p,
        position: { x: goalX + goalWidth / 2, y: goalY + (i + 1) * 0.4 * iconSize },
        category: cat,
        index: i,
        goalWidth,
        iconSize,
      }));
    });
  }

  _createBoundary() {
    this.boundary = new Boundary({
      world: this.world,
      width: this.vp.width,
      height: this.vp.height,
      thickness: this.vp.iconSize * 2,
    });
  }

  _trackCollisions() {
    Matter.Events.on(this.engine, 'collisionActive', (event) => {
      if (this.detailOpen) return;

      event.pairs.forEach(({ bodyA, bodyB }) => {
        if (
          bodyA.category && bodyB.category &&
          bodyA.category === bodyB.category &&
          bodyA.id !== bodyB.id
        ) {
          const ballBody = bodyA.label === 'Ball' ? bodyA : bodyB.label === 'Ball' ? bodyB : null;
          if (ballBody?.ballRef) {
            const ball = ballBody.ballRef;
            this._openBallDetail(ball);
            this.totalMakes++;
            this._emitStats();
          }
        }
      });
    });
  }

  // ── Private: actions ───────────────────────────────────────────────────

  _launchBall(ball) {
    const sens  = Math.pow(this.vp.width * this.vp.height, 1 / 3);
    const padj  = this.vp.mobile
      ? Math.pow(this.vp.iconSize, 2.2) * (this.vp.portrait ? 0.95 : 1)
      : Math.pow(this.vp.iconSize, 2);

    const strength = Matter.Vector.create(
      (-ball.xPower * sens) / padj,
      (-ball.yPower * sens) / padj,
    );
    const pos = Matter.Vector.create(ball.x, ball.y);
    const catIdx = this.categories.indexOf(ball.category);

    if (ball.inOriginalPosition) Matter.Composite.add(this.world, ball.body);

    ball.body.collisionFilter = {
      group:    catIdx + 1,
      category: Math.pow(2, catIdx),
      mask:     config.categoryBits[0] | config.categoryBits[1] | config.categoryBits[2],
    };
    Matter.Body.setStatic(ball.body, false);
    Matter.Body.applyForce(ball.body, pos, strength);
    ball.launched();
  }

  _openBallDetail(ball) {
    const data = ball.openDetail();
    if (!data) return; // already open
    this.totalOpens++;
    this.detailOpen = true;
    this._emitStats();
    bus.emit('detail:open', data);
  }

  _onDetailClosed() {
    this.detailOpen = false;
    this.selectedCategory = 'All';
    this.balls.forEach((ball) => {
      ball.display = true;
      ball.closeDetail();
      if (!ball.inOriginalPosition) ball.reset();
    });
  }

  _onReset() {
    this.windowResized();
  }

  _emitStats() {
    bus.emit('stats:update', {
      shots: this.totalShots,
      makes: this.totalMakes,
      opens: this.totalOpens,
    });
  }

  // ── Private: drawing ───────────────────────────────────────────────────

  _drawBackgroundGradient() {
    const p = this.p;
    const ctx = p.drawingContext;
    ctx.save();
    const grad = ctx.createRadialGradient(
      this.vp.width * 0.7, this.vp.height * 0.5, 0,
      this.vp.width * 0.7, this.vp.height * 0.5,
      Math.max(this.vp.width, this.vp.height) * 0.65,
    );
    grad.addColorStop(0, 'rgba(40, 60, 90, 0.10)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.vp.width, this.vp.height);
    ctx.restore();
  }

  _drawGoals() {
    if (this.goals.length >= 2) {
      const g0 = this.goals[0];
      const g1 = this.goals[1];
      const rimY = g0.body.position.y - g0.radius * 1.5;
      const p = this.p;
      p.push();
      p.stroke(config.colors.accent);
      p.strokeWeight(g0.radius * 0.6);
      p.noFill();
      p.line(g0.body.position.x, rimY, g1.body.position.x, rimY);
      p.pop();
    }
    this.goals.forEach((g) => g.show());
  }

  _drawBalls() {
    if (this.detailOpen) return;

    const p = this.p;
    this.balls.forEach((ball) => {
      if (!ball.display) return;

      ball.show(this.vp);

      if (p.mouseIsPressed) {
        if (ball.clicked) ball.aim(
          this.vp.portrait || this.vp.mobile
            ? config.powerScaleMobile
            : config.powerScaleDesktop,
        );
      } else {
        if (ball.onBall(p.mouseX, p.mouseY)) ball.hover(this.vp.iconSize, this.totalShots);
        if (!ball.clicked) {
          ball.xPower = 0;
          ball.yPower = 0;
        }
      }
    });
    this._captureWebsite();
  }

  _runDemo() {
    const ball = this.balls[0];
    if (!ball) return;
    ball.xPower += this.vp.power / 100;
    ball.yPower += this.vp.power / 80;
    ball.demoAim();
    if (ball.xPower > this.vp.power) {
      this._launchBall(ball);
      this.showDemo = false;
    }
  }

  _drawTitle() {
    const p = this.p;
    const { iconSize, portrait, width, height } = this.vp;
    const ctx = p.drawingContext;

    if (portrait) {
      const splitTitle = config.titleText.replace('.', '').split(', ');
      const splitSub   = config.subtitleText.split('. ');
      const titleSize  = iconSize / 2.5;
      const subSize    = iconSize / 4;
      const xPos       = width / 8;
      const yStart     = height * 0.07;

      // Gradient panel
      const panelX = xPos - iconSize * 0.22;
      const panelY = yStart - titleSize * 0.85;
      const panelW = width * 0.38;
      const panelH = titleSize * (splitTitle.length * 1.15 + splitSub.length + 0.8);

      ctx.save();
      const grad = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY);
      grad.addColorStop(0, 'rgba(89, 133, 177, 0.07)');
      grad.addColorStop(1, 'rgba(89, 133, 177, 0)');
      ctx.fillStyle = grad;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 6);
        ctx.fill();
      } else {
        ctx.fillRect(panelX, panelY, panelW, panelH);
      }

      // Accent line
      ctx.strokeStyle = 'rgba(89, 133, 177, 0.65)';
      ctx.lineWidth   = 2;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(panelX + 1, panelY + 6);
      ctx.lineTo(panelX + 1, panelY + panelH - 6);
      ctx.stroke();
      ctx.restore();

      p.push();
      p.textFont('Syne');
      splitTitle.forEach((item, i) => {
        p.textSize(titleSize);
        p.textStyle(i === 0 ? p.NORMAL : p.BOLD);
        p.fill(i === 0 ? 'rgba(199, 214, 213, 0.7)' : config.colors.main);
        p.text(item, xPos + 6, yStart + titleSize * 1.15 * i);
      });
      p.textSize(subSize);
      p.textStyle(p.NORMAL);
      p.textFont('DM Sans');
      splitSub.forEach((item, i) => {
        p.fill(config.colors.secondary);
        p.text(item, xPos + 6, yStart + titleSize * splitTitle.length * 1.15 + i * titleSize);
      });
      p.pop();
    } else {
      const xPos      = width / 8;
      const titleSize = iconSize / 2.5;
      const subSize   = iconSize / 4;
      const yTitle    = height / 6;
      const ySub      = height / 4.2;

      // Accent line
      ctx.save();
      ctx.strokeStyle = 'rgba(89, 133, 177, 0.65)';
      ctx.lineWidth   = 2;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(xPos - iconSize * 0.14, yTitle - titleSize * 0.8);
      ctx.lineTo(xPos - iconSize * 0.14, ySub + subSize * 0.5);
      ctx.stroke();
      ctx.restore();

      p.push();
      p.textFont('Syne');
      p.textSize(titleSize);
      p.textStyle(p.BOLD);
      p.fill(config.colors.main);
      p.text(config.titleText, xPos, yTitle);
      p.textFont('DM Sans');
      p.textSize(subSize);
      p.textStyle(p.NORMAL);
      p.fill(config.colors.secondary);
      p.text(config.subtitleText, xPos, ySub);
      p.pop();
    }
  }

  _drawHelpMessage() {
    if (this.totalShots > 2 && this.totalShots < 10 && !this.clickedToOpen && !this.detailOpen) {
      const p = this.p;
      const yPos = this.vp.portrait ? this.vp.height * 0.9 : this.vp.height * 0.85;
      p.push();
      p.textFont('DM Sans');
      p.textSize(this.vp.iconSize / 6);
      p.fill(config.colors.main);
      p.text("Double click the image if you're tired of playing.", this.vp.width / 8, yPos);
      p.pop();
    }
  }

  _captureWebsite() {
    // Ball index 4 is 'thisWebsite' — capture the canvas as its image
    const thisSiteBall = this.balls.find((b) => b.project.id === 'thisWebsite');
    if (thisSiteBall) {
      const minDim = Math.min(this.vp.width, this.vp.height);
      const cap = this.p.get(0, 0, minDim, minDim);
      thisSiteBall.ballImage = cap;
      thisSiteBall.fullImage = cap;
    }
  }

  // ── Private: layout computation ────────────────────────────────────────

  _computeLayout() {
    const w = this.p.windowWidth;
    const h = this.p.windowHeight;
    const portrait = h > w;
    const mobile   = Math.max(h, w) <= 1000;
    const area     = w * h;
    const iconSize = Math.min(w / config.iconScale, h / config.iconScale);

    let power = Math.sqrt(iconSize) * (area / 350000);
    if (mobile) {
      power = portrait
        ? area / Math.pow(iconSize, 2.7)
        : area / Math.pow(iconSize, 3);
    }

    const goalX = 0.33 * iconSize;
    const goalY = h * 0.4;
    const goalWidth = iconSize * 1.4;
    const gridStartX = goalX + goalWidth + 2 * iconSize;
    let gridStartY = goalY;
    if (portrait) gridStartY -= iconSize;

    this.vp = {
      width: w,
      height: h,
      portrait,
      mobile,
      area,
      iconSize,
      power,
      goalX,
      goalY,
      goalWidth,
      gridStartX,
      gridStartY,
    };
  }
}
