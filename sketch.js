let categoryBits = [0x0001, 0x0002, 0x0004, 0x0008, 0x0016, 0x0032, 0x0064, 0x0128];
let imageBalls = [];
let imgs = [];
let imageBuffers = [];
let goals = [];
let categories = [];
let pageInfo = [];
let menu = [];
let net = [];
let playfieldWidth,
playfieldHeight,
iconSize, 
gridStartX, 
gridStartY, 
gridCurrentX, 
gridCurrentY,
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
mobileMode,
detailPageOpen,
resetButton,
titleElement,
subtitleElement,
contactUsElement;
let showDemo = true;
let clickedToOpen = false;
let totalShots = 0;
let totalMakes = 0;
let totalOpens = 0;
let selectedCategory = "All";

// Config object is used to store values for variables which are expected to be customized per user deployment preferences
let config = {
  itemsToDisplay: ['aboutMe', 'arduinoCoopDoor', 'googleDataStudioServiceTechs', 'powerBIMetrics', 'thisWebsite'],
  backgroundColor: "rgba(12, 18, 12, 1)", 
  mainColor: "rgba(199, 214, 213, 1)", 
  secondaryColor: "rgba(89, 133, 177, 1)",
  accentColor: "rgba(89, 133, 177, 1)",
  xScale: 1,
  yScale: 1,
  iconScale: 7,
  sensitivity: 1,
  powerAdjustment: 20000,
  gridSpacing: 1,
  titleText: "Hello world, I am Josh Merritt.",
  subTitleText: "Honest. Analytical. Data Nerd.",
  //contactLinkText: "What problem can I help you solve?",
  contactLinkText: "Contact Me",
  contactLinkAddress: "mailto:josh@DaDataDad.com"
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
  }


/*
  preload()
    Native p5.js function used to load assets prior to running the rest of the program  
*/
  function preload() {
    preLoadAssets();
  }


/*
  setup()
    Native p5.js function, run once when the program is loaded
*/
  function setup() {
    history.pushState({'page_id': 1}, document.title, location.href);
    playfield = createCanvas(windowWidth*config.xScale, windowHeight*config.yScale);
    setDisplaySize();
    engine = Matter.Engine.create();
    world = engine.world;
    //console.log("matter.js engine.world", world); 
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
      drawMenu();
      net.forEach((item) => item.show());
      helpMessage();
    }
    if(showDemo) {
      imageBalls[0].xPower += (power/100);
      imageBalls[0].yPower += (power/80);
      imageBalls[0].demoAim();
      if(imageBalls[0].xPower > power) {
        demo();
      }
    } else drawBalls();
  }


/*
  demo()
    Used to provide a demonstration of the launching feature of the website
    Show only once, on the initial load
*/
  function demo() {
    let strength = Matter.Vector.create(-imageBalls[0].xPower*config.sensitivity/config.powerAdjustment, -imageBalls[0].yPower*config.sensitivity/config.powerAdjustment);
    let ballPos = Matter.Vector.create(imageBalls[0].x, imageBalls[0].y);
    let ballCatIndex = categories.findIndex((category) => category === imageBalls[0].category); 
    Matter.World.add(world, imageBalls[0].body);
    imageBalls[0].body.collisionFilter = {
      'group': ballCatIndex + 1,
      'category': Math.pow(2, categories.findIndex(category => category === imageBalls[0].category)),
      'mask': categoryBits[0] | categoryBits[1] | categoryBits[2],
    };
    Matter.Body.setStatic(imageBalls[0].body, false);
    Matter.Body.applyForce(imageBalls[0].body, ballPos, strength);
    imageBalls[0].launched();
    showDemo = false;
}


/*
  drawMenu()
    Called by the draw function in order to show the menu each time.
    Loops through all menu items and checks if they have been selected or hovered over,
    if so, changes the display to reflect the user interaction for the applicable menu item
*/
function drawMenu() {
  menu.forEach((item) => {
      item.show(); 
  });
}


/*
  helpMessage();
*/
function helpMessage() {
  if(totalShots > 2 && totalShots < 10 && !clickedToOpen && !detailPageOpen) {
    let verticalPos = portraitMode ? playfieldHeight*.9 : playfieldHeight*.85;
    push();
    textSize(iconSize/6)
    fill(config.mainColor);
    text("Double click the image if you're tired of playing.", playfieldWidth/8, verticalPos);
    pop();
  }
}

/*
  captureWebsite()
    Used to display a copy of the website within the website ball
*/
  function captureWebsite() {
    let minDim = Math.min(playfieldWidth, playfieldHeight);
    let thisWebsite = get(0, 0, minDim, minDim);
    imageBalls[1].ballImage = thisWebsite;
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
    //addContactUs();
    addBoundary();
    trackCollisions();
    createOutline();
  }

/*
  createOutline()
    Uses a second p5 graphics object to make images appear circular by applying a "mask"
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
            totalMakes++;   
          } else if(collision.bodyB.label === 'Image Ball') {
            imageBalls.find(imageBall => imageBall.body.id === collision.bodyB.id).showDetail();
            totalMakes++;
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
    if(!pageInfo) setTimeout(createBalls, 150);
    imgs.forEach((img, i) => {
      imageBalls[i] = new ImageBall(img, gridCurrentX, gridCurrentY, iconSize, pageInfo[i], i);
      if(gridCurrentX + iconSize + config.gridSpacing <= playfieldWidth) {
        gridCurrentX += config.gridSpacing;
      } else if(!(Object.is(imgs.length - 1, i))){
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
    playfieldWidth = windowWidth;
    playfieldHeight = windowHeight;
    resizeCanvas(playfieldWidth*config.xScale, playfieldHeight*config.yScale);
    setDisplaySize();
    imageBalls.forEach((ball) => {
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
      //addContactUs()
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
  boundary = new Boundary(playfieldWidth, playfieldHeight, iconSize*2);
  boundary.add();
}


/*
  addContactUs
    Removes any existing element and replaces it with a new HTML element and matter.js body
    Used to resize the screen and in initial setup
*/
function addContactUs() {
  if (contactUsElement) contactUsElement.remove();
  contactUsElement = new ContactUs({x: gridStartX, y: playfieldHeight*0.9}, config.contactLinkText, config.contactLinkAddress);
  contactUsElement.add();
}


/*
  addResetButton()
    Creates a button on the screen in the lower right corner to reset
    all balls to their original position
*/
function addResetButton() {
  if(resetButton) resetButton.remove();
  resetButton = createButton("Reset");
  resetButton.addClass("reset");
  resetButton.mouseClicked(resetBalls);
  resetButton.mouseClicked(windowResized);
  resetButton.touchEnded(resetBalls);
  resetButton.touchEnded(windowResized);
}


/* 
  setDisplaySize()
    Calculates the appropriate sized grid based upon the window size
    Called during set up or when the window is resized
*/
  function setDisplaySize() {
    playfieldWidth = windowWidth;
    playfieldHeight = windowHeight;
    portraitMode = (playfieldHeight > playfieldWidth);
    mobileMode = (Math.max(playfieldHeight, playfieldWidth) <= 1000);
    screenArea = playfieldWidth * playfieldHeight;
    iconSize =  Math.min(playfieldWidth/config.iconScale, playfieldHeight/config.iconScale);
    config.sensitivity = Math.pow(screenArea, 1/3);
    config.powerAdjustment = mobileMode ? Math.pow(iconSize, 2.2) : Math.pow(iconSize, 2);
    config.powerAdjustment = portraitMode ? config.powerAdjustment*0.95 : config.powerAdjustment;
    power = Math.sqrt(iconSize)*(screenArea/350000);
    if(mobileMode) {
      power = portraitMode ? (screenArea/Math.pow(iconSize, 2.7)) : (screenArea/Math.pow(iconSize, 3));
    };
    // console.log('mobileMode::', mobileMode, 'portraitMode::', portraitMode);
    // console.log('screenArea :: iconSize', screenArea, " :: ", iconSize);
    // console.log('powerAdjustment', config.powerAdjustment);
    // console.log('power', power);
    config.gridSpacing = 2*iconSize;
    goalPosition = {x: 0.33*iconSize, y:playfieldHeight*0.4};
    goalWidth = iconSize*1.4;
    gridStartX = goalPosition.x + goalWidth + 2*iconSize;
    gridStartY = goalPosition.y;
    if(playfieldWidth < playfieldHeight) gridStartY -= iconSize;
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
      y: goalPosition.y + (index+1)*0.4*iconSize
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
  const netHeight = 0.4*categories.length*iconSize;
  for(let i = 0; i < 2; i++){
    let netOffset = 0;
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
  if(portraitMode) {
    let splitTitle = config.titleText.replace(".", "").split(", ");
    let splitSubtitle = config.subTitleText.split(". ");
    let tempTextSize = iconSize/2.5;
    push();
    textSize(tempTextSize);
    fill(config.mainColor); 
    splitTitle.forEach((item, index) => text(item, playfieldWidth/8, playfieldHeight*0.07 + tempTextSize*1.1*index));
    textSize(iconSize/4);
    splitSubtitle.forEach((item, index) => text(item, playfieldWidth/8, playfieldHeight*0.07 + tempTextSize*splitTitle.length + index*tempTextSize));
    pop();
  } else {
    push();
    textSize(iconSize/2.5);
    fill(config.mainColor); 
    text(config.titleText, playfieldWidth/8, playfieldHeight/6);
    textSize(iconSize/4);
    text(config.subTitleText, playfieldWidth/8, playfieldHeight/4.2);
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
  keyPressed()
    Built in function to trigger an action based upon a key press
*/
function keyPressed() {
  if(detailPageOpen &&  (keyCode === BACKSPACE || keyCode === ESCAPE)) {
    imageBalls.forEach(function(ball) {
      if(ball.pageOpen) {
        ball.removeDetailPage();
      } 
    });
  }
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
    return false;
  }


/*
  mousePressed()
    Checks to see where the mouse was pressed.
    If it is on a given ball, set clicked=true,
    otherwise set clicked=false
*/
  function mousePressed(event) {
    if(!detailPageOpen) {
      imageBalls.forEach(function(ball) {
        if(selectedCategory !== "All" && ball.category !== selectedCategory) {
          ball.display = false;
        } else {
          ball.display = true;
        }
        if(ball.onBall(mouseX, mouseY)) {
          if(ball.clicked && (Date.now() - ball.lastClickTime) < 300) {
            ball.showDetail();
            clickedToOpen = true;
          }
          ball.lastClickTime = Date.now();
          ball.clicked = true;
          ball.clickedCount++;
        } else {
          ball.clicked = false;
        }
      });
      return false;
    }
  }

/*
  mouseReleased()
    When the mouse is released, the ball that was clicked is
    checked to see if it's already been launched, if not it's added to the world.
    The ball is made moveable and the strength vector is applied as a force.
*/
  function mouseReleased(event) {
    menu.forEach((item) => {
      if(item.onMenu(mouseX, mouseY)) {
        if(item.selected) {
          item.selected = false;
          selectedCategory = "All";
        } else {
          item.selected = true;
          selectedCategory = item.category;
        }
      }
    });
    menu.forEach((item) => selectedCategory !== item.category ? item.selected = false : item.selected = true);
    if(!detailPageOpen) {
      imageBalls.forEach((ball, index) => {
        if(selectedCategory !== "All" && ball.category !== selectedCategory) {
          ball.display = false;
        } else {
          ball.display = true;
        }
        if(ball.clicked && (ball.xPower || ball.yPower)) {
          let strength = Matter.Vector.create(-ball.xPower*config.sensitivity/config.powerAdjustment, -ball.yPower*config.sensitivity/config.powerAdjustment);
          let ballPos = Matter.Vector.create(ball.x, ball.y);
          let ballCatIndex = categories.findIndex((category) => category === ball.category); 
          if(ball.inOriginalPosition) Matter.World.add(world, ball.body);
          ball.body.collisionFilter = {
            'group': ballCatIndex + 1,
            'category': Math.pow(2, categories.findIndex(category => category === ball.category)),
            'mask': categoryBits[0] | categoryBits[1] | categoryBits[2],
          };
          Matter.Body.setStatic(ball.body, false);
          Matter.Body.applyForce(ball.body, ballPos, strength);
          ball.launched();
          totalShots++;
        } 
      });  
      return false;
    }
  }