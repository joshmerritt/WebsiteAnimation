class LaunchArrow {
    constructor(x, y, body) {
        const options = {
            pointA: {
                x: x,
                y: y
            },
            bodyB: body,
            stiffness: 0.5,
            length: 20
        }
        this.launchArrow = Matter.Constraint.create(options);
        Matter.World.add(world, this.launchArrow);

    }

    show() {
        stroke(255);
        const start = this.launchArrow.PointA;
        const end = this.launchArrow.body.position;
        line(start.x, start.y, end.x, end.y);
    }
}