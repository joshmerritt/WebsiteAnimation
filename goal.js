/*
  goal.js
  ───────
  Fix: Matter.Composite replaces deprecated Matter.World (matter.js v0.19+)
*/

class Goal {
  constructor(xPos, yPos, radius, index) {
    const options = { isStatic: true, restitution: 0.99 };
    this.body = Matter.Bodies.circle(xPos, yPos, radius, options);
    this.body.id = 'Goal' + index;
    // ✅ FIX: Matter.Composite.add replaces Matter.World.add
    Matter.Composite.add(world, this.body);
    this.radius = radius;
  }

  show() {
    // Draw rim post slightly above the physics body so it crowns the net
    const drawX = this.body.position.x;
    const drawY = this.body.position.y - this.radius * 1.5;
    push();
    stroke(config.accentColor);
    strokeWeight(this.radius * 0.6);
    noFill();
    ellipseMode(CENTER);
    circle(drawX, drawY, this.radius * 2);
    pop();
  }
}
