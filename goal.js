// Need to add objects for the menu ("net") where the collision is only detected if the ball comes from above
// 

class Goal {
    constructor(xPos, yPos, radius) {
        this.body = Matter.Bodies.circle(xPos, yPos, radius, {isStatic: true});
        Matter.World.add(world, this.body);
        this.radius = radius;
    }

    show() {
      push();
      fill(55);
      ellipseMode(CENTER);
      circle(this.body.position.x, this.body.position.y, this.radius);
      pop();
    }

}
