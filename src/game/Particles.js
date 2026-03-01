/**
 * Particles.js — Lightweight particle burst system
 *
 * Spawns a radial burst of particles at a given position.
 * Drawn on the p5 canvas each frame; particles fade and die automatically.
 */

import config from './config.js';

class Particle {
  constructor(x, y, color) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 4;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - 1.5; // slight upward bias
    this.life = 1.0;
    this.decay = 0.015 + Math.random() * 0.02;
    this.size = 2 + Math.random() * 4;
    this.color = color;
    this.gravity = 0.06;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.vx *= 0.98;
    this.life -= this.decay;
  }

  get alive() {
    return this.life > 0;
  }
}

export default class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  /**
   * Spawn a burst of particles at (x, y).
   * @param {number} x
   * @param {number} y
   * @param {number} count — number of particles (default 35)
   * @param {string} color — CSS color string
   */
  burst(x, y, count = 35, color = config.colors.accent) {
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(x, y, color));
    }
  }

  /** Update all particles. Call once per frame. */
  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (!this.particles[i].alive) {
        this.particles.splice(i, 1);
      }
    }
  }

  /** Draw all particles. Call once per frame after update(). */
  draw(p) {
    if (this.particles.length === 0) return;

    const ctx = p.drawingContext;
    ctx.save();

    for (const pt of this.particles) {
      const alpha = pt.life * 0.85;
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillStyle = pt.color;

      // Soft glow (larger, faded circle — cheaper than shadowBlur)
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * pt.life * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * pt.life, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  get active() {
    return this.particles.length > 0;
  }

  clear() {
    this.particles = [];
  }
}
