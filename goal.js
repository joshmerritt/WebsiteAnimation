class Goal {
    constructor(xPos, yPos, radius, index) {
      let options = {
        isStatic: true,
        restitution: 0.99,
      };
      this.body = Matter.Bodies.circle(xPos, yPos, radius, options);
      this.body.id = 'Goal' + index;
      Matter.World.add(world, this.body);
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


