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
    // Invisible — uncomment below to debug net placement:
    // push();
    // fill('red');
    // rectMode(CENTER);
    // rect(this.body.position.x, this.body.position.y, this.width, this.netHeight);
    // pop();
  }
}
