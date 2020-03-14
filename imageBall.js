class ImageBall {
    constructor(img, xPos, yPos, staticState) {
      let defaultOptions = {
        friction: 0.333,
        restitution: 0.9,
        isStatic: staticState
      };
      this.body = Matter.Bodies.circle(xPos, yPos, iconSize/2, defaultOptions);
      console.log(this.body);
      Matter.World.add(world, this.body);
      this.img = img;
      this.x = xPos;
      this.y = yPos;
      this.r = iconSize/2;
      this.xPower = 0;
      this.yPower = 0;
      this.clicked = false;
    }

    onBall(x, y) {
      let distance = dist(x, y, this.x, this.y);
      return (distance < (this.r));
    }

    show() {
      const currentPos = this.body.position;
      //console.log(this.body.id, currentPos);
      const currentAngle = this.body.angle;
      push();
      translate(currentPos.x, currentPos.y);
      rotate(currentAngle);
      imageMode(CENTER);
      image(this.img, 0, 0, iconSize, iconSize);    
      pop();
    }

    hover() {
      push();  
      rectMode(CENTER);
      rect(this.x, this.y, this.r*2, this.r*2, this.r);
      stroke(255);
      strokeWeight(5);
      line(this.x, this.y, this.x - iconSize, this.y - iconSize);
      triangle(this.x - iconSize, this.y - iconSize, this.x - iconSize, this.y - iconSize + iconSize/8, this.x - iconSize + iconSize/8, this.y - iconSize);        
      pop();
    }

    aim() {
      this.xPower += (mouseX - pmouseX)/300;
      this.yPower += (mouseY - pmouseY)/300;
      let endPosX = this.x - iconSize;
      let endPosY = this.y - iconSize;
      let arrowLength = iconSize/8;
      let arrowOffsetX = Math.sqrt(Math.pow(arrowLength, 2))/2;
      let arrowOffsetY = Math.sqrt((Math.pow(arrowLength, 2) - (Math.pow(arrowOffsetX, 2))), 2);
      let currentPosX = this.x - (this.xPower*100);
      let currentPosY = this.y - (this.yPower*100);
      push();
      stroke(255);
      strokeWeight(5);
      line(this.x, this.y, currentPosX, currentPosY);
      triangle(currentPosX, currentPosY, currentPosX - arrowOffsetX, currentPosY + arrowOffsetY, currentPosX + arrowOffsetX, currentPosY + arrowOffsetY);
      pop();
    }

  }
