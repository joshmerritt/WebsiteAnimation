/*
Provided a name of the category and the order it appears, construct menu links
Balls will bounce and open the page when it goes through the goal
*/

class Menu {
    constructor(categoryName, index) {
        fill(0, 102, 153); 
        text(categoryName, iconSize, goalPosition.y + iconSize*(index+1));
        // let options = {
        //     isStatic: true, 
        //     restitution: 0.5
        // };
        // this.body = Matter.Bodies.rectangle(0, displayHeight - groundHeight, displayWidth, groundHeight, options);
        // Matter.World.add(world, this.body);
        // this.height = groundHeight;
    }

    // show() {
    //   push();
    //   fill(55);
    //   rectMode(CENTER);
    //   rect(this.body.position.x, this.body.position.y, windowWidth, this.height);
    //   pop();
    // }
}