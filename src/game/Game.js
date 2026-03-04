/**
 * Game.js — Main game orchestrator
 *
 * Owns all state: engine, world, balls, goals, nets, menus, boundary, viewport, stats.
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

    this.engine = Matter.Engine.create();
    this.world  = this.engine.world;

    this.balls    = [];
    this.goals    = [];
    this.nets     = [];
    this.menus    = [];
    this.boundary = null;

    this.images     = [];
    this.categories = [];

    this.vp = {};

    this.detailOpen       = false;
    this.selectedCategory = 'All';
    this.showDemo         = true;
    this.totalShots       = 0;
    this.totalMakes       = 0;
    this.totalOpens       = 0;
    this.clickedToOpen    = false;
    this.consecutiveMisses = 0;

    this.currentPage      = 0;
    this.ballsPerPage     = 999;

    this._loaded = false;
    this._loadProgress = 0;

    this._lastTapTime = 0;
    this._lastTappedBall = null;
    this._lastReleaseTime = 0;
    this._aimingCategory = null;
    this._hoverHintCount = 0;
    this._currentHoveredBall = null;

    this._unsubs = [
      bus.on('detail:close', () => this._onDetailClosed()),
      bus.on('game:reset', () => this._onReset()),
    ];

    this._collisionHandler = (event) => this._handleCollisions(event);
    Matter.Events.on(this.engine, 'collisionActive', this._collisionHandler);
  }

  // ── p5 lifecycle ───────────────────────────────────────────────────────

  preload() {
    const p = this.p;
    const total = projects.length;
    let loaded = 0;
    for (const proj of projects) {
      this.images.push(p.loadImage(`assets/images/${proj.id}.jpg`, () => {
        loaded++;
        this._loadProgress = loaded / total;
        bus.emit('load:progress', this._loadProgress);
      }));
    }
  }

  setup() {
    const p = this.p;
    p.createCanvas(p.windowWidth, p.windowHeight);
    this._computeLayout();
    this._buildWorld();
    this._loaded = true;
    bus.emit('load:complete');
  }

  draw() {
    const p = this.p;
    const hasActive = this._hasActiveBalls();
    if (hasActive) {
      Matter.Engine.update(this.engine);
    }

    // ── Idle framerate: drop to 15fps when nothing is changing ──
    const isIdle = !hasActive && !p.mouseIsPressed && !this.showDemo && !this.detailOpen;
    if (isIdle !== this._wasIdle) {
      p.frameRate(isIdle ? 15 : 60);
      this._wasIdle = isIdle;
    }

    p.background(config.colors.bg);
    this._drawBackgroundGradient();

    if (!this.detailOpen) {
      this._drawTitle();
      this._drawGoals();
      this._drawNetting();
      this.menus.forEach((m) => {
        m.highlighted = (this._aimingCategory && m.category === this._aimingCategory);
        m.show();
      });
      this._drawStats();
      if (this.totalPages > 1) this._drawPageNav();
    }

    if (this.showDemo) {
      this._runDemo();
    } else {
      this._drawBalls();
      if (!this.detailOpen) this._drawHelpMessage();
    }
  }

  windowResized() {
    const p = this.p;
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    this._computeLayout();

    this.balls.forEach((ball) => {
      if (ball.pageOpen || ball.inOriginalPosition) return;
      ball.reset();
    });

    if (!this.detailOpen) {
      this._teardownWorld();
      this._buildWorld();
    }
  }

  // ── Input handlers ─────────────────────────────────────────────────────

  mousePressed() {
    if (this.detailOpen) return false;
    const p = this.p;

    // Wake from idle framerate immediately
    if (this._wasIdle) { p.frameRate(60); this._wasIdle = false; }

    // ── FIX 2: Check double-tap BEFORE the release cooldown guard ──
    // The 300ms cooldown was blocking the second click of a double-click.
    // Now we check for double-tap first so it always goes through.
    const now = Date.now();
    if (this._lastTappedBall &&
        now - this._lastTapTime < config.doubleTapWindow &&
        this._lastTappedBall.onBall(p.mouseX, p.mouseY)) {
      this._openBallDetail(this._lastTappedBall);
      this.clickedToOpen = true;
      this.consecutiveMisses = 0;
      bus.emit('miss:hint', false);
      this._lastTappedBall = null;
      return false;
    }

    if (now - this._lastReleaseTime < 300) return false;

    if (this.totalPages > 1 && this._checkPageNavClick(p.mouseX, p.mouseY)) {
      return false;
    }

    this.balls.forEach((ball) => {
      const onPage = ball.index >= this.currentPage * this.ballsPerPage &&
                     ball.index < (this.currentPage + 1) * this.ballsPerPage;
      ball.display = onPage && (this.selectedCategory === 'All' || ball.category === this.selectedCategory);

      if (ball.onBall(p.mouseX, p.mouseY)) {
        this._lastTapTime = now;
        this._lastTappedBall = ball;
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
    this._lastReleaseTime = Date.now();
    this._aimingCategory = null;

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
    this.menus.forEach((item) => {
      item.selected = this.selectedCategory === item.category;
    });

    if (this.detailOpen) return false;

    this.balls.forEach((ball) => {
      const onPage = ball.index >= this.currentPage * this.ballsPerPage &&
                     ball.index < (this.currentPage + 1) * this.ballsPerPage;
      ball.display = onPage && (this.selectedCategory === 'All' || ball.category === this.selectedCategory);

      if (ball.clicked && (Math.abs(ball.xPower) > config.minLaunchPower || Math.abs(ball.yPower) > config.minLaunchPower)) {
        this._launchBall(ball);
        this.totalShots++;
        this.consecutiveMisses++;
        if (this.consecutiveMisses >= 3) {
          bus.emit('miss:hint', true);
        }
        this._emitStats();
        bus.emit('ball:launched', {
          name: ball.name,
          category: ball.category,
          ballLaunches: ball.launchCount,
          ballMakes: ball.makes,
        });
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

  destroy() {
    this._unsubs.forEach((fn) => fn());
    Matter.Events.off(this.engine, 'collisionActive', this._collisionHandler);
    Matter.Engine.clear(this.engine);
  }

  // ── Private: world management ──────────────────────────────────────────

  _buildWorld() {
    this._createBalls();
    this._createGoals();
    this._createMenus();
    this._createBoundary();
  }

  _teardownWorld() {
    this.balls.forEach((b) => {
      try { Matter.Composite.remove(this.world, b.body); } catch (_) {}
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
    this._aimingCategory = null;
  }

  _createBalls() {
    const { gridStartX, gridStartY, spacing, gridCols } = this.vp;
    const startIdx = this.currentPage * this.ballsPerPage;
    const endIdx   = Math.min(startIdx + this.ballsPerPage, projects.length);

    let col = 0;
    let row = 0;

    projects.forEach((proj, i) => {
      const isOnPage = i >= startIdx && i < endIdx;
      const gx = isOnPage ? gridStartX + col * spacing : -9999;
      const gy = isOnPage ? gridStartY + row * spacing : -9999;

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
      ball.display = isOnPage;
      this.balls.push(ball);

      if (isOnPage) {
        col++;
        if (col >= gridCols) { col = 0; row++; }
      }

      if (!this.categories.includes(proj.category)) {
        this.categories.push(proj.category);
      }
    });
    this.categories.sort((a, b) => b.length - a.length);

    this.totalPages = Math.ceil(projects.length / this.ballsPerPage);
  }

  _createGoals() {
    const { iconSize, dotCenterX, dotSpan, gridStartY, portrait, mobile } = this.vp;
    // Cap dot radius at 40% of ball diameter (= 20% of diameter each side)
    const dotRadius = Math.min(iconSize / 15, iconSize * 0.2);
    const dotY = gridStartY;
    const dotLeftX = dotCenterX - dotSpan / 2;
    const dotRightX = dotCenterX + dotSpan / 2;

    // Cap left dot so the gap between its edge and screen edge is
    // never more than 40% of ball diameter — prevents ball trapping.
    const maxGap = iconSize * 0.4;
    const maxLeftCenter = dotRadius + maxGap;
    const leftDotX = Math.min(dotLeftX, maxLeftCenter);

    // Net height: just enough to cover the category labels
    const menuStartY = gridStartY + dotRadius * 2 + iconSize * 0.35;
    const lastMenuCenterY = menuStartY + (this.categories.length - 1) * 0.4 * iconSize;
    const netHeight = (lastMenuCenterY - dotY) + iconSize * 0.1;

    const dotPositions = [leftDotX, dotRightX];
    for (let i = 0; i < 2; i++) {
      this.goals.push(new Goal({
        world: this.world, p: this.p,
        x: dotPositions[i],
        y: dotY,
        radius: dotRadius,
        index: i,
      }));
      this.nets.push(new Net({
        world: this.world, p: this.p,
        x: dotPositions[i],
        y: dotY + netHeight / 2,
        height: netHeight,
        goalWidth: dotSpan,
      }));
    }
  }

  _createMenus() {
    const { dotCenterX, dotSpan, gridStartY, iconSize, menuFontSize } = this.vp;
    const dotRadius = iconSize / 15;
    const menuStartY = gridStartY + dotRadius * 2 + iconSize * 0.35;
    this.categories.forEach((cat, i) => {
      this.menus.push(new MenuObj({
        world: this.world, p: this.p,
        position: { x: dotCenterX, y: menuStartY + i * 0.4 * iconSize },
        category: cat,
        index: i,
        goalWidth: dotSpan,
        iconSize,
        fontSize: menuFontSize,
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

  _handleCollisions(event) {
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
          this.consecutiveMisses = 0;
          bus.emit('miss:hint', false);
          this._emitStats();
          bus.emit('ball:scored', {
            name: ball.name,
            category: ball.category,
            ballLaunches: ball.launchCount,
            ballMakes: ball.makes,
          });
        }
      }
    });
  }

  // ── Private: actions ───────────────────────────────────────────────────

  _launchBall(ball) {
    // ── Linear launch power ──
    // Drag twice as far → twice as much power. Simple and predictable.
    const magnitude = Math.sqrt(ball.xPower ** 2 + ball.yPower ** 2);
    if (magnitude < 0.01) return;

    let speedScale;
    if (this.vp.portrait) {
      speedScale = 0.70;
    } else if (this.vp.mobile) {
      speedScale = 0.42;
    } else {
      speedScale = 0.25;
    }

    const vx = -ball.xPower * speedScale;
    const vy = -ball.yPower * speedScale;

    const catIdx = this.categories.indexOf(ball.category);

    Matter.Body.setPosition(ball.body, { x: ball.x, y: ball.y });
    Matter.Body.setVelocity(ball.body, { x: 0, y: 0 });
    Matter.Body.setAngle(ball.body, 0);

    if (ball.inOriginalPosition) {
      Matter.Composite.add(this.world, ball.body);
    }

    ball.body.collisionFilter = {
      group:    catIdx + 1,
      category: Math.pow(2, catIdx),
      mask:     this.categories.reduce((m, _, i) => m | config.categoryBits[i], 0),
    };

    Matter.Body.setStatic(ball.body, false);
    Matter.Body.setVelocity(ball.body, { x: vx, y: vy });
    ball.launched();
  }

  _openBallDetail(ball) {
    const data = ball.openDetail();
    if (!data) return;
    this.totalOpens++;
    this.detailOpen = true;
    this._emitStats();
    bus.emit('detail:open', data);
  }

  _onDetailClosed() {
    this.detailOpen = false;
    this.selectedCategory = 'All';

    const startIdx = this.currentPage * this.ballsPerPage;
    const endIdx   = Math.min(startIdx + this.ballsPerPage, projects.length);

    this.balls.forEach((ball) => {
      const isOnPage = ball.index >= startIdx && ball.index < endIdx;
      ball.display = isOnPage;
      ball.closeDetail();
      ball.clicked = false;
      ball.xPower = 0;
      ball.yPower = 0;
      if (!ball.inOriginalPosition) ball.reset();
    });
  }

  _onReset() {
    this.currentPage = 0;
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
    const ctx = this.p.drawingContext;
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
    this.goals.forEach((g) => g.show());
  }

  /**
   * Draw a subtle diamond mesh behind the menu area to give
   * the dots + menu region a "goal net" feel.
   */
  _drawNetting() {
    const ctx = this.p.drawingContext;
    const { dotCenterX, dotSpan, gridStartY, iconSize } = this.vp;
    const dotRadius = iconSize / 15;

    // Net is 66% of dotSpan, centered
    const netW = dotSpan * 0.66;
    const leftX  = dotCenterX - netW / 2;
    const rightX = dotCenterX + netW / 2;
    const topY   = gridStartY + dotRadius * 2;
    const menuStartY = gridStartY + dotRadius * 2 + iconSize * 0.35;
    // End right at the last category center, not below it
    const botY   = menuStartY + (this.categories.length - 1) * 0.4 * iconSize + iconSize * 0.1;

    if (botY <= topY) return;

    const cellSize = netW / 3;

    // Trapezoid: wide at top (near dots), narrowing toward bottom
    const flare = netW * 0.15;
    const topLeftX  = leftX - flare;
    const topRightX = rightX + flare;
    const botLeftX  = leftX + flare;
    const botRightX = rightX - flare;

    ctx.save();
    ctx.strokeStyle = 'rgba(89, 133, 177, 0.07)';
    ctx.lineWidth = 0.7;

    // Clip to trapezoid
    ctx.beginPath();
    ctx.moveTo(topLeftX - 1, topY);
    ctx.lineTo(topRightX + 1, topY);
    ctx.lineTo(botRightX + 1, botY);
    ctx.lineTo(botLeftX - 1, botY);
    ctx.closePath();
    ctx.clip();

    const span = botY - topY;
    const fullW = topRightX - topLeftX;
    for (let offset = -span - fullW; offset < fullW + span * 2; offset += cellSize) {
      ctx.beginPath();
      ctx.moveTo(topLeftX + offset, topY);
      ctx.lineTo(topLeftX + offset + span, botY);
      ctx.stroke();
    }
    for (let offset = -span - fullW; offset < fullW + span * 2; offset += cellSize) {
      ctx.beginPath();
      ctx.moveTo(topLeftX + offset, topY);
      ctx.lineTo(topLeftX + offset - span, botY);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawBalls() {
    if (this.detailOpen) return;

    const p = this.p;
    this._aimingCategory = null;
    let hoveredBall = null;
    this.balls.forEach((ball) => {
      if (!ball.display && ball.inOriginalPosition) return;

      ball.show(this.vp);

      if (p.mouseIsPressed) {
        if (ball.clicked) {
          ball.aim(
            this.vp.portrait || this.vp.mobile
              ? config.powerScaleMobile
              : config.powerScaleDesktop,
          );
          this._aimingCategory = ball.category;
        }
      } else {
        if (ball.onBall(p.mouseX, p.mouseY)) {
          hoveredBall = ball;
          ball.hover(this.vp.iconSize, this._hoverHintCount < 3);
        }
        if (!ball.clicked) {
          ball.xPower = 0;
          ball.yPower = 0;
        }
      }
    });
    // Count each new hover session (entering a ball, or switching balls)
    if (hoveredBall && hoveredBall !== this._currentHoveredBall) {
      if (this._hoverHintCount < 3) this._hoverHintCount++;
    }
    this._currentHoveredBall = hoveredBall || null;

    this._captureWebsite();
  }

  _runDemo() {
    const ball = this.balls[0];
    if (!ball) return;

    // Demo launch: 60° angle (more vertical)
    if (!this._demoTarget) {
      const xDir = 0.5;
      const yDir = Math.sqrt(3) / 2;  // 0.866

      const demoPower = this._computeDemoPower(ball);

      this._demoTarget = {
        xDir,
        yDir,
        totalPower: demoPower,
      };
    }

    const { xDir, yDir, totalPower } = this._demoTarget;
    const step = totalPower / 100;
    ball.xPower += step * xDir;
    ball.yPower += step * yDir;
    ball.demoAim();

    const currentPower = Math.sqrt(ball.xPower * ball.xPower + ball.yPower * ball.yPower);
    if (currentPower > totalPower) {
      this._launchBall(ball);
      this.showDemo = false;
      this._demoTarget = null;
    }
  }

  /**
   * Compute demo launch power using a higher-order formula that
   * accounts for both screen width and ball-to-goal distance.
   *
   * Core idea:  dist^1.5 compensates for gravity losses on longer
   * trajectories (linear would under-shoot large screens).  Dividing
   * by a power of width normalises across viewport sizes.
   *
   * Mobile (portrait & landscape):  coeff × dist^1.5 / √width
   *   - Portrait coeff 0.129, landscape coeff 0.169
   *
   * Desktop:  12.59 × dist^1.5 / width^1.045
   *   - The 1.045 exponent gives a gentle boost to narrower viewports
   *     while leaving wide desktops untouched.
   *   - +5% uniform bump vs prior round; narrow-to-wide ratio preserved.
   *   - Narrower viewports still get a gentle relative boost via the exponent.
   */
  _computeDemoPower(ball) {
    const dx = ball.x - this.vp.dotCenterX;
    const dy = ball.y - this.vp.gridStartY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const { width, portrait, mobile } = this.vp;

    const distPow = Math.pow(dist, 1.5);

    if (portrait) {
      return 0.129 * distPow / Math.sqrt(width);
    } else if (mobile) {
      return 0.169 * distPow / Math.sqrt(width);
    } else {
      // Desktop: width^1.045 — slight boost at narrow viewports
      return 12.59 * distPow / Math.pow(width, 1.045);
    }
  }

  _drawTitle() {
    const p = this.p;
    const { iconSize, portrait, width, height, titleZoneBottom } = this.vp;
    const ctx = p.drawingContext;

    const titleLines = config.titleText.split('. ').map((s) => s.replace(/\.$/, '') + '.');
    const ctaLine = config.ctaText;

    if (portrait) {
      const availH = titleZoneBottom - height * 0.055;
      const titleSize  = Math.min(iconSize / 2.2, width / 11, availH / (titleLines.length + 1.5));
      const ctaSize    = titleSize * 0.7;
      const lineHeight = titleSize * 1.3;

      p.push();
      p.textFont('Syne');
      p.textSize(titleSize);
      p.textStyle(p.BOLD);
      let maxTitleW = 0;
      titleLines.forEach((line) => { maxTitleW = Math.max(maxTitleW, p.textWidth(line)); });
      p.pop();
      const xPos = Math.max(width * 0.06, width * 0.93 - maxTitleW);

      const totalTextH = lineHeight * titleLines.length + ctaSize * 1.1;
      const yStart = (titleZoneBottom - totalTextH) / 2 + titleSize * 0.35;

      const accentTopY = yStart - titleSize * 1.0;
      const accentBotY = yStart + lineHeight * titleLines.length + ctaSize * 0.7;
      const panelX = xPos;
      const panelW = width * 0.60;
      const panelY = accentTopY;
      const panelH = accentBotY - accentTopY;

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
      ctx.strokeStyle = 'rgba(89, 133, 177, 0.65)';
      ctx.lineWidth   = 2;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(panelX + 1, accentTopY);
      ctx.lineTo(panelX + 1, accentBotY);
      ctx.stroke();
      ctx.restore();

      p.push();
      p.textFont('Syne');
      p.textSize(titleSize);
      p.textStyle(p.BOLD);
      titleLines.forEach((line, i) => {
        p.fill(config.colors.secondary);
        p.text(line, xPos + 6, yStart + lineHeight * i);
      });
      p.textFont('Syne');
      p.textSize(ctaSize);
      p.textStyle(p.NORMAL);
      p.fill(config.colors.main);
      p.text(ctaLine, xPos + 6, yStart + lineHeight * titleLines.length + ctaSize * 0.4);
      p.pop();

    } else {
      const titleSize = Math.min(iconSize / 3.5, height / 18, width / 40);
      const ctaSize   = titleSize * 0.7;
      const lineHeight = titleSize * 1.25;

      p.push();
      p.textFont('Syne');
      p.textSize(titleSize);
      p.textStyle(p.BOLD);
      let maxW = 0;
      titleLines.forEach((line) => { maxW = Math.max(maxW, p.textWidth(line)); });
      p.pop();

      const totalTextH = lineHeight * titleLines.length + ctaSize * 1.1;

      // Mobile landscape: push title to the right of the ball field
      let xPos;
      if (this.vp.mobile) {
        const rightmostBallEdge = this.vp.gridStartX
          + (this.vp.gridCols - 1) * this.vp.spacing
          + iconSize / 2;
        xPos = Math.max(rightmostBallEdge + titleSize, width * 0.92 - maxW);
        // Clamp so the longest line doesn't get cut off at the right edge
        xPos = Math.min(xPos, width - maxW - titleSize * 0.4);
      } else {
        xPos = width * 0.92 - maxW;
      }

      // Simple centering within titleZoneBottom
      const rawYStart = (titleZoneBottom - totalTextH) / 2 + titleSize * 0.35;
      const yStart = Math.max(titleSize * 0.8, rawYStart);

      const accentTopY = yStart - titleSize * 1.0;
      const accentBotY = yStart + lineHeight * titleLines.length + ctaSize * 0.7;

      ctx.save();
      ctx.strokeStyle = 'rgba(89, 133, 177, 0.65)';
      ctx.lineWidth   = 2;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(xPos - 12, accentTopY);
      ctx.lineTo(xPos - 12, accentBotY);
      ctx.stroke();
      ctx.restore();

      p.push();
      p.textFont('Syne');
      p.textSize(titleSize);
      p.textStyle(p.BOLD);
      titleLines.forEach((line, i) => {
        p.fill(config.colors.secondary);
        p.text(line, xPos, yStart + lineHeight * i);
      });
      p.textFont('Syne');
      p.textSize(ctaSize);
      p.textStyle(p.NORMAL);
      p.fill(config.colors.main);
      p.text(ctaLine, xPos, yStart + lineHeight * titleLines.length + ctaSize * 0.3);
      p.pop();
    }
  }

  _drawHelpMessage() {
    // Now handled by React miss:hint popup (emitted after 3 consecutive misses)
  }

  // ── FIX 3: Stats equidistant between last category and screen bottom ──
  _drawStats() {
    if (this.totalShots === 0) return;

    const p = this.p;
    const { dotCenterX, dotSpan, gridStartY, iconSize, height, mobile, portrait } = this.vp;
    const centerX = dotCenterX;
    const dotRadius = Math.min(iconSize / 15, iconSize * 0.2);
    const menuStartY = gridStartY + dotRadius * 2 + iconSize * 0.35;
    const lastMenuY = menuStartY + (this.categories.length - 1) * 0.4 * iconSize;
    const pct = Math.round((this.totalMakes / this.totalShots) * 100);

    // Mobile landscape: horizontal single-line stats
    if (mobile && !portrait) {
      const fontSize = iconSize / 8;
      const statsY = height - fontSize * 1.5;
      p.push();
      p.textFont('JetBrains Mono');
      p.textAlign(p.CENTER);
      p.noStroke();
      p.textSize(fontSize * 0.65);
      p.fill('rgba(199, 214, 213, 0.35)');
      const statsText = `${this.totalShots} shot${this.totalShots !== 1 ? 's' : ''}  ·  ${this.totalMakes} make${this.totalMakes !== 1 ? 's' : ''}  ·  `;
      p.text(statsText, centerX, statsY);
      // Accent for percentage
      const baseW = p.textWidth(statsText);
      p.fill('rgba(89, 133, 177, 0.6)');
      p.textSize(fontSize * 0.75);
      p.text(`${pct}%`, centerX + baseW / 2 + p.textWidth(`${pct}%`) / 2 + 2, statsY);
      p.pop();
      return;
    }

    // Default: vertical stacked layout
    const fontSize = iconSize / 7;
    const lineH = fontSize * 1.6;

    // Stats block: divider + 3 text lines (shots, makes, pct)
    const statsContentH = lineH * 1.2 + lineH * 2.2 + lineH * 0.4;

    // Center the stats block equidistant between last category and screen bottom
    const availSpace = height - lastMenuY;
    const midY = lastMenuY + availSpace / 2;
    const dividerY = midY - statsContentH / 2;

    p.push();
    p.textAlign(p.CENTER);
    p.textFont('JetBrains Mono');
    p.noStroke();

    const divW = dotSpan * 0.5;
    p.stroke('rgba(89, 133, 177, 0.15)');
    p.strokeWeight(1);
    p.line(centerX - divW / 2, dividerY, centerX + divW / 2, dividerY);
    p.noStroke();

    const startY = dividerY + lineH * 1.2;

    // Stats are subtle — low opacity
    p.textSize(fontSize * 0.7);
    p.fill('rgba(199, 214, 213, 0.35)');
    p.text(`${this.totalShots} shot${this.totalShots !== 1 ? 's' : ''}`, centerX, startY);
    p.fill('rgba(199, 214, 213, 0.35)');
    p.text(`${this.totalMakes} make${this.totalMakes !== 1 ? 's' : ''}`, centerX, startY + lineH);

    p.textSize(fontSize * 0.85);
    p.fill('rgba(89, 133, 177, 0.6)');
    p.text(`${pct}%`, centerX, startY + lineH * 2.2);

    p.pop();
  }

  // ── Capture for "thisWebsite" ball ──
  // Centers on the first ball (aboutMe) in the grid so the portfolio ball
  // shows a zoomed view of the actual layout with visible surrounding balls.
  // DPR-aware: p5 canvas backing store is at pixelDensity() resolution.
  _captureWebsite() {
    this._captureCounter = (this._captureCounter || 0) + 1;
    if (this._captureCounter % 4 !== 1) return;

    const thisSiteBall = this.balls.find((b) => b.project.id === 'thisWebsite');
    if (!thisSiteBall) return;

    const dpr = this.p.pixelDensity ? this.p.pixelDensity() : (window.devicePixelRatio || 1);
    const cssSize = Math.round(thisSiteBall.r * 2);
    const physSize = Math.round(cssSize * dpr);
    if (physSize <= 0) return;

    if (!this._captureCanvas || this._captureCanvas.width !== physSize) {
      this._captureCanvas = document.createElement('canvas');
      this._captureCanvas.width = physSize;
      this._captureCanvas.height = physSize;
      this._captureCtx = this._captureCanvas.getContext('2d');
    }

    const canvas = this.p.drawingContext.canvas;

    // Center capture on the first ball (aboutMe) in the grid
    const firstBall = this.balls.find((b) => b.index === 0);
    const centerX = firstBall ? firstBall.originalPos.x : this.vp.gridStartX;
    const centerY = firstBall ? firstBall.originalPos.y : this.vp.gridStartY;

    // Capture region in CSS pixels: ~5× ball diameter so the center ball
    // is about 20% of the view. On portrait use slightly tighter zoom.
    const zoomFactor = this.vp.portrait ? 3.5 : 5.0;
    const captureCSS = this.vp.iconSize * zoomFactor;

    // Clamp so we don't go outside the canvas
    const halfCSS = captureCSS / 2;
    const cssLeft = Math.max(0, Math.min(centerX - halfCSS, this.vp.width - captureCSS));
    const cssTop  = Math.max(0, Math.min(centerY - halfCSS, this.vp.height - captureCSS));

    // Convert to physical pixels
    const srcX = Math.round(cssLeft * dpr);
    const srcY = Math.round(cssTop * dpr);
    const srcSize = Math.round(captureCSS * dpr);

    this._captureCtx.drawImage(canvas, srcX, srcY, srcSize, srcSize, 0, 0, physSize, physSize);

    // Update the p5 image
    if (!this._capturePImg || this._capturePImg.width !== physSize) {
      this._capturePImg = this.p.createImage(physSize, physSize);
    }
    this._capturePImg.drawingContext.drawImage(this._captureCanvas, 0, 0);
    thisSiteBall.ballImage = this._capturePImg;
    thisSiteBall.fullImage = this._capturePImg;
    thisSiteBall._cropX = 0;
    thisSiteBall._cropY = 0;
    thisSiteBall._cropSize = physSize;

    // Update the circle canvas in-place.
    // CRITICAL: _renderCircleImage applies scale(dpr, dpr) which persists
    // on the context. We must reset the transform before drawing here.
    if (thisSiteBall._circleCanvas) {
      const cSize = thisSiteBall._circleCanvas.width; // physical pixels
      const octx = thisSiteBall._circleCanvas.getContext('2d');
      octx.setTransform(1, 0, 0, 1, 0, 0); // reset DPR scale
      octx.clearRect(0, 0, cSize, cSize);
      octx.save();
      octx.beginPath();
      octx.arc(cSize / 2, cSize / 2, cSize / 2, 0, Math.PI * 2);
      octx.clip();
      octx.drawImage(this._captureCanvas, 0, 0, physSize, physSize, 0, 0, cSize, cSize);
      octx.restore();
    } else {
      thisSiteBall._circleCanvas = null;
    }
  }

  // ── Private: page navigation ──────────────────────────────────────────

  _drawPageNav() {
    const p = this.p;
    const { width, height, iconSize } = this.vp;
    const navY = height - iconSize * 0.6;
    const navX = width * 0.65;
    const arrowSize = iconSize / 5;

    p.push();
    p.textAlign(p.CENTER, p.CENTER);
    p.textFont('Syne');
    p.textSize(arrowSize * 0.8);

    if (this.currentPage > 0) {
      p.fill(config.colors.accent);
      p.noStroke();
      p.triangle(
        navX - arrowSize * 3, navY,
        navX - arrowSize * 1.5, navY - arrowSize * 0.6,
        navX - arrowSize * 1.5, navY + arrowSize * 0.6,
      );
    }

    p.fill(config.colors.main);
    p.text(`${this.currentPage + 1} / ${this.totalPages}`, navX, navY);

    if (this.currentPage < this.totalPages - 1) {
      p.fill(config.colors.accent);
      p.noStroke();
      p.triangle(
        navX + arrowSize * 3, navY,
        navX + arrowSize * 1.5, navY - arrowSize * 0.6,
        navX + arrowSize * 1.5, navY + arrowSize * 0.6,
      );
    }

    p.pop();
  }

  _checkPageNavClick(mx, my) {
    const { width, height, iconSize } = this.vp;
    const navY = height - iconSize * 0.6;
    const navX = width * 0.65;
    const arrowSize = iconSize / 5;
    const hitZone = arrowSize * 2;

    if (this.currentPage > 0 && mx < navX - arrowSize && mx > navX - arrowSize * 4 && Math.abs(my - navY) < hitZone) {
      this.currentPage--;
      this._teardownWorld();
      this._buildWorld();
      return true;
    }
    if (this.currentPage < this.totalPages - 1 && mx > navX + arrowSize && mx < navX + arrowSize * 4 && Math.abs(my - navY) < hitZone) {
      this.currentPage++;
      this._teardownWorld();
      this._buildWorld();
      return true;
    }
    return false;
  }

  _hasActiveBalls() {
    if (this.showDemo) return true;
    return this.balls.some((b) => !b.inOriginalPosition);
  }

  // ── Private: layout computation ────────────────────────────────────────

  _computeLayout() {
    const w = this.p.windowWidth;
    const h = this.p.windowHeight;
    const portrait = h > w;
    const mobile   = Math.max(h, w) <= 1000;
    const area     = w * h;

    let goalX, goalY, gridStartX, gridStartY, titleZoneBottom;

    if (portrait) {
      // ══════════════════════════════════════════════════════════
      //  PORTRAIT (mobile): 2-column grid, equal horizontal spacing
      // ══════════════════════════════════════════════════════════
      const gridCols = 2;
      const neededRows = Math.ceil(projects.length / gridCols);

      titleZoneBottom = h * 0.15;
      goalX = w * 0.04;
      const goalWidth = w * 0.18;
      goalY = titleZoneBottom + goalWidth * 0.55;

      const estAvailW = w * 0.55;

      // ── Icon size: account for ALL vertical consumers ──
      const topOffset = 0.8;        // ball center below titleZoneBottom
      const dragRoomFactor = 1.0;   // minimum drag space below lowest ball
      const spacingFactor = 1.30;
      const totalVertical = topOffset
        + (neededRows - 1) * spacingFactor
        + 0.5                        // bottom half of lowest ball
        + dragRoomFactor;
      const iconFromH = (h - titleZoneBottom) / totalVertical;
      const iconFromW = estAvailW / (gridCols * spacingFactor);
      const iconSize = Math.min(iconFromH, iconFromW);

      // Goal dot positions
      const dotSpan = iconSize * 1.3;
      const dotRadius = iconSize / 15;
      const dotCenterX = Math.max(dotSpan / 2 + iconSize / 5, goalX + goalWidth / 2);
      const rightDotEdge = dotCenterX + dotSpan / 2 + dotRadius;

      // ── FIX 6: Equal horizontal spacing — center grid in available space ──
      // Instead of capping gap and having uneven margins, center the grid
      const availW = w - rightDotEdge;
      const idealGap = (availW - gridCols * iconSize) / (gridCols + 1);
      const gap = Math.max(idealGap, iconSize * 0.08);
      // Center the grid so left margin = right margin
      const totalGridW = gridCols * iconSize + (gridCols - 1) * gap;
      const leftMargin = (availW - totalGridW) / 2;
      gridStartX = rightDotEdge + leftMargin + iconSize / 2;
      const spacing = iconSize + gap;

      gridStartY = titleZoneBottom + iconSize * topOffset;
      const gridRows = neededRows;

      // Power: scale so lowest ball can reach goal with available drag distance
      let power = Math.sqrt(iconSize) * (area / 350000);
      if (mobile) power = area / Math.pow(iconSize, 2.7);

      // Title and menu font sizes (title always ≥ 30% bigger than menu)
      const availTitleH = titleZoneBottom - h * 0.055;
      const titleSize = Math.min(iconSize / 2.2, w / 11, availTitleH / 4.5);
      const menuFontSize = titleSize / 1.35;   // title is 35% bigger

      this.ballsPerPage = gridCols * gridRows;
      this.vp = {
        width: w, height: h, portrait, mobile, area, iconSize, power,
        goalX, goalY, goalWidth: goalWidth, dotSpan, dotCenterX,
        gridStartX, gridStartY, titleZoneBottom, spacing,
        gridCols, gridRows, menuFontSize,
      };

    } else if (mobile) {
      // ══════════════════════════════════════════════════════════
      //  MOBILE LANDSCAPE — even 2-row grid (4+4 for 8 balls)
      // ══════════════════════════════════════════════════════════
      const totalBalls = projects.length;
      const gridCols = Math.ceil(totalBalls / 2); // even split: 8→4, 9→5, 10→5
      const neededRows = Math.ceil(totalBalls / gridCols);

      goalX = w * 0.02;
      const goalWidth = w * 0.09;
      goalY = h * 0.40;
      // More vertical room for title — prevents crowding against top
      titleZoneBottom = h * 0.35;

      const spacingFactor = 1.20;
      const topOffset = 0.65;   // push balls down so they don't overlap title
      const dragRoomFactor = 0.7;
      const totalVertical = topOffset
        + (neededRows - 1) * spacingFactor
        + 0.5
        + dragRoomFactor;
      const availH = h - titleZoneBottom;
      const iconFromH = availH / totalVertical;

      // Horizontal constraint: goal area + ball columns
      const dotSpan_est = iconFromH * 1.3;
      const menuAreaW = goalX + goalWidth / 2 + dotSpan_est / 2 + iconFromH * 0.3;
      const availHoriz = w - menuAreaW;
      const iconFromW = availHoriz / (gridCols * spacingFactor + 0.5);
      const maxIcon = Math.min(w / 10, h / 3.2);
      const iconSize = Math.min(iconFromH, iconFromW, maxIcon);

      const spacing = iconSize * spacingFactor;
      const gridRows = neededRows;

      const dotSpan = iconSize * 1.3;
      const dotRadius = Math.min(iconSize / 15, iconSize * 0.2);
      // Ensure left dot is never cut off — minimum clearance from left edge
      const minDotCenterX = dotSpan / 2 + dotRadius + 4;
      const dotCenterX = Math.max(minDotCenterX, goalX + goalWidth / 2);

      const menuRightEdge = dotCenterX + dotSpan / 2 + dotRadius + iconSize * 0.15;
      const minFirstBallCenter = menuRightEdge + iconSize * 0.7;

      // Center the grid between menu and right edge
      const gridW = (gridCols - 1) * spacing;
      const gridAreaCenter = (menuRightEdge + w) / 2;
      gridStartX = Math.max(minFirstBallCenter, gridAreaCenter - gridW / 2);

      gridStartY = titleZoneBottom + iconSize * topOffset;

      let power = Math.sqrt(iconSize) * (area / 350000);

      const titleSize = Math.min(iconSize / 2.8, h / 14, w / 42);
      const menuFontSize = titleSize / 1.35;

      this.ballsPerPage = gridCols * gridRows;
      this.vp = {
        width: w, height: h, portrait, mobile, area, iconSize, power,
        goalX, goalY, goalWidth, dotSpan, dotCenterX,
        gridStartX, gridStartY, titleZoneBottom, spacing,
        gridCols, gridRows, menuFontSize,
      };

    } else {
      // ══════════════════════════════════════════════════════════
      //  DESKTOP LANDSCAPE: 3-column grid
      // ══════════════════════════════════════════════════════════
      const gridCols = 3;
      const neededRows = Math.ceil(projects.length / gridCols);

      goalX = w * 0.03;
      const goalWidth = w * 0.12;
      goalY = h * 0.35;
      titleZoneBottom = h * 0.28;

      // ── Icon size: account for ALL vertical consumers ──
      const spacingFactor = 1.30;
      const topOffset = 0.7;
      const dragRoomFactor = 1.2;
      const totalVertical = topOffset
        + (neededRows - 1) * spacingFactor
        + 0.5
        + dragRoomFactor;
      const availH = h - titleZoneBottom;
      const iconFromH = availH / totalVertical;
      const maxIcon = Math.min(w / 7, h / 4);
      const iconSize = Math.min(iconFromH, maxIcon);

      const spacing = iconSize * spacingFactor;
      const gridRows = neededRows;

      const dotSpan = iconSize * 1.3;
      const dotRadius = iconSize / 15;
      const dotCenterX = goalX + goalWidth / 2;

      // ── Enforce at least 1 ball width between menu right edge and first ball ──
      const menuRightEdge = dotCenterX + dotSpan / 2 + dotRadius + iconSize * 0.15;
      const minFirstBallCenter = menuRightEdge + iconSize;

      // Center the 3-column grid on the screen, respecting minimum menu separation
      const gridW = (gridCols - 1) * spacing;
      gridStartX = Math.max(minFirstBallCenter, w / 2 - gridW / 2);

      gridStartY = titleZoneBottom + iconSize * topOffset;

      let power = Math.sqrt(iconSize) * (area / 350000);

      // Title and menu font sizes
      // Menu reduced ~40% from previous (titleSize/1.35 → titleSize/2.25)
      const titleSize = Math.min(iconSize / 3, h / 16, w / 36);
      const menuFontSize = titleSize / 2.25;

      this.ballsPerPage = gridCols * gridRows;
      this.vp = {
        width: w, height: h, portrait, mobile, area, iconSize, power,
        goalX, goalY, goalWidth, dotSpan, dotCenterX,
        gridStartX, gridStartY, titleZoneBottom, spacing,
        gridCols, gridRows, menuFontSize,
      };
    }

    // Expose ball bottom edge as CSS custom property for HUD positioning.
    // Ball bottom = last row center Y + ball radius.
    const vp = this.vp;
    const lastRowCenterY = vp.gridStartY + (vp.gridRows - 1) * vp.spacing;
    const ballBottomY = lastRowCenterY + vp.iconSize / 2;
    document.documentElement.style.setProperty('--ball-bottom', `${ballBottomY}px`);
  }
}


