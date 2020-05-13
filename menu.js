/*
Provided a name of the category and the order it appears, construct menu links
Balls will bounce and open the page when it goes through the goal
*/

class Menu {
    constructor(position, category, index) {
        let options = {
            isStatic: true, 
            restitution: 0.5
        };
        this.category = category;
        this.position = position;
        this.index = index;
        this.body = Matter.Bodies.rectangle(position.x, position.y + (index + 1) * iconSize/3, iconSize, iconSize/3, options);
        // Matter.World.add(world, this.body);
        // this.height = groundHeight;
    }

    show() {
      push();
      rectMode(CENTER);
      textAlign(CENTER);
      textSize(iconSize/4)
      fill(151); 
      text(this.category, this.position.x + 0.7*iconSize, this.position.y + (this.index + 1) * 0.7*iconSize);
      pop();
    }
}