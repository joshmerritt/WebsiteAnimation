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
    noFill();
    noStroke();

    // Pill background
    const isHover  = this.onMenu(mouseX, mouseY);
    const pillH    = iconSize / 2.8;
    const pillW    = goalWidth * 0.92;
    const pillX    = this.position.x - pillW / 2;
    const pillY    = this.position.y - pillH * 0.78;
    const fillAlpha   = this.selected ? 0.22 : (isHover ? 0.1 : 0.05);
    const borderAlpha = this.selected ? 0.65 : (isHover ? 0.35 : 0.18);

    drawingContext.save();
    drawingContext.beginPath();
    if (drawingContext.roundRect) {
      drawingContext.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
    } else {
      drawingContext.arc(pillX + pillH / 2, pillY + pillH / 2, pillH / 2, Math.PI / 2, -Math.PI / 2, true);
      drawingContext.lineTo(pillX + pillW - pillH / 2, pillY);
      drawingContext.arc(pillX + pillW - pillH / 2, pillY + pillH / 2, pillH / 2, -Math.PI / 2, Math.PI / 2, false);
      drawingContext.closePath();
    }
    drawingContext.fillStyle   = `rgba(89, 133, 177, ${fillAlpha})`;
    drawingContext.strokeStyle = `rgba(89, 133, 177, ${borderAlpha})`;
    drawingContext.lineWidth   = 1;
    drawingContext.fill();
    drawingContext.stroke();
    drawingContext.restore();

    textAlign(CENTER);
    textFont('Inter');
    textSize(iconSize / 4.5);
    textStyle(this.selected || isHover ? BOLD : NORMAL);
    fill(this.selected ? config.mainColor : config.secondaryColor);
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
