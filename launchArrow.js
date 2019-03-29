class LaunchArrow {
    constructor(x, y, body) {
        let strength = dist(x, y, body.position.x, body.position.y);
        const options = {
            pointA: {
                x: x,
                y: y
            },
            pointB: body,
            stiffness: 0.5,
            length: strength
        };
        this.launchArrow = Matter.Constraint.create(options);
        Matter.World.add(world, this.launchArrow);

    }

    launch() {
        // Matter.World.remove(world, this.launchArrow);
        // delete this;
        launchArrow.pointA = null;
    }

    show() {
        if(this.launchArrow.bodyB && this.launchArrow.pointA) {
            stroke(255);
            const start = this.launchArrow.pointA;
            const end = this.launchArrow.bodyB.position;
            line(start.x, start.y, end.x, end.y);
        }
    }
}