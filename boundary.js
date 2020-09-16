class Boundary {
    constructor(displayWidth, displayHeight, boundaryWidth) {
        let options = {
            isStatic: true, 
            restitution: .5
        };
        this.width = boundaryWidth;
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

    // show() {
    //   push();
    //   fill(55);
    //   rectMode(CENTER);
    //   rect(this.body.position.x, this.body.position.y, 1.5*windowWidth, this.width);
    //   pop();
    // }
}