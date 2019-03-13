let imageBalls = [];
let imgs = [];
let imageBuffers = [];
let iconSize, 
gridStartX, 
gridStartY, 
gridCurrentX, 
gridCurentY,
imageLayer,
engine,
world,
leftGoal,
rightGoal;

  function preload() {
    imgs.push(loadImage('assets/images/cellman.jpg'));
    imgs.push(loadImage('assets/images/antbw.jpg'));
  }

  function setup() {
    createCanvas(windowWidth, windowHeight);
    background(17,51,153);
    setDisplaySize();
    engine = Matter.Engine.create();
    world = engine.world;
    loadAssets();
  }

  function draw() {
    Matter.Engine.update(engine);
    imageBalls.forEach(function(ball) {
      if(ball) {
        ball.show();
      }
    });
  }

  function mouseClicked() {
    imageBalls[0].body.isStatic = false;
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
        imageBalls[i] = new ImageBall(img, gridCurrentX, gridCurrentY);
        if(gridCurrentX + iconSize*3 <= windowWidth) {
          gridCurrentX += iconSize*2;
        } else {
          gridCurrentX = gridStartX;
          gridCurrentY += icons*2;
        }
    });
    drawGoal();
  }

  function drawGoal() {
    leftGoal = Matter.Bodies.circle(windowWidth/50, gridStartY/3, iconSize/10,{isStatic: true});
    rightGoal = Matter.Bodies.circle(windowWidth/50 + iconSize, gridStartY/3, iconSize/10,{isStatic: true});
    //Matter.Body.setStatic(goal.body,true);
    Matter.World.add(world, leftGoal);
    Matter.World.add(world, rightGoal);
    fill(128);
    ellipseMode(CENTER);
    circle(iconSize/5, gridStartY, iconSize/10);
    circle(iconSize + iconSize, gridStartY, iconSize/10);
  }
  



// function mouseDragged(event) {
//   print(event);
//   power += 1;
//   line(mouseX,mouseY,mouseX-power,mouseY-power);
// }

// function mouseReleased() {
//   background(map(power,0,100,0,255));
//   power = 0;

// }