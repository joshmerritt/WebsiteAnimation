/*
  sketch.js — Main p5.js sketch
  ──────────────────────────────
  Fixes applied vs original:
    1. Collision event: event.source.pairs.collisionActive → event.pairs
    2. Matter.World → Matter.Composite (deprecated in matter.js v0.19)
    3. Removed p5.js DOM calls for UI (now handled by React via window.ui)
    4. window.onReset / window.onDetailClosed bridges for React ↔ sketch communication
*/

let categoryBits = [0x0001, 0x0002, 0x0004, 0x0008, 0x0016, 0x0032, 0x0064, 0x0128];
let imageBalls = [];
let imgs = [];
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
    power,
    boundary,
    goalPosition,
    goalWidth,
    screenArea,
    portraitMode,
    mobileMode;

// detailPageOpen is read by React via window.detailPageOpen, kept in sync here
let detailPageOpen = false;

let showDemo = true;
let clickedToOpen = false;
let totalShots = 0;
let totalMakes = 0;
let totalOpens = 0;
let selectedCategory = "All";

const config = {
  itemsToDisplay: ['aboutMe', 'arduinoCoopDoor', 'googleDataStudioServiceTechs', 'powerBIMetrics', 'thisWebsite', 'SiteAnalytics', 'thewineyoudrink', 'dartleague'],
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
  contactLinkText: "Contact Me",
  contactLinkAddress: "mailto:josh@DaDataDad.com",
};


// ─── p5.js lifecycle ────────────────────────────────────────────────────────

function preload() {
  for (const item of config.itemsToDisplay) {
    imgs.push(loadImage(`assets/images/${item}.jpg`));
    pageInfo.push(loadStrings(`assets/${item}.txt`));
  }
}

function setup() {
  history.pushState({ page_id: 1 }, document.title, location.href);
  playfield = createCanvas(windowWidth * config.xScale, windowHeight * config.yScale);
  setDisplaySize();

  // ✅ FIX: Use Matter.Composite-based API (matter.js v0.19+)
  engine = Matter.Engine.create();
  world = engine.world;

  background(config.backgroundColor);
  loadAssets();

  // Wire up React callbacks
  window.onReset = windowResized;
  window.onDetailClosed = () => {
    detailPageOpen = false;
    selectedCategory = "All";
    imageBalls.forEach((ball) => {
      ball.display = true;
      if (ball && !ball.inOriginalPosition) ball.reset();
    });
  };
}

function draw() {
  Matter.Engine.update(engine);
  background(config.backgroundColor);

  if (!detailPageOpen) {
    displayTitle();
    drawGoals();
    drawMenu();
    net.forEach((item) => item.show());
    helpMessage();
  }

  if (showDemo) {
    imageBalls[0].xPower += power / 100;
    imageBalls[0].yPower += power / 80;
    imageBalls[0].demoAim();
    if (imageBalls[0].xPower > power) {
      demo();
    }
  } else {
    drawBalls();
  }
}


// ─── Demo ────────────────────────────────────────────────────────────────────

function demo() {
  const strength = Matter.Vector.create(
    (-imageBalls[0].xPower * config.sensitivity) / config.powerAdjustment,
    (-imageBalls[0].yPower * config.sensitivity) / config.powerAdjustment
  );
  const ballPos = Matter.Vector.create(imageBalls[0].x, imageBalls[0].y);
  const ballCatIndex = categories.findIndex((c) => c === imageBalls[0].category);

  // ✅ FIX: Matter.Composite replaces Matter.World
  Matter.Composite.add(world, imageBalls[0].body);
  imageBalls[0].body.collisionFilter = {
    group: ballCatIndex + 1,
    category: Math.pow(2, ballCatIndex),
    mask: categoryBits[0] | categoryBits[1] | categoryBits[2],
  };
  Matter.Body.setStatic(imageBalls[0].body, false);
  Matter.Body.applyForce(imageBalls[0].body, ballPos, strength);
  imageBalls[0].launched();
  showDemo = false;
}


// ─── Asset loading ───────────────────────────────────────────────────────────

function loadAssets() {
  createBalls();
  createGoals();
  createMenu();
  addBoundary();
  trackCollisions();
}

function createBalls() {
  imageBalls = [];
  if (!pageInfo) {
    setTimeout(createBalls, 150);
    return;
  }
  imgs.forEach((img, i) => {
    // Pass itemsToDisplay[i] so the ball knows its asset name for the image URL
    imageBalls[i] = new ImageBall(
      img,
      gridCurrentX,
      gridCurrentY,
      iconSize,
      pageInfo[i],
      i,
      config.itemsToDisplay[i]
    );
    if (gridCurrentX + iconSize + config.gridSpacing <= playfieldWidth) {
      gridCurrentX += config.gridSpacing;
    } else if (!Object.is(imgs.length - 1, i)) {
      gridCurrentX = gridStartX;
      gridCurrentY += config.gridSpacing;
    }
    if (categories.indexOf(imageBalls[i].category) === -1) {
      categories.push(imageBalls[i].category);
    }
  });
  categories.sort((a, b) => b.length - a.length);
}

function createGoals() {
  goals.forEach((g) => Matter.Composite.remove(world, g.body));
  net.forEach((n) => Matter.Composite.remove(world, n.body));
  goals = [];
  net = [];
  const netHeight = 0.4 * categories.length * iconSize;
  for (let i = 0; i < 2; i++) {
    goals[i] = new Goal(goalPosition.x + i * goalWidth, goalPosition.y, iconSize / 7.5, i);
    net.push(new Net(goalPosition.x + i * goalWidth, goalPosition.y + netHeight / 2, netHeight));
  }
}

function createMenu() {
  menu.forEach((m) => Matter.Composite.remove(world, m.body));
  menu = [];
  categories.forEach((category, index) => {
    const menuPos = {
      x: goalPosition.x + goalWidth / 2,
      y: goalPosition.y + (index + 1) * 0.4 * iconSize,
    };
    menu.push(new Menu(menuPos, category, index));
  });
}


// ─── Collision tracking ───────────────────────────────────────────────────────

function trackCollisions() {
  Matter.Events.on(engine, 'collisionActive', function (event) {
    if (detailPageOpen) return;

    // ✅ FIX: event.pairs replaces event.source.pairs.collisionActive
    event.pairs.forEach((collision) => {
      const { bodyA, bodyB } = collision;
      if (
        bodyA.category &&
        bodyB.category &&
        bodyA.category === bodyB.category &&
        bodyA.id !== bodyB.id
      ) {
        if (bodyA.label === 'Image Ball') {
          const ball = imageBalls.find((b) => b.body.id === bodyA.id);
          if (ball) { ball.showDetail(); totalMakes++; }
        } else if (bodyB.label === 'Image Ball') {
          const ball = imageBalls.find((b) => b.body.id === bodyB.id);
          if (ball) { ball.showDetail(); totalMakes++; }
        }
      }
    });
  });
}


// ─── Drawing ─────────────────────────────────────────────────────────────────

function drawBalls() {
  if (detailPageOpen) {
    imageBalls.forEach((ball) => {
      if (ball && ball.pageOpen) ball.showDetail();
    });
  } else {
    imageBalls.forEach((ball) => {
      if (ball && ball.display) {
        ball.show();
        if (mouseIsPressed) {
          if (ball.clicked) ball.aim();
        } else {
          if (ball.onBall(mouseX, mouseY)) ball.hover();
          // Keep power values intact until mouseReleased runs so launch
          // strength cannot be cleared before force is applied.
          if (!ball.clicked) {
            ball.xPower = 0;
            ball.yPower = 0;
          }
        }
      }
    });
    captureWebsite();
  }
}

function drawGoals() {
  goals.forEach((g) => { if (g) g.show(); });
}

function drawMenu() {
  menu.forEach((item) => item.show());
}

function displayTitle() {
  if (portraitMode) {
    const splitTitle = config.titleText.replace(".", "").split(", ");
    const splitSubtitle = config.subTitleText.split(". ");
    const tempTextSize = iconSize / 2.5;
    push();
    textSize(tempTextSize);
    fill(config.mainColor);
    splitTitle.forEach((item, i) =>
      text(item, playfieldWidth / 8, playfieldHeight * 0.07 + tempTextSize * 1.1 * i)
    );
    textSize(iconSize / 4);
    splitSubtitle.forEach((item, i) =>
      text(item, playfieldWidth / 8, playfieldHeight * 0.07 + tempTextSize * splitTitle.length + i * tempTextSize)
    );
    pop();
  } else {
    push();
    textSize(iconSize / 2.5);
    fill(config.mainColor);
    text(config.titleText, playfieldWidth / 8, playfieldHeight / 6);
    textSize(iconSize / 4);
    text(config.subTitleText, playfieldWidth / 8, playfieldHeight / 4.2);
    pop();
  }
}

function helpMessage() {
  if (totalShots > 2 && totalShots < 10 && !clickedToOpen && !detailPageOpen) {
    const verticalPos = portraitMode ? playfieldHeight * 0.9 : playfieldHeight * 0.85;
    push();
    textSize(iconSize / 6);
    fill(config.mainColor);
    text("Double click the image if you're tired of playing.", playfieldWidth / 8, verticalPos);
    pop();
  }
}

function captureWebsite() {
  if (imageBalls[4]) {
    const minDim = Math.min(playfieldWidth, playfieldHeight);
    const thisWebsite = get(0, 0, minDim, minDim);
    imageBalls[4].ballImage = thisWebsite;
    imageBalls[4].fullImage = thisWebsite;
  }
}


// ─── Utility ─────────────────────────────────────────────────────────────────

function setDisplaySize() {
  playfieldWidth = windowWidth;
  playfieldHeight = windowHeight;
  portraitMode = playfieldHeight > playfieldWidth;
  mobileMode = Math.max(playfieldHeight, playfieldWidth) <= 1000;
  screenArea = playfieldWidth * playfieldHeight;
  iconSize = Math.min(playfieldWidth / config.iconScale, playfieldHeight / config.iconScale);
  config.sensitivity = Math.pow(screenArea, 1 / 3);
  config.powerAdjustment = mobileMode ? Math.pow(iconSize, 2.2) : Math.pow(iconSize, 2);
  config.powerAdjustment = portraitMode ? config.powerAdjustment * 0.95 : config.powerAdjustment;
  power = Math.sqrt(iconSize) * (screenArea / 350000);
  if (mobileMode) {
    power = portraitMode
      ? screenArea / Math.pow(iconSize, 2.7)
      : screenArea / Math.pow(iconSize, 3);
  }
  config.gridSpacing = 2 * iconSize;
  goalPosition = { x: 0.33 * iconSize, y: playfieldHeight * 0.4 };
  goalWidth = iconSize * 1.4;
  gridStartX = goalPosition.x + goalWidth + 2 * iconSize;
  gridStartY = goalPosition.y;
  if (playfieldWidth < playfieldHeight) gridStartY -= iconSize;
  gridCurrentX = gridStartX;
  gridCurrentY = gridStartY;
}

function resetBalls() {
  imageBalls.forEach((ball) => {
    if (ball && !ball.inOriginalPosition) ball.reset();
  });
}

function addBoundary() {
  if (boundary) boundary.remove();
  boundary = new Boundary(playfieldWidth, playfieldHeight, iconSize * 2);
  boundary.add();
}


// ─── Event handlers ───────────────────────────────────────────────────────────

function windowResized() {
  playfieldWidth = windowWidth;
  playfieldHeight = windowHeight;
  resizeCanvas(playfieldWidth * config.xScale, playfieldHeight * config.yScale);
  setDisplaySize();
  imageBalls.forEach((ball) => {
    if (ball.pageOpen) {
      ball.showDetail();
    } else if (ball.body) {
      ball.reset();
    }
  });
  if (!detailPageOpen) {
    createBalls();
    createGoals();
    createMenu();
    addBoundary();
    trackCollisions();
  }
}

function keyPressed() {
  if (detailPageOpen && (keyCode === BACKSPACE || keyCode === ESCAPE)) {
    imageBalls.forEach((ball) => {
      if (ball.pageOpen) ball.removeDetailPage();
    });
  }
}

function mouseDragged() {
  imageBalls.forEach((ball) => {
    if (ball.clicked) ball.aim();
  });
  return false;
}

// Touch equivalents — mouseReleased is not reliably triggered by touchend
// on all mobile browsers, so we wire touch events explicitly.
function touchStarted() { return mousePressed(); }
function touchMoved()   { return mouseDragged(); }
function touchEnded()   { return mouseReleased(); }

function mousePressed() {
  if (!detailPageOpen) {
    imageBalls.forEach((ball) => {
      if (selectedCategory !== "All" && ball.category !== selectedCategory) {
        ball.display = false;
      } else {
        ball.display = true;
      }
      if (ball.onBall(mouseX, mouseY)) {
        // Double-click detection
        if (ball.clicked && Date.now() - ball.lastClickTime < 300) {
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

function mouseReleased() {
  // Handle menu category selection
  menu.forEach((item) => {
    if (item.onMenu(mouseX, mouseY)) {
      if (item.selected) {
        item.selected = false;
        selectedCategory = "All";
      } else {
        item.selected = true;
        selectedCategory = item.category;
      }
    }
  });
  menu.forEach((item) => (selectedCategory !== item.category ? (item.selected = false) : (item.selected = true)));

  if (!detailPageOpen) {
    imageBalls.forEach((ball) => {
      if (selectedCategory !== "All" && ball.category !== selectedCategory) {
        ball.display = false;
      } else {
        ball.display = true;
      }
      if (ball.clicked && (ball.xPower || ball.yPower)) {
        const strength = Matter.Vector.create(
          (-ball.xPower * config.sensitivity) / config.powerAdjustment,
          (-ball.yPower * config.sensitivity) / config.powerAdjustment
        );
        const ballPos = Matter.Vector.create(ball.x, ball.y);
        const ballCatIndex = categories.findIndex((c) => c === ball.category);

        // ✅ FIX: Matter.Composite replaces Matter.World
        if (ball.inOriginalPosition) Matter.Composite.add(world, ball.body);
        ball.body.collisionFilter = {
          group: ballCatIndex + 1,
          category: Math.pow(2, ballCatIndex),
          mask: categoryBits[0] | categoryBits[1] | categoryBits[2],
        };
        Matter.Body.setStatic(ball.body, false);
        Matter.Body.applyForce(ball.body, ballPos, strength);
        ball.launched();
        totalShots++;
      }

      // Release should always end the aiming session for this ball.
      ball.clicked = false;
      ball.xPower = 0;
      ball.yPower = 0;
    });
    return false;
  }
}
