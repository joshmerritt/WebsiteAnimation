class Ground {
    constructor(displayWidth, displayHeight, groundHeight) {
        let options = {
            isStatic: true, 
            restitution: .5,
            id: "ground",
        };
        this.body = Matter.Bodies.rectangle(displayWidth/4, displayHeight, 1.5*displayWidth, groundHeight, options);
        this.height = groundHeight;
        let ceiling = Matter.Bodies.rectangle(displayWidth/4, -displayHeight*2, displayWidth*1.5, displayHeight*3, options);
        let leftWall = Matter.Bodies.rectangle(-groundHeight, -displayHeight/2, groundHeight*2, displayHeight*3, options);
        let rightWall = Matter.Bodies.rectangle(displayWidth+groundHeight, -displayHeight/2, groundHeight*2, displayHeight*3, options)
        ceiling.id = 'ceiling';
        leftWall.id = 'leftWall';
        rightWall.id = 'rightWall';
        Matter.World.add(world, this.body);
        Matter.World.add(world, ceiling);
        Matter.World.add(world, leftWall);
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