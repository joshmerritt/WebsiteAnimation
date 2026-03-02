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

    this.currentPage      = 0;
    this.ballsPerPage     = 999;

    this._loaded = false;
    this._loadProgress = 0;

    this._lastTapTime = 0;
    this._lastTappedBall = null;
    this._lastReleaseTime = 0;
    this._aimingCategory = null;

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
    if (this._hasActiveBalls()) {
      Matter.Engine.update(this.engine);
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

    if (Date.now() - this._lastReleaseTime < 300) return false;

    if (this.totalPages > 1 && this._checkPageNavClick(p.mouseX, p.mouseY)) {
      return false;
    }

    this.balls.forEach((ball) => {
      const onPage = ball.index >= this.currentPage * this.ballsPerPage &&
                     ball.index < (this.currentPage + 1) * this.ballsPerPage;
      ball.display = onPage && (this.selectedCategory === 'All' || ball.category === this.selectedCategory);

      if (ball.onBall(p.mouseX, p.mouseY)) {
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
    const { iconSize, dotCenterX, dotSpan, gridStartY } = this.vp;
    const dotRadius = iconSize / 15;
    const dotY = gridStartY;
    const dotLeftX = dotCenterX - dotSpan / 2;

    // Net height: just enough to cover the category labels
    const menuStartY = gridStartY + dotRadius * 2 + iconSize * 0.35;
    const lastMenuCenterY = menuStartY + (this.categories.length - 1) * 0.4 * iconSize;
    const netHeight = (lastMenuCenterY - dotY) + iconSize * 0.1;

    for (let i = 0; i < 2; i++) {
      this.goals.push(new Goal({
        world: this.world, p: this.p,
        x: dotLeftX + i * dotSpan,
        y: dotY,
        radius: dotRadius,
        index: i,
      }));
      this.nets.push(new Net({
        world: this.world, p: this.p,
        x: dotLeftX + i * dotSpan,
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
          this._emitStats();
        }
      }
    });
  }

  // ── Private: actions ───────────────────────────────────────────────────

  _launchBall(ball) {
    const speedScale = this.vp.mobile ? 0.35 : 0.25;
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

    // Demo launch: always at 45° angle (upper-left direction)
    // Power doubled from previous iteration (100% increase)
    if (!this._demoTarget) {
      const SQRT1_2 = Math.SQRT1_2; // 0.7071 — gives exact 45°

      let demoPower;
      if (this.vp.portrait || this.vp.mobile) {
        demoPower = this.vp.power * 6.8;
      } else {
        demoPower = this.vp.power * 1.12;
      }

      this._demoTarget = {
        xDir: SQRT1_2,
        yDir: SQRT1_2,
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
      const titleSize = Math.min(iconSize / 3, height / 16, width / 36);
      const ctaSize   = titleSize * 0.7;
      const lineHeight = titleSize * 1.25;

      p.push();
      p.textFont('Syne');
      p.textSize(titleSize);
      p.textStyle(p.BOLD);
      let maxW = 0;
      titleLines.forEach((line) => { maxW = Math.max(maxW, p.textWidth(line)); });
      p.pop();

      const xPos = width * 0.92 - maxW;
      const totalTextH = lineHeight * titleLines.length + ctaSize * 1.1;
      const yStart = (titleZoneBottom - totalTextH) / 2 + titleSize * 0.35;

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
    if (this.totalShots > 2 && this.totalShots < 10 && !this.clickedToOpen && !this.detailOpen) {
      const p = this.p;
      const { gridStartY, spacing, gridRows, iconSize, portrait, width, height } = this.vp;
      const gridBottom = gridStartY + (gridRows - 1) * spacing + iconSize / 2;
      const yPos = portrait
        ? Math.min(gridBottom + iconSize * 0.6, height - iconSize * 1.5)
        : gridBottom + iconSize * 0.6;
      p.push();
      p.textFont('Syne');
      p.textSize(iconSize / 6);
      p.fill(config.colors.main);
      p.textAlign(p.CENTER);
      p.text("Double click the image if you're tired of playing.", width / 2, yPos);
      p.pop();
    }
  }

  _drawStats() {
    if (this.totalShots === 0) return;

    const p = this.p;
    const { dotCenterX, dotSpan, gridStartY, iconSize } = this.vp;
    const centerX = dotCenterX;
    const dotRadius = iconSize / 15;
    const menuStartY = gridStartY + dotRadius * 2 + iconSize * 0.35;
    const lastMenuY = menuStartY + this.categories.length * 0.4 * iconSize;
    const fontSize = iconSize / 7;
    const lineH = fontSize * 1.6;
    const pct = Math.round((this.totalMakes / this.totalShots) * 100);

    p.push();
    p.textAlign(p.CENTER);
    p.textFont('JetBrains Mono');
    p.noStroke();

    const divW = dotSpan * 0.5;
    const dividerY = lastMenuY + lineH * 1.0;
    p.stroke('rgba(89, 133, 177, 0.15)');
    p.strokeWeight(1);
    p.line(centerX - divW / 2, dividerY, centerX + divW / 2, dividerY);
    p.noStroke();

    const startY = lastMenuY + lineH * 2.2;

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

  _captureWebsite() {
    this._captureCounter = (this._captureCounter || 0) + 1;
    if (this._captureCounter % 8 !== 1) return;

    const thisSiteBall = this.balls.find((b) => b.project.id === 'thisWebsite');
    if (!thisSiteBall) return;

    const size = Math.round(thisSiteBall.r * 2);
    if (size <= 0) return;

    if (!this._captureCanvas || this._captureCanvas.width !== size) {
      this._captureCanvas = document.createElement('canvas');
      this._captureCanvas.width = size;
      this._captureCanvas.height = size;
      this._captureCtx = this._captureCanvas.getContext('2d');
    }

    const canvas = this.p.drawingContext.canvas;
    if (this.vp.portrait) {
      // Capture full screen width from top — balls appear ~25% of actual size
      const srcW = this.vp.width;
      const srcH = srcW;
      this._captureCtx.drawImage(canvas, 0, 0, srcW, srcH, 0, 0, size, size);
    } else {
      // Desktop: full viewport width to show menu + all ball columns
      const srcSize = this.vp.width;
      this._captureCtx.drawImage(canvas, 0, 0, srcSize, srcSize, 0, 0, size, size);
    }

    if (!this._capturePImg || this._capturePImg.width !== size) {
      this._capturePImg = this.p.createImage(size, size);
    }
    this._capturePImg.drawingContext.drawImage(this._captureCanvas, 0, 0);
    thisSiteBall.ballImage = this._capturePImg;
    thisSiteBall.fullImage = this._capturePImg;
    thisSiteBall._cropX = 0;
    thisSiteBall._cropY = 0;
    thisSiteBall._cropSize = size;
  }

  // ── Private: page navigation ─────────────────────────────────────────

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

      // Reserve generous bottom space for drag room + HUD
      const bottomReserve = h * 0.16;
      const gridAvailH = h - titleZoneBottom - bottomReserve;

      // Estimate available width (will refine after computing dot positions)
      const estAvailW = w * 0.55;

      // Icon size: constrained by height (tighter spacing: 1.30 gap ratio)
      const spacingFactor = 1.30;     // was 1.45 — 33% less gap
      const iconFromH = gridAvailH / (neededRows * spacingFactor);
      const iconFromW = estAvailW / (gridCols * spacingFactor);
      const iconSize = Math.min(iconFromH, iconFromW);

      // Goal dot positions
      const dotSpan = iconSize * 1.3;
      const dotRadius = iconSize / 15;
      const dotCenterX = Math.max(dotSpan / 2 + iconSize / 5, goalX + goalWidth / 2);
      const rightDotEdge = dotCenterX + dotSpan / 2 + dotRadius;

      // ── Equal horizontal spacing ──
      // Three equal gaps: dot→ball1, ball1→ball2, ball2→screen edge
      const availW = w - rightDotEdge;
      const gap = Math.max((availW - gridCols * iconSize) / (gridCols + 1), iconSize * 0.08);
      gridStartX = rightDotEdge + gap + iconSize / 2;
      const spacing = iconSize + gap;

      gridStartY = titleZoneBottom + iconSize * 0.8;
      const gridRows = neededRows;

      // Ensure the lowest ball leaves enough drag room
      const lowestBallBottom = gridStartY + (gridRows - 1) * spacing + iconSize / 2;
      const dragRoom = h - lowestBallBottom;
      // If drag room is less than 1.5× iconSize, shift grid up
      if (dragRoom < iconSize * 1.5) {
        gridStartY -= (iconSize * 1.5 - dragRoom);
      }

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

    } else {
      // ══════════════════════════════════════════════════════════
      //  LANDSCAPE (desktop): 3-column grid, 33% tighter spacing
      // ══════════════════════════════════════════════════════════
      const gridCols = 3;
      const neededRows = Math.ceil(projects.length / gridCols);

      goalX = w * 0.03;
      const goalWidth = w * 0.12;
      goalY = h * 0.35;
      titleZoneBottom = h * 0.25;

      // Reserve bottom space for drag room
      const bottomReserve = h * 0.12;
      const gridAvailH = h - titleZoneBottom - bottomReserve;
      const spacingFactor = 1.30;  // 33% less gap
      const iconFromH = gridAvailH / (neededRows * spacingFactor);
      const maxIcon = Math.min(w / 7, h / 4);
      const iconSize = Math.min(iconFromH, maxIcon);
      const spacing = iconSize * spacingFactor;
      const gridRows = neededRows;

      const dotSpan = iconSize * 1.3;
      const dotRadius = iconSize / 15;
      const dotCenterX = goalX + goalWidth / 2;

      // ── Enforce at least 1 ball width between menu right edge and first ball ──
      // Menu text extends roughly to right dot + some overhang
      const menuRightEdge = dotCenterX + dotSpan / 2 + dotRadius + iconSize * 0.15;
      const minFirstBallCenter = menuRightEdge + iconSize;  // 1 ball-width gap + half ball

      // Center the 3-column grid, respecting minimum separation
      const gridW = (gridCols - 1) * spacing;
      const idealCenter = (minFirstBallCenter + w * 0.55) / 2;
      gridStartX = Math.max(minFirstBallCenter, idealCenter - gridW / 2);

      gridStartY = titleZoneBottom + iconSize * 1.0;

      // Ensure lowest ball has drag room
      const lowestBallBottom = gridStartY + (gridRows - 1) * spacing + iconSize / 2;
      const dragRoom = h - lowestBallBottom;
      if (dragRoom < iconSize * 1.5) {
        gridStartY -= (iconSize * 1.5 - dragRoom);
      }

      let power = Math.sqrt(iconSize) * (area / 350000);

      // Title and menu font sizes
      const titleSize = Math.min(iconSize / 3, h / 16, w / 36);
      const menuFontSize = titleSize / 1.35;

      this.ballsPerPage = gridCols * gridRows;
      this.vp = {
        width: w, height: h, portrait, mobile, area, iconSize, power,
        goalX, goalY, goalWidth, dotSpan, dotCenterX,
        gridStartX, gridStartY, titleZoneBottom, spacing,
        gridCols, gridRows, menuFontSize,
      };
    }
  }
}
