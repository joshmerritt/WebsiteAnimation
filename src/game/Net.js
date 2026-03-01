/**
 * Net.js — Invisible barriers framing the goal/menu area
 */

import Matter from 'matter-js';
import config from './config.js';

export default class Net {
  constructor({ world, x, y, height, goalWidth, p }) {
    this.p = p;
    this.world = world;
    this.netHeight = height;
    this.width = goalWidth / 8;
    this.body = Matter.Bodies.rectangle(x, y, this.width, height, {
      isStatic: true,
      restitution: config.goal.restitution,
    });
    this.body.id = 'Net';
    Matter.Composite.add(world, this.body);
  }

  show() {
    const ctx = this.p.drawingContext;
    const topY = this.body.position.y - this.netHeight / 2;
    const botY = this.body.position.y + this.netHeight / 2;

    ctx.save();
    ctx.strokeStyle = 'rgba(89, 133, 177, 0.18)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.moveTo(this.body.position.x, topY);
    ctx.lineTo(this.body.position.x, botY);
    ctx.stroke();
    ctx.restore();
  }

  remove() {
    Matter.Composite.remove(this.world, this.body);
  }
}
