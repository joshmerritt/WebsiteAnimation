/*
Provided location, text, and the mailto link, construct link item
Balls will bounce off when they encounter it
*/

class ContactUs {
    constructor(position, text, link) {
        this.position = position;
        this.text = text;
        this.link = link;
        this.add = this.add.bind(this);

    }

    add() {
      this.element = createA(this.link, this.text, "_blank");
      this.element.size(windowWidth*2/3);
      this.length = this.element.width;
      this.height = this.element.height;
      console.log("this.length - windowWidth", this.length, " - ", windowWidth);
      if(windowWidth < 800) {
        this.position = {x: 10, y: this.position.y}
      }
      this.element.position(this.position.x, this.position.y);
      let options = {
        isStatic: true, 
        restitution: 0.5,
      };
      this.body = Matter.Bodies.rectangle(this.position.x + this.length/2, this.position.y + this.height/2, this.length*0.9, this.height/2, options);
      this.body.id = "ContactUs";
      this.body.category = "Link";
      Matter.World.add(world, this.body);
    }

    remove() {
      console.log('contact us remove this', this)
        this.element.remove();
        Matter.World.remove(world, this.body)
    }
}