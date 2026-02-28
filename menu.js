/*
  menu.js
  ───────
  Category menu items shown below the goal posts.
  Balls bounce off their matching category's menu item to open the detail page.
  Fix: Matter.Composite replaces deprecated Matter.World (matter.js v0.19+)
*/

class Menu {
  constructor(position, category, index) {
    const options = {
      isStatic: true,
      restitution: 1,
      collisionFilter: {
        group:    index + 1,
        category: Math.pow(2, index),
        mask:     Math.pow(2, index),
      },
    };
    this.width    = goalWidth;
    this.height   = iconSize / 2;
    this.category = category;
    this.position = position;
    this.index    = index;
    this.body     = Matter.Bodies.rectangle(position.x, position.y, this.width, this.height, options);
    this.body.id       = category;
    this.body.category = category;
    // ✅ FIX: Matter.Composite.add replaces Matter.World.add
    Matter.Composite.add(world, this.body);
    this.selected = false;
  }

  show() {
    push();
    const isHover = this.onMenu(mouseX, mouseY);
    noStroke();
    textAlign(CENTER);
    textFont('Inter');
    textSize(iconSize / 4.5);
    textStyle(this.selected || isHover ? BOLD : NORMAL);
    if (this.selected) {
      fill(config.mainColor);
    } else if (isHover) {
      fill('rgba(199, 214, 213, 0.85)');
    } else {
      fill(config.secondaryColor);
    }
    text(this.category, this.position.x, this.position.y);
    pop();
  }

  onMenu(x, y) {
    const menuLength = this.category.length / 20;
    const xMin = this.position.x - menuLength * this.width;
    const xMax = this.position.x + menuLength * this.width;
    const yMin = this.position.y - this.height / 2;
    const yMax = this.position.y;
    return x > xMin && x < xMax && y > yMin && y < yMax;
  }
}
