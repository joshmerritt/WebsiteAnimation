let imageBalls = [];
let imgs = [];
let imageBuffers = [];
let goals = [];
let categories = [];
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
ground,
goalPosition,
clicked = false;


  function preload() {
    imgs.push(loadImage('assets/images/cellman.jpg'));
    imgs.push(loadImage('assets/images/antbw.jpg'));
    imgs.push(loadImage('assets/images/bball.jpeg'));
    imgs.push(loadImage('assets/images/disc.jpg'));
  }

  function setup() {
    playfield = createCanvas(windowWidth*0.99, windowHeight*0.97);
    setDisplaySize();
    engine = Matter.Engine.create();
    world = engine.world;
    console.log(world); 
    background(111);
    loadAssets();
  }

  function draw() {
    Matter.Engine.update(engine);
    background(111);
    drawBalls();
    drawGoals();
    drawMenu();
    ground.show();
    backboard.show();

  }

// Creates a 'ball' for each image that is spaced intelligently across the screen
// Each image has a category that is added to the categories array, if not already present
// Categories are ordered by descending length and displayed below the 'goal posts'
// Goal posts are created about the menu items which are used to mark the 'goal'
// Invisible barriers are in place to prevent reaching the menu except from above

  function loadAssets() {
    imgs.forEach(function(img, i) {
        console.log('img -', img);
        imageBalls[i] = new ImageBall(img, gridCurrentX, gridCurrentY, true);
        console.log('imageBall -', imageBalls[i]);
        if(gridCurrentX + iconSize*3 <= windowWidth) {
          gridCurrentX += iconSize*2;
        } else {
          gridCurrentX = gridStartX;
          gridCurrentY += icons*2;
        }
    });
    for(let i = 0; i < 2; i++){
      goals[i] = new Goal(iconSize/(2-i) + iconSize*i, gridStartY, iconSize/10);
    };

    ground = new Ground(windowWidth, windowHeight, iconSize);
  }

  // Checks each ball to decide to show it, 
  // determine if the mouse is hovering on it, or
  // create a launch arrow if the mouse is clicked
  // for each applicable ball

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

  // Displays the goals

  function drawGoals() {
    goals.forEach(function(goal, index) {
      if(goal) {
        goal.show();
      }
    });
  }

  // Resizes the playfield whenever the window is resized
  // Uses built in p5.js methods

  function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    setDisplaySize();
  }

  // Calculates the appropriate sized grid based upon the window size

  function setDisplaySize() {
    goalPosition = {x:windowWidth/4, y:windowHeight/4};
    iconSize =  Math.min(windowWidth/7, windowHeight/7);
    gridStartX = windowWidth/3;
    gridStartY = windowHeight/3;
    gridCurrentX = gridStartX;
    gridCurrentY = gridStartY;
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
        if(ball.launchCount===0) Matter.World.add(world, ball.body);
        let strength = Matter.Vector.create(-ball.xPower/3, -ball.yPower/3);
        let ballPos = Matter.Vector.create(ball.x, ball.y);
        Matter.Body.setStatic(ball.body, false);
        Matter.Body.applyForce(ball.body, ballPos, strength);
        ball.launched();
      } else {
          //ball.reset();
      }
    });    
  }
  