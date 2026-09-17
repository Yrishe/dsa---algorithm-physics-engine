// Queue (FIFO): balls roll down a sloped track and wait at the gate. The one
// at the front leaves first and gravity moves everyone else up the line.
class QueueScene extends Scene {
  static id = 'queue';
  static title = 'Queue';
  static nav = 'FIFO · enqueue / dequeue';
  static group = 'Data Structures';
  static subtitle = 'First In, First Out. Like a line at a ticket counter: join at the back, leave from the front.';

  static CAP = 10;

  setup() {
    this.r = 30;
    this.items = [];
    this.gateX = 110;
    this.trackAngle = -0.07;
    this.served = 0;
    this.nextTicket = 1;

    // sloped track: lower at the front (left)
    const len = 820;
    const cx = this.gateX + len / 2;
    const cy = 430;
    this.track = { cx, cy, len };
    this.physics.wall(cx, cy, len, 14, { fill: Theme.line }, { angle: this.trackAngle, friction: 0.02 });
    this.frontY = cy - Math.sin(this.trackAngle) * (len / 2);
    this.physics.wall(this.gateX - 8, this.frontY - 60, 14, 130, { fill: Theme.muted });
    this.physics.wall(cx + len / 2 + 6, cy - 60 + Math.sin(this.trackAngle) * (len / 2), 12, 110, { fill: Theme.line });

    this.codes = {
      enqueue: ['queue.enqueue(value);', '// add at the back (tail): O(1)', '', '// with a plain array: queue.push(value)'],
      dequeue: [
        'const front = queue.dequeue();',
        '// remove from the front (head): O(1)',
        '',
        '// ⚠ array.shift() is O(n): every element',
        '// moves one slot. Use a linked list or a',
        '// head index / ring buffer instead.',
      ],
      peek: ['const front = queue.peek();', '// look at the head without removing it: O(1)'],
      impl: [
        'class Queue {',
        '  #items = {}; #head = 0; #tail = 0;',
        '  enqueue(v) { this.#items[this.#tail++] = v; }',
        '  dequeue() {',
        '    if (this.#head === this.#tail) return undefined;',
        '    const v = this.#items[this.#head];',
        '    delete this.#items[this.#head++];',
        '    return v;',
        '  }',
        '  get size() { return this.#tail - this.#head; }',
        '}',
      ],
    };
    this.code('impl');

    this.run(async () => {
      for (let k = 0; k < 4; k++) await this.enqueue(undefined, true);
      this.log('Press dequeue and watch the line move up.', 'hint');
    });
  }

  controls() {
    const act = (fn) => () => this.run(fn);
    return [
      { type: 'input', id: 'value', label: 'Value (blank = ticket #)', value: '', placeholder: 'auto', width: 120, maxLength: 4, onEnter: act(() => this.enqueue()) },
      { type: 'button', label: 'enqueue', action: act(() => this.enqueue()) },
      { type: 'button', label: 'dequeue', action: act(() => this.dequeue()) },
      { type: 'button', label: 'peek', variant: 'secondary', action: act(() => this.peek()) },
      { type: 'sep' },
      { type: 'button', label: 'Simulate a busy counter', variant: 'ghost', action: act(() => this.simulate()) },
      { type: 'button', label: 'Clear', variant: 'danger', action: act(() => this.clear()) },
    ];
  }

  about() {
    return `
      <p>A <b>queue</b> is a First-In-First-Out collection. New items <code>enqueue</code> at the <b>back</b>; <code>dequeue</code> removes from the <b>front</b>.</p>
      <p>Both operations are <code>O(1)</code> when implemented with a linked list or head/tail indices (see the code panel). Using <code>array.shift()</code> is a common trap: it re-indexes every element, making it <code>O(n)</code>.</p>
      <p>Queues schedule print jobs, buffer network packets, process events in order and drive breadth-first search.</p>`;
  }

  complexity() {
    return [
      ['<code>enqueue</code>', 'O(1)', ''],
      ['<code>dequeue</code>', 'O(1)', 'with head index / linked list'],
      ['<code>array.shift()</code> as dequeue', 'O(n)', 're-indexes all items'],
      ['<code>peek</code>', 'O(1)', ''],
    ];
  }

  updateStats() {
    this.setStats({ size: this.items.length, front: this.items[0]?.value ?? '—', back: this.items[this.items.length - 1]?.value ?? '—', served: this.served });
  }

  async enqueue(value, quiet = false) {
    let v = value ?? this.inputValue('value');
    if (v === '' || v === undefined) v = '#' + this.nextTicket++;
    if (this.items.length >= QueueScene.CAP) return this.log('Queue is full on screen', 'warn');
    this.code('enqueue', 0);
    const x = this.track.cx + this.track.len / 2 - 50;
    const body = this.physics.circle(x, 250, this.r, { label: v, rotateLabel: false, mark: true, fill: Theme.colorForValue(v), textSize: v.length > 3 ? 14 : 17 }, { friction: 0.02, frictionAir: 0.004, restitution: 0.15, density: 0.002 });
    this.items.push({ value: v, body });
    this.updateStats();
    // wait until it has joined the back of the line
    const slot = this.items.length - 1;
    const targetX = this.gateX + this.r + slot * this.r * 2;
    await this.anim.waitUntil(() => body.position.x < targetX + 30 || (Physics.speedOf(body) < 0.15 && body.position.x < x - 60), 4000);
    if (!quiet) this.log(`enqueue(${v}) → size ${this.items.length}`, 'ok');
  }

  async dequeue(quiet = false) {
    this.code('dequeue', 0);
    if (!this.items.length) {
      this.log('dequeue() on empty queue → undefined', 'warn');
      return;
    }
    const it = this.items.shift();
    it.body.style.highlight = Theme.yellow;
    await this.wait(250);
    this.physics.fling(it.body, -6, -13, -0.1);
    this.served++;
    this.updateStats();
    if (!quiet) this.log(`dequeue() → ${it.value}`, 'ok');
    await this.wait(700);
  }

  async peek() {
    this.code('peek', 0);
    const f = this.items[0];
    if (!f) return this.log('peek() on empty queue → undefined', 'warn');
    f.body.style.highlight = Theme.green;
    f.body.style.glow = Theme.green;
    this.log(`peek() → ${f.value}`, 'ok');
    await this.wait(900);
    f.body.style.highlight = null;
    f.body.style.glow = null;
  }

  async clear() {
    for (const it of this.items) this.physics.fling(it.body, (Math.random() - 0.5) * 8, -10 - Math.random() * 6, 0.2);
    this.items = [];
    this.updateStats();
    await this.wait(300);
  }

  async simulate() {
    this.log('Simulating: customers arrive randomly, the counter serves the front', 'hint');
    for (let k = 0; k < 10; k++) {
      if (this.items.length && (Math.random() < 0.45 || this.items.length >= QueueScene.CAP)) await this.dequeue();
      else await this.enqueue();
      await this.wait(150);
    }
  }

  draw(p) {
    Draw.label(p, 'FRONT', this.gateX + 10, this.frontY - 150, { color: Theme.green, size: 14, bold: true });
    Draw.label(p, 'dequeue ↖', this.gateX + 10, this.frontY - 130, { size: 12 });
    const backX = this.track.cx + this.track.len / 2 - 50;
    Draw.label(p, 'enqueue ↓', backX, 190, { size: 12 });
    Draw.label(p, 'BACK', backX, 170, { color: Theme.cyan, size: 14, bold: true });

    this.physics.render(p);

    const front = this.items[0];
    const back = this.items[this.items.length - 1];
    if (front) Draw.pointerUp(p, front.body.position.x, front.body.position.y + this.r + 22, 'front', Theme.green);
    if (back && back !== front) Draw.pointerUp(p, back.body.position.x, back.body.position.y + this.r + 22, 'back', Theme.cyan);

    // compact array view of the queue
    const y = 560;
    const cw = 58;
    const x0 = this.W / 2 - (Math.max(1, this.items.length) * cw) / 2 + cw / 2;
    Draw.label(p, 'queue →', x0 - cw / 2 - 12, y, { align: 'right', size: 13 });
    if (!this.items.length) Draw.label(p, '(empty)', this.W / 2, y, { size: 13, color: Theme.dim });
    this.items.forEach((it, i) => {
      Draw.box(p, x0 + i * cw, y, cw - 6, 34, { fill: Theme.surface2, stroke: i === 0 ? Theme.green : Theme.line, label: it.value, textColor: Theme.text, size: 13 });
    });
  }
}
