// Singly linked list. Nodes float on Matter.js springs, so re-linking
// pointers makes the nodes glide (and wobble) into their new order.
class LinkedListScene extends Scene {
  static id = 'linked-list';
  static title = 'Linked List';
  static nav = 'nodes + next pointers';
  static group = 'Data Structures';
  static subtitle = 'Each node stores a value and a pointer to the next node. No shifting needed, but no random access either.';
  static gravity = 0;

  static MAX = 8;
  static NODE_W = 78;
  static NODE_H = 48;

  setup() {
    this.head = null;
    this.size = 0;
    this.rowY = 300;
    this.ptrs = {};
    this.fallers = [];
    this.nodes = new Set(); // every live node, reachable from head or not

    this.codes = {
      append: [
        'append(value) {',
        '  const node = { value, next: null };',
        '  if (!this.head) this.head = node;',
        '  else this.tail.next = node;',
        '  this.tail = node;',
        '}',
      ],
      prepend: ['prepend(value) {', '  const node = { value, next: this.head };', '  this.head = node;', '}'],
      insertAt: [
        'insertAt(index, value) {',
        '  if (index === 0) return this.prepend(value);',
        '  let prev = this.head;',
        '  for (let k = 0; k < index - 1; k++)',
        '    prev = prev.next;',
        '  const node = { value, next: prev.next };',
        '  prev.next = node;',
        '}',
      ],
      remove: [
        'remove(value) {',
        '  if (this.head.value === value) {',
        '    this.head = this.head.next; return;',
        '  }',
        '  let prev = this.head;',
        '  while (prev.next && prev.next.value !== value)',
        '    prev = prev.next;',
        '  if (prev.next) prev.next = prev.next.next;',
        '}',
      ],
      find: ['find(value) {', '  let curr = this.head;', '  while (curr) {', '    if (curr.value === value) return curr;', '    curr = curr.next;', '  }', '  return null;', '}'],
      reverse: [
        'reverse() {',
        '  let prev = null, curr = this.head;',
        '  while (curr) {',
        '    const next = curr.next;',
        '    curr.next = prev;',
        '    prev = curr;',
        '    curr = next;',
        '  }',
        '  this.head = prev;',
        '}',
      ],
    };

    this.run(async () => {
      for (const v of [3, 14, 15, 92]) await this.append(v, true);
      this.log('Try insertAt or reverse to see pointers re-link.', 'hint');
    });
  }

  controls() {
    const act = (fn) => () => this.run(fn);
    return [
      { type: 'number', id: 'value', label: 'Value', value: '42', width: 70, onEnter: act(() => this.append()) },
      { type: 'number', id: 'index', label: 'Index', value: '2', width: 60 },
      { type: 'sep' },
      { type: 'button', label: 'append', action: act(() => this.append()) },
      { type: 'button', label: 'prepend', action: act(() => this.prepend()) },
      { type: 'button', label: 'insertAt', variant: 'secondary', action: act(() => this.insertAt()) },
      { type: 'button', label: 'remove(value)', variant: 'secondary', action: act(() => this.remove()) },
      { type: 'button', label: 'find(value)', variant: 'secondary', action: act(() => this.find()) },
      { type: 'button', label: 'reverse', variant: 'secondary', action: act(() => this.reverse()) },
      { type: 'sep' },
      { type: 'button', label: 'Clear', variant: 'danger', action: act(() => this.clear()) },
    ];
  }

  about() {
    return `
      <p>A <b>linked list</b> is a chain of nodes. Each node holds a <code>value</code> and a <code>next</code> pointer; the list only remembers its <code>head</code> (and often its <code>tail</code>).</p>
      <p>Inserting or removing next to a node you already have is <code>O(1)</code>: just re-point two arrows, nothing shifts. But reaching index <code>i</code> means following <code>i</code> pointers from the head: <code>O(n)</code>.</p>
      <p>In memory the nodes can live anywhere; they're laid out in a row here only to make the chain easy to read.</p>`;
  }

  complexity() {
    return [
      ['<code>prepend</code>', 'O(1)', ''],
      ['<code>append</code> (with tail)', 'O(1)', 'O(n) without a tail pointer'],
      ['Access / find', 'O(n)', 'walk from head'],
      ['Insert / remove at i', 'O(n)', 'O(1) once you are there'],
      ['<code>reverse</code>', 'O(n)', 'one pass, O(1) memory'],
    ];
  }

  // ---- structure helpers ---------------------------------------------------

  toArray() {
    const out = [];
    let n = this.head;
    while (n && out.length <= LinkedListScene.MAX + 2) {
      out.push(n);
      n = n.next;
    }
    return out;
  }

  slotX(i, count) {
    const spacing = 118;
    return this.W / 2 + (i - (count - 1) / 2) * spacing;
  }

  layout() {
    const order = this.toArray();
    order.forEach((n, i) => {
      n.anchor.pointB.x = this.slotX(i, order.length);
      n.anchor.pointB.y = this.rowY;
    });
    this.updateStats();
  }

  updateStats() {
    const arr = this.toArray();
    this.setStats({ size: this.size, head: arr[0]?.value ?? 'null', tail: arr[arr.length - 1]?.value ?? 'null' });
  }

  makeNode(value, x, y) {
    const body = this.physics.rect(x, y, LinkedListScene.NODE_W, LinkedListScene.NODE_H, { hidden: true }, { frictionAir: 0.1, collisionFilter: { group: -1 } });
    const anchor = this.physics.anchor(body, x, y, 0.02, 0.15);
    const node = { value, next: null, body, anchor, color: Theme.colorForValue(value) };
    this.nodes.add(node);
    return node;
  }

  moveNode(node, x, y) {
    node.anchor.pointB.x = x;
    node.anchor.pointB.y = y;
  }

  dropNode(node) {
    this.nodes.delete(node);
    this.physics.remove(node.anchor);
    node.body.collisionFilter = { group: 0, category: 0x0004, mask: 0 };
    Body.setVelocity(node.body, { x: (Math.random() - 0.5) * 3, y: -2 });
    Body.setAngularVelocity(node.body, (Math.random() - 0.5) * 0.08);
    this.fallers.push(node);
  }

  readValue() {
    const v = this.inputNumber('value');
    if (v === null) this.log('Enter a numeric value', 'warn');
    return v;
  }

  full() {
    if (this.size >= LinkedListScene.MAX) {
      this.log(`Only ${LinkedListScene.MAX} nodes fit on screen`, 'warn');
      return true;
    }
    return false;
  }

  // ---- operations -------------------------------------------------------------

  async append(value, quiet = false) {
    const v = value ?? this.readValue();
    if (v === null || this.full()) return;
    this.code('append', 1);
    const arr = this.toArray();
    const node = this.makeNode(v, this.slotX(arr.length, arr.length + 1), this.rowY + 170);
    this.size++;
    await this.wait(350);
    if (!this.head) {
      this.line(2);
      this.head = node;
    } else {
      this.line(3);
      const tail = arr[arr.length - 1];
      this.ptrs = { tail };
      tail.next = node;
    }
    await this.wait(350);
    this.line(4);
    this.ptrs = {};
    this.layout();
    await this.wait(500);
    if (!quiet) this.log(`append(${v}) → O(1) using the tail pointer`, 'ok');
  }

  async prepend(value) {
    const v = value ?? this.readValue();
    if (v === null || this.full()) return;
    this.code('prepend', 1);
    const count = this.size + 1;
    const node = this.makeNode(v, this.slotX(0, count) - 40, this.rowY + 170);
    this.size++;
    await this.wait(400);
    node.next = this.head;
    await this.wait(450);
    this.line(2);
    this.head = node;
    this.layout();
    await this.wait(600);
    this.log(`prepend(${v}) → O(1), no nodes shifted in memory`, 'ok');
  }

  async insertAt() {
    const v = this.readValue();
    if (v === null || this.full()) return;
    const i = this.inputNumber('index');
    if (i === null || !Number.isInteger(i) || i < 0 || i > this.size) return this.log(`Index must be 0…${this.size}`, 'warn');
    if (i === 0) return this.prepend(v);

    this.code('insertAt', 2);
    let prev = this.head;
    this.ptrs = { prev };
    await this.wait(450);
    for (let k = 0; k < i - 1; k++) {
      this.line(4);
      prev = prev.next;
      this.ptrs = { prev };
      await this.wait(450);
    }
    const order = this.toArray();
    const x = (this.slotX(i - 1, order.length) + this.slotX(i, order.length)) / 2;
    const node = this.makeNode(v, x, this.rowY + 170);
    this.size++;
    this.line(5);
    await this.wait(300);
    node.next = prev.next;
    this.ptrs = { prev, node };
    await this.wait(700);
    this.line(6);
    prev.next = node;
    await this.wait(700);
    this.ptrs = {};
    this.layout();
    await this.wait(600);
    this.log(`insertAt(${i}, ${v}) → walked ${i - 1} pointer${i - 1 === 1 ? '' : 's'}, then re-linked 2`, 'ok');
  }

  async remove() {
    const v = this.readValue();
    if (v === null) return;
    if (!this.head) return this.log('List is empty', 'warn');
    this.code('remove', 1);

    if (this.head.value === v) {
      const old = this.head;
      this.ptrs = { head: old };
      await this.wait(450);
      this.line(2);
      this.head = old.next;
      this.moveNode(old, old.body.position.x, this.rowY + 130);
      await this.wait(500);
      this.dropNode(old);
      this.size--;
      this.ptrs = {};
      this.layout();
      await this.wait(500);
      return this.log(`remove(${v}) → removed the head, O(1)`, 'ok');
    }

    let prev = this.head;
    this.line(4);
    this.ptrs = { prev };
    await this.wait(450);
    let steps = 0;
    while (prev.next && prev.next.value !== v) {
      this.line(6);
      prev = prev.next;
      steps++;
      this.ptrs = { prev };
      await this.wait(450);
    }
    if (!prev.next) {
      this.ptrs = {};
      return this.log(`remove(${v}) → value not found after ${steps + 1} steps`, 'warn');
    }
    const target = prev.next;
    this.ptrs = { prev, target };
    this.moveNode(target, target.body.position.x, this.rowY + 130);
    await this.wait(600);
    this.line(7);
    prev.next = target.next;
    await this.wait(700);
    this.dropNode(target);
    this.size--;
    this.ptrs = {};
    this.layout();
    await this.wait(500);
    this.log(`remove(${v}) → bypassed the node; garbage collector frees it`, 'ok');
  }

  async find() {
    const v = this.readValue();
    if (v === null) return;
    this.code('find', 1);
    let curr = this.head;
    let steps = 0;
    while (curr) {
      steps++;
      this.ptrs = { curr };
      this.line(3);
      await this.wait(450);
      if (curr.value === v) {
        curr.found = true;
        this.log(`find(${v}) → found after ${steps} step${steps > 1 ? 's' : ''}`, 'ok');
        await this.wait(900);
        curr.found = false;
        this.ptrs = {};
        return;
      }
      this.line(4);
      curr = curr.next;
    }
    this.ptrs = {};
    this.line(6);
    this.log(`find(${v}) → null after ${steps} steps`, 'warn');
  }

  async reverse() {
    if (this.size < 2) return this.log('Need at least two nodes to reverse', 'warn');
    this.code('reverse', 1);
    let prev = null;
    let curr = this.head;
    this.ptrs = { prev, curr };
    await this.wait(500);
    while (curr) {
      this.line(3);
      const next = curr.next;
      this.ptrs = { prev, curr, next };
      await this.wait(500);
      this.line(4);
      curr.next = prev;
      await this.wait(600);
      this.line(5);
      prev = curr;
      this.ptrs = { prev, curr, next };
      this.line(6);
      curr = next;
      this.ptrs = { prev, curr, next };
      await this.wait(400);
    }
    this.line(8);
    this.head = prev;
    this.ptrs = {};
    this.layout();
    await this.wait(900);
    this.log('reverse() → every next pointer flipped, O(n)', 'ok');
  }

  async clear() {
    for (const n of [...this.nodes]) this.dropNode(n);
    this.head = null;
    this.size = 0;
    this.ptrs = {};
    this.updateStats();
    await this.wait(300);
  }

  // ---- update & draw -----------------------------------------------------------

  update(dt) {
    const g = 0.012 * dt;
    for (const n of this.fallers) Body.setVelocity(n.body, { x: n.body.velocity.x, y: n.body.velocity.y + g });
    this.fallers = this.fallers.filter((n) => {
      if (n.body.position.y < this.H + 100) return true;
      this.physics.remove(n.body);
      return false;
    });
  }

  draw(p) {
    const all = [...this.nodes];

    Draw.label(p, 'The list only knows its head; everything else is reached by following next.', this.W / 2, 90, { size: 13 });

    // arrows
    for (const n of all) this.drawNext(p, n);
    for (const n of this.fallers) this.drawNode(p, n, { alpha: 0.6, stroke: Theme.red });
    for (const n of all) this.drawNode(p, n, { stroke: n.found ? Theme.green : null });

    // head label
    if (this.head) {
      const { x, y } = this.head.body.position;
      Draw.arrow(p, x - 12, y - 90, x - 12, y - LinkedListScene.NODE_H / 2 - 6, { color: Theme.green });
      Draw.label(p, 'head', x - 12, y - 102, { color: Theme.green, size: 14, bold: true });
    } else {
      Draw.label(p, 'head → null', this.W / 2, this.rowY, { color: Theme.muted, size: 18 });
    }

    // traversal pointers
    const colors = { prev: Theme.cyan, curr: Theme.yellow, next: Theme.pink, target: Theme.red, node: Theme.green, tail: Theme.cyan, head: Theme.green };
    const stackCount = new Map();
    for (const [name, n] of Object.entries(this.ptrs)) {
      if (!n) continue;
      const k = stackCount.get(n) || 0;
      stackCount.set(n, k + 1);
      const { x, y } = n.body.position;
      Draw.pointerUp(p, x - 20, y + LinkedListScene.NODE_H / 2 + 8 + k * 34, name, colors[name] || Theme.yellow);
    }
    if (this.ptrs && 'prev' in this.ptrs && this.ptrs.prev === null) {
      Draw.label(p, 'prev = null', 90, this.rowY + 120, { color: Theme.cyan, size: 13, bold: true });
    }
    if (this.ptrs && 'curr' in this.ptrs && !this.ptrs.curr && this.ptrs.prev) {
      Draw.label(p, 'curr = null → done', 900, this.rowY + 120, { color: Theme.yellow, size: 13, bold: true });
    }
  }

  drawNode(p, n, { alpha = 1, stroke = null } = {}) {
    const W = LinkedListScene.NODE_W;
    const H = LinkedListScene.NODE_H;
    const { x, y } = n.body.position;
    p.push();
    p.translate(x, y);
    p.rotate(n.body.angle);
    p.drawingContext.globalAlpha = alpha;
    p.rectMode(p.CORNER);
    p.stroke(stroke || Theme.line);
    p.strokeWeight(stroke ? 3 : 1.5);
    p.fill(n.color);
    p.rect(-W / 2, -H / 2, W - 26, H, 8, 0, 0, 8);
    p.fill(Theme.surface2);
    p.rect(W / 2 - 26, -H / 2, 26, H, 0, 8, 8, 0);
    if (n.next) {
      p.noStroke();
      p.fill(Theme.text);
      p.circle(W / 2 - 13, 0, 7);
    } else {
      p.stroke(Theme.dim);
      p.strokeWeight(2);
      p.line(W / 2 - 22, H / 2 - 6, W / 2 - 4, -H / 2 + 6);
      p.noStroke();
    }
    p.fill(Theme.bg);
    p.textFont(Theme.font);
    p.textStyle(p.BOLD);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(18);
    p.text(n.value, -13, 1);
    p.pop();
  }

  drawNext(p, n) {
    const W = LinkedListScene.NODE_W;
    const H = LinkedListScene.NODE_H;
    const a = n.body.position;
    const sx = a.x + W / 2 - 13;
    const sy = a.y;
    if (!n.next) {
      // the node itself draws a slash; spell out "null" when there's room
      const crowded = [...this.nodes].some((o) => o !== n && Math.abs(o.body.position.y - a.y) < 40 && o.body.position.x > a.x && o.body.position.x - a.x < 150);
      if (!crowded) {
        Draw.arrow(p, a.x + W / 2 + 2, sy, a.x + W / 2 + 30, sy, { color: Theme.dim, weight: 1.5, head: 7 });
        Draw.label(p, 'null', a.x + W / 2 + 50, sy, { size: 12, color: Theme.dim });
      }
      return;
    }
    const b = n.next.body.position;
    const sameRow = Math.abs(b.y - a.y) < 40;
    if (sameRow && b.x > a.x) {
      Draw.arrow(p, sx, sy, b.x - W / 2 - 3, b.y, { color: Theme.text });
    } else if (sameRow) {
      // pointer going backwards: curve underneath
      p.push();
      p.noFill();
      p.stroke(Theme.purple);
      p.strokeWeight(2);
      const ex = b.x + 14;
      const ey = b.y + H / 2 + 4;
      p.bezier(sx, sy + H / 2, sx, sy + H / 2 + 60, ex, ey + 60, ex, ey + 6);
      p.pop();
      Draw.arrow(p, ex, ey + 14, ex, ey, { color: Theme.purple });
    } else {
      // different rows: aim at the nearest edge of the target box
      const dx = b.x - sx;
      const dy = b.y - sy;
      const t = Math.min(Math.abs((W / 2 + 3) / (dx || 1e-6)), Math.abs((H / 2 + 3) / (dy || 1e-6)));
      Draw.arrow(p, sx, sy, b.x - dx * t, b.y - dy * t, { color: Theme.text });
    }
  }
}
