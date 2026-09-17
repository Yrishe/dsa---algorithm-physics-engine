// Arrays: contiguous slots in memory. Elements drop into slots; inserting or
// removing at the front forces every later element to shift one slot.
class ArrayScene extends Scene {
  static id = 'arrays';
  static title = 'Arrays';
  static nav = 'push, pop, insert, shift…';
  static group = 'Data Structures';
  static subtitle = 'A contiguous block of memory. Reads by index are instant, but inserting at the front moves everything.';

  static CAP = 12;

  setup() {
    this.items = [];
    this.slotW = 70;
    this.left = (this.W - ArrayScene.CAP * this.slotW) / 2;
    this.rowY = 380;
    this.cell = 58;
    this.ptr = null;
    this.moves = 0;
    this.reads = 0;
    this.physics.wall(this.W / 2, this.rowY + this.cell / 2 + 5, ArrayScene.CAP * this.slotW + 20, 10);

    this.codes = {
      push: ['arr.push(value);', '// arr[arr.length] = value', '// no other element moves → O(1)'],
      pop: ['const last = arr.pop();', '// remove arr[arr.length - 1]', '// nothing shifts → O(1)'],
      insert: [
        'function insertAt(arr, i, value) {',
        '  for (let k = arr.length; k > i; k--)',
        '    arr[k] = arr[k - 1];   // shift right',
        '  arr[i] = value;',
        '}',
        '// arr.splice(i, 0, value) / arr.unshift(value)',
      ],
      remove: [
        'function removeAt(arr, i) {',
        '  const removed = arr[i];',
        '  for (let k = i; k < arr.length - 1; k++)',
        '    arr[k] = arr[k + 1];   // shift left',
        '  arr.length--;',
        '  return removed;',
        '}',
        '// arr.splice(i, 1) / arr.shift()',
      ],
      get: ['const x = arr[i];', '// address = base + i * elementSize', '// one calculation, no loop → O(1)'],
      indexOf: ['function indexOf(arr, value) {', '  for (let i = 0; i < arr.length; i++)', '    if (arr[i] === value) return i;', '  return -1;', '}'],
    };

    this.run(async () => {
      for (const v of [7, 3, 12, 5]) await this.push(v, true);
      this.log('Try unshift() and watch every element shift.', 'hint');
    });
  }

  controls() {
    const act = (fn) => () => this.run(fn);
    return [
      { type: 'number', id: 'value', label: 'Value', value: '42', width: 70, onEnter: act(() => this.push()) },
      { type: 'number', id: 'index', label: 'Index', value: '0', width: 60 },
      { type: 'sep' },
      { type: 'button', label: 'push', action: act(() => this.push()) },
      { type: 'button', label: 'pop', action: act(() => this.pop()) },
      { type: 'button', label: 'unshift', action: act(() => this.insert(0)) },
      { type: 'button', label: 'shift', action: act(() => this.removeAt(0)) },
      { type: 'button', label: 'insert at index', variant: 'secondary', action: act(() => this.insert()) },
      { type: 'button', label: 'remove at index', variant: 'secondary', action: act(() => this.removeAt()) },
      { type: 'button', label: 'get arr[index]', variant: 'secondary', action: act(() => this.get()) },
      { type: 'button', label: 'indexOf(value)', variant: 'secondary', action: act(() => this.indexOf()) },
      { type: 'sep' },
      { type: 'button', label: 'Random', variant: 'ghost', action: act(() => this.randomFill()) },
      { type: 'button', label: 'Clear', variant: 'danger', action: act(() => this.clear()) },
    ];
  }

  about() {
    return `
      <p>An <b>array</b> stores elements side by side in one block of memory. Because every slot has the same size, the address of <code>arr[i]</code> is simply <code>base + i × size</code>, so reading any index is <code>O(1)</code>.</p>
      <p>The catch: elements must stay contiguous. <code>unshift</code>, <code>shift</code> and <code>splice</code> in the middle must move every element after the index, which is <code>O(n)</code>. Watch the <b>moves</b> counter.</p>
      <p>Adding or removing at the <i>end</i> (<code>push</code> / <code>pop</code>) moves nothing.</p>`;
  }

  complexity() {
    return [
      ['Access <code>arr[i]</code>', 'O(1)', ''],
      ['<code>push</code> / <code>pop</code>', 'O(1)', 'amortised for push'],
      ['<code>unshift</code> / <code>shift</code>', 'O(n)', 'shifts every element'],
      ['Insert / remove at i', 'O(n)', 'shifts n − i elements'],
      ['<code>indexOf</code> (unsorted)', 'O(n)', ''],
    ];
  }

  slotX(i) {
    return this.left + this.slotW * (i + 0.5);
  }

  updateStats() {
    this.setStats({ length: this.items.length, capacity: ArrayScene.CAP, 'moves (last op)': this.moves, reads: this.reads });
  }

  readValue() {
    const v = this.inputNumber('value');
    if (v === null) {
      this.log('Enter a numeric value first', 'warn');
      return null;
    }
    return v;
  }

  readIndex(maxInclusive) {
    const i = this.inputNumber('index');
    if (i === null || !Number.isInteger(i) || i < 0 || i > maxInclusive) {
      this.log(`Index must be an integer from 0 to ${maxInclusive}`, 'warn');
      return null;
    }
    return i;
  }

  newTile(value, i) {
    return this.physics.tile(this.slotX(i), 90, this.cell, this.cell, value, { textSize: 20 });
  }

  async push(value, quiet = false) {
    const v = value ?? this.readValue();
    if (v === null) return;
    if (this.items.length >= ArrayScene.CAP) return this.log('Array is full (canvas capacity)', 'warn');
    this.code('push', 0);
    this.moves = 0;
    const i = this.items.length;
    const body = this.newTile(v, i);
    this.items.push({ value: v, body });
    this.ptr = { i, label: 'length', color: Theme.cyan };
    await this.physics.dropTo(this.anim, body, this.slotX(i), this.rowY);
    this.ptr = null;
    this.updateStats();
    if (!quiet) this.log(`push(${v}) → placed at index ${i}, 0 moves`, 'ok');
  }

  async pop() {
    if (!this.items.length) return this.log('pop() on an empty array returns undefined', 'warn');
    this.code('pop', 0);
    this.moves = 0;
    const it = this.items.pop();
    it.body.style.highlight = Theme.yellow;
    await this.wait(250);
    this.physics.fling(it.body, 5, -12, 0.15);
    this.updateStats();
    this.log(`pop() → ${it.value}, 0 moves`, 'ok');
    await this.wait(300);
  }

  async insert(index) {
    const v = this.readValue();
    if (v === null) return;
    const i = index ?? this.readIndex(this.items.length);
    if (i === null) return;
    if (this.items.length >= ArrayScene.CAP) return this.log('Array is full (canvas capacity)', 'warn');

    this.code('insert', 0);
    this.moves = 0;
    this.updateStats();
    const name = index === 0 ? `unshift(${v})` : `insertAt(${i}, ${v})`;
    this.log(`${name}: make room at index ${i}`);

    for (let k = this.items.length - 1; k >= i; k--) {
      this.line(2);
      this.ptr = { i: k, label: `k=${k + 1}`, color: Theme.orange };
      await this.physics.moveTo(this.anim, this.items[k].body, this.slotX(k + 1), this.rowY, 260, { arc: 26 });
      this.moves++;
      this.updateStats();
    }
    this.line(3);
    const body = this.newTile(v, i);
    this.items.splice(i, 0, { value: v, body });
    this.ptr = { i, label: 'i', color: Theme.yellow };
    await this.physics.dropTo(this.anim, body, this.slotX(i), this.rowY);
    this.ptr = null;
    this.updateStats();
    this.log(`${name} done, ${this.moves} element${this.moves === 1 ? '' : 's'} moved`, this.moves > 0 ? 'hint' : 'ok');
  }

  async removeAt(index) {
    if (!this.items.length) return this.log('Array is empty', 'warn');
    const i = index ?? this.readIndex(this.items.length - 1);
    if (i === null) return;
    this.code('remove', 1);
    this.moves = 0;
    this.updateStats();
    const [it] = this.items.splice(i, 1);
    const name = index === 0 ? 'shift()' : `removeAt(${i})`;
    it.body.style.highlight = Theme.red;
    this.ptr = { i, label: 'i', color: Theme.red };
    await this.wait(250);
    this.physics.fling(it.body, -3, -11, -0.15);
    await this.wait(200);

    for (let k = i; k < this.items.length; k++) {
      this.line(3);
      this.ptr = { i: k, label: `k=${k}`, color: Theme.orange };
      await this.physics.moveTo(this.anim, this.items[k].body, this.slotX(k), this.rowY, 260, { arc: 26 });
      this.moves++;
      this.updateStats();
    }
    this.line(4);
    this.ptr = null;
    this.updateStats();
    this.log(`${name} → ${it.value}, ${this.moves} element${this.moves === 1 ? '' : 's'} moved`, this.moves > 0 ? 'hint' : 'ok');
  }

  async get() {
    if (!this.items.length) return this.log('Array is empty', 'warn');
    const i = this.readIndex(this.items.length - 1);
    if (i === null) return;
    this.code('get', 1);
    this.moves = 0;
    this.reads = 1;
    this.addr = { i, t: 0 };
    this.ptr = { i, label: `arr[${i}]`, color: Theme.yellow };
    const body = this.items[i].body;
    body.style.highlight = Theme.yellow;
    await this.anim.to(this.addr, { t: 1 }, 700);
    this.updateStats();
    this.log(`arr[${i}] = ${this.items[i].value} (address 0x${(0x100 + i * 8).toString(16)}), 1 read`, 'ok');
    await this.wait(600);
    body.style.highlight = null;
    this.ptr = null;
    this.addr = null;
  }

  async indexOf() {
    const v = this.readValue();
    if (v === null) return;
    this.code('indexOf', 1);
    this.moves = 0;
    this.reads = 0;
    for (let i = 0; i < this.items.length; i++) {
      const body = this.items[i].body;
      this.ptr = { i, label: 'i', color: Theme.yellow };
      this.line(2);
      body.style.highlight = Theme.yellow;
      this.reads++;
      this.updateStats();
      await this.wait(380);
      if (this.items[i].value === v) {
        body.style.highlight = Theme.green;
        this.line(2);
        this.log(`indexOf(${v}) → ${i} after ${this.reads} reads`, 'ok');
        await this.wait(700);
        body.style.highlight = null;
        this.ptr = null;
        return;
      }
      body.style.highlight = null;
    }
    this.line(3);
    this.ptr = null;
    this.log(`indexOf(${v}) → -1 after ${this.reads} reads`, 'warn');
  }

  async clear() {
    this.items.forEach((it, k) => this.physics.fling(it.body, (Math.random() - 0.5) * 8, -6 - Math.random() * 6, (Math.random() - 0.5) * 0.3));
    this.items = [];
    this.moves = 0;
    this.reads = 0;
    this.updateStats();
    await this.wait(300);
  }

  async randomFill() {
    await this.clear();
    const n = 5 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) {
      const v = 1 + Math.floor(Math.random() * 99);
      const body = this.newTile(v, k);
      Body.setPosition(body, { x: this.slotX(k), y: 60 - k * 40 });
      this.items.push({ value: v, body });
    }
    await Promise.all(this.items.map((it, k) => this.physics.dropTo(this.anim, it.body, this.slotX(k), this.rowY, 3500)));
    this.updateStats();
    this.log(`Filled with ${n} random values`);
  }

  draw(p) {
    const top = this.rowY - this.cell / 2 - 6;
    const h = this.cell + 12;
    // memory slots
    for (let i = 0; i < ArrayScene.CAP; i++) {
      const x = this.slotX(i);
      const used = i < this.items.length;
      p.push();
      p.noFill();
      p.stroke(used ? Theme.line : Theme.grid);
      p.strokeWeight(1.5);
      p.drawingContext.setLineDash(used ? [] : [5, 5]);
      p.rect(x - this.slotW / 2 + 3, top, this.slotW - 6, h, 8);
      p.pop();
      Draw.label(p, i, x, this.rowY + this.cell / 2 + 30, { color: used ? Theme.text : Theme.dim, size: 14, bold: used });
      Draw.label(p, '0x' + (0x100 + i * 8).toString(16), x, this.rowY + this.cell / 2 + 50, { color: Theme.dim, size: 10 });
    }
    Draw.label(p, 'index', this.left - 16, this.rowY + this.cell / 2 + 30, { align: 'right', size: 12 });
    Draw.label(p, 'address', this.left - 16, this.rowY + this.cell / 2 + 50, { align: 'right', size: 10, color: Theme.dim });

    this.physics.render(p);

    if (this.ptr) Draw.pointer(p, this.slotX(this.ptr.i), top - 8, this.ptr.label, this.ptr.color);

    if (this.addr) {
      const x0 = this.slotX(0);
      const xi = this.slotX(this.addr.i);
      const y = this.rowY + 140;
      Draw.label(p, `address = 0x100 + ${this.addr.i} × 8 = 0x${(0x100 + this.addr.i * 8).toString(16)}`, this.W / 2, y + 36, { color: Theme.yellow, size: 15, bold: true });
      Draw.label(p, 'base', x0, y + 12, { size: 11, color: Theme.yellow });
      if (xi > x0) Draw.arrow(p, x0, y, lerp(x0, xi, this.addr.t), y, { color: Theme.yellow, dash: [6, 5] });
      Draw.label(p, 'jump straight to the slot, no loop', this.W / 2, y + 60, { size: 12 });
    }

    Draw.label(p, 'const arr = [' + this.items.map((it) => it.value).join(', ') + ']', this.W / 2, 150, { color: Theme.text, size: 18 });
  }
}
