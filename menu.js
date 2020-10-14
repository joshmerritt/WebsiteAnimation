/*
Provided location, name of the category, and the order it appears, construct menu item
Balls will bounce and open the page when it goes through the goal
*/

class Menu {
    constructor(position, category, index) {
        let options = {
            isStatic: true, 
            restitution: 1,
            collisionFilter:
            {
                'group': index+1,
                'category': Math.pow(2, index),
                'mask': Math.pow(2, index)
            }
        }
        this.width = goalWidth;
        this.height = iconSize/2;
        this.category = category;
        this.position = position;
        this.index = index;
        this.body = Matter.Bodies.rectangle(position.x, position.y, this.width, this.height, options);
        this.body.id = category;
        this.body.category = category;
        Matter.World.add(world, this.body);
        this.selected = false;
    }

    show() {
      push();
      // rectMode(CENTER);
      // rect(this.position.x, this.position.y, this.width, this.height);
      textAlign(CENTER);
      textSize(iconSize/4)
      fill(config.mainColor); 
      if(this.selected) fill(config.accentColor);
      text(this.category, this.position.x, this.position.y);
      pop();
    }

    onMenu(x, y) {
        let menuLength = this.category.length;
        let xMin = this.position.x - (this.position.x*menuLength/20);
        let xMax = this.position.x + (this.position.x*menuLength/20);
        let yMin = this.position.y - (iconSize/8);
        let yMax = this.position.y + (iconSize/8);
        let onX = (x > xMin && x < xMax);
        let onY = (y > yMin && y < yMax);
        return onX && onY;
    }

    select() {

    }
}