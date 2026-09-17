// Linear vs binary search on the same sorted array. Every element a search
// rules out physically falls off its shelf, so you can see binary search
// discarding half the remaining items per step.
class SearchRaceScene extends Scene {
  static id = 'search-race';
  static title = 'Linear vs Binary Search';
  static nav = 'O(n) vs O(log n) race';
  static group = 'Fundamentals';
  static subtitle = 'Both searches look for the same target in the same sorted array. Eliminated items fall away.';

  setup() {
    this.size = 32;
    this.rows = { linear: { y: 250, cells: [] }, binary: { y: 490, cells: [] } };
    this.physics.wall(this.W / 2, this.rows.linear.y + 26, this.W - 60, 8);
    this.physics.wall(this.W / 2, this.rows.binary.y + 26, this.W - 60, 8);
    this.pointers = { linear: {}, binary: {} };
    this.steps = { linear: 0, binary: 0 };

    this.codes.search = [
      'function linearSearch(arr, t) {',
      '  for (let i = 0; i < arr.length; i++)',
      '    if (arr[i] === t) return i;',
      '  return -1;',
      '}',
      '',
      'function binarySearch(arr, t) {',
      '  let lo = 0, hi = arr.length - 1;',
      '  while (lo <= hi) {',
      '    const mid = (lo + hi) >> 1;',
      '    if (arr[mid] === t) return mid;',
      '    if (arr[mid] < t) lo = mid + 1;',
      '    else hi = mid - 1;',
      '  }',
      '  return -1;',
      '}',
    ];
    this.code('search');
    this.run(() => this.newArray());
  }

  controls() {
    return [
      { type: 'number', id: 'target', label: 'Target', value: '', placeholder: 'e.g. 42', width: 80, onEnter: () => this.run(() => this.race()) },
      { type: 'button', label: 'Race!', action: () => this.run(() => this.race()) },
      { type: 'button', label: 'Random target', variant: 'secondary', action: () => this.run(() => this.race(true)) },
      { type: 'sep' },
      {
        type: 'select',
        id: 'size',
        label: 'Array size',
        value: '32',
        options: [16, 32, 48].map((v) => ({ value: String(v), label: String(v) })),
        onChange: (v) => {
          if (this.busy) return (this.ui.size.value = String(this.size));
          this.size = Number(v);
          this.run(() => this.newArray());
        },
      },
      { type: 'button', label: 'New array', variant: 'secondary', action: () => this.run(() => this.newArray()) },
    ];
  }

  about() {
    return `
      <p><b>Linear search</b> checks items one by one. In the worst case it looks at all <code>n</code> items: <code>O(n)</code>.</p>
      <p><b>Binary search</b> only works on <i>sorted</i> data. It checks the middle item and throws away the half that cannot contain the target, so it needs at most <code>⌊log₂ n⌋ + 1</code> checks: <code>O(log n)</code>.</p>
      <p>For 32 items that is 32 vs 6 checks. For a million items it is 1,000,000 vs 20.</p>`;
  }

  complexity() {
    return [
      ['Linear search', 'O(n)', 'works on any array'],
      ['Binary search', 'O(log n)', 'requires sorted input'],
      ['Sorting first', 'O(n log n)', 'worth it for many lookups'],
    ];
  }

  get cellW() {
    return (this.W - 80) / this.size;
  }

  xOf(i) {
    return 40 + this.cellW * (i + 0.5);
  }

  async newArray() {
    for (const row of Object.values(this.rows)) {
      row.cells.forEach((c) => c && this.physics.fling(c, 0, 2, 0));
      row.cells = [];
    }
    this.pointers = { linear: {}, binary: {} };
    this.steps = { linear: 0, binary: 0 };
    this.found = {};

    const pool = Array.from({ length: 99 }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.values = pool.slice(0, this.size).sort((a, b) => a - b);
    this.updateStats();

    const w = this.cellW - 3;
    const h = 36;
    const drops = [];
    for (const [name, row] of Object.entries(this.rows)) {
      this.values.forEach((v, i) => {
        const cell = this.physics.tile(this.xOf(i), row.y - 220 - Math.random() * 120, w, h, v, {
          fill: Theme.surface2,
          textColor: Theme.text,
          stroke: Theme.line,
          textSize: this.size > 32 ? 11 : 14,
          radius: 4,
        });
        row.cells.push(cell);
        drops.push(this.physics.dropTo(this.anim, cell, this.xOf(i), row.y));
      });
    }
    await Promise.all(drops);
    this.log(`New sorted array of ${this.size} values`, 'hint');
  }

  updateStats() {
    this.setStats({
      n: this.size,
      'linear steps': this.steps.linear,
      'binary steps': this.steps.binary,
      'log₂ n': Math.floor(Math.log2(this.size)) + 1,
    });
  }

  async race(random = false) {
    let target = this.inputNumber('target');
    if (random || target === null) {
      target = Math.random() < 0.85 ? this.values[Math.floor(Math.random() * this.values.length)] : 100;
      this.ui.target.value = target;
    }
    if (this.rows.linear.cells.some((c) => !c || c.cull)) await this.newArray();

    this.steps = { linear: 0, binary: 0 };
    this.found = {};
    this.updateStats();
    this.log(`Searching for ${target}…`);

    const lin = { i: 0, done: false };
    const bin = { lo: 0, hi: this.size - 1, done: false };

    while (!lin.done || !bin.done) {
      if (!lin.done) this.linearStep(lin, target);
      if (!bin.done) this.binaryStep(bin, target);
      this.updateStats();
      await this.wait(260);
      this.settleStep(lin, bin, target);
      await this.wait(260);
    }
    this.pointers = { linear: {}, binary: {} };
    const L = this.steps.linear;
    const B = this.steps.binary;
    this.log(`Linear: ${L} checks · Binary: ${B} checks`, 'ok');
    if (B < L) this.log(`Binary search was ${(L / B).toFixed(1)}× faster`, 'hint');
  }

  linearStep(s, target) {
    if (s.i >= this.size) {
      s.done = true;
      this.log('Linear: not found', 'warn');
      return;
    }
    this.steps.linear++;
    this.pointers.linear = { i: s.i };
    this.rows.linear.cells[s.i].style.highlight = Theme.yellow;
    this.line(2);
  }

  binaryStep(s, target) {
    if (s.lo > s.hi) {
      s.done = true;
      this.log('Binary: not found', 'warn');
      return;
    }
    s.mid = (s.lo + s.hi) >> 1;
    this.steps.binary++;
    this.pointers.binary = { lo: s.lo, mid: s.mid, hi: s.hi };
    this.rows.binary.cells[s.mid].style.highlight = Theme.yellow;
    this.line(10);
  }

  // Resolve the comparison made in the previous half-step.
  settleStep(lin, bin, target) {
    const lc = this.rows.linear.cells;
    const bc = this.rows.binary.cells;

    if (!lin.done && lin.i < this.size && this.pointers.linear.i === lin.i) {
      const cell = lc[lin.i];
      if (this.values[lin.i] === target) {
        cell.style.fill = Theme.green;
        cell.style.textColor = Theme.bg;
        cell.style.glow = Theme.green;
        lin.done = true;
        this.log(`Linear found ${target} at index ${lin.i}`, 'ok');
      } else {
        this.physics.fling(cell, (Math.random() - 0.5) * 2, -3, (Math.random() - 0.5) * 0.2);
        lin.i++;
      }
    }

    if (!bin.done && bin.mid !== undefined && this.pointers.binary.mid === bin.mid) {
      const v = this.values[bin.mid];
      if (v === target) {
        const cell = bc[bin.mid];
        cell.style.fill = Theme.green;
        cell.style.textColor = Theme.bg;
        cell.style.glow = Theme.green;
        bin.done = true;
        this.log(`Binary found ${target} at index ${bin.mid}`, 'ok');
        // drop the rest of the range for clarity
        for (let k = bin.lo; k <= bin.hi; k++) if (k !== bin.mid) this.physics.fling(bc[k], (Math.random() - 0.5) * 2, -2, (Math.random() - 0.5) * 0.2);
      } else {
        const [a, b] = v < target ? [bin.lo, bin.mid] : [bin.mid, bin.hi];
        this.line(v < target ? 11 : 12);
        for (let k = a; k <= b; k++) this.physics.fling(bc[k], (Math.random() - 0.5) * 3, -3 - Math.random() * 2, (Math.random() - 0.5) * 0.25);
        this.log(`Binary: arr[${bin.mid}] = ${v} ${v < target ? '<' : '>'} ${target} → drop ${b - a + 1} items`, 'step');
        if (v < target) bin.lo = bin.mid + 1;
        else bin.hi = bin.mid - 1;
      }
      bin.mid = undefined;
    }
  }

  draw(p) {
    Draw.label(p, 'Linear search  ·  O(n)', 40, this.rows.linear.y - 150, { align: 'left', color: Theme.text, size: 16, bold: true });
    Draw.label(p, 'check every item from left to right', 40, this.rows.linear.y - 128, { align: 'left', size: 12 });
    Draw.label(p, 'Binary search  ·  O(log n)', 40, this.rows.binary.y - 150, { align: 'left', color: Theme.text, size: 16, bold: true });
    Draw.label(p, 'check the middle, discard half', 40, this.rows.binary.y - 128, { align: 'left', size: 12 });

    this.physics.render(p);

    const lp = this.pointers.linear;
    if (lp.i !== undefined) Draw.pointer(p, this.xOf(lp.i), this.rows.linear.y - 26, 'i');
    const bp = this.pointers.binary;
    const by = this.rows.binary.y + 32;
    if (bp.mid !== undefined) {
      Draw.pointer(p, this.xOf(bp.mid), this.rows.binary.y - 26, 'mid');
      Draw.pointerUp(p, this.xOf(bp.lo), by, 'lo', Theme.cyan);
      if (bp.hi !== bp.lo) Draw.pointerUp(p, this.xOf(bp.hi), by, 'hi', Theme.pink);
    }

    // step counters
    Draw.label(p, `${this.steps.linear} checks`, this.W - 40, this.rows.linear.y - 150, { align: 'right', color: Theme.yellow, size: 16, bold: true });
    Draw.label(p, `${this.steps.binary} checks`, this.W - 40, this.rows.binary.y - 150, { align: 'right', color: Theme.yellow, size: 16, bold: true });
  }
}
