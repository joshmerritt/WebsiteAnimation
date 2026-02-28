/*
  net.js
  ──────
  Invisible barriers to prevent reaching the menu except through the goal posts.
  Fix: Matter.Composite replaces deprecated Matter.World (matter.js v0.19+)
*/

class Net {
  constructor(xPos, yPos, netHeight) {
    const options = { isStatic: true, restitution: 0.99 };
    this.netHeight = netHeight;
    this.width = goalWidth / 8;
    this.body = Matter.Bodies.rectangle(xPos, yPos, this.width, netHeight, options);
    this.body.id = 'Net';
    // ✅ FIX: Matter.Composite.add replaces Matter.World.add
    Matter.Composite.add(world, this.body);
  }

  remove() {
    // ✅ FIX: Matter.Composite.remove replaces Matter.World.remove
    Matter.Composite.remove(world, this.body);
  }

  show() {
    // Subtle dashed side lines framing the net/menu area
    const topY = this.body.position.y - this.netHeight / 2;
    const botY = this.body.position.y + this.netHeight / 2;
    drawingContext.save();
    drawingContext.strokeStyle = 'rgba(89, 133, 177, 0.22)';
    drawingContext.lineWidth = 1;
    drawingContext.setLineDash([2, 5]);
    drawingContext.beginPath();
    drawingContext.moveTo(this.body.position.x, topY);
    drawingContext.lineTo(this.body.position.x, botY);
    drawingContext.stroke();
    drawingContext.restore();
  }
}
