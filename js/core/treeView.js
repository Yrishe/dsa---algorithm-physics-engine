// Shared renderer for node-and-edge structures (trees, heaps). Each node is a
// Matter.js circle held by a spring anchor; moving the anchor makes the node
// glide to its new place. Removed nodes lose their anchor and fall away.
const NODE_STATE_COLORS = {
  visit: Theme.yellow,
  path: Theme.cyan,
  found: Theme.green,
  remove: Theme.red,
  new: Theme.purple,
  swap: Theme.orange,
};

class TreeView {
  constructor(physics, r = 24) {
    this.physics = physics;
    this.r = r;
    this.nodes = new Set();
    this.fallers = [];
  }

  add(value, x, y) {
    const body = this.physics.circle(x, y, this.r, { hidden: true }, { frictionAir: 0.12, collisionFilter: { group: -1 } });
    const anchor = this.physics.anchor(body, x, y, 0.03, 0.2);
    const node = { value, body, anchor, left: null, right: null, state: null };
    this.nodes.add(node);
    return node;
  }

  moveTo(node, x, y) {
    node.anchor.pointB.x = x;
    node.anchor.pointB.y = y;
  }

  pos(node) {
    return node.body.position;
  }

  drop(node) {
    if (!this.nodes.delete(node)) return;
    this.physics.remove(node.anchor);
    node.body.collisionFilter = { group: 0, category: 0x0004, mask: 0 };
    Body.setVelocity(node.body, { x: (Math.random() - 0.5) * 4, y: -3 });
    this.fallers.push(node);
  }

  clear() {
    for (const n of [...this.nodes]) this.drop(n);
  }

  update(dt) {
    const g = 0.012 * dt;
    for (const n of this.fallers) Body.setVelocity(n.body, { x: n.body.velocity.x, y: n.body.velocity.y + g });
    this.fallers = this.fallers.filter((n) => {
      if (n.body.position.y < Theme.height + 80) return true;
      this.physics.remove(n.body);
      return false;
    });
  }

  draw(p, edges) {
    for (const [a, b, color] of edges) {
      const pa = a.body.position;
      const pb = b.body.position;
      p.stroke(color || Theme.line);
      p.strokeWeight(color ? 3 : 2);
      p.line(pa.x, pa.y, pb.x, pb.y);
    }
    for (const n of this.fallers) this.drawNode(p, n, 0.5);
    for (const n of this.nodes) this.drawNode(p, n);
  }

  drawNode(p, n, alpha = 1) {
    const { x, y } = n.body.position;
    const stateColor = NODE_STATE_COLORS[n.state];
    p.push();
    p.drawingContext.globalAlpha = alpha;
    if (stateColor) {
      p.drawingContext.shadowColor = stateColor;
      p.drawingContext.shadowBlur = 16;
    }
    p.fill(stateColor || Theme.surface2);
    p.stroke(stateColor ? stateColor : Theme.accent);
    p.strokeWeight(2.5);
    p.circle(x, y, this.r * 2);
    p.drawingContext.shadowBlur = 0;
    p.noStroke();
    p.fill(stateColor ? Theme.bg : Theme.text);
    p.textFont(Theme.font);
    p.textStyle(p.BOLD);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(String(n.value).length > 2 ? 14 : 17);
    p.text(n.value, x, y + 1);
    p.pop();
  }
}

// Row of labelled boxes used to show traversal output / array views.
function drawValueRow(p, title, values, y, { color = Theme.text, highlight = -1, x0 = 60, cell = 44 } = {}) {
  Draw.label(p, title, x0, y, { align: 'left', size: 13, color: Theme.muted });
  const start = x0 + 150;
  values.forEach((v, i) => {
    Draw.box(p, start + i * cell, y, cell - 6, 32, {
      fill: i === highlight ? Theme.yellow : Theme.surface2,
      stroke: Theme.line,
      label: v,
      textColor: i === highlight ? Theme.bg : color,
      size: 14,
      weight: 1,
    });
  });
}
