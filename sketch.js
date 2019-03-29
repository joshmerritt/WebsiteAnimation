let imageBalls = [];
let imgs = [];
let imageBuffers = [];
let goals = [];
let iconSize, 
gridStartX, 
gridStartY, 
gridCurrentX, 
gridCurentY,
playfield,
engine,
world,
launchArrow,
power;
let clicked = false;

  function preload() {
    imgs.push(loadImage('assets/images/cellman.jpg'));
    imgs.push(loadImage('assets/images/antbw.jpg'));
  }

  function setup() {
    playfield = createCanvas(windowWidth, windowHeight);
    setDisplaySize();
    engine = Matter.Engine.create();
    world = engine.world;
    background(111);
    loadAssets();
  }

  function draw() {
    Matter.Engine.update(engine);
    background(111);
    drawBalls();
    drawGoals();

  }

  function drawBalls() {
    imageBalls.forEach(function(ball) {
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

  function drawGoals() {
    goals.forEach(function(goal) {
      if(goal) {
        goal.show();
      }
    });
  }

  function setDisplaySize() {
    iconSize =  Math.min(windowWidth/7, windowHeight/7);
    gridStartX = windowWidth/4;
    gridStartY = windowHeight/4;
    gridCurrentX = gridStartX;
    gridCurrentY = gridStartY;
  }

  function loadAssets() {
    imgs.forEach(function(img,i) {
        imageBalls[i] = new ImageBall(img, gridCurrentX, gridCurrentY, true);
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
  }


  function mouseDragged(event) {
    imageBalls.forEach(function(ball) {
      if(ball.clicked) {
        ball.aim();
      }
    });
  }

  function mousePressed() {
    imageBalls.forEach(function(ball) {
      if(ball.onBall(mouseX, mouseY)) {
        ball.clicked = true;
      } else {
        ball.clicked = false;
      }
    });
  }

  function mouseReleased() {
    createLaunchArrow();
    console.log(launchArrow);
    setTimeout(() => {
      launchArrow.launch();
    }, 50);
  }
  
  function createLaunchArrow() {
    imageBalls.forEach(function(ball) {
      if(ball.clicked) {
        launchArrow = new LaunchArrow(ball.x - ball.xPower, ball.y - ball.yPower, ball.body);
        Matter.Body.setStatic(ball.body, false);
      }
    });
  }