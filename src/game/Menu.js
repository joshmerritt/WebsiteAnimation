/**
 * Menu.js — Category menu item (physics body + label)
 *
 * Font size is passed in from Game.js so the title/menu size hierarchy
 * (title always ≥10% bigger) is guaranteed.
 *
 * Body height reduced to iconSize/5 so balls bounce closer to the text.
 * `highlighted` property set by Game when a ball of this category is being aimed.
 */

import Matter from 'matter-js';
import config from './config.js';

export default class Menu {
  constructor({ world, position, category, index, goalWidth, iconSize, fontSize, p }) {
    this.p = p;
    this.world = world;
    this.category = category;
    this.position = position;
    this.index = index;
    this.width = goalWidth;
    this.height = iconSize / 5;       // thinner body — ball bounces closer to text
    this.fontSize = fontSize || iconSize / 5;
    this.selected = false;
    this.highlighted = false;

    this.body = Matter.Bodies.rectangle(
      position.x, position.y, this.width, this.height,
      {
        isStatic: true,
        restitution: 0.3,
        collisionFilter: {
          group:    index + 1,
          category: Math.pow(2, index),
          mask:     Math.pow(2, index),
        },
      },
    );
    this.body.label    = `Menu_${category}`;
    this.body.category = category;
    Matter.Composite.add(world, this.body);
  }

  show() {
    const p = this.p;
    const isHover = this.onMenu(p.mouseX, p.mouseY);

    p.push();
    p.noStroke();
    p.textAlign(p.CENTER);
    p.textFont('Syne');
    p.textSize(this.fontSize);
    p.textStyle(p.BOLD);

    if (this.selected) {
      p.fill(config.colors.main);
    } else if (this.highlighted) {
      // Category highlight when its ball is being aimed
      p.fill(config.colors.main);
    } else if (isHover) {
      p.fill('rgba(199, 214, 213, 0.75)');
    } else {
      // Subtler than title — lower opacity
      p.fill('rgba(89, 133, 177, 0.72)');
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
