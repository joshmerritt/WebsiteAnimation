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
        console.log("onMenu this", this, );
        let menuLength = this.category.length/20;
        console.log("menu length", menuLength);
        let xMin = this.position.x - (menuLength*this.width);
        let xMax = this.position.x + (menuLength*this.width);
        let yMin = this.position.y - (this.height/2);
        let yMax = this.position.y;
        console.log("bounds xmin, xmax, ymin, ymax", xMin, ", ", xMax, ", ", yMin, ", ", yMax);
        let onX = (x > xMin && x < xMax);
        let onY = (y > yMin && y < yMax);
        return onX && onY;
    }

    highlight() {
        push();
        textAlign(CENTER);
        textSize(iconSize/4)
        fill(config.mainColor);
        textStyle(BOLD);
        text(this.category, this.position.x, this.position.y);
        pop();
    }
}