/*
Provid locatiopn, name of the category, and the order it appears, construct menu item
Balls will bounce and open the page when it goes through the goal
*/

class Menu {
    constructor(position, category, index) {
        let options = {
            isStatic: true, 
            restitution: 0.5,
            collisionFilter:
            {
                // 'group': -1,
                'category': Math.pow(2, index),
                'mask': Math.pow(2, index)
            }
        }
        this.category = category;
        this.position = position;
        this.index = index;
        this.body = Matter.Bodies.rectangle(position.x, this.position.y, iconSize, iconSize/3, options);
        this.body.id = category;
        this.body.category = category;
        Matter.World.add(world, this.body);
    }

    show() {
      push();
      //rectMode(CENTER);
      //rect(this.position.x, this.position.y, iconSize, iconSize/3);
      textAlign(CENTER);
      textSize(iconSize/4)
      fill(22); 
      text(this.category, this.position.x, this.position.y);
      pop();
    }
}