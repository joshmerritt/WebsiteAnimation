/*
  ImageBall class is designed to create standalone balls that can be displayed, launched, and interacted with independently.
    The class uses the matter.js physics engine to handle interactions and movement
    Visuals are created using p5.js, leveraging the matter.js world/body data
*/

class ImageBall {
    constructor(img, xPos, yPos, info) {
      let defaultOptions = {
        friction: 0.5,
        frictionAir: 0.001,
        restitution: 0.66,
        isStatic: true,
      };
      this.body = Matter.Bodies.circle(xPos, yPos, iconSize/2, defaultOptions);
      this.name = 'placeholder';
      this.link = 'placeholder';
      this.category = 'placeholder';
      this.description = 'placeholder';
      this.parseInfo = function() {
        let tempInfo = [];
        info.forEach((item) => {
          tempInfo.push(item.split(": "));
        });
        this.name = tempInfo[0][1];
        this.link = tempInfo[1][1];
        this.category = tempInfo[2][1];
        this.body.category = this.category;
        this.description = tempInfo[3][1];   
      };
      this.parseInfo = this.parseInfo.bind(this)();
      this.body.id = this.name;
      this.body.label = 'Image Ball';
      this.img = img;
      this.position = {
        x: xPos,
        y: yPos
      };
      this.r = iconSize/2;
      this.transitionRadius = iconSize/2;
      this.xPower = 0;
      this.yPower = 0;
      this.clicked = false;
      this.launchCount = 0;
      this.originalPos = {
        x: xPos, 
        y: yPos
      }; 
      this.inOriginalPosition = true;
      this.pageOpen = false;
      this.ballExpanded = false;
      this.removeDetailPage = this.removeDetailPage.bind(this);
      //this.checkForReset = this.checkForReset.bind(this);
      this.expandBall = this.expandBall.bind(this);
      this.show = this.show.bind(this);
    }

/*
  expandBall()
    Used to give appearence of ball slowly expanding to fill the screen
    Called after the ball is made
*/
    expandBall() {
      let distanceToGo = {
        x: playfield.width/2 - this.position.x,
        y: playfield.height/2 - this.position.y,
      }
      console.log('expandBall this - distanceToGo', this, "-", distanceToGo);
      if(distanceToGo.x > 0 || distanceToGo.y > 0) {
        if(this.transitionRadius < 1.5*Math.min(playfield.width, playfield.height)){
          this.transitionRadius += 5;
        }
        let expansionRatio = Math.abs(distanceToGo.x / distanceToGo.y);
        console.log("distance togo - expansion ratio", distanceToGo, " - ", expansionRatio);
        this.position.x += expansionRatio;
        this.position.y += 1;
      } else {
        this.ballExpanded = true;
      }
    }


/*
  showDetail()
    Called when the ball has made contact with the correct menu item
    Translates the existing ball to a larger size, filling the smallest h/w dimension
    Displays the image, along with the name, description, and link
*/
    showDetail() {
      //Matter.World.remove(world, this.body);
      console.log("this.show detail - this", this);
      let tempScreenSize = Math.min(playfield.width, playfield.height);
      let imageDetails = {
        x: (windowWidth/2 - tempScreenSize/4),
        y: (windowHeight/2 - tempScreenSize/2),
        size: tempScreenSize/2
      };
      if(!this.ballExpanded) {
        this.expandBall();
        console.log("showDetail expandball loop this", this);
        push();
        fill(55);
        strokeWeight(0);
        ellipseMode(CENTER);
        circle(this.position.x, this.position.y, this.transitionRadius);
        //image(this.img, imageDetails.x, imageDetails.y, imageDetails.size, imageDetails.size);
        //textSize(iconSize/3);
        fill(0, 102, 153);
        pop();
      } else {
        if ( this.pageOpen === false ) {
          this.pageOpen = true;
          detailPageOpen = true;
          this.createDetailElements();
        }
        push();
        fill(55);
        strokeWeight(0);
        ellipseMode(CENTER);
        circle(windowWidth/2, windowHeight/2, tempScreenSize*1.5);
        image(this.img, imageDetails.x, imageDetails.y, imageDetails.size, imageDetails.size);
        textSize(iconSize/3);
        fill(0, 102, 153);
        pop();
      }
    }

  /*
    createDetailElements()
      Called when a user makes a ball or double clicks it.
      Creates and displays the various elements of the detail page
  */
    createDetailElements() {
      let tempOffset = Math.sin(QUARTER_PI)*Math.min(playfield.width, playfield.height)/1.5;
      let buttonPosition = {
        x: playfield.width/2 + tempOffset,
        y: playfield.height/2 - tempOffset
      }
      this.exitButton = createButton("X");
      this.exitButton.position(buttonPosition.x, buttonPosition.y);
      this.exitButton.mousePressed(this.removeDetailPage);
      this.linkElement = createA(`${this.link}`, "See more details", "_blank"); 
      this.linkElement.position(windowWidth/2 - this.link.width/2, windowHeight * 0.6);
      this.linkElement.show();
      this.descriptionElement = createP(this.description);
      this.descriptionElement.width = Math.min(windowWidth, windowHeight)/4; 
      this.descriptionElement.position(windowWidth/2 - this.description.width/4, windowHeight * 0.7);
      this.descriptionElement.show();
    }

    removeDetailPage() {
      detailPageOpen = false;
      this.pageOpen = false;
      this.descriptionElement.remove();
      this.linkElement.remove();
      this.exitButton.remove();
      imageBalls.forEach(function(ball) {
        if(ball && !ball.inOriginalPosition) {
          ball.reset();
        }
      }); 
    }

  /*
    onBall()
      Used to check if the mouse is hovering over the ball
  */
      onBall(x, y) {
      let distance = dist(x, y, this.position.x, this.position.y);
      return (distance < (this.r));
    }

  /*
    show()
      If ball has been launched, checks for reset
      Uses the current position and angle of the body
      to display the imageBall.
      Also uses a border width hack to make square images appear round 
  */
    show() {
      if(this.launchCount) {
        this.checkForReset();
        console.log("show ball", this);
      }
      const currentPos = this.body.position;
      const currentAngle = this.body.angle;
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
      this.position = this.body.position;
    }

  /*
    checkForReset()
      Checks if if ball is off the playfield
      if true, resets the ball to the original position
  */  
    checkForReset() {
      if(this.offScreen()) {
          this.reset();
      }
    }

  /*
    offScreen()
      Uses the object's radius and the playfield size
      to determine if the object is still visible
  */
    offScreen() {
      let x = this.body.position.x;
      let y = this.body.position.y;
      let radius = this.body.circleRadius;
      let offX = ((x + radius) < 0 || (x - radius) > windowWidth);
      let offY = (((y + radius) < -windowHeight*2) || ((y - radius) > windowHeight));
      if(offY) {
        return true;
      } else if(offX) {
        return true;
      }
      return false;
    }

  /* 
    reset()
      Returns the body to the original launch position and settings
  */
    reset() {
      Matter.Body.setVelocity(this.body, {x: 0, y: 0});
      Matter.Body.setPosition(this.body, this.originalPos);
      Matter.Body.setStatic(this.body, true);
      Matter.World.remove(world, this.body);
      this.inOriginalPosition = true;
    }

  /*
    hover()
      Displays an arrow when a ball is hovered over
  */
    hover() {
      push();  
      stroke(155);
      strokeWeight(5);
      fill(155);
      line(this.position.x, this.position.y, this.position.x - iconSize, this.position.y - iconSize);
      triangle(this.position.x - iconSize, this.position.y - iconSize, this.position.x - iconSize, this.position.y - iconSize + iconSize/8, this.position.x - iconSize + iconSize/8, this.position.y - iconSize);        
      pop();
    }

  /*
    aim()
      Aim takes the mouse position when the mouse is dragged and creates a visual arrow to indicate direction and power.
      Needs to be cleaned up to properly rotate the arrow around the end point of the line
      To keep the launch from being too powerful, limits the maximum power registered
  */
    aim() {
      this.xPower += (mouseX - pmouseX)/300;
      this.yPower += (mouseY - pmouseY)/300;
      this.xPower = Math.min(this.xPower, 5);
      this.yPower = Math.min(this.yPower, 5);
      let arrowLength = iconSize/8;
      let currentPosX = this.position.x - (this.xPower*100);
      let currentPosY = this.position.y - (this.yPower*100);
      let endVec = createVector(currentPosX, currentPosY);
      let arrowHeight = arrowLength/2 * Math.sqrt(3);
      // let endPosX = this.position.x - iconSize;
      // let endPosY = this.position.y - iconSize;
      // let arrowOffsetX = Math.sqrt(Math.pow(arrowLength, 2))/2;
      // let arrowOffsetY = Math.sqrt((Math.pow(arrowLength, 2) - (Math.pow(arrowOffsetX, 2))), 2);
      // let startVec = createVector(endPosX, endPosY);
      // let tempAngle = endVec.angleBetween(startVec);
      push();
      stroke(155);
      strokeWeight(5);
      fill(155);
      line(this.position.x, this.position.y, endVec.x, endVec.y);
      translate(endVec);
      angleMode(DEGREES);
      rotate(endVec.heading()); 
      triangle(-arrowLength/2, 0, arrowLength/2, 0, 0, arrowHeight);
      pop();
    }

  /*
    launched()
      Increments launchCount, used to calculate metrics
  */
    launched() {
      this.launchCount++;
      this.inOriginalPosition = false;
    }


  }
