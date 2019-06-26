class ImageBall {
    constructor(img, xPos, yPos, staticState) {
      this.body = Matter.Bodies.circle(xPos, yPos, iconSize/2);
      Matter.Body.setStatic(this.body, staticState);
      this.body.restitution = 0.5;
      Matter.World.add(world, this.body);
      this.originalPos = {x:xPos, y:yPos};
      this.img = img;
      this.x = xPos;
      this.y = yPos;
      this.r = iconSize/2;
      this.xPower = 0;
      this.yPower = 0;
      this.clicked = false;
      this.launchTime = 0;
    }

    onBall(x, y) {
      let distance = dist(x, y, this.x, this.y);
      return (distance < (this.r));
    }

    show() {
      this.reset();
      const currentPos = this.body.position;
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
      this.xPower += (mouseX - pmouseX)/3000;
      this.yPower += (mouseY - pmouseY)/3000;
      let endPosX = this.x - iconSize;
      let endPosY = this.y - iconSize;
      let arrowLength = iconSize/8;
      let arrowOffsetX = Math.sqrt(Math.pow(arrowLength, 2))/2;
      let arrowOffsetY = Math.sqrt((Math.pow(arrowLength, 2) - (Math.pow(arrowOffsetX, 2))), 2);
      let currentPosX = this.x - (this.xPower*500);
      let currentPosY = this.y - (this.yPower*500);
      push();
      stroke(255);
      strokeWeight(5);
      line(this.x, this.y, currentPosX, currentPosY);
      triangle(currentPosX, currentPosY, currentPosX - arrowOffsetX, currentPosY + arrowOffsetY, currentPosX + arrowOffsetX, currentPosY + arrowOffsetY);
      pop();
    }

    reset() {
      let currentTime = new Date;
      let timeElapsed = currentTime - this.launchTime;
      if((this.body.angularVelocity <= 0.01) && (timeElapsed>5000) && (this.launchTime)) {
        Matter.Body.setPosition(this.body, this.originalPos);
        Matter.Body.setAngle(this.body, 0);
        this.launchTime = 0;
        Matter.Body.setStatic(this.body, true);
      }
    }

  }
