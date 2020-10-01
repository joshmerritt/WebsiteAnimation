class Boundary {
    constructor(displayWidth, displayHeight, boundaryWidth) {
        this.displayWidth = displayWidth;
        this.displayHeight = displayHeight;
        this.width = boundaryWidth;
  
    }

    add() {
        let options = {
            isStatic: true, 
            restitution: .5
        };
        let ceiling = Matter.Bodies.rectangle(displayWidth/4, -displayHeight*2, boundaryWidth, displayHeight*3, options);
        let leftWall = Matter.Bodies.rectangle(-boundaryWidth/2, -displayHeight/2, boundaryWidth, displayHeight*3, options);
        let rightWall = Matter.Bodies.rectangle(displayWidth+boundaryWidth, -displayHeight/2, boundaryWidth, displayHeight*3, options)
        ceiling.id = 'ceiling';
        leftWall.id = 'leftWall';
        rightWall.id = 'rightWall';
        Matter.World.add(world, ceiling);
        Matter.World.add(world, leftWall);
        Matter.World.add(world, rightWall);  
    }

    remove() {
        Matter.World.remove(world, ceiling);
        Matter.World.remove(world, leftWall);
        Matter.World.remove(world, rightWall);
    }
    // show() {
    //   push();
    //   fill(55);
    //   rectMode(CENTER);
    //   rect(this.body.position.x, this.body.position.y, 1.5*windowWidth, this.width);
    //   pop();
    // }
}