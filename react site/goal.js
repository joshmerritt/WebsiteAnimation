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
    push();
    fill(config.accentColor);
    ellipseMode(CENTER);
    circle(this.body.position.x, this.body.position.y, this.radius);
    pop();
  }
}
