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
    background(111);
    setDisplaySize();
    engine = Matter.Engine.create();
    world = engine.world;
    loadAssets();
    power = 0;
    
  }

  function draw() {
    Matter.Engine.update(engine);
    background(111);
    imageBalls.forEach(function(ball) {
      if(ball) {
        ball.show();
      }
    });
    goals.forEach(function(goal) {
      if(goal) {
        goal.show();
      }
    });
    if(launchArrow) {
        launchArrow.show();
    }
  }


// function mouseDragged(event) {
//   print(event);
//   power += 1;
//   stroke(255);
//   strokeWeight(7);
//   playfield.line(mouseX,mouseY,mouseX-power,mouseY-power);
// }

  function mousePressed() {
    if(!clicked) {
      createLaunchArrow();
      clicked = true;
    }
  }

  function mouseReleased() {
    Matter.Body.setStatic(imageBalls[0].body, false);
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

  function createLaunchArrow() {
    launchArrow = new LaunchArrow(mouseX, mouseY, imageBalls[0].body);
  }

  
  





// function mouseReleased() {
//   background(map(power,0,100,0,255));
//   power = 0;

// }