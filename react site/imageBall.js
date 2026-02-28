/*
  imageBall.js
  ─────────────
  Fixes vs original:
    1. Canvas clipping replaces img.mask() — mask() is destructive in p5.js v1.x;
       calling it every frame corrupted the image progressively.
    2. Detail page UI delegated to React via window.ui.openDetail()
    3. Matter.Composite replaces Matter.World (deprecated in v0.19)
    4. Accepts itemName param to build the image URL for React's <img> tag
*/

class ImageBall {
  constructor(img, xPos, yPos, size, info, index, itemName) {
    const defaultOptions = {
      friction: 0.5,
      frictionAir: 0.001,
      restitution: 0.66,
      isStatic: true,
    };
    this.body = Matter.Bodies.circle(xPos, yPos, size / 2, defaultOptions);
    this.index = index;

    // Parse the text file metadata
    const tempInfo = info.map((line) => line.split(": "));
    this.name         = tempInfo[0]?.[1] ?? '';
    this.link         = tempInfo[1]?.[1] ?? '';
    this.category     = tempInfo[2]?.[1] ?? '';
    this.goal         = tempInfo[3]?.[1] ?? '';
    this.role         = tempInfo[4]?.[1] ?? '';
    this.technology   = tempInfo[5]?.[1] ?? '';
    this.description  = tempInfo[6]?.[1] ?? '';
    this.body.category = this.category;

    this.body.id = this.name;
    this.body.label = 'Image Ball';

    // Image source URL — used by React detail panel
    this.imageSrc = itemName ? `../assets/images/${itemName}.jpg` : '';

    this.fullImage = img;
    const minSize = Math.min(img.height, img.width);
    // ✅ FIX: crop to square but do NOT call mask() here.
    //    Masking is now done via canvas clipping in show() instead.
    this.ballImage = img.get(0, 0, minSize, minSize);

    this.x = xPos;
    this.y = yPos;
    this.r = size / 2;
    this.xPower = 0;
    this.yPower = 0;
    this.clicked = false;
    this.launchCount = 0;
    this.originalPos = { x: xPos, y: yPos };
    this.inOriginalPosition = true;
    this.pageOpen = false;
    this.display = true;
    this.clickedCount = 0;
    this.lastClickTime = 0;
    this.opens = 0;
    this.makes = 0;
  }


  /* ── showDetail ─────────────────────────────────────────────────────────────
     Called when the ball scores a goal or is double-clicked.
     Draws the expanded image on canvas AND opens the React detail panel.
  */
  showDetail() {
    if (this.pageOpen) return;   // already open, don't re-open
    totalOpens++;
    this.makes++;
    this.pageOpen = true;
    detailPageOpen = true;

    // Delegate HTML detail panel to React
    window.ui?.openDetail({
      name:        this.name,
      link:        this.link,
      goal:        this.goal,
      role:        this.role,
      technology:  this.technology,
      description: this.description,
      imageSrc:    this.imageSrc,
    });

    return this;
  }


  /* ── removeDetailPage ───────────────────────────────────────────────────────
     Resets state when the user closes the detail page.
     React calls window.onDetailClosed() which drives the reset cascade.
  */
  removeDetailPage() {
    selectedCategory = "All";
    detailPageOpen = false;
    this.pageOpen = false;
    // window.onDetailClosed handles resetting balls (set up in sketch.js)
    window.onDetailClosed?.();
  }


  /* ── onBall ─────────────────────────────────────────────────────────────── */
  onBall(x, y) {
    return dist(x, y, this.x, this.y) < this.r;
  }


  /* ── show ───────────────────────────────────────────────────────────────────
     Draws the ball on the canvas.
     ✅ FIX: Uses drawingContext canvas clipping instead of p5's img.mask(),
     which was destructive (modified the image in-place) in p5.js v1.x.
  */
  show() {
    if (this.launchCount) this.checkForReset();

    const currentPos = this.body.position;
    const currentAngle = this.body.angle;

    push();
    translate(currentPos.x, currentPos.y);
    rotate(currentAngle);

    // Clip to circle so the image appears round
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.arc(0, 0, this.r, 0, Math.PI * 2);
    drawingContext.clip();

    imageMode(CENTER);
    image(this.ballImage, 0, 0, this.r * 2, this.r * 2);

    drawingContext.restore();

    // Circle border
    noFill();
    stroke(config.mainColor);
    strokeWeight(iconSize / 50);
    ellipseMode(CENTER);
    circle(0, 0, this.r * 2);

    pop();

    this.x = this.body.position.x;
    this.y = this.body.position.y;
  }


  /* ── checkForReset / offScreen / reset ─────────────────────────────────── */
  checkForReset() {
    if (this.offScreen()) this.reset();
  }

  offScreen() {
    const { x, y } = this.body.position;
    const radius = this.body.circleRadius * 2;
    return (
      x + radius < 0 ||
      x - radius > playfieldWidth ||
      y + radius < -playfieldHeight * 4 ||
      y - radius > playfieldHeight
    );
  }

  reset() {
    Matter.Body.setVelocity(this.body, { x: 0, y: 0 });
    Matter.Body.setPosition(this.body, this.originalPos);
    Matter.Body.setStatic(this.body, true);
    Matter.Body.setAngle(this.body, 0);
    // ✅ FIX: Matter.Composite.remove replaces Matter.World.remove
    Matter.Composite.remove(world, this.body);
    this.inOriginalPosition = true;
  }


  /* ── hover ──────────────────────────────────────────────────────────────────
     Arrow shown when mouse is over the ball but not clicked.
  */
  hover() {
    angleMode(DEGREES);
    const arrowLength = iconSize / 22;
    const angle = 45;
    const lineStart = {
      x: this.x - this.r * sin(angle),
      y: this.y - this.r * cos(angle),
    };
    const lineEnd = {
      x: lineStart.x - this.r / 2,
      y: lineStart.y - this.r / 2,
    };
    const pointA = {
      x: lineEnd.x - sin(angle) * arrowLength * 2,
      y: lineEnd.y - cos(angle) * arrowLength * 2,
    };
    const pointB = {
      x: lineEnd.x + cos(angle) * arrowLength,
      y: lineEnd.y - sin(angle) * arrowLength,
    };
    const pointC = {
      x: lineEnd.x - cos(angle) * arrowLength,
      y: lineEnd.y + sin(angle) * arrowLength,
    };

    push();
    if (totalShots < 3) {
      textAlign(CENTER);
      fill(config.mainColor);
      textSize(iconSize / 9);
      text("Drag to aim",       this.x, this.y + this.r * 1.3);
      text("Release to launch", this.x, this.y + this.r * 1.3 + iconSize / 8);
    }
    stroke(config.accentColor);
    strokeWeight(iconSize / 20);
    noFill();
    ellipseMode(CENTER);
    circle(this.x, this.y, this.r * 2);
    fill(config.accentColor);
    line(lineStart.x, lineStart.y, lineEnd.x, lineEnd.y);
    triangle(pointA.x, pointA.y, pointB.x, pointB.y, pointC.x, pointC.y);
    pop();
    angleMode(RADIANS);
  }


  /* ── aim ────────────────────────────────────────────────────────────────────
     Called while mouse is dragged. Draws the directional power arrow.
  */
  aim() {
    let powerScale = 33;
    if (portraitMode || mobileMode) powerScale /= 5;
    angleMode(DEGREES);

    this.xPower += ((mouseX - pmouseX) / config.sensitivity) * powerScale;
    this.yPower += ((mouseY - pmouseY) / config.sensitivity) * powerScale;

    const lineStart = {
      x: this.x - this.r * sin(45),
      y: this.y - this.r * cos(45),
    };
    const currentPosX = lineStart.x - this.xPower * 2;
    const currentPosY = lineStart.y - this.yPower * 2;
    const arrowLength = iconSize / 22;
    const angle = atan2(this.xPower, this.yPower);
    const pointA = {
      x: currentPosX - sin(angle) * arrowLength * 2,
      y: currentPosY - cos(angle) * arrowLength * 2,
    };
    const pointB = {
      x: currentPosX + cos(angle) * arrowLength,
      y: currentPosY - sin(angle) * arrowLength,
    };
    const pointC = {
      x: currentPosX - cos(angle) * arrowLength,
      y: currentPosY + sin(angle) * arrowLength,
    };

    push();
    stroke(config.accentColor);
    strokeWeight(5);
    noFill();
    ellipseMode(CENTER);
    circle(this.x, this.y, this.r * 2);
    fill(config.accentColor);
    line(lineStart.x, lineStart.y, currentPosX, currentPosY);
    triangle(pointA.x, pointA.y, pointB.x, pointB.y, pointC.x, pointC.y);
    pop();
    angleMode(RADIANS);
  }


  /* ── demoAim ─────────────────────────────────────────────────────────────── */
  demoAim() {
    this.show();
    angleMode(DEGREES);
    const lineStart = {
      x: this.x - this.r * sin(45),
      y: this.y - this.r * cos(45),
    };
    const currentPosX = lineStart.x - this.xPower * 2;
    const currentPosY = lineStart.y - this.yPower * 2;
    const arrowLength = iconSize / 22;
    const angle = atan2(this.xPower, this.yPower);
    const pointA = {
      x: currentPosX - sin(angle) * arrowLength * 2,
      y: currentPosY - cos(angle) * arrowLength * 2,
    };
    const pointB = {
      x: currentPosX + cos(angle) * arrowLength,
      y: currentPosY - sin(angle) * arrowLength,
    };
    const pointC = {
      x: currentPosX - cos(angle) * arrowLength,
      y: currentPosY + sin(angle) * arrowLength,
    };

    push();
    stroke(config.accentColor);
    strokeWeight(5);
    noFill();
    ellipseMode(CENTER);
    circle(this.x, this.y, this.r * 2);
    fill(config.accentColor);
    line(lineStart.x, lineStart.y, currentPosX, currentPosY);
    triangle(pointA.x, pointA.y, pointB.x, pointB.y, pointC.x, pointC.y);
    pop();
    angleMode(RADIANS);
  }


  launched() {
    this.launchCount++;
    this.inOriginalPosition = false;
  }
}
