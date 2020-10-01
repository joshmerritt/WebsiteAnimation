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
        let ceiling = Matter.Bodies.rectangle(this.displayWidth/4, -this.displayHeight*2, this.width, this.displayHeight*3, options);
        let leftWall = Matter.Bodies.rectangle(-this.width/2, -this.displayHeight/2, this.width, this.displayHeight*3, options);
        let rightWall = Matter.Bodies.rectangle(this.displayWidth+this.width, -this.displayHeight/2, this.width, this.displayHeight*3, options)
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