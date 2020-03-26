class ImageBall {
    constructor(img, xPos, yPos, staticState) {
      let defaultOptions = {
        friction: 0.333,
        restitution: 0.9,
        isStatic: staticState
      };
      this.body = Matter.Bodies.circle(xPos, yPos, iconSize/2, defaultOptions);
      //console.log(this.body);
      //Matter.World.add(world, this.body);
      this.img = img;
      this.x = xPos;
      this.y = yPos;
      this.r = iconSize/2;
      this.xPower = 0;
      this.yPower = 0;
      this.clicked = false;
      this.launchCount = 0;
      this.originalX = xPos;
      this.originalY = yPos;
      this.originalPos = {x: xPos, y: yPos}; 
    }

 

    onBall(x, y) {
      let distance = dist(x, y, this.x, this.y);
      return (distance < (this.r));
    }

    show() {
      if(this.launchCount) this.checkForReset();
      const currentPos = this.body.position;
      const currentAngle = this.body.angle;
      push();
      translate(currentPos.x, currentPos.y);
      rotate(currentAngle);
      imageMode(CENTER);
      image(this.img, 0, 0, iconSize, iconSize);    
      pop();
      this.x = this.body.position.x;
      this.y = this.body.position.y;
    }

    // Checks if speed is near zero
    //  if so, checks if ball is off screen
    //    if so, resets the ball to the original position

    checkForReset() {
      console.log('checkForReset', this);
      console.log('this.offScreen', this.offScreen());
      if(this.body.velocity.x < 0.03) {
        if(this.offScreen){
          console.log('****** triggering reset', this)
          //this.reset();
        }
      }
    }

    offScreen() {
      let x = this.x;
      let y = this.y;
      let radius = this.body.circleRadius;
      console.log("wW - wH", windowWidth, " - ", windowHeight);
      console.log("x - y - radius", x, " - ", y, " - ", radius);
      let offX = ((x + radius) < 0 || (x - radius) > windowWidth);
      let offY = (y + radius) > windowHeight;
      console.log("offX - offY", offX, " - ", offY);
      if(offX || offY) return true;
       else return false;
    }

    reset() {
      console.log("reset - body ", this.body);
      Matter.Body.setStatic(this.body, true);
      Matter.Body.setVelocity(this.body, {x: 0, y: 0});
      Matter.Body.setPosition(this.body, this.originalPos);
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

// Aim takes the mouse position when the mouse is dragged and creates a visual arrow to indicate direction and power.
// Needs to be cleaned up to properly rotate the arrow around the end point of the line

    aim() {
      this.xPower += (mouseX - pmouseX)/300;
      this.yPower += (mouseY - pmouseY)/300;
      this.xPower = Math.min(this.xPower, 3);
      this.yPower = Math.min(this.yPower, 3);
      let endPosX = this.x - iconSize;
      let endPosY = this.y - iconSize;
      let arrowLength = iconSize/8;
      let arrowOffsetX = Math.sqrt(Math.pow(arrowLength, 2))/2;
      let arrowOffsetY = Math.sqrt((Math.pow(arrowLength, 2) - (Math.pow(arrowOffsetX, 2))), 2);
      let currentPosX = this.x - (this.xPower*100);
      let currentPosY = this.y - (this.yPower*100);
      let arrow = new p5.Vector(endPosX, endPosY);
      let startVec = createVector(endPosX, endPosY);
      let endVec = createVector(currentPosX, currentPosY);
      let arrowHeight = arrowLength/2 * Math.sqrt(3);
      let tempAngle = endVec.angleBetween(startVec);
      push();
      stroke(255);
      strokeWeight(5);
      line(this.x, this.y, endVec.x, endVec.y);
      translate(endVec);
      angleMode(DEGREES);
      rotate(endVec.heading()); 
      triangle(-arrowLength/2, 0, arrowLength/2, 0, 0, arrowHeight);
      pop();
    }

    launched() {
      this.launchCount++;
    }

    checkGoal() {

    }

  }
