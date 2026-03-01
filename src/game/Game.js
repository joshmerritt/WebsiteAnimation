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

    // Pagination
    this.currentPage      = 0;
    this.ballsPerPage     = 999; // calculated in _computeLayout

    // Loading state
    this._loaded = false;
    this._loadProgress = 0;

    // Double-tap tracking (sketch-level, survives mouseReleased)
    this._lastTapTime = 0;
    this._lastTappedBall = null;

    // Listen for React events
    this._unsubs = [
      bus.on('detail:close', () => this._onDetailClosed()),
      bus.on('game:reset', () => this._onReset()),
    ];

    // Collision listener (one-time, on the engine — NOT per-build)
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
    // Only step physics when balls are in flight
    if (this._hasActiveBalls()) {
      Matter.Engine.update(this.engine);
    }
    p.background(config.colors.bg);
    this._drawBackgroundGradient();

    if (!this.detailOpen) {
      this._drawTitle();
      this._drawGoals();
      this.menus.forEach((m) => m.show());
      this.nets.forEach((n) => n.show());
      this._drawStats();
      this._drawHelpMessage();
      if (this.totalPages > 1) this._drawPageNav();
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
      if (ball.pageOpen || ball.inOriginalPosition) return;
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

    // Page navigation click
    if (this.totalPages > 1 && this._checkPageNavClick(p.mouseX, p.mouseY)) {
      return false;
    }

    this.balls.forEach((ball) => {
      const onPage = ball.index >= this.currentPage * this.ballsPerPage &&
                     ball.index < (this.currentPage + 1) * this.ballsPerPage;
      ball.display = onPage && (this.selectedCategory === 'All' || ball.category === this.selectedCategory);

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

  // ── Cleanup ────────────────────────────────────────────────────────────

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
    // Collision listener lives on the engine (registered once in constructor)
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
        if (col >= gridCols) {
          col = 0;
          row++;
        }
      }

      if (!this.categories.includes(proj.category)) {
        this.categories.push(proj.category);
      }
    });
    this.categories.sort((a, b) => b.length - a.length);

    this.totalPages = Math.ceil(projects.length / this.ballsPerPage);
  }

  _createGoals() {
    const { goalX, goalY, goalWidth, iconSize } = this.vp;
    const netHeight = 0.4 * this.categories.length * iconSize;
    const dotRadius = iconSize / 15;
    // Move dots up by 2× dot diameter so they sit well above the menu text
    const dotY = goalY - dotRadius * 4;
    // Widen dot spacing to align with the rough span of category text below
    const dotSpan = goalWidth * 1.3;
    const dotLeftX = Math.max(dotRadius * 3, goalX + goalWidth / 2 - dotSpan / 2);

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
    // Convert drag power into a velocity vector
    // Negative because dragging away from target = launching toward it
    const speedScale = this.vp.mobile ? 0.35 : 0.25;
    const vx = -ball.xPower * speedScale;
    const vy = -ball.yPower * speedScale;

    const catIdx = this.categories.indexOf(ball.category);

    // Ensure body position matches the ball's current visual position
    Matter.Body.setPosition(ball.body, { x: ball.x, y: ball.y });
    Matter.Body.setVelocity(ball.body, { x: 0, y: 0 });
    Matter.Body.setAngle(ball.body, 0);

    // Add to physics world if not already there
    if (ball.inOriginalPosition) {
      Matter.Composite.add(this.world, ball.body);
    }

    // Set collision filter for category matching
    ball.body.collisionFilter = {
      group:    catIdx + 1,
      category: Math.pow(2, catIdx),
      mask:     this.categories.reduce((m, _, i) => m | config.categoryBits[i], 0),
    };

    // Make dynamic and launch with velocity
    Matter.Body.setStatic(ball.body, false);
    Matter.Body.setVelocity(ball.body, { x: vx, y: vy });
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

  _drawBalls() {
    if (this.detailOpen) return;

    const p = this.p;
    this.balls.forEach((ball) => {
      // Always show balls that are in flight (launched and not yet reset)
      if (!ball.display && ball.inOriginalPosition) return;

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
    const { iconSize, portrait, width, height, titleZoneBottom, gridStartX } = this.vp;
    const ctx = p.drawingContext;

    const titleLines = config.titleText.split('. ').map((s) => s.replace(/\.$/, '') + '.');
    const ctaLine = config.ctaText;

    if (portrait) {
      // Title in top zone, left-justified but pushed toward center-right
      const availH = titleZoneBottom - height * 0.055;
      const titleSize  = Math.min(iconSize / 3, width / 14, availH / (titleLines.length + 1.5));
      const ctaSize    = titleSize * 0.75;

      // Measure longest line to right-align the block near the right edge
      p.push();
      p.textFont('Syne');
      p.textSize(titleSize);
      p.textStyle(p.BOLD);
      let maxTitleW = 0;
      titleLines.forEach((line) => { maxTitleW = Math.max(maxTitleW, p.textWidth(line)); });
      p.pop();
      const xPos = Math.max(width * 0.06, width * 0.93 - maxTitleW);
      // Push below HUD buttons on non-touch portrait screens
      const yStart     = height * 0.055;
      const lineHeight = titleSize * 1.3;

      const panelX = xPos - 8;
      const panelY = yStart - titleSize * 0.6;
      const panelW = width * 0.60;
      const panelH = lineHeight * titleLines.length + ctaSize * 2.2;

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
      ctx.moveTo(panelX + 1, panelY + 6);
      ctx.lineTo(panelX + 1, panelY + panelH - 6);
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
      p.textFont('DM Sans');
      p.textSize(ctaSize);
      p.textStyle(p.NORMAL);
      p.fill(config.colors.main);
      p.text(ctaLine, xPos + 6, yStart + lineHeight * titleLines.length + ctaSize * 0.4);
      p.pop();

    } else {
      // Landscape — title centered-right, left-justified text near the right edge
      // Position so the text block ends near the right ~15% margin
      const titleSize = Math.min(iconSize / 3, height / 16, width / 36);
      const ctaSize   = titleSize * 0.7;
      const lineHeight = titleSize * 1.25;

      // Measure the longest line to right-align the block near right edge
      p.push();
      p.textFont('Syne');
      p.textSize(titleSize);
      p.textStyle(p.BOLD);
      let maxW = 0;
      titleLines.forEach((line) => {
        maxW = Math.max(maxW, p.textWidth(line));
      });
      p.pop();

      // Left edge of the title block: right-aligned with ~8% right margin
      // Start below HUD buttons (~42px) with breathing room
      const xPos   = width * 0.92 - maxW;
      const yStart = height * 0.10;

      const totalHeight = lineHeight * titleLines.length + ctaSize * 1.5;

      ctx.save();
      ctx.strokeStyle = 'rgba(89, 133, 177, 0.65)';
      ctx.lineWidth   = 2;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(xPos - 12, yStart - titleSize * 0.5);
      ctx.lineTo(xPos - 12, yStart + totalHeight - titleSize * 0.3);
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
      p.textFont('DM Sans');
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
      const yPos = this.vp.portrait ? this.vp.height * 0.9 : this.vp.height * 0.85;
      p.push();
      p.textFont('DM Sans');
      p.textSize(this.vp.iconSize / 6);
      p.fill(config.colors.main);
      p.text("Double click the image if you're tired of playing.", this.vp.width / 8, yPos);
      p.pop();
    }
  }

  _drawStats() {
    if (this.totalShots === 0) return;

    const p = this.p;
    const { goalX, goalWidth, goalY, iconSize } = this.vp;
    const centerX = goalX + goalWidth / 2;
    // Position below the last menu item
    const lastMenuY = goalY + (this.categories.length + 1) * 0.4 * iconSize;
    const fontSize = iconSize / 7;
    const lineH = fontSize * 1.6;
    const pct = Math.round((this.totalMakes / this.totalShots) * 100);

    p.push();
    p.textAlign(p.CENTER);
    p.textFont('JetBrains Mono');
    p.noStroke();

    // Divider line
    const divW = goalWidth * 0.5;
    p.stroke('rgba(89, 133, 177, 0.2)');
    p.strokeWeight(1);
    p.line(centerX - divW / 2, lastMenuY, centerX + divW / 2, lastMenuY);
    p.noStroke();

    const startY = lastMenuY + lineH;

    p.textSize(fontSize * 0.75);
    p.fill('rgba(199, 214, 213, 0.45)');
    p.text(`${this.totalShots} shot${this.totalShots !== 1 ? 's' : ''}`, centerX, startY);

    p.fill('rgba(199, 214, 213, 0.45)');
    p.text(`${this.totalMakes} make${this.totalMakes !== 1 ? 's' : ''}`, centerX, startY + lineH);

    p.textSize(fontSize);
    p.fill(config.colors.accent);
    p.text(`${pct}%`, centerX, startY + lineH * 2.2);

    p.pop();
  }

  _captureWebsite() {
    // Throttle: capture every 8 frames (~7.5 fps at 60fps) using drawImage
    // which is much cheaper than p.get() since it stays on the GPU
    this._captureCounter = (this._captureCounter || 0) + 1;
    if (this._captureCounter % 8 !== 1) return;

    const thisSiteBall = this.balls.find((b) => b.project.id === 'thisWebsite');
    if (!thisSiteBall) return;

    const size = Math.round(thisSiteBall.r * 2);
    if (size <= 0) return;

    // Lazily create an offscreen canvas sized to the ball
    if (!this._captureCanvas || this._captureCanvas.width !== size) {
      this._captureCanvas = document.createElement('canvas');
      this._captureCanvas.width = size;
      this._captureCanvas.height = size;
      this._captureCtx = this._captureCanvas.getContext('2d');
    }

    // Draw a scaled-down copy of the main canvas onto the small offscreen canvas
    const srcSize = Math.min(this.vp.width, this.vp.height);
    this._captureCtx.drawImage(
      this.p.drawingContext.canvas,
      0, 0, srcSize, srcSize,
      0, 0, size, size,
    );

    // Reuse a single p5.Image to avoid GC pressure from creating a new one each capture
    if (!this._capturePImg || this._capturePImg.width !== size) {
      this._capturePImg = this.p.createImage(size, size);
    }
    this._capturePImg.drawingContext.drawImage(this._captureCanvas, 0, 0);
    thisSiteBall.ballImage = this._capturePImg;
    thisSiteBall.fullImage = this._capturePImg;
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
    p.textFont('DM Sans');
    p.textSize(arrowSize * 0.8);

    // Left arrow
    if (this.currentPage > 0) {
      p.fill(config.colors.accent);
      p.noStroke();
      p.triangle(
        navX - arrowSize * 3, navY,
        navX - arrowSize * 1.5, navY - arrowSize * 0.6,
        navX - arrowSize * 1.5, navY + arrowSize * 0.6,
      );
    }

    // Page indicator
    p.fill(config.colors.main);
    p.text(`${this.currentPage + 1} / ${this.totalPages}`, navX, navY);

    // Right arrow
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

    // Store hit areas for click detection
    this._pageNavAreas = {
      y: navY, x: navX, size: arrowSize,
    };
  }

  _checkPageNavClick(mx, my) {
    if (!this._pageNavAreas) return false;
    const { x, y, size } = this._pageNavAreas;
    const hitPad = size * 2;

    // Left arrow hit
    if (this.currentPage > 0 &&
        mx > x - size * 4 && mx < x - size &&
        my > y - hitPad && my < y + hitPad) {
      this._changePage(this.currentPage - 1);
      return true;
    }
    // Right arrow hit
    if (this.currentPage < this.totalPages - 1 &&
        mx > x + size && mx < x + size * 4 &&
        my > y - hitPad && my < y + hitPad) {
      this._changePage(this.currentPage + 1);
      return true;
    }
    return false;
  }

  _changePage(newPage) {
    this.currentPage = newPage;

    // Reposition balls for the current page
    const { gridStartX, gridStartY, spacing, gridCols } = this.vp;
    const startIdx = this.currentPage * this.ballsPerPage;
    const endIdx   = Math.min(startIdx + this.ballsPerPage, projects.length);

    let col = 0;
    let row = 0;

    this.balls.forEach((ball) => {
      const isOnPage = ball.index >= startIdx && ball.index < endIdx;
      ball.display = isOnPage;

      if (isOnPage) {
        const gx = gridStartX + col * spacing;
        const gy = gridStartY + row * spacing;
        ball.originalPos = { x: gx, y: gy };
        Matter.Body.setPosition(ball.body, { x: gx, y: gy });
        Matter.Body.setVelocity(ball.body, { x: 0, y: 0 });
        Matter.Body.setStatic(ball.body, true);
        Matter.Body.setAngle(ball.body, 0);
        try { Matter.Composite.remove(this.world, ball.body); } catch (_) {}
        ball.inOriginalPosition = true;
        ball.x = gx;
        ball.y = gy;

        col++;
        if (col >= gridCols) {
          col = 0;
          row++;
        }
      }
    });
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

    // 2-column grid — rows determined by project count
    const gridCols = 2;
    const neededRows = Math.ceil(projects.length / gridCols);

    let goalX, goalY, gridStartX, gridStartY, titleZoneBottom;

    if (portrait) {
      titleZoneBottom = h * 0.15;
      goalX = w * 0.04;
      const goalWidth = w * 0.18;
      goalY = titleZoneBottom + goalWidth * 0.55;
      // Extra padding between menu column and ball grid — enough room to aim at the basket
      const gridLeft = goalX + goalWidth + w * 0.20;

      // Size balls so needed rows fit with breathing room
      const availH = h - titleZoneBottom - h * 0.12;
      const availW = w - gridLeft - w * 0.03;
      const iconFromH = availH / (neededRows * 1.45);
      const iconFromW = availW / (gridCols * 1.45);
      const iconSize = Math.min(iconFromH, iconFromW);
      const spacing = iconSize * 1.45;
      const gridRows = neededRows;

      // Ensure balls start below the title zone with padding
      gridStartX = gridLeft;
      gridStartY = titleZoneBottom + iconSize * 0.8;

      let power = Math.sqrt(iconSize) * (area / 350000);
      if (mobile) power = area / Math.pow(iconSize, 2.7);

      this.ballsPerPage = gridCols * gridRows;
      this.vp = {
        width: w, height: h, portrait, mobile, area, iconSize, power,
        goalX, goalY, goalWidth,
        gridStartX, gridStartY, titleZoneBottom, spacing,
        gridCols, gridRows,
      };
    } else {
      // LANDSCAPE — goal/menu left, ball grid center-left, title near right edge
      goalX = w * 0.03;
      const goalWidth = w * 0.12;
      goalY = h * 0.35;
      titleZoneBottom = h * 0.25;
      const goalColumnEnd = goalX + goalWidth + w * 0.04;

      // Size balls to fit vertically with the actual number of rows needed
      const availH = h - titleZoneBottom - h * 0.06;
      const iconFromH = availH / (neededRows * 1.45);
      // Cap ball size so the grid stays proportional
      const maxIcon = Math.min(w / 8, h / 5);
      const iconSize = Math.min(iconFromH, maxIcon);
      const spacing = iconSize * 1.45;
      const gridRows = neededRows;

      // Center the 2-column grid between goal column end and ~55% of screen width
      const gridW = (gridCols - 1) * spacing + iconSize;
      const gridAreaLeft = goalColumnEnd;
      const gridAreaRight = w * 0.55;
      gridStartX = gridAreaLeft + (gridAreaRight - gridAreaLeft - gridW) / 2 + iconSize / 2;
      gridStartY = titleZoneBottom + iconSize * 0.3;

      let power = Math.sqrt(iconSize) * (area / 350000);

      this.ballsPerPage = gridCols * gridRows;
      this.vp = {
        width: w, height: h, portrait, mobile, area, iconSize, power,
        goalX, goalY, goalWidth,
        gridStartX, gridStartY, titleZoneBottom, spacing,
        gridCols, gridRows,
      };
    }
  }
}
