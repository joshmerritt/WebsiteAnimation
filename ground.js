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
        let cornerWedge = Matter.Bodies.polygon(-displayWidth/3, displayHeight*0.75, 3, displayWidth/4, options);
        Matter.Body.setAngle(cornerWedge, -30);
        Matter.World.add(world, this.body);
        Matter.World.add(world, ceiling);
        Matter.World.add(world, leftWall);
        Matter.World.add(world, rightWall);
        Matter.World.add(world, cornerWedge);        
    }

    show() {
      push();
      fill(55);
      rectMode(CENTER);
      rect(this.body.position.x, this.body.position.y, 1.5*windowWidth, this.height);
      pop();
    }
}