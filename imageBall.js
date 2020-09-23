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
      this.detailPage = {
        name: 'placeholder',
        link: 'placeholder',
        category: 'placeholder',
        description: 'placeholder',
        element: 'placeholder',
      };
      this.parseInfo = function() {
        let tempInfo = [];
        info.forEach((item) => {
          tempInfo.push(item.split(": "));
        });
        this.detailPage.name = tempInfo[0][1];
        this.detailPage.link = tempInfo[1][1];
        this.detailPage.category = tempInfo[2][1];
        this.detailPage.description = tempInfo[3][1];
        this.body.category = this.detailPage.category;   
      };
      this.parseInfo = this.parseInfo.bind(this)();
      this.body.id = this.name;
      this.body.label = 'Image Ball';
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
      this.pageOpen = false;
      this.ballExpanded = false;
      this.removeDetailPage = this.removeDetailPage.bind(this);
      this.checkForReset = this.checkForReset.bind(this);

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
      //console.log('showDetail(), this:', this);
      Matter.World.remove(world, this.body);
      // if(!this.ballExpanded) {
      //   this.expandBall();
      // } else {
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
        fill(configurationObjection.accentColor);
        strokeWeight(0);
        ellipseMode(CENTER);
        circle(windowWidth/2, windowHeight/2, tempScreenSize*1.5);
        image(this.img, imageDetails.x, imageDetails.y, imageDetails.size, imageDetails.size);
        textSize(iconSize/3);
        fill(0, 102, 153);
        pop();
      //}
    }


/*
  createDetailElements()
    Called when a user makes a ball or double clicks it.
    Creates and displays the various elements of the detail page
*/
    createDetailElements() {
      this.detailPage.element = createDiv("DetailPage");
      this.detailPage.element.size(windowWidth/3, windowHeight/3);
      this.detailPage.element.position(windowWidth/3, windowHeight/2);
      this.detailPage.exitButton = createButton("X");
      this.detailPage.exitButton.mousePressed(this.removeDetailPage);
      this.detailPage.linkElement = createA(`${this.link}`, "See more details", "_blank"); 
      this.detailPage.descriptionElement = createP(this.detailPage.description);
      this.detailPage.element.child(this.detailPage.exitButton);
      this.detailPage.element.child(this.detailPage.linkElement);
      this.detailPage.element.child(this.detailPage.descriptionElement);
    }

    removeDetailPage() {
      detailPageOpen = false;
      this.pageOpen = false;
      this.detailPage.element.remove();
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
    to display the imageBall.
    Also uses a border width hack to make square images appear round 
*/
    show() {
      // let thisWebsite = get(windowWidth*.3, windowHeight*.3, windowWidth*.5, windowHeight*.5);
      // image(thisWebsite, windowWidth/3, windowHeight/3, iconSize*windowWidth/windowHeight, iconSize);
      // 0, windowHeight/10, windowWidth/3, windowWidth/3
      // if(this.detailPage.name === "Portfolio Website") {
      //   let thisWebsite = get(windowWidth*.3, windowHeight*.3, windowWidth*.5, windowHeight*.5);
      //   console.log('thisWebsite', thisWebsite);
      //   image(thisWebsite, windowWidth/3, windowHeight/3, iconSize*windowWidth/windowHeight, iconSize);
      //   //this.img = get();
      // };
      if(this.launchCount) this.checkForReset();
      let currentPos = this.body.position;
      let currentAngle = this.body.angle;
      let dynamicStrokeWeight = Math.ceil(iconSize/4);
      push();
      translate(currentPos.x, currentPos.y);
      rotate(currentAngle);
      imageMode(CENTER);
      let thumbnail = this.img.get(this.img.width/20, this.img.height/3.5, this.img.width/2, this.img.width/2);
      image(thumbnail, 0, 0, iconSize, iconSize);
      noFill();
      stroke(configurationObjection.backgroundColor);
      strokeWeight(dynamicStrokeWeight);
      circle(0, 0, iconSize*1.25);    
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
      Matter.World.remove(world, this.body);
      this.inOriginalPosition = true;
    }

/*
  hover()
    Displays an arrow when a ball is hovered over
*/
    hover() {
      push();  
      stroke(configurationObjection.accentColor);
      strokeWeight(5);
      noFill();
      circle(this.x, this.y, this.r*2)
      fill(configurationObjection.accentColor);
      line(this.x, this.y, this.x - iconSize, this.y - iconSize);
      triangle(this.x - iconSize, this.y - iconSize, this.x - iconSize, this.y - iconSize + iconSize/8, this.x - iconSize + iconSize/8, this.y - iconSize);        
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
      let currentPosX = this.x - (this.xPower*100);
      let currentPosY = this.y - (this.yPower*100);
      let endVec = createVector(currentPosX, currentPosY);
      let arrowLength = iconSize/8;
      let arrowHeight = arrowLength/2 * Math.sqrt(3);
      // let endPosX = this.x - iconSize;
      // let endPosY = this.y - iconSize;
      // let arrowOffsetX = Math.sqrt(Math.pow(arrowLength, 2))/2;
      // let arrowOffsetY = Math.sqrt((Math.pow(arrowLength, 2) - (Math.pow(arrowOffsetX, 2))), 2);
      // let tempAngle = endVec.angleBetween(startVec);
      // let startVec = createVector(endPosX, endPosY);
      push();
      stroke(configurationObjection.accentColor);
      strokeWeight(5);
      fill(configurationObjection.accentColor);
      line(this.x, this.y, endVec.x, endVec.y);
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
