/*
Provided a name of the category and the order it appears, construct menu links
Balls will bounce and open the page when it goes through the goal
*/

class Menu {
    constructor(position, category, order) {
        let options = {
            isStatic: true, 
            restitution: 0.5,
            collisionFilter:
            {
                // 'group': -1,
                'category': order,
                //'mask': 0,
            }
        }
        this.category = category;
        this.position = position;
        this.order = order;
        this.body = Matter.Bodies.rectangle(position.x, this.position.y + (this.order) * 0.7*iconSize, iconSize, iconSize/3, options);
        Matter.World.add(world, this.body);
    }

    show() {
      push();
      rectMode(CENTER);
      textAlign(CENTER);
      textSize(iconSize/4)
      fill(151); 
      text(this.category, this.position.x + 0.7*iconSize, this.position.y + (this.order) * 0.7*iconSize);
      pop();
    }
}