class ImageBall {
    constructor(img, xPos, yPos) {
      this.img = img;
      this.x = xPos;
      this.y = yPos;
      this.canvas = createGraphics(iconSize,iconSize);

      
    }
    show() {
      //this.canvas.image(this.img,this.x,this.y,iconSize,iconSize);
      circle(this.img,this.x,this.y, iconSize);    
    }

    aim() {
      this.speed = this.x - mouseX;
      this.direction = this.y - mouseY;
      stroke(128);
      line(this.x, this.y, this.x + this.speed, this.y + this.direction);
    }

  }
