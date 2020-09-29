let categoryBits = [0x0001, 0x0002, 0x0004, 0x0008, 0x0016, 0x0032, 0x0064, 0x0128];
let imageBalls = [];
let imgs = [];
let imageBuffers = [];
let goals = [];
let categories = [];
let pageInfo = [];
let menu = [];
let net = [];
let iconSize, 
gridStartX, 
gridStartY, 
gridCurrentX, 
gridCurentY,
playfield,
engine,
world,
thisCanvasImage,
power,
boundary,
goalPosition,
detailPageOpen,
resetButton,
totalShots,
contactUsElement,
titleFont;
let configurationObjection = {
  //  itemsToDisplay: ['thisWebsite', 'scoreboard', 'swingBet', 'coopDoor', 'googleDataStudio', 'powerBI', 'financialModels', 'flowchart'],
  itemsToDisplay: ['arduinoScoreboard', 'thisWebsite', 'arduinoCoopDoor', 'flowchart'],
  backgroundColor: 	"rgb(96, 117, 134)", 
  mainColor: "rgb(242, 250, 255)", 
  accentColor: "rgb(3, 27, 81)",
  xScale: 0.99,
  yScale: 0.995,
  iconScale: 7,
  fontName: "Gidolinya-Regular",
  titleText: "My name is Josh Merritt.",
  subTitleText: "I am a builder.",
  contactLinkText: "What problem can I help you solve?",
  contactLinkAddress: "mailto:josh@wayfarerfarms.com"
};


/*
  preLoadAssets()
    Called by preload(), which ensures that the data is read 
    and available to the system before attempting to build the page.
    Loops through itemsToDisplay array to load images and text description files.
    Stores the images in the imgs array and the descriptions in the pageInfo array.

*/
  function preLoadAssets() {
    for (const item of configurationObjection.itemsToDisplay) {
      imgs.push(loadImage(`assets/images/${item}.jpg`));
      let tempString = loadStrings(`assets/${item}.txt`);
      pageInfo.push(tempString);
    }
    titleFont = loadFont(`assets/fonts/${configurationObjection.fontName}.otf`);
  }

  function preload() {
    preLoadAssets();
  }

  function setup() {
    playfield = createCanvas(windowWidth*configurationObjection.xScale, windowHeight*configurationObjection.yScale);
    setDisplaySize();
    engine = Matter.Engine.create();
    world = engine.world;
    console.log("physics engine", world); 
    background(configurationObjection.backgroundColor);
    loadAssets();
  }

  function draw() {
    Matter.Engine.update(engine);
    background(configurationObjection.backgroundColor);
    displayTitle();      
    drawGoals();
    menu.forEach((item) => {
      item.show();
    });
    drawBalls();
    let thisWebsite = get(windowWidth/50, windowHeight/50, windowHeight/1.5, windowHeight/1.5);
    imageBalls[1].img = thisWebsite;
  }


/* 
  loadAssets()
    Creates a 'ball' for each image that is spaced intelligently across the screen
    Each image has a category that is added to the categories array, if not already present
    Categories are ordered by descending length and displayed below the 'goal posts'
    Goal posts are created about the menu items which are used to mark the 'goal'
    Invisible barriers are in place to prevent reaching the menu except from above
*/
  function loadAssets() {
    loadImages();
    createGoals();
    boundary = new Boundary(playfield.width, playfield.height, iconSize*2);
    createMenu();
    trackCollisions();
    addResetButton();
    contactUsElement = new ContactUs({x: windowWidth/8, y: windowHeight/1.1}, configurationObjection.contactLinkText, configurationObjection.contactLinkAddress);
    contactUsElement.add();
  }

 /*
  addResetButton()
    Creates a button on the screen in the lower right corner to reset
    all balls to their original position
*/
function addResetButton() {
  resetButton = createButton("↻");
  resetButton.size(iconSize/2, iconSize/2);
  resetButton.addClass("reset");
  resetButton.mousePressed(resetBalls);
}

/*
  trackCollisions()
    Creates an event listener for when two bodies are actively colliding
    Checks to see if any of the balls are currently touching their menu item
*/
function trackCollisions() {
  Matter.Events.on(engine, 'collisionActive', function(event) {
    console.log("collision event", event);
    event.source.pairs.collisionActive.forEach((collision) => {
      if(collision.bodyA.category && collision.bodyB.category && collision.bodyA.category === collision.bodyB.category) {
        if(collision.bodyA.label === 'Image Ball') {
          imageBalls.find(imageBall => imageBall.body.id === collision.bodyA.id).showDetail();
        } else if(collision.bodyB.label === 'Image Ball') {
          imageBalls.find(imageBall => imageBall.body.id === collision.bodyB.id).showDetail();
        }

      };
    });
  });
}


/*
  loadImages()
    Loops through all images that were pre-loaded
    Creates an "ImageBall" for each, passing in its image, location, and text info
    For each ball created, add its category to the category array
*/
  function loadImages() {
    imgs.forEach(function(img, i) {
      imageBalls[i] = new ImageBall(img, gridCurrentX, gridCurrentY, pageInfo[i]);
      if(gridCurrentX + iconSize*3 <= windowWidth) {
        gridCurrentX += iconSize*2;
      } else {
        gridCurrentX = gridStartX;
        gridCurrentY += iconSize*2;
      }
      if(categories.indexOf(imageBalls[i].detailPage.category) === -1) {
        categories.push(imageBalls[i].detailPage.category);
      };
    });
    categories.sort((a, b) => b.length - a.length);
    imageBalls.forEach((ball) => {
      ball.body.collisionFilter = {
        'group': 1,
        'category': Math.pow(2, categories.findIndex(category => category === ball.detailPage.category)),
        'mask': categoryBits[0] | categoryBits[1] | categoryBits[2],
      };
    });
  }

/*
  windowResized()
    Resizes the playfield whenever the window is resized
    Uses built in p5.js methods
*/
  function windowResized() {
    resizeCanvas(windowWidth*configurationObjection.xScale, windowHeight*configurationObjection.yScale);
    setDisplaySize();
    // Remove all imageBalls[], goals[], net[], menu[], then create them again with the new dimensions or adjust all their dimensions
  }

/* 
  setDisplaySize()
    Calculates the appropriate sized grid based upon the window size
    Called during set up or when the window is resized
*/
  function setDisplaySize() {
    iconSize =  Math.min(playfield.width/configurationObjection.iconScale, playfield.height/configurationObjection.iconScale);
    goalPosition = {x: 0.22*iconSize, y:windowHeight/2.2};
    gridStartX = goalPosition.x + iconSize*3;
    gridStartY = goalPosition.y;
    gridCurrentX = gridStartX;
    gridCurrentY = gridStartY;
  } 


/*
createMenu()
  calculates a the appropriate position and creates a new menu item
  for each item in the categories array. It adds the items to the menu array to use later.
*/
function createMenu() {
  categories.forEach((category, index) => {
    let menuPos = {
      x: goalPosition.x + 0.7*iconSize,
      y: goalPosition.y + (index+1)*0.7*iconSize
    };
    menu.push(new Menu(menuPos, category, index));
  });
}

/*
createGoals()
  Adds 2 visible "goalposts" to the field
  Adds 2 invisible nets below the goal posts to prevent menu collision from the side
*/
function createGoals() {
  const netHeight = 0.7*categories.length*iconSize;
  for(let i = 0; i < 2; i++){
    goals[i] = new Goal(goalPosition.x + iconSize*i*1.4, goalPosition.y, iconSize/10, i);
    net.push(new Net(goalPosition.x + iconSize*i*1.4, goalPosition.y + netHeight/2, netHeight));
  };
}

/*
  drawBalls()
    Checks each ball to decide to show it, 
    determine if the mouse is hovering on it to show the launch arrow, 
    or create and display a scalable launch arrow if the mouse is clicked
    for each applicable ball
*/
  function drawBalls() {
    if(detailPageOpen) {
      imageBalls.forEach(function(ball, index) {
        if(ball) {
          if(ball.pageOpen) {
            ball.showDetail();
          }
        }
      }); 
    } else {
      imageBalls.forEach(function(ball, index) {
        if(ball) {
          ball.show();
          if(mouseIsPressed) {
            if(ball.clicked) {
              ball.aim();
            }
          } else {
            if(ball.onBall(mouseX, mouseY)) {
              ball.hover();
            }
            ball.xPower = 0;
            ball.yPower = 0;
            }
          }
      });
    }
  }

/*
  drawGoals()
    Displays the goals
*/
  function drawGoals() {
    goals.forEach(function(goal, index) {
      if(goal) {
        goal.show();
      }
    });
  }

/*
  displayTitle()
    Shows the page creator's name with a brief description of the site
*/
function displayTitle() {
  push();
  //textFont(titleFont);
  //textAlign(CENTER);
  textSize(iconSize/2)
  fill(configurationObjection.mainColor); 
  text(configurationObjection.titleText, windowWidth/8, windowHeight/6);
  text(configurationObjection.subTitleText, windowWidth/8, windowHeight/4)
  pop();
}


/*
  resetBalls()
    Resets each ball to it's original position
 */
function resetBalls() {
  imageBalls.forEach(function(ball) {
    if(ball && !ball.inOriginalPosition) {
      ball.reset();
    }
  }); 
}

/*
  doubleClicked()
    Allows for viewing projects without having to make the ball
*/
function doubleClicked(event) {
  imageBalls.forEach(function(ball) {
    if(ball.onBall(mouseX, mouseY)) {
      ball.showDetail();
    } 
  });
}

/*
  mouseDragged()
    When the user drags the mouse (clicks and holds),
    if the user clicked on a ball, 
    call the aim() function on that ball, 
    which displays a dynamically sized directional arrow.
*/
  function mouseDragged() {
    imageBalls.forEach(function(ball) {
      if(ball.clicked) {
        ball.aim();
      }
    });
  }

/*
  mousePressed()
    Checks to see where the mouse was pressed.
    If it is on a given ball, set clicked=true,
    otherwise set clicked=false
*/
  function mousePressed() {
    imageBalls.forEach(function(ball) {
      if(ball.onBall(mouseX, mouseY)) {
        ball.clicked = true;
      } else {
        ball.clicked = false;
      }
    });
  }

/*
  mouseReleased()
    When the mouse is released, the ball that was clicked is
    checked to see if it's already been launched, if not it's added to the world.
    The ball is made moveable and the strength vector is applied as a force.
*/
  function mouseReleased() {
    imageBalls.forEach(function(ball) {
      if(ball.clicked && (ball.xPower || ball.yPower)) {
        let strength = Matter.Vector.create(-ball.xPower/3, -ball.yPower/3);
        let ballPos = Matter.Vector.create(ball.x, ball.y);
        if(ball.inOriginalPosition) Matter.World.add(world, ball.body);
        Matter.Body.setStatic(ball.body, false);
        Matter.Body.applyForce(ball.body, ballPos, strength);
        ball.launched();
        totalShots++;
      } 
    });    
  }