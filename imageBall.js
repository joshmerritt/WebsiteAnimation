/*
  ImageBall class is designed to create standalone balls that can be displayed, launched, and interacted with independently.
    The class uses the matter.js physics engine to handle interactions and movement
    Visuals are created using p5.js, leveraging the matter.js world/body data
*/

class ImageBall {
    constructor(img, xPos, yPos, info, index) {
      let defaultOptions = {
        friction: 0.5,
        frictionAir: 0.001,
        restitution: 0.66,
        isStatic: true,
      };
      this.body = Matter.Bodies.circle(xPos, yPos, iconSize/2, defaultOptions);
      this.index = index;
      this.name = 'placeholder';
      this.link = 'placeholder';
      this.category = 'placeholder';
      this.description = 'placeholder';
      this.element = 'placeholder';
      this.parseInfo = function() {
        let tempInfo = [];
        info.forEach((item) => {
          tempInfo.push(item.split(": "));
        });
        this.name = tempInfo[0][1];
        this.link = tempInfo[1][1];
        this.category = tempInfo[2][1];
        this.description = tempInfo[3][1];
        this.body.category = this.category;   
      };
      this.parseInfo = this.parseInfo.bind(this)();
      this.body.id = this.name;
      this.body.label = 'Image Ball';
      this.fullImage = img;
      this.ballImage = img;  
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
      this.pageOpen = false;
      this.ballExpanded = false;
      this.removeDetailPage = this.removeDetailPage.bind(this);
      this.checkForReset = this.checkForReset.bind(this);
      this.showDetail = this.showDetail.bind(this);
      this.show = this.show.bind(this);
      this.createDetailElements = this.createDetailElements.bind(this);
      this.onBall = this.onBall.bind(this);
      this.expandBall = this.expandBall.bind(this);
      this.hover = this.hover.bind(this);
      this.launched = this.launched.bind(this);
      this.reset = this.reset.bind(this);
      

    }

/*
  expandBall()
    Used to give appearence of ball slowly expanding to fill the screen
    Called after the ball is made
*/
    expandBall() {
      console.log('expandBall this', this);
      // if(this.x < playfield.width/2 || this.y < playfield.height/2) {
      //   let expansionRatio = (playfield.width/2 - this.x) / (playfield.height/2 - this.y);
      //   this.x += 1,
      //   this.y += expansionRatio
      // } else {
      //   this.ballExpanded = true;
      // }
    }


/*
  showDetail()
    Called when the ball has made contact with the correct menu item
    Translates the existing ball to a larger size, filling the smallest h/w dimension
    Displays the image, along with the name, description, and link
*/
    showDetail() {
      // console.log('showDetail(), this:', this);
      // Matter.World.remove(world, this.body);
      // if(!this.ballExpanded) {
      //   this.expandBall();
      // } else {
        let detailImage = imgs[this.index];
        let tempScreenSize = Math.min(playfield.width, playfield.height);
        let imageDetails = {
          x: (windowWidth/2 - tempScreenSize/4),
          y: (windowHeight/2 - tempScreenSize/2),
          size: tempScreenSize/2
        };
        if ( this.pageOpen === false ) {
          this.pageOpen = true;
          detailPageOpen = true;
          this.createDetailElements();
        }
        push();
        fill(config.accentColor);
        strokeWeight(0);
        ellipseMode(CENTER);
        circle(windowWidth/2, windowHeight/2, tempScreenSize*1.5);
        image(detailImage, imageDetails.x, imageDetails.y, imageDetails.size, imageDetails.size);
        textSize(iconSize/3);
        pop();
      //}
    }


/*
  createDetailElements()
    Called when a user makes a ball or double clicks it.
    Creates and displays the various elements of the detail page
*/
    createDetailElements() {
      this.element = createDiv("DetailPage");
      this.element.size(windowWidth/3, windowHeight/3);
      this.element.position(windowWidth/3, windowHeight/2);
      this.exitButton = createButton("X");
      this.exitButton.mousePressed(this.removeDetailPage);
      this.linkElement = createA(`${this.link}`, "See more details", "_blank"); 
      this.descriptionElement = createP(this.description);
      this.element.child(this.linkElement);
      this.element.child(this.descriptionElement);
      this.element.child(this.exitButton);
    }

    removeDetailPage() {
      detailPageOpen = false;
      this.pageOpen = false;
      this.element.remove();
      imageBalls.forEach(function(ball) {
        if(ball && !ball.inOriginalPosition) {
          ball.reset();
        }
      }); 
      
    }

/*
  onball()
    Used to check if the mouse is hovering over the ball
*/
    onBall(x, y) {
      let distance = dist(x, y, this.x, this.y);
      return (distance < (this.r));
    }

/*

  show()
    If ball has been launched, checks for reset
    Uses the current position and angle of the body
    to display the imageBall, using a round image mask overlay
*/
    show() {
      if(this.launchCount) this.checkForReset();
      push();
      imageMode(CENTER);
      ellipseMode(CENTER);
      let currentPos = this.body.position;
      let currentAngle = this.body.angle;
      translate(currentPos.x, currentPos.y);
      rotate(currentAngle);
      this.ballImage.mask(imageMask);
      image(this.ballImage, 0, 0, iconSize, iconSize);
      noFill();
      stroke(config.mainColor);
      strokeWeight(iconSize/50); 
      circle(0, 0, iconSize*.99, iconSize*.99); 
      pop();
      this.x = this.body.position.x;
      this.y = this.body.position.y;
    }

/*
  checksForReset()    
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
      let radius = this.body.circleRadius*2;
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
      Matter.Body.setAngle(this.body, 0);
      Matter.World.remove(world, this.body);
      this.inOriginalPosition = true;
    }

/*
  hover()
    Displays an arrow when a ball is hovered over
*/
    hover() {
      angleMode(DEGREES);
      let arrowLength = iconSize/8;
      let angle = 45;
      let lineEnd = {
        x: this.x - iconSize/2,
        y: this.y - iconSize/2
      };
      let pointA = {
        x: lineEnd.x - sin(angle)*arrowLength*2,
        y: lineEnd.y - cos(angle)*arrowLength*2
      };
      let pointB = {
        x: lineEnd.x + cos(angle)*arrowLength,
        y: lineEnd.y - sin(angle)*arrowLength
      };
      let pointC = {
        x: lineEnd.x - cos(angle)*arrowLength,
        y: lineEnd.y + sin(angle)*arrowLength
      };
      push();
      stroke(config.accentColor);
      strokeWeight(5);
      fill(config.accentColor);
      line(this.x, this.y, lineEnd.x , lineEnd.y);
      triangle(pointA.x, pointA.y, pointB.x, pointB.y, pointC.x, pointC.y);
      pop();
    }

/*
  aim()
      Aim takes the mouse position when the mouse is dragged and creates a visual arrow to indicate direction and power.
      Needs to be cleaned up to properly rotate the arrow around the end point of the line
      To keep the launch from being too powerful, limits the maximum power registered
*/
    aim() {
      angleMode(DEGREES);
      this.xPower += (mouseX - pmouseX)/300;
      this.yPower += (mouseY - pmouseY)/300;
      this.xPower = Math.min(this.xPower, 5);
      this.yPower = Math.min(this.yPower, 5);
      let currentPosX = this.x - (this.xPower*100);
      let currentPosY = this.y - (this.yPower*100);
      let arrowLength = iconSize/8;
      let angle = atan2(this.xPower, this.yPower);
      let pointA = {
        x: currentPosX - sin(angle)*arrowLength*2,
        y: currentPosY - cos(angle)*arrowLength*2
      };
      let pointB = {
        x: currentPosX + cos(angle)*arrowLength,
        y: currentPosY - sin(angle)*arrowLength
      };
      let pointC = {
        x: currentPosX - cos(angle)*arrowLength,
        y: currentPosY + sin(angle)*arrowLength
      };
      push();
      stroke(config.accentColor);
      strokeWeight(5);
      fill(config.accentColor);
      line(this.x, this.y, currentPosX, currentPosY);
      triangle(pointA.x, pointA.y, pointB.x, pointB.y, pointC.x, pointC.y);
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
