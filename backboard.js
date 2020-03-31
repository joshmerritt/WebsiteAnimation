class Backboard {
    constructor(goalHeight) {
        let options = {
            isStatic: true, 
            restitution: 0.5
        };
        this.body = Matter.Bodies.rectangle(0, 0, 10, goalHeight, options);
        Matter.World.add(world, this.body);
        this.height = goalHeight;
    }

    show() {
      push();
      fill(55);
      rectMode(CENTER);
      rect(this.body.position.x, this.body.position.y, 0, this.height);
      pop();
    }
}