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
launchArrow;

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
  }



  function mousePressed() {
    console.log(this);
    console.log(event);
    //launchArrow = new LaunchArrow(mouse)
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
    createLaunchArrow();
  }

  function createLaunchArrow() {
    const mouse = Matter.Mouse.create(playfield.elt);
    const options = {
      mouse: mouse
    }
    launchArrow = Matter.MouseConstraint.create({
      pointA: imageBalls[0],
      bodyB: mouse,
      render: {
        lineWidth: 1,
      }  
    });
    console.log(launchArrow);
    Matter.World.add(world, launchArrow);
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