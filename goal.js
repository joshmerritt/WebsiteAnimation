class Goal {
    constructor(xPos, yPos, radius) {
        this.body = Matter.Bodies.circle(xPos, yPos, radius, {isStatic: true});
        Matter.World.add(world, this.body);
        this.radius = radius;
    }

    show() {
      const currentPos = this.body.position;
      const currentAngle = this.body.angle;
      push();
      translate(currentPos.x, currentPos.y);
      rotate(currentAngle);
      fill(55);
      ellipseMode(CENTER);
      circle(0, 0, this.radius);
      pop();  
    }

}
