class Ground {
    constructor(displayWidth, displayHeight, groundHeight) {
        let options = {
            isStatic: true, 
            restitution: 1,
            id: "boundary"
        };
        console.log("dW +++ dH +++ gH", displayWidth,"+++", displayHeight,"+++", groundHeight);
        this.body = Matter.Bodies.rectangle(displayWidth/4, 0.9*displayHeight, 1.5*displayWidth, groundHeight, options);
        this.height = groundHeight;
        let ceiling = Matter.Bodies.rectangle(displayWidth/4, -displayHeight/2, 1.5*displayWidth, groundHeight*2, options);
        let leftWall = Matter.Bodies.rectangle(-displayWidth/2, displayHeight/4, groundHeight*2, 1.5*displayHeight, options);
        let rightWall = Matter.Bodies.rectangle(displayWidth+groundHeight, displayHeight/4, groundHeight*2, 1.5*displayHeight, options)
        Matter.World.add(world, ceiling);
        Matter.World.add(world, leftWall);
        Matter.World.add(world, this.body);
        Matter.World.add(world, rightWall);        
    }

    show() {
      push();
      fill(55);
      rectMode(CENTER);
      rect(this.body.position.x, this.body.position.y, 1.5*windowWidth, this.height);
      pop();
    }
}