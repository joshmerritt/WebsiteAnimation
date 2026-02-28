/*
  boundary.js
  ───────────
  Fix: Matter.Composite replaces deprecated Matter.World (matter.js v0.19+)
*/

class Boundary {
  constructor(displayWidth, displayHeight, boundaryWidth) {
    this.displayWidth  = displayWidth;
    this.displayHeight = displayHeight;
    this.width         = boundaryWidth;
  }

  add() {
    const options = { isStatic: true, restitution: 0.5 };
    this.leftWall  = Matter.Bodies.rectangle(-this.width / 2, -this.displayHeight / 2, this.width, this.displayHeight * 3, options);
    this.rightWall = Matter.Bodies.rectangle(this.displayWidth + this.width / 2, -this.displayHeight / 2, this.width, this.displayHeight * 3, options);
    this.leftWall.id  = 'leftWall';
    this.rightWall.id = 'rightWall';
    // ✅ FIX: Matter.Composite.add replaces Matter.World.add
    Matter.Composite.add(world, this.leftWall);
    Matter.Composite.add(world, this.rightWall);
  }

  remove() {
    // ✅ FIX: Matter.Composite.remove replaces Matter.World.remove
    Matter.Composite.remove(world, this.leftWall);
    Matter.Composite.remove(world, this.rightWall);
  }
}
