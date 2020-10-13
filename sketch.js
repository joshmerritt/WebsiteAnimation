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
imageMask,
power,
boundary,
goalPosition,
goalWidth,
screenArea,
portraitMode,
detailPageOpen,
resetButton,
titleElement,
subtitleElement,
contactUsElement,
titleFont;
let clickedToOpen = false;
let totalShots = 0;
let selectedCategory = "All";
let config = {
  //  itemsToDisplay: ['thisWebsite', 'scoreboard', 'swingBet', 'coopDoor', 'googleDataStudio', 'powerBI', 'financialModels', 'flowchart'],
  itemsToDisplay: ['aboutMe', 'thisWebsite', 'swingBet', 'googleDataStudioOverview', 'powerBIConversionMetrics', 'arduinoScoreboard', 'arduinoCoopDoor', 'googleDataStudioServiceTechs'],
  backgroundColor: 	"rgb(17, 17, 17)", 
  mainColor: "rgb(242, 250, 255)", 
  accentColor: "rgb(96, 117, 134)",
  //accentColor: "rgb(3, 27, 81)",
  xScale: 1,
  yScale: 1,
  iconScale: 7,
  sensitivity: 1,
  gridSpacing: 1,
  fontName: "Gidolinya-Regular",
  titleText: "Hello world, I am Josh Merritt.",
  subTitleText: "Honest. Data-driven. Product Management & Development. ",
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
    for (const item of config.itemsToDisplay) {
      imgs.push(loadImage(`assets/images/${item}.jpg`));
      let tempString = loadStrings(`assets/${item}.txt`);
      pageInfo.push(tempString);
    }
    titleFont = loadFont(`assets/fonts/${config.fontName}.otf`);
  }

  function preload() {
    preLoadAssets();
  }

  function setup() {
    history.pushState({'page_id': 1}, document.title, location.href);
    playfield = createCanvas(windowWidth*config.xScale, windowHeight*config.yScale);
    // var el = document.getElementsByTagName("canvas")[0];
    // el.addEventListener("touchstart", mousePressed, false);
    setDisplaySize();
    engine = Matter.Engine.create();
    world = engine.world;
    console.log("physics engine", world); 
    background(config.backgroundColor);
    loadAssets();
  }

/*
  draw()
    Native p5.js function used to continually loop the program
*/
  function draw() {
    Matter.Engine.update(engine);
    background(config.backgroundColor); 
    if(!detailPageOpen) {
      displayTitle();   
      drawGoals();
      menu.forEach((item) => item.show());
      net.forEach((item) => item.show());
      helpMessage();
    }
    drawBalls();
  }


/*
  helpMessage();
*/
function helpMessage() {
  if((totalShots === 3 || totalShots === 4) && !clickedToOpen && !detailPageOpen) {
    push();
    textFont(titleFont);
    textAlign(CENTER);
    textSize(iconSize/4)
    fill(config.mainColor);
    text("Double click the ball if you're tired of playing", gridStartX, windowHeight*0.9);
    pop();
  }
}

/*
  captureWebsite()
    Used to display a copy of the website within the website ball
*/
  function captureWebsite() {
    let minDim = Math.min(windowWidth, windowHeight);
    let thisWebsite = get(0, 0, minDim, minDim);
    //imageBalls[1].ballImage = thisWebsite;
    imageBalls[1].fullImage = thisWebsite;
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
    createBalls();
    createGoals();
    createMenu();
    addResetButton();
    addContactUs();
    addBoundary();
    trackCollisions();
    createOutline();
  }

/*
  createOutline()
    Uses a second p5 graphics object to make images appear circular
*/ 
function createOutline() {
  if(imageMask) imageMask.remove();
  imageMask = createGraphics(iconSize, iconSize);
  imageMask.circle(iconSize/2, iconSize/2, iconSize);
}
 

/*
  trackCollisions()
    Creates an event listener for when two bodies are actively colliding
    Checks to see if any of the balls are currently touching their menu item
*/
function trackCollisions() {
  Matter.Events.on(engine, 'collisionActive', function(event) {
    if(!detailPageOpen) {
      event.source.pairs.collisionActive.forEach((collision) => {
        if(collision.bodyA.category && collision.bodyB.category && collision.bodyA.category === collision.bodyB.category && collision.bodyA.id !== collision.bodyB.id) {
          if(collision.bodyA.label === 'Image Ball') {
            imageBalls.find(imageBall => imageBall.body.id === collision.bodyA.id).showDetail();
          } else if(collision.bodyB.label === 'Image Ball') {
            imageBalls.find(imageBall => imageBall.body.id === collision.bodyB.id).showDetail();
          }
        }
      });
    };
  });
}


/*
  createBalls()
    Loops through all images that were pre-loaded
    Creates an "ImageBall" for each, passing in its image, location, and text info
    For each ball created, add its category to the category array
*/
  function createBalls() {
    imageBalls = [];
    imgs.forEach(function(img, i) {
      //console.log("gridStartX, Y, gridCurrentX, Y", gridStartX, ", ", gridStartY, ", ", gridCurrentX, ", ", gridCurrentY);
      imageBalls[i] = new ImageBall(img, gridCurrentX, gridCurrentY, pageInfo[i], i);
      if(gridCurrentX + iconSize + config.gridSpacing <= windowWidth) {
        gridCurrentX += config.gridSpacing;
      } else {
        gridCurrentX = gridStartX;
        gridCurrentY += config.gridSpacing;
      }
      if(categories.indexOf(imageBalls[i].category) === -1) {
        categories.push(imageBalls[i].category);
      };
    });
    categories.sort((a, b) => b.length - a.length);
  }


/*
  windowResized()
    Resizes the playfield whenever the window is resized
    Uses built in p5.js methods
*/
  function windowResized() {
    resizeCanvas(windowWidth*config.xScale, windowHeight*config.yScale);
    setDisplaySize();
    imageBalls.forEach(function(ball){
      if(ball.pageOpen) {
        ball.showDetail();
      } else {
        if(ball.body) ball.reset();
      }
    });
    if(!detailPageOpen) {
      createBalls();
      createGoals();
      createMenu();
      addBoundary();
      addContactUs()
      addResetButton();
      createOutline();
      trackCollisions();
    }
  }


/*
  addBoundary()
    Removes any existing boundary and replaces it with a new one
    Used to resize the screen and in initial setup
*/
function addBoundary() {
  if(boundary) boundary.remove();
  boundary = new Boundary(playfield.width, playfield.height, iconSize*2);
  boundary.add();
}


/*
  addContactUs
    Removes any existing element and replaces it with a new HTML element and matter.js body
    Used to resize the screen and in initial setup
*/
function addContactUs() {
  if (contactUsElement) contactUsElement.remove();
  contactUsElement = new ContactUs({x: gridStartX, y: windowHeight*0.93}, config.contactLinkText, config.contactLinkAddress);
  contactUsElement.add();
}


/*
  addResetButton()
    Creates a button on the screen in the lower right corner to reset
    all balls to their original position
*/
function addResetButton() {
  if(resetButton) resetButton.remove();
  resetButton = createButton("↻");
  resetButton.addClass("reset");
  resetButton.mousePressed(resetBalls);
}


/* 
  setDisplaySize()
    Calculates the appropriate sized grid based upon the window size
    Called during set up or when the window is resized
*/
  function setDisplaySize() {
    screenArea = windowWidth * windowHeight;
    config.sensitivity = Math.pow(screenArea, 1/3);
    portraitMode = windowHeight > windowWidth;
    iconSize =  Math.min(windowWidth/config.iconScale, windowHeight/config.iconScale);
    config.gridSpacing = 2*iconSize;
    goalPosition = {x: 0.33*iconSize, y:windowHeight*0.4};
    goalWidth = iconSize*1.4;
    gridStartX = goalPosition.x + goalWidth + 2*iconSize;
    gridStartY = goalPosition.y;
    if(windowWidth < windowHeight) gridStartY -= iconSize;
    gridCurrentX = gridStartX;
    gridCurrentY = gridStartY;
  } 


/*
createMenu()
  calculates a the appropriate position and creates a new menu item
  for each item in the categories array. It adds the items to the menu array to use later.
*/
function createMenu() {
  menu.forEach((menu) => Matter.World.remove(world, menu.body));
  menu = [];
  categories.forEach((category, index) => {
    let menuPos = {
      x: goalPosition.x + goalWidth/2,
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
  goals.forEach((goal) => Matter.World.remove(world, goal.body));
  net.forEach((net) => Matter.World.remove(world, net.body));
  goals = [];
  net = [];
  const netHeight = 0.8*categories.length*iconSize;
  for(let i = 0; i < 2; i++){
    let netOffset = -iconSize/6;
    if(i) netOffset = netOffset*-1;
    goals[i] = new Goal(goalPosition.x + i * goalWidth, goalPosition.y, iconSize/7.5, i);
    net.push(new Net(goalPosition.x + i * goalWidth + netOffset, goalPosition.y + netHeight/2, netHeight));
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
      imageBalls.forEach(function(ball) {
        if(ball && ball.display) {
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
      captureWebsite();
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
  if(windowHeight > windowWidth) {
    let splitTitle = config.titleText.replace(".", "").split(", ");
    let splitSubtitle = config.subTitleText.split(". ");
    let tempTextSize = iconSize/2.5;
    push();
    textSize(tempTextSize);
    fill(config.mainColor); 
    splitTitle.forEach((item, index) => text(item, windowWidth/8, windowHeight*0.07 + tempTextSize*1.1*index));
    textSize(iconSize/4);
    splitSubtitle.forEach((item, index) => text(item, windowWidth/8, windowHeight*0.07 + tempTextSize*splitTitle.length + index*tempTextSize));
    pop();
  } else {
    push();
    textSize(iconSize/2.5);
    fill(config.mainColor); 
    text(config.titleText, windowWidth/8, windowHeight/6);
    textSize(iconSize/4);
    text(config.subTitleText, windowWidth/8, windowHeight/4.2);
    pop();
  }
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
function doubleClicked() {
  imageBalls.forEach(function(ball) {
    if(ball.onBall(mouseX, mouseY)) {
      clickedToOpen = true;
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
  function mousePressed(event) {
    imageBalls.forEach(function(ball) {
      if(selectedCategory !== "All" && ball.category !== selectedCategory) {
        ball.display = false;
      } else {
        ball.display = true;
      }
      if(ball.onBall(mouseX, mouseY)) {
        ball.clicked = true;
        ball.clickedCount++;
      } else {
        ball.clicked = false;
      }
    });
  }

  // function checkIfClicked() {

  // }


/*
  mouseReleased()
    When the mouse is released, the ball that was clicked is
    checked to see if it's already been launched, if not it's added to the world.
    The ball is made moveable and the strength vector is applied as a force.
*/
  function mouseReleased() {
    imageBalls.forEach((ball, index) => {
      if(ball.clicked && (ball.xPower || ball.yPower)) {
        let strength = Matter.Vector.create(-ball.xPower*config.sensitivity/30000, -ball.yPower*config.sensitivity/30000);
        let ballPos = Matter.Vector.create(ball.x, ball.y);
        let ballCatIndex = categories.findIndex((category) => category === ball.category); 
        if(ball.inOriginalPosition) Matter.World.add(world, ball.body);
        ball.body.collisionFilter = {
          'group': ballCatIndex+1,
          'category': Math.pow(2, categories.findIndex(category => category === ball.category)),
          'mask': categoryBits[0] | categoryBits[1] | categoryBits[2],
        };
        Matter.Body.setStatic(ball.body, false);
        Matter.Body.applyForce(ball.body, ballPos, strength);
        ball.launched();
        totalShots++;
      } 
    });
    menu.forEach((item) => {
      if(item.onMenu(mouseX, mouseY)) {
        if(item.selected) {
          item.selected = false;
          selectedCategory = "All";
        } else {
          item.selected = true;
          selectedCategory = item.category;
        }
      } else {
        item.selected = false;
      }
    });   
  }