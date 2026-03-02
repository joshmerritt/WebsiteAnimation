/**
 * Goal.js — Goal post physics body + rendering
 *
 * Dots are subtle — thin stroke, reduced opacity to keep visual
 * hierarchy focused on balls and title.
 * Dots rendered at 50% of physics radius for smaller visual footprint.
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
    this.body.label = `Goal${index}`;
    Matter.Composite.add(world, this.body);
  }

  show() {
    const p = this.p;
    const drawX = this.body.position.x;
    const drawY = this.body.position.y - this.radius * 1.5;

    // Visual radius is 50% of physics radius for smaller dots
    const visualRadius = this.radius * 0.5;

    p.push();
    p.stroke('rgba(89, 133, 177, 0.55)');
    p.strokeWeight(visualRadius * 0.3);
    p.noFill();
    p.ellipseMode(p.CENTER);
    p.circle(drawX, drawY, visualRadius * 2);
    p.pop();
  }

  remove() {
    Matter.Composite.remove(this.world, this.body);
  }
}
