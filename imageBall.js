/*
  ImageBall class is designed to create standalone balls that can be displayed, launched, and interacted with independently.
    The class uses the matter.js physics engine to handle interactions and movement
    Visuals are created using p5.js, leveraging the matter.js world/body data
*/

class ImageBall {
    constructor(img, xPos, yPos, size, info, index) {
      let defaultOptions = {
        friction: 0.5,
        frictionAir: 0.001,
        restitution: 0.66,
        isStatic: true,
      };
      this.body = Matter.Bodies.circle(xPos, yPos, size/2, defaultOptions);
      this.index = index;
      this.parseInfo = function() {
        let tempInfo = [];
        info.forEach((item) => {
          tempInfo.push(item.split(": "));
        });
        this.name = tempInfo[0][1];
        this.link = tempInfo[1][1];
        this.category = tempInfo[2][1];
        this.goal = tempInfo[3][1];
        this.role = tempInfo[4][1];
        this.technology = tempInfo[5][1]
        this.description = tempInfo[6][1];
        this.body.category = this.category;   
      };
      this.parseInfo = this.parseInfo.bind(this)();
      this.body.id = this.name;
      this.body.label = 'Image Ball';
      this.fullImage = img;
      this.ballImage = img.get();  
      this.x = xPos;
      this.y = yPos;
      this.r = size/2;
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
      this.display = true;
      this.clickedCount = 0;
      this.lastClickTime = 0;
      this.opens = 0;
      this.makes = 0;
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
      this.aim = this.aim.bind(this);
      this.demoAim = this.demoAim.bind(this);
   }

/*
  expandBall()
    Used to give appearence of ball slowly expanding to fill the screen
    Called after the ball is made
*/
    expandBall() {
      console.log('expandBall this', this);
      // if(this.x < playfieldWidth/2 || this.y < playfieldHeight/2) {
      //   let expansionRatio = (playfieldWidth/2 - this.x) / (playfieldHeight/2 - this.y);
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
        totalOpens++;
        this.makes++;
        // let circleX = playfieldWidth*0.733;
        // let circleY = playfieldHeight*0.5;
        // let circleR = Math.sqrt((Math.pow(playfieldWidth/1.75, 2) + Math.pow(playfieldHeight/1.75, 2)));
        let maxSize = Math.min(playfieldHeight, playfieldWidth/2)*0.90;
        let imageSize = {
          x: maxSize,
          y: maxSize*this.fullImage.height/this.fullImage.width
        };
        let imageX = Math.min(playfieldHeight, playfieldWidth)*0.025;
        let imageY = Math.max((playfieldHeight - imageSize.y)/2, Math.min(playfieldHeight, playfieldWidth)*0.025);
        let tempImage = this.fullImage;
        if(portraitMode) {
          maxSize = playfieldHeight*0.36;
          imageSize = {
            x: maxSize,
            y: maxSize*this.fullImage.height/this.fullImage.width
          };
          imageX = Math.max((playfieldWidth - imageSize.x)/2, Math.min(playfieldHeight, playfieldWidth)*0.025);
          imageY = Math.min(playfieldHeight, playfieldWidth)*0.1;
        }
        if (this.pageOpen === false) {
          this.pageOpen = true;
          detailPageOpen = true;
          this.createDetailElements();
          //contactUsElement.hide();
          resetButton.style("display", "none"); 
        }
        push();
        fill(config.accentColor);
        stroke(config.accentColor);
        strokeWeight(iconSize/10);
        rect(imageX, imageY, imageSize.x, imageSize.y);
        image(tempImage, imageX, imageY, imageSize.x, imageSize.y);
        pop();
      //}
      return this;
    }


/*
  createDetailElements()
    Called when a user makes a ball or double clicks it.
    Creates and displays the various elements of the detail page
*/
    createDetailElements() {
      this.element = createDiv();
      this.element.addClass("DetailPage");
      this.pageTitle = createElement("h1", this.name)
      this.exitButton = createButton("X");
      this.exitButton.addClass("ExitButton");
      this.exitButton.mouseClicked(this.removeDetailPage);
      this.linkElement = createA(`${this.link}`, "Learn more", "_blank");
      this.contactElement = createA(config.contactLinkAddress, config.contactLinkText, "_blank");
      this.tableElement = createElement("table");
      this.goalRow = createElement("tr");
      this.goalTitle = createElement("td", "Goal");
      this.goalDesc = createElement("td", this.goal);
      this.roleRow = createElement("tr");
      this.roleTitle = createElement("td", "My Role");
      this.roleDesc = createElement("td", this.role);
      this.techRow = createElement("tr");
      this.techTitle = createElement("td", "Technology");
      this.techDesc = createElement("td", this.technology);
      this.descRow = createElement("tr");
      this.descTitle = createElement("td", "Summary");
      this.descDesc = createElement("td", this.description);
      this.element.child(this.pageTitle);
      this.element.child(this.tableElement);
      this.element.child(this.linkElement);
      this.element.child(this.contactElement);
      this.element.child(this.exitButton);
      this.tableElement.child(this.goalRow);
      this.tableElement.child(this.roleRow);
      this.tableElement.child(this.techRow);
      this.tableElement.child(this.descRow);
      this.goalRow.child(this.goalTitle);
      this.goalRow.child(this.goalDesc);
      this.roleRow.child(this.roleTitle);
      this.roleRow.child(this.roleDesc);
      this.techRow.child(this.techTitle);
      this.techRow.child(this.techDesc);
      this.descRow.child(this.descTitle);
      this.descRow.child(this.descDesc);
    }


  /*
    removeDetailPage()
      When the user closes the detail page, removes the various elements 
      and resets to the original state
  */
    removeDetailPage() {
      selectedCategory = "All";
      detailPageOpen = false;
      this.pageOpen = false;
      this.element.remove();
      imageBalls.forEach(function(ball) {
        ball.display = true;
        if(ball && !ball.inOriginalPosition) {
          ball.reset();
        }
      });
      //contactUsElement.show(); 
      resetButton.style("display", "block");      
    }

/*
  onBall()
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
      circle(0, 0, this.r*2, this.r*2);
      // text(this.clickedCount, 0, 0);
      // text(this.doubleClicked, 0, 20);
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
      let offX = ((x + radius) < 0 || (x - radius) > playfieldWidth);
      let offY = (((y + radius) < -playfieldHeight*4) || ((y - radius) > playfieldHeight));
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
      let arrowLength = iconSize/22;
      let angle = 45;
      let lineStart = {
        x: this.x - this.r*sin(angle),
        y: this.y - this.r*cos(angle)
      };
      let lineEnd = {
        x: lineStart.x - this.r/2,
        y: lineStart.y - this.r/2
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
      strokeWeight(iconSize/20);
      noFill();
      circle(this.x, this.y, this.r*2, this.r*2);
      fill(config.accentColor);
      line(lineStart.x, lineStart.y, lineEnd.x , lineEnd.y);
      triangle(pointA.x, pointA.y, pointB.x, pointB.y, pointC.x, pointC.y);
      pop();
      angleMode(RADIANS);
    }


/*
  aim()
      Aim takes the mouse position when the mouse is dragged and creates a visual arrow to indicate direction and power.
      Needs to be cleaned up to properly rotate the arrow around the end point of the line
      To keep the launch from being too powerful, limits the maximum power registered
*/
    aim() {
      let powerScale = 33;
      if(portraitMode || mobileMode) powerScale = powerScale/5;
      angleMode(DEGREES);
      this.xPower += (mouseX - pmouseX)/config.sensitivity*powerScale;
      this.yPower += (mouseY - pmouseY)/config.sensitivity*powerScale;
      let lineStart = {
        x: this.x - this.r*sin(45),
        y: this.y - this.r*cos(45)
      };
      let currentPosX = lineStart.x - (this.xPower)*2;
      let currentPosY = lineStart.y - (this.yPower)*2;
      let arrowLength = iconSize/22;
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
      noFill();
      circle(this.x, this.y, this.r*2, this.r*2);
      fill(config.accentColor);
      line(lineStart.x, lineStart.y, currentPosX, currentPosY);
      triangle(pointA.x, pointA.y, pointB.x, pointB.y, pointC.x, pointC.y);
      pop();
      angleMode(RADIANS);
    }


 /*
  demoAim()
      Aim takes the mouse position when the mouse is dragged and creates a visual arrow to indicate direction and power.
      Needs to be cleaned up to properly rotate the arrow around the end point of the line
      To keep the launch from being too powerful, limits the maximum power registered
*/
demoAim() {
  this.show();
  angleMode(DEGREES);
  let lineStart = {
    x: this.x - this.r*sin(45),
    y: this.y - this.r*cos(45)
  };
  let currentPosX = lineStart.x - (this.xPower)*2;
  let currentPosY = lineStart.y - (this.yPower)*2;
  let arrowLength = iconSize/22;
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
  noFill();
  circle(this.x, this.y, this.r*2, this.r*2);
  fill(config.accentColor);
  line(lineStart.x, lineStart.y, currentPosX, currentPosY);
  triangle(pointA.x, pointA.y, pointB.x, pointB.y, pointC.x, pointC.y);
  pop();
  angleMode(RADIANS);
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
