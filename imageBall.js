class ImageBall {
    constructor(img, xPos, yPos, staticState) {
      this.body = Matter.Bodies.circle(xPos, yPos, iconSize/2);
      Matter.Body.setStatic(this.body, staticState);
      Matter.World.add(world, this.body);
      this.img = img;
    }

    show() {
      const currentPos = this.body.position;
      const currentAngle = this.body.angle;
      push();
      translate(currentPos.x, currentPos.y);
      rotate(currentAngle);
      fill(222);
      ellipseMode(CENTER);
      circle(0, 0, iconSize/2);
      pop();
      
      //this.canvas.image(this.img,this.x,this.y,iconSize,iconSize);
      //image(this.img,this.x,this.y,iconSize,iconSize);    
    }

  }
