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
        //this.ceiling = Matter.Bodies.rectangle(this.displayWidth/4, -this.displayHeight*2, this.width, this.displayHeight*3, options);
        this.leftWall = Matter.Bodies.rectangle(-this.width/2, -this.displayHeight/2, this.width, this.displayHeight*3, options);
        this.rightWall = Matter.Bodies.rectangle(this.displayWidth+this.width/2, -this.displayHeight/2, this.width, this.displayHeight*3, options)
        //this.ceiling.id = 'ceiling';
        this.leftWall.id = 'leftWall';
        this.rightWall.id = 'rightWall';
        //Matter.World.add(world, this.ceiling);
        Matter.World.add(world, this.leftWall);
        Matter.World.add(world, this.rightWall);  
    }

    remove() {
        //Matter.World.remove(world, this.ceiling);
        Matter.World.remove(world, this.leftWall);
        Matter.World.remove(world, this.rightWall);
    }
}