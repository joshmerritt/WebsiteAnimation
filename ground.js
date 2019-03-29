class Ground {
    constructor(displayWidth, displayHeight, groundHeight) {
        let options = {
            isStatic: true, 
            restitution: 0.5
        };
        this.body = Matter.Bodies.rectangle(0, displayHeight - groundHeight, displayWidth, groundHeight, options);
        Matter.World.add(world, this.body);
        this.height = groundHeight;
    }

    show() {
      push();
      fill(55);
      rectMode(CENTER);
      rect(this.body.position.x, this.body.position.y, windowWidth, this.height);
      pop();
    }
}