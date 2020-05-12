// ImageBall is designed to create standalone balls that can be displayed, launched, and interacted with independently.
// The class uses the matter.js physics engine to handle interactions
// Visuals are created using p5.js, which are tied to specific bodies in the world

class ImageBall {
    constructor(img, xPos, yPos, info) {
      let defaultOptions = {
        friction: 0.333,
        restitution: 0.9,
        isStatic: true,
      };
      this.body = Matter.Bodies.circle(xPos, yPos, iconSize/2, defaultOptions);
      //console.log('constructor info', info);

      this.name = 'placeholder';
      this.link = 'placeholder';
      this.category = 'placeholder';
      this.description = 'placeholder';
      this.parseInfo = function() {
        let tempInfo = [];
        info.forEach(function(item, index){
          tempInfo.push(item.split(": "));
        });
        this.name = tempInfo[0][1];
        this.link = tempInfo[1][1];
        this.category = tempInfo[2][1];
        this.description = tempInfo[3][1];        
      };
      this.parseInfo = this.parseInfo.bind(this)();
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
      this.inOriginalPosition = true;
    }

    // Used to check if the mouse is hovering over the ball

    onBall(x, y) {
      let distance = dist(x, y, this.x, this.y);
      return (distance < (this.r));
    }

    // Displays the ball if it is on screen

    show() {
      if(this.launchCount) this.checkForReset();
      const currentPos = this.body.position;
      const currentAngle = this.body.angle;
      const currentTorque = this.body.torque;
      console.log('current torque', currentTorque);
      let dynamicStrokeWeight = Math.ceil(iconSize/4);
      push();
      translate(currentPos.x, currentPos.y);
      rotate(currentAngle);
      imageMode(CENTER);
      let thumbnail = this.img.get(this.img.width/2, this.img.height/2, this.img.width/4, this.img.width/4);
      image(thumbnail, 0, 0, iconSize, iconSize);
      noFill();
      stroke(111);
      strokeWeight(dynamicStrokeWeight);
      circle(0, 0, iconSize*1.25);    
      pop();
      this.x = this.body.position.x;
      this.y = this.body.position.y;
    }

    // Checks if if ball is off screen
    // if true, checks if horizontal speed is near zero
    // if true, resets the ball to the original position

    checkForReset() {
      if(this.offScreen()) {
        if(Math.abs(this.body.velocity.x) < 0.05){
          this.reset();
        }
      }
    }

    // Uses the object's radius and the screen size
    // to determine if the object is still visible

    offScreen() {
      let x = this.x;
      let y = this.y;
      let radius = this.body.circleRadius;
      let offX = ((x + radius) < 0 || (x - radius) > windowWidth);
      let offY = (y + radius) > windowHeight;
      if(offX || offY) return true;
       else return false;
    }

    // Returns the body to the original launch position and settings

    reset() {
      Matter.Body.setStatic(this.body, true);
      Matter.Body.setVelocity(this.body, {x: 0, y: 0});
      Matter.Body.setPosition(this.body, this.originalPos);
      Matter.World.remove(world, this.body);
      this.inOriginalPosition = true;
    }

    //Displays an arrow when a ball is hovered over

    hover() {
      push();  
      stroke(155);
      strokeWeight(5);
      fill(155);
      line(this.x, this.y, this.x - iconSize, this.y - iconSize);
      triangle(this.x - iconSize, this.y - iconSize, this.x - iconSize, this.y - iconSize + iconSize/8, this.x - iconSize + iconSize/8, this.y - iconSize);        
      pop();
    }

    // Aim takes the mouse position when the mouse is dragged and creates a visual arrow to indicate direction and power.
    // Needs to be cleaned up to properly rotate the arrow around the end point of the line
    // To keep the launch from being too powerful, limits the maximum power registered

    aim() {
      this.xPower += (mouseX - pmouseX)/300;
      this.yPower += (mouseY - pmouseY)/300;
      this.xPower = Math.min(this.xPower, 5);
      this.yPower = Math.min(this.yPower, 5);
      let endPosX = this.x - iconSize;
      let endPosY = this.y - iconSize;
      let arrowLength = iconSize/8;
      let arrowOffsetX = Math.sqrt(Math.pow(arrowLength, 2))/2;
      let arrowOffsetY = Math.sqrt((Math.pow(arrowLength, 2) - (Math.pow(arrowOffsetX, 2))), 2);
      let currentPosX = this.x - (this.xPower*100);
      let currentPosY = this.y - (this.yPower*100);
      let startVec = createVector(endPosX, endPosY);
      let endVec = createVector(currentPosX, currentPosY);
      let arrowHeight = arrowLength/2 * Math.sqrt(3);
      // let tempAngle = endVec.angleBetween(startVec);
      push();
      stroke(155);
      strokeWeight(5);
      fill(155);
      line(this.x, this.y, endVec.x, endVec.y);
      translate(endVec);
      angleMode(DEGREES);
      rotate(endVec.heading()); 
      triangle(-arrowLength/2, 0, arrowLength/2, 0, 0, arrowHeight);
      pop();
    }

    launched() {
      this.launchCount++;
      this.inOriginalPosition = false;
    }

    checkGoal() {

    }

  }
