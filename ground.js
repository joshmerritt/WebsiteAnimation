class Ground {
    constructor(displayWidth, displayHeight, groundHeight) {
        let options = {
            isStatic: true, 
            restitution: 1,
            id: "ground"
        };
        console.log("dW +++ dH +++ gH", displayWidth,"+++", displayHeight,"+++", groundHeight);
        this.body = Matter.Bodies.rectangle(displayWidth/4, displayHeight, 1.5*displayWidth, groundHeight, options);
        let ceiling = Matter.Bodies.rectangle(displayWidth/4, -displayHeight/2, 1.5*displayWidth, groundHeight, options);
        let leftWall = Matter.Bodies.rectangle(-displayWidth/2, displayHeight/4, groundHeight, 1.5*displayHeight, options);
        Matter.World.add(world, ceiling);
        Matter.World.add(world, leftWall);
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