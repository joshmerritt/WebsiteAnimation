/**
 * Goal.js — Goal post physics body + rendering
 */

import Matter from 'matter-js';
import config from './config.js';

export default class Goal {
  constructor({ world, x, y, radius, index, p }) {
    this.p = p;
    this.world = world;
    this.radius = radius;
    this.body = Matter.Bodies.circle(x, y, radius, {
      isStatic: true,
      restitution: config.goal.restitution,
    });
    this.body.id = `Goal${index}`;
    Matter.Composite.add(world, this.body);
  }

  show() {
    const p = this.p;
    const drawX = this.body.position.x;
    const drawY = this.body.position.y - this.radius * 1.5;

    p.push();
    p.stroke(config.colors.accent);
    p.strokeWeight(this.radius * 0.6);
    p.noFill();
    p.ellipseMode(p.CENTER);
    p.circle(drawX, drawY, this.radius * 2);
    p.pop();
  }

  remove() {
    Matter.Composite.remove(this.world, this.body);
  }
}
