/**
 * Ball.js — Physics-enabled project ball
 *
 * Image quality: Uses native canvas drawImage with source-rectangle
 * cropping from the full-resolution loaded image, bypassing p5's
 * internal scaling for much sharper rendering on desktop/retina.
 */

import Matter from 'matter-js';
import config from './config.js';

export default class Ball {
  constructor({ p, world, project, img, x, y, size, index }) {
    this.p = p;
    this.world = world;
    this.project = project;
    this.index = index;
    this.r = size / 2;

    // Physics body — create dynamic first so Matter.js stores real mass,
    // then set static. This ensures setStatic(false) restores proper mass.
    this.body = Matter.Bodies.circle(x, y, this.r, {
      friction:    config.ball.friction,
      frictionAir: config.ball.frictionAir,
      restitution: config.ball.restitution,
    });
    Matter.Body.setStatic(this.body, true);
    this.body.label    = 'Ball';
    this.body.ballRef  = this;
    this.body.category = project.category;
    this.body.customId = project.name;

    // Keep full image reference for high-quality rendering
    this.fullImage = img;
    // Compute square crop region from center of the source image
    const srcW = img.width;
    const srcH = img.height;
    const minDim = Math.min(srcW, srcH);
    this._cropX = Math.floor((srcW - minDim) / 2);
    this._cropY = Math.floor((srcH - minDim) / 2);
    this._cropSize = minDim;

    // Fallback p5 cropped image (used by _captureWebsite override)
    this.ballImage = img.get(this._cropX, this._cropY, minDim, minDim);
    this.imageSrc = `assets/images/${project.id}.jpg`;

    // Position / interaction state
    this.originalPos = { x, y };
    this.x = x;
    this.y = y;
    this.xPower = 0;
    this.yPower = 0;
    this.clicked = false;
    this.inOriginalPosition = true;
    this.launchCount = 0;
    this.pageOpen = false;
    this.display = true;

    // Stats
    this.makes = 0;
    this.opens = 0;
  }

  get category() { return this.project.category; }
  get name()     { return this.project.name; }

  getDetailData() {
    return {
      name:        this.project.name,
      link:        this.project.link,
      goal:        this.project.goal,
      role:        this.project.role,
      technology:  this.project.technology,
      description: this.project.description,
      imageSrc:    this.imageSrc,
      heroMode:    this.project.heroMode || 'banner',
    };
  }

  openDetail() {
    if (this.pageOpen) return null;
    this.makes++;
    this.pageOpen = true;
    return this.getDetailData();
  }

  closeDetail() { this.pageOpen = false; }

  onBall(mx, my) {
    return this.p.dist(mx, my, this.x, this.y) < this.r;
  }

  // ── Drawing ────────────────────────────────────────────────────────────

  show(viewport) {
    if (this.launchCount) this._checkReset(viewport);

    const pos = this.inOriginalPosition ? this.originalPos : this.body.position;
    const angle = this.body.angle;
    const p = this.p;
    const ctx = p.drawingContext;
    const diameter = this.r * 2;

    p.push();
    p.translate(pos.x, pos.y);
    p.rotate(angle);

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    ctx.clip();

    // Draw directly from full-res source with square crop
    // Browser bicubic interpolation >> p5's software scaling
    const srcCanvas = this.fullImage.canvas || this.fullImage.drawingContext?.canvas;
    if (srcCanvas) {
      ctx.drawImage(
        srcCanvas,
        this._cropX, this._cropY, this._cropSize, this._cropSize,
        -this.r, -this.r, diameter, diameter,
      );
    } else {
      p.imageMode(p.CENTER);
      p.image(this.ballImage, 0, 0, diameter, diameter);
    }
    ctx.restore();

    // Border ring
    p.noFill();
    p.stroke(config.colors.main);
    p.strokeWeight(this.r / 25);
    p.ellipseMode(p.CENTER);
    p.circle(0, 0, diameter);

    p.pop();

    this.x = pos.x;
    this.y = pos.y;
  }

  hover(iconSize, totalShots) {
    const p = this.p;
    p.angleMode(p.DEGREES);

    const arrowLen = iconSize / 22;
    const angle = 45;
    const ls = {
      x: this.x - this.r * p.sin(angle),
      y: this.y - this.r * p.cos(angle),
    };
    const le = { x: ls.x - this.r / 2, y: ls.y - this.r / 2 };
    const pA = { x: le.x - p.sin(angle) * arrowLen * 2, y: le.y - p.cos(angle) * arrowLen * 2 };
    const pB = { x: le.x + p.cos(angle) * arrowLen,     y: le.y - p.sin(angle) * arrowLen };
    const pC = { x: le.x - p.cos(angle) * arrowLen,     y: le.y + p.sin(angle) * arrowLen };

    p.push();
    if (totalShots < 3) {
      p.textAlign(p.CENTER);
      p.fill(config.colors.main);
      p.textSize(iconSize / 9);
      p.textFont('Syne');
      p.text('Drag to aim',       this.x, this.y + this.r * 1.3);
      p.text('Release to launch', this.x, this.y + this.r * 1.3 + iconSize / 8);
    }
    p.stroke(config.colors.accent);
    p.strokeWeight(iconSize / 20);
    p.noFill();
    p.ellipseMode(p.CENTER);
    p.circle(this.x, this.y, this.r * 2);
    p.fill(config.colors.accent);
    p.line(ls.x, ls.y, le.x, le.y);
    p.triangle(pA.x, pA.y, pB.x, pB.y, pC.x, pC.y);
    p.pop();
    p.angleMode(p.RADIANS);
  }

  aim(powerScale) {
    const p = this.p;
    p.angleMode(p.DEGREES);

    this.xPower += ((p.mouseX - p.pmouseX) / this._sensitivity()) * powerScale;
    this.yPower += ((p.mouseY - p.pmouseY) / this._sensitivity()) * powerScale;

    const ls = { x: this.x - this.r * p.sin(45), y: this.y - this.r * p.cos(45) };
    const cx = ls.x - this.xPower * 2;
    const cy = ls.y - this.yPower * 2;
    const arrowLen = this.r / 4;
    const angle = p.atan2(this.xPower, this.yPower);
    const pA = { x: cx - p.sin(angle) * arrowLen * 2, y: cy - p.cos(angle) * arrowLen * 2 };
    const pB = { x: cx + p.cos(angle) * arrowLen,     y: cy - p.sin(angle) * arrowLen };
    const pC = { x: cx - p.cos(angle) * arrowLen,     y: cy + p.sin(angle) * arrowLen };

    p.push();
    p.stroke(config.colors.accent);
    p.strokeWeight(5);
    p.noFill();
    p.ellipseMode(p.CENTER);
    p.circle(this.x, this.y, this.r * 2);
    p.fill(config.colors.accent);
    p.line(ls.x, ls.y, cx, cy);
    p.triangle(pA.x, pA.y, pB.x, pB.y, pC.x, pC.y);
    p.pop();
    p.angleMode(p.RADIANS);
  }

  demoAim() {
    this.show({ width: 9999, height: 9999 });
    const p = this.p;
    p.angleMode(p.DEGREES);
    const ls = { x: this.x - this.r * p.sin(45), y: this.y - this.r * p.cos(45) };
    const cx = ls.x - this.xPower * 2;
    const cy = ls.y - this.yPower * 2;
    const arrowLen = this.r / 4;
    const angle = p.atan2(this.xPower, this.yPower);
    const pA = { x: cx - p.sin(angle) * arrowLen * 2, y: cy - p.cos(angle) * arrowLen * 2 };
    const pB = { x: cx + p.cos(angle) * arrowLen,     y: cy - p.sin(angle) * arrowLen };
    const pC = { x: cx - p.cos(angle) * arrowLen,     y: cy + p.sin(angle) * arrowLen };

    p.push();
    p.stroke(config.colors.accent);
    p.strokeWeight(5);
    p.noFill();
    p.ellipseMode(p.CENTER);
    p.circle(this.x, this.y, this.r * 2);
    p.fill(config.colors.accent);
    p.line(ls.x, ls.y, cx, cy);
    p.triangle(pA.x, pA.y, pB.x, pB.y, pC.x, pC.y);
    p.pop();
    p.angleMode(p.RADIANS);
  }

  launched() {
    this.launchCount++;
    this.inOriginalPosition = false;
  }

  reset() {
    Matter.Body.setVelocity(this.body, { x: 0, y: 0 });
    Matter.Body.setPosition(this.body, this.originalPos);
    Matter.Body.setStatic(this.body, true);
    Matter.Body.setAngle(this.body, 0);
    Matter.Composite.remove(this.world, this.body);
    this.inOriginalPosition = true;
  }

  _sensitivity() {
    const area = this.p.width * this.p.height;
    return Math.pow(area, 1 / 3);
  }

  _checkReset(viewport) {
    const { x, y } = this.body.position;
    const r2 = this.r * 2;
    if (x + r2 < 0 || x - r2 > viewport.width || y + r2 < -viewport.height * 4 || y - r2 > viewport.height) {
      this.reset();
    }
  }
}
