/**
 * Menu.js — Category menu item (physics body + label)
 */

import Matter from 'matter-js';
import config from './config.js';

export default class Menu {
  constructor({ world, position, category, index, goalWidth, iconSize, p }) {
    this.p = p;
    this.world = world;
    this.category = category;
    this.position = position;
    this.index = index;
    this.width = goalWidth;
    this.height = iconSize / 2;
    this.selected = false;

    this.body = Matter.Bodies.rectangle(
      position.x, position.y, this.width, this.height,
      {
        isStatic: true,
        restitution: 1,
        collisionFilter: {
          group:    index + 1,
          category: Math.pow(2, index),
          mask:     Math.pow(2, index),
        },
      },
    );
    this.body.id       = category;
    this.body.category = category;
    Matter.Composite.add(world, this.body);
  }

  show() {
    const p = this.p;
    const isHover = this.onMenu(p.mouseX, p.mouseY);

    p.push();
    p.noStroke();
    p.textAlign(p.CENTER);
    p.textFont('DM Sans');
    p.textSize(this.height / 2.25);
    p.textStyle(this.selected || isHover ? p.BOLD : p.NORMAL);

    if (this.selected) {
      p.fill(config.colors.main);
    } else if (isHover) {
      p.fill('rgba(199, 214, 213, 0.85)');
    } else {
      p.fill(config.colors.secondary);
    }
    p.text(this.category, this.position.x, this.position.y);
    p.pop();
  }

  onMenu(mx, my) {
    const pad = this.category.length / 20;
    const xMin = this.position.x - pad * this.width;
    const xMax = this.position.x + pad * this.width;
    const yMin = this.position.y - this.height / 2;
    const yMax = this.position.y;
    return mx > xMin && mx < xMax && my > yMin && my < yMax;
  }

  remove() {
    Matter.Composite.remove(this.world, this.body);
  }
}
