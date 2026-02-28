/*
  contactUs.js
  ────────────
  Optional contact link that balls can bounce off.
  Currently commented out in sketch.js but kept here for future use.
  Fix: Matter.Composite replaces deprecated Matter.World (matter.js v0.19+)
  Fix: Removed p5.js DOM helpers (createA) — use plain DOM instead.
*/

class ContactUs {
  constructor(position, text, link) {
    this.position = position;
    this.text     = text;
    this.link     = link;
  }

  add() {
    // Create the anchor element with plain DOM (no p5.js DOM dependency)
    this.element = document.createElement('a');
    this.element.href        = this.link;
    this.element.textContent = this.text;
    this.element.target      = '_blank';
    this.element.rel         = 'noopener noreferrer';
    this.element.style.position = 'absolute';
    document.body.appendChild(this.element);

    const rect = this.element.getBoundingClientRect();
    this.length = rect.width  || 100;
    this.height = rect.height || 20;

    if (playfieldWidth < 800) {
      this.position = { x: (playfieldWidth - this.length) / 2, y: this.position.y };
    }
    this.element.style.left = this.position.x + 'px';
    this.element.style.top  = this.position.y + 'px';

    const options = { isStatic: true, restitution: 0.5 };
    this.body = Matter.Bodies.rectangle(
      this.position.x + this.length / 2,
      this.position.y + this.height / 2,
      this.length * 0.9,
      this.height / 2,
      options
    );
    this.body.id       = 'ContactUs';
    this.body.category = 'Link';
    // ✅ FIX: Matter.Composite.add replaces Matter.World.add
    Matter.Composite.add(world, this.body);
  }

  remove() {
    this.element.remove();
    // ✅ FIX: Matter.Composite.remove replaces Matter.World.remove
    Matter.Composite.remove(world, this.body);
  }

  hide() {
    this.element.style.display = 'none';
    Matter.Composite.remove(world, this.body);
  }

  show() {
    this.element.style.display = 'block';
    Matter.Composite.add(world, this.body);
  }
}
