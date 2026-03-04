/**
 * Boundary.js — Left and right walls that keep balls in the playfield
 */

import Matter from 'matter-js';
import config from './config.js';

export default class Boundary {
  constructor({ world, width, height, thickness }) {
    this.world = world;
    const rightOpts = { isStatic: true, restitution: config.boundary.restitution };
    const leftOpts  = { isStatic: true, restitution: config.boundary.leftRestitution };

    this.leftWall = Matter.Bodies.rectangle(
      -thickness / 2, -height / 2, thickness, height * 3, leftOpts,
    );
    this.rightWall = Matter.Bodies.rectangle(
      width + thickness / 2, -height / 2, thickness, height * 3, rightOpts,
    );
    this.leftWall.label  = 'leftWall';
    this.rightWall.label = 'rightWall';

    Matter.Composite.add(world, this.leftWall);
    Matter.Composite.add(world, this.rightWall);
  }

  remove() {
    Matter.Composite.remove(this.world, this.leftWall);
    Matter.Composite.remove(this.world, this.rightWall);
  }
}
