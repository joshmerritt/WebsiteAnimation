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
backboard,
goalLine,
ground,
goalPosition,
detailPageOpen = false,
clicked = false;

// Loads images and text for use in building the website

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
    drawBalls();
    drawGoals();
    ground.show();
    menu.forEach((item) => {
      item.show();
    });
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
  }

  /*
    trackCollisions()
      Creates an event listener for when two bodies are actively colliding
      Checks to see if any of the balls are currently touching their menu item
  */
  function trackCollisions() {
    Matter.Events.on(engine, 'collisionActive', function(event) {
      //console.log("event - a - b", event);
      event.source.pairs.collisionActive.forEach((collision) => {
        //console.log('collision', collision);
        if(collision.bodyA.category && collision.bodyB.category && collision.bodyA.category === collision.bodyB.category) {
          // console.log("Success!!!");
          // console.log("body a", collision.bodyA);
          // console.log("body b", collision.bodyB);
          if(collision.bodyA.label === 'Image Ball') {
            imageBalls.find(imageBall => imageBall.body.id === collision.bodyA.id).showDetail();
          } else if(collision.bodyB.label === 'Image Ball') {

          }

        };
      });
      // let a = event.source.pairs.collisionActive[0].bodyA;
      // let b = event.source.pairs.collisionActive[0].bodyB;
      // console.log( a, " - ", b);
  
      // check bodies, do whatever...
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
      //console.log('img -', img);
      //console.log('load function: ', pages[i]);
      imageBalls[i] = new ImageBall(img, gridCurrentX, gridCurrentY, pageInfo[i]);
      //console.log('imageBall -', imageBalls[i]);
      if(gridCurrentX + iconSize*3 <= windowWidth) {
        gridCurrentX += iconSize*2;
      } else {
        gridCurrentX = gridStartX;
        gridCurrentY += iconSize*2;
      }
      console.log('imageBall ',i, " : ",imageBalls[i]);
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
    console.log('goal positon - iconSize', goalPosition, ' - ', iconSize);
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



  // If the mouse is being dragged, create and display a launch arrow

  function mouseDragged(event) {
    imageBalls.forEach(function(ball) {
      if(ball.clicked) {
        ball.aim();
      }
    });
  }

  // If the mouse is pressed, toggle the clicked property for all balls

  function mousePressed() {
    imageBalls.forEach(function(ball) {
      if(ball.onBall(mouseX, mouseY)) {
        ball.clicked = true;
      } else {
        ball.clicked = false;
      }
    });
  }

  // When the mouse is release the ball is added to the world
  // The launch arrow is applied to the ball and the body is made moveable

  function mouseReleased() {
    imageBalls.forEach(function(ball) {
      if(ball.clicked) {
        if(ball.inOriginalPosition) Matter.World.add(world, ball.body);
        console.log("launched ball: ", ball);
        let strength = Matter.Vector.create(-ball.xPower/3, -ball.yPower/3);
        console.log("strength - area (width * height) - iconSize:  ", strength, " - ", height*width, " - ", iconSize);
        let ballPos = Matter.Vector.create(ball.x, ball.y);
        Matter.Body.setStatic(ball.body, false);
        Matter.Body.applyForce(ball.body, ballPos, strength);
        ball.launched();
      } else {
          //ball.reset();
      }
    });    
  }
  