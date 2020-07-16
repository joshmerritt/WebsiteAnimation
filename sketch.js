let itemsToDisplay = ['scoreboard', 'disc', 'antbw', 'flowchart'];
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
launchArrow,
power,
ground,
goalPosition,
detailPageOpen,
resetButton;


/*
  preLoadAssets()
    Called by preload(), which ensures that the data is read 
    and available to the system before attempting to build the page.
    Loops through itemsToDisplay array to load images and text description files.
    Stores the images in the imgs array and the descriptions in the pageInfo array.

*/
  function preLoadAssets() {
    for (const item of itemsToDisplay) {
      imgs.push(loadImage(`assets/images/${item}.jpg`));
      let tempString = loadStrings(`assets/${item}.txt`);
      pageInfo.push(tempString);
    }
  }

  function preload() {
    preLoadAssets();
  }

  function setup() {
    playfield = createCanvas(document.documentElement.clientWidth*.99, document.documentElement.clientHeight*.955);
    setDisplaySize();
    engine = Matter.Engine.create();
    world = engine.world;
    console.log("world", world); 
    background(111);
    loadAssets();
  }

  function draw() {
    Matter.Engine.update(engine);
    background(111);
    drawGoals();
    ground.show();
    menu.forEach((item) => {
      item.show();
    });
    drawBalls();
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
    createMenu();
    ground = new Ground(width, height, iconSize);
    trackCollisions();
    addResetButton();
  }

/*
  addResetButton()
    Creates a button on the screen in the lower right corner to reset
    all balls to their original position
*/
  function addResetButton() {
    resetButton = createButton("↻");
    resetButton.position(windowWidth - iconSize, windowHeight - iconSize);
    resetButton.mousePressed(resetBalls);
  }

  function resetBalls() {
    imageBalls.forEach(function(ball) {
      if(ball) {
        ball.reset();
      }
    }); 
  }


  /*
    trackCollisions()
      Creates an event listener for when two bodies are actively colliding
      Checks to see if any of the balls are currently touching their menu item
  */
  function trackCollisions() {
    Matter.Events.on(engine, 'collisionActive', function(event) {
      event.source.pairs.collisionActive.forEach((collision) => {
        if(collision.bodyA.category && collision.bodyB.category && collision.bodyA.category === collision.bodyB.category) {
          if(collision.bodyA.label === 'Image Ball') {
            imageBalls.find(imageBall => imageBall.body.id === collision.bodyA.id).showDetail();
          } else if(collision.bodyB.label === 'Image Ball') {

          }

        };
      });
    });
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
      if(categories.indexOf(imageBalls[i].category) === -1) categories.push(imageBalls[i].category);
    });
    categories.sort((a, b) => b.length - a.length);
    imageBalls.forEach((ball) => {
      ball.body.collisionFilter = {
        'group': 1,
        'category': Math.pow(2, categories.findIndex(category => category === ball.category)),
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
    resizeCanvas(document.documentElement.clientWidth*.99, document.documentElement.clientHeight*.955);
    setDisplaySize();
  }

/* 
  setDisplaySize()
    Calculates the appropriate sized grid based upon the window size
    Called during set up or when the window is resized
*/
  function setDisplaySize() {
    iconSize =  Math.min(windowWidth/7, windowHeight/7);
    goalPosition = {x: 1.1*iconSize, y:windowHeight/3};
    gridStartX = goalPosition.x + iconSize*3;
    gridStartY = goalPosition.y;
    gridCurrentX = gridStartX;
    gridCurrentY = gridStartY;
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
      if(ball.clicked) {
        let strength = Matter.Vector.create(-ball.xPower/3, -ball.yPower/3);
        let ballPos = Matter.Vector.create(ball.x, ball.y);
        if(ball.inOriginalPosition) Matter.World.add(world, ball.body);
        Matter.Body.setStatic(ball.body, false);
        Matter.Body.applyForce(ball.body, ballPos, strength);
        ball.launched();
      } else {
          //ball.reset();
      }
    });    
  }