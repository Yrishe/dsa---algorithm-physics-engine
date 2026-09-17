// Thin wrapper around a Matter.js world plus a p5 renderer for its bodies.
// Each body carries a `style` object describing how to draw it.
const { Engine, Bodies, Body, Composite, Constraint } = Matter;

const PHYSICS_STEP = 1000 / 120;

class Physics {
  constructor({ gravity = 1 } = {}) {
    this.engine = Engine.create();
    this.engine.gravity.y = gravity;
    this.engine.positionIterations = 10;
    this.engine.velocityIterations = 8;
    this.world = this.engine.world;
    this.acc = 0;
  }

  // Fixed-step integration keeps stacks stable at every animation speed.
  step(dt) {
    this.acc += dt;
    let steps = 0;
    while (this.acc >= PHYSICS_STEP && steps < 12) {
      Engine.update(this.engine, PHYSICS_STEP);
      this.acc -= PHYSICS_STEP;
      steps++;
    }
    if (steps === 12) this.acc = 0;

    for (const b of Composite.allBodies(this.world)) {
      if (!b.cull) continue;
      const { x, y } = b.position;
      if (y > Theme.height + 200 || y < -800 || x < -300 || x > Theme.width + 300) this.remove(b);
    }
  }

  destroy() {
    Composite.clear(this.world, false, true);
    Engine.clear(this.engine);
  }

  // ---- creation -----------------------------------------------------------

  // Bodies are always created dynamic and made static afterwards, so Matter
  // keeps their real mass and they can later be released or flung.
  rect(x, y, w, h, style = {}, opts = {}) {
    const { isStatic, ...rest } = opts;
    const b = Bodies.rectangle(x, y, w, h, { friction: 0.4, frictionAir: 0.01, restitution: 0.05, ...rest });
    b.style = { kind: 'rect', w, h, radius: 6, fill: Theme.accent, ...style };
    if (isStatic) Body.setStatic(b, true);
    Composite.add(this.world, b);
    return b;
  }

  circle(x, y, r, style = {}, opts = {}) {
    const { isStatic, ...rest } = opts;
    const b = Bodies.circle(x, y, r, { friction: 0.05, frictionAir: 0.01, restitution: 0.2, ...rest });
    b.style = { kind: 'circle', r, fill: Theme.accent, ...style };
    if (isStatic) Body.setStatic(b, true);
    Composite.add(this.world, b);
    return b;
  }

  // Non-rotating labelled box: array cells, letters, stack frames...
  tile(x, y, w, h, label, style = {}, opts = {}) {
    return this.rect(x, y, w, h, { label, fill: Theme.colorForValue(label), textSize: Math.min(18, h * 0.45), ...style }, { inertia: Infinity, friction: 0.3, restitution: 0, ...opts });
  }

  wall(x, y, w, h, style = {}, opts = {}) {
    const b = Bodies.rectangle(x, y, w, h, { isStatic: true, friction: 0.6, ...opts });
    b.style = { kind: 'rect', w, h, radius: 3, fill: Theme.line, ...style };
    Composite.add(this.world, b);
    return b;
  }

  // Zero-length spring pulling a body toward a world point (used for layouts).
  anchor(body, x, y, stiffness = 0.012, damping = 0.08) {
    const c = Constraint.create({ bodyA: body, pointB: { x, y }, length: 0, stiffness, damping });
    c.style = { hidden: true };
    Composite.add(this.world, c);
    return c;
  }

  remove(thing) {
    if (!thing) return;
    Composite.remove(this.world, thing, true);
  }

  // ---- motion helpers -----------------------------------------------------

  static speedOf(b) {
    return Body.getSpeed ? Body.getSpeed(b) : b.speed;
  }

  freeze(b, x = b.position.x, y = b.position.y) {
    Body.setStatic(b, true);
    Body.setAngle(b, 0);
    Body.setPosition(b, { x, y });
  }

  release(b) {
    if (b.isStatic) Body.setStatic(b, false);
  }

  // Throw a body off-screen; it stops colliding and is removed once it leaves.
  fling(b, vx, vy, spin = 0) {
    this.release(b);
    b.collisionFilter = { group: 0, category: 0x0004, mask: 0 };
    b.cull = true;
    Body.setVelocity(b, { x: vx, y: vy });
    Body.setAngularVelocity(b, spin);
  }

  // Let a body fall under gravity and freeze it once it rests at (x, y).
  async dropTo(anim, b, x, y, timeout = 2500) {
    this.release(b);
    await anim.waitUntil(() => Math.abs(b.position.y - y) < 2.5 && Physics.speedOf(b) < 0.25, timeout);
    this.freeze(b, x, y);
  }

  // Tween a (frozen) body to a target, optionally along an arc.
  moveTo(anim, b, x, y, duration = 400, { arc = 0, ease = Ease.inOutCubic } = {}) {
    if (!b.isStatic) Body.setStatic(b, true);
    const x0 = b.position.x;
    const y0 = b.position.y;
    const a0 = b.angle;
    return anim.tween(
      duration,
      (e) => {
        const lift = Math.sin(Math.PI * e) * arc;
        Body.setPosition(b, { x: lerp(x0, x, e), y: lerp(y0, y, e) - lift });
        Body.setAngle(b, lerp(a0, 0, e));
      },
      ease
    );
  }

  // ---- rendering ----------------------------------------------------------

  render(p) {
    for (const c of Composite.allConstraints(this.world)) {
      if (!c.style || c.style.hidden) continue;
      const a = Constraint.pointAWorld(c);
      const b = Constraint.pointBWorld(c);
      p.stroke(c.style.stroke || Theme.line);
      p.strokeWeight(c.style.weight || 2);
      p.line(a.x, a.y, b.x, b.y);
    }
    const bodies = Composite.allBodies(this.world).sort((a, b) => (a.style?.z || 0) - (b.style?.z || 0));
    for (const b of bodies) Physics.drawBody(p, b);
  }

  static drawBody(p, b) {
    const s = b.style;
    if (!s || s.hidden) return;
    const alpha = s.alpha ?? 1;
    p.push();
    p.translate(b.position.x, b.position.y);
    p.rotate(b.angle);
    p.drawingContext.globalAlpha = alpha;

    if (s.glow) {
      p.drawingContext.shadowColor = s.glow;
      p.drawingContext.shadowBlur = 18;
    }
    p.fill(s.fill);
    if (s.highlight) {
      p.stroke(s.highlight);
      p.strokeWeight(3);
    } else if (s.stroke) {
      p.stroke(s.stroke);
      p.strokeWeight(s.strokeWeight || 1.5);
    } else {
      p.noStroke();
    }

    if (s.kind === 'circle') {
      p.circle(0, 0, s.r * 2);
      if (s.mark) {
        // small notch so rolling is visible even with an upright label
        p.noStroke();
        p.fill(0, 0, 0, 60);
        p.circle(s.r * 0.7, 0, s.r * 0.28);
      }
    } else if (s.kind === 'rect') {
      p.rectMode(p.CENTER);
      p.rect(0, 0, s.w, s.h, s.radius);
    } else {
      p.beginShape();
      for (const v of b.vertices) p.vertex(v.x - b.position.x, v.y - b.position.y);
      p.endShape(p.CLOSE);
    }
    p.drawingContext.shadowBlur = 0;

    if (s.label !== undefined && s.label !== null && s.label !== '') {
      if (s.rotateLabel === false) p.rotate(-b.angle);
      p.noStroke();
      p.fill(s.textColor || '#0d1117');
      p.textFont(Theme.font);
      p.textStyle(p.BOLD);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(s.textSize || 16);
      p.text(String(s.label), 0, 1);
    }
    p.pop();
  }
}
