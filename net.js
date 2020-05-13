// Need to add objects for the menu ("net") where the collision is only detected if the ball comes from above
// 

class Net {
    constructor(xPos, yPos, netHeight) {
        let options = {
          isStatic: true,
          restitution: 0.99,
        };
        console.log('net constructor - xpos, ypos, netHeight', xPos, yPos, netHeight)
        this.body = Matter.Bodies.rectangle(xPos - iconSize/5, yPos, xPos + iconSize/10, yPos + netHeight, options);
        Matter.World.add(world, this.body);
    }

    // show() {
    //   push();
    //   fill(55);
    //   ellipseMode(CENTER);
    //   circle(this.body.position.x, this.body.position.y, this.radius);
    //   pop();
    // }

}
