class Ground {
    constructor(displayWidth, displayHeight, groundHeight) {
        let options = {
            isStatic: true, 
            restitution: .5,
            id: "ground"
        };
        this.body = Matter.Bodies.rectangle(displayWidth/4, displayHeight, 1.5*displayWidth, groundHeight, options);
        this.height = groundHeight;
        let ceiling = Matter.Bodies.rectangle(displayWidth/4, -displayHeight, 1.5*displayWidth, groundHeight*2, options);
        let leftWall = Matter.Bodies.rectangle(-groundHeight*2, height/2, 2*groundHeight, 2*height, options);
        let rightWall = Matter.Bodies.rectangle(displayWidth+groundHeight, displayHeight/4, groundHeight*2, 1.5*displayHeight, options)
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
      rect(this.body.position.x, this.body.position.y, 1.5*width, this.height);
      pop();
    }
}