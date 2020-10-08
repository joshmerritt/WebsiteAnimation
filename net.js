/*
    class for the invisible net barriers to prevent reaching the menu except through the goal posts
    x,y positions are passed in as parameters, along with the desired height of the net
*/

class Net {
    constructor(xPos, yPos, netHeight) {
        let options = {
          isStatic: true,
          restitution: 0.99,
        };
        this.netHeight = netHeight;
        this.width = goalWidth/10;
        this.body = Matter.Bodies.rectangle(xPos, yPos, this.width, netHeight, options);
        this.body.id = "Net"
        Matter.World.add(world, this.body);
    }

    remove() {
        Matter.World.remove(world, this.body);
    }

    show() {
        // push();
        // fill('red');
        // rectMode(CENTER);
        // rect(this.body.position.x, this.body.position.y, this.width, this.netHeight);
        // pop();
    }
      
}
