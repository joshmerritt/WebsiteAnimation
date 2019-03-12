
let icons = [];
let imgs = [];
let imageBuffers = [];
let iconSize, 
gridStartX, 
gridStartY, 
gridCurrentX, 
gridCurentY,
imageLayer;

  function preload() {
    imgs.push(loadImage('assets/images/cellman.jpg'));
    imgs.push(loadImage('assets/images/antbw.jpg'));
  }

  function setup() {
    createCanvas(windowWidth, windowHeight);
    background(17,51,153);
    setDisplaySize();
    loadAssets();
  }

  function draw() {
    icons.forEach(function(icon) {
      icon.show();
    });
  }

  function mouseDragged() {
    icons[0].aim();
  }

  function setDisplaySize() {
    iconSize =  Math.min(windowWidth/7, windowHeight/7);
    gridStartX = windowWidth/4;
    gridStartY = windowHeight/3;
    gridCurrentX = gridStartX;
    gridCurrentY = gridStartY;
  }

  function loadAssets() {
      imgs.forEach(function(img,i) {
        icons[i] = new Icon(img, gridCurrentX, gridCurrentY);
        if(gridCurrentX + iconSize*3 <= windowWidth) {
          gridCurrentX += iconSize*2;
        } else {
          gridCurrentX = gridStartX;
          gridCurrentY += icons*2;
        }
    });
  }

  class Icon {
    constructor(img, xPos, yPos) {
      this.img = img;
      this.x = xPos;
      this.y = yPos;
      this.canvas = createGraphics(iconSize,iconSize);

      
    }
    show() {
      //this.canvas.image(this.img,this.x,this.y,iconSize,iconSize);
      image(this.img,this.x,this.y, iconSize, iconSize);    
    }

    aim() {
      this.speed = this.x - mouseX;
      this.direction = this.y - mouseY;
      stroke(128);
      line(this.x, this.y, this.x + this.speed, this.y + this.direction);
    }

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