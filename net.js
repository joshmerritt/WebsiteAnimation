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
        this.body = Matter.Bodies.rectangle(xPos, yPos, iconSize/10, netHeight, options);
        Matter.World.add(world, this.body);
    }
}
