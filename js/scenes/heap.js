// Binary heap stored in an array. The tree above and the array below are two
// views of the same data; sift-up / sift-down swaps move nodes in both.
class HeapScene extends Scene {
  static id = 'heap';
  static title = 'Binary Heap';
  static nav = 'priority queue · heap sort';
  static group = 'Trees';
  static subtitle = 'A complete binary tree kept in an array. The smallest (or largest) value is always at the root.';
  static gravity = 0;

  static MAX = 15;

  setup() {
    this.tree = new TreeView(this.physics, 22);
    this.heap = [];
    this.kind = 'min';
    this.extracted = [];
    this.arrayY = 500;

    this.codes = {
      insert: [
        'push(value) {',
        '  const a = this.items;',
        '  a.push(value);                 // add at the end',
        '  let i = a.length - 1;',
        '  while (i > 0) {                // sift up',
        '    const parent = (i - 1) >> 1;',
        '    if (a[parent] <= a[i]) break;',
        '    [a[parent], a[i]] = [a[i], a[parent]];',
        '    i = parent;',
        '  }',
        '}',
      ],
      extract: [
        'pop() {',
        '  const a = this.items;',
        '  const top = a[0];',
        '  a[0] = a.pop();                // last leaf to root',
        '  let i = 0;',
        '  while (true) {                 // sift down',
        '    const l = 2 * i + 1, r = l + 1;',
        '    let best = i;',
        '    if (l < a.length && a[l] < a[best]) best = l;',
        '    if (r < a.length && a[r] < a[best]) best = r;',
        '    if (best === i) break;',
        '    [a[i], a[best]] = [a[best], a[i]];',
        '    i = best;',
        '  }',
        '  return top;',
        '}',
      ],
      index: ['// array ↔ tree', 'parent(i) = (i - 1) >> 1', 'left(i)   = 2 * i + 1', 'right(i)  = 2 * i + 2', '', '// no pointers needed: the shape is', '// always a complete binary tree'],
    };
    this.code('index');

    this.run(async () => {
      for (const v of [40, 25, 60, 10, 35, 50]) await this.insert(v, true);
      this.log('Root is always the minimum. Try pop() a few times.', 'hint');
    });
  }

  controls() {
    const act = (fn) => () => this.run(fn);
    return [
      { type: 'number', id: 'value', label: 'Value', value: '5', width: 70, onEnter: act(() => this.insert()) },
      { type: 'button', label: 'push', action: act(() => this.insert()) },
      { type: 'button', label: 'pop (extract root)', action: act(() => this.extract()) },
      { type: 'button', label: 'peek', variant: 'secondary', action: act(() => this.peek()) },
      { type: 'sep' },
      {
        type: 'select',
        id: 'kind',
        label: 'Heap type',
        value: 'min',
        options: [
          { value: 'min', label: 'min-heap' },
          { value: 'max', label: 'max-heap' },
        ],
        onChange: (v) => {
          if (this.busy) return (this.ui.kind.value = this.kind);
          this.kind = v;
          this.run(() => this.randomHeap());
        },
      },
      { type: 'button', label: 'Random heap', variant: 'ghost', action: act(() => this.randomHeap()) },
      { type: 'button', label: 'Heap sort (pop all)', variant: 'ghost', action: act(() => this.heapSort()) },
      { type: 'button', label: 'Clear', variant: 'danger', action: act(() => this.clear()) },
    ];
  }

  about() {
    return `
      <p>A <b>binary heap</b> is a complete binary tree where every parent is ≤ its children (<b>min-heap</b>) or ≥ them (<b>max-heap</b>). It is stored compactly in an array: the children of index <code>i</code> live at <code>2i+1</code> and <code>2i+2</code>.</p>
      <p><code>push</code> adds at the end and <b>sifts up</b>; <code>pop</code> moves the last leaf to the root and <b>sifts down</b>. Both follow one root-to-leaf path: <code>O(log n)</code>.</p>
      <p>Heaps implement <b>priority queues</b> (task schedulers, Dijkstra's shortest path) and <b>heap sort</b>: pop everything and the values come out in order, <code>O(n log n)</code>.</p>`;
  }

  complexity() {
    return [
      ['<code>peek</code> (min / max)', 'O(1)', ''],
      ['<code>push</code>', 'O(log n)', 'sift up'],
      ['<code>pop</code>', 'O(log n)', 'sift down'],
      ['Build heap from array', 'O(n)', 'bottom-up heapify'],
      ['Heap sort', 'O(n log n)', ''],
      ['Search arbitrary value', 'O(n)', 'heaps are not search trees'],
    ];
  }

  update(dt) {
    this.tree.update(dt);
  }

  // ---- geometry -------------------------------------------------------------

  treePos(i) {
    const level = Math.floor(Math.log2(i + 1));
    const pos = i - (Math.pow(2, level) - 1);
    const count = Math.pow(2, level);
    return { x: 60 + ((pos + 0.5) / count) * (this.W - 120), y: 90 + level * 88 };
  }

  cellX(i) {
    const cell = 52;
    return this.W / 2 - (HeapScene.MAX * cell) / 2 + cell * (i + 0.5);
  }

  better(a, b) {
    return this.kind === 'min' ? a < b : a > b;
  }

  layout() {
    this.heap.forEach((n, i) => {
      const { x, y } = this.treePos(i);
      this.tree.moveTo(n, x, y);
    });
    this.updateStats();
  }

  updateStats() {
    this.setStats({ size: this.heap.length, root: this.heap[0]?.value ?? '—', height: this.heap.length ? Math.floor(Math.log2(this.heap.length)) : 0 });
  }

  resetStates() {
    for (const n of this.heap) n.state = null;
  }

  async swap(i, j, pause) {
    const a = this.heap;
    a[i].state = a[j].state = 'swap';
    [a[i], a[j]] = [a[j], a[i]];
    this.layout();
    await this.wait(pause);
    a[i].state = a[j].state = null;
  }

  // ---- operations --------------------------------------------------------------

  async insert(value, quiet = false) {
    const v = value ?? this.inputNumber('value');
    if (v === null || !Number.isFinite(v)) return this.log('Enter a number', 'warn');
    if (this.heap.length >= HeapScene.MAX) return this.log(`Only ${HeapScene.MAX} nodes fit on screen`, 'warn');
    const pause = quiet ? 250 : 550;
    this.code('insert', 2);

    const i0 = this.heap.length;
    const node = this.tree.add(v, this.cellX(i0), this.arrayY);
    node.state = 'new';
    this.heap.push(node);
    this.layout();
    await this.wait(pause);
    node.state = null;

    let i = i0;
    let swaps = 0;
    while (i > 0) {
      this.line(5);
      const parent = (i - 1) >> 1;
      const a = this.heap;
      a[i].state = 'visit';
      a[parent].state = 'visit';
      await this.wait(pause);
      if (!this.better(a[i].value, a[parent].value)) {
        this.line(6);
        a[i].state = a[parent].state = null;
        break;
      }
      this.line(7);
      await this.swap(i, parent, pause);
      swaps++;
      i = parent;
    }
    this.resetStates();
    if (!quiet) this.log(`push(${v}) → sifted up ${swaps} level${swaps === 1 ? '' : 's'}`, 'ok');
  }

  async extract(quiet = false) {
    if (!this.heap.length) {
      this.log('pop() on an empty heap', 'warn');
      return null;
    }
    const pause = quiet ? 280 : 550;
    this.code('extract', 2);
    const a = this.heap;
    const top = a[0];
    top.state = 'found';
    await this.wait(pause);

    // the root leaves the heap and drops into the output row
    this.extracted.push(top.value);
    this.tree.drop(top);

    const last = a.pop();
    if (a.length) {
      this.line(3);
      a[0] = last;
      last.state = 'new';
      this.layout();
      await this.wait(pause + 150);
      last.state = null;

      let i = 0;
      let swaps = 0;
      while (true) {
        this.line(6);
        const l = 2 * i + 1;
        const r = l + 1;
        let best = i;
        a[i].state = 'visit';
        if (l < a.length) a[l].state = 'visit';
        if (r < a.length) a[r].state = 'visit';
        await this.wait(pause);
        if (l < a.length && this.better(a[l].value, a[best].value)) best = l;
        if (r < a.length && this.better(a[r].value, a[best].value)) best = r;
        this.resetStates();
        if (best === i) {
          this.line(10);
          break;
        }
        this.line(11);
        await this.swap(i, best, pause);
        swaps++;
        i = best;
      }
      if (!quiet) this.log(`pop() → ${top.value}, sifted down ${swaps} level${swaps === 1 ? '' : 's'}`, 'ok');
    } else {
      this.layout();
      if (!quiet) this.log(`pop() → ${top.value}, heap is now empty`, 'ok');
    }
    this.line(14);
    this.updateStats();
    return top.value;
  }

  async peek() {
    this.code('index');
    const root = this.heap[0];
    if (!root) return this.log('peek() on an empty heap', 'warn');
    root.state = 'found';
    this.log(`peek() → ${root.value} (always at index 0)`, 'ok');
    await this.wait(900);
    root.state = null;
  }

  async clear() {
    this.tree.clear();
    this.heap = [];
    this.extracted = [];
    this.updateStats();
    await this.wait(300);
  }

  async randomHeap() {
    await this.clear();
    const values = new Set();
    while (values.size < 9) values.add(1 + Math.floor(Math.random() * 98));
    for (const v of values) await this.insert(v, true);
    this.log(`Built a ${this.kind}-heap from ${[...values].join(', ')}`, 'hint');
  }

  async heapSort() {
    if (!this.heap.length) await this.randomHeap();
    this.extracted = [];
    this.log('Heap sort: pop until empty…');
    while (this.heap.length) await this.extract(true);
    this.log(`Sorted: ${this.extracted.join(', ')}`, 'ok');
  }

  // ---- drawing ------------------------------------------------------------------

  draw(p) {
    const edges = [];
    this.heap.forEach((n, i) => {
      if (i === 0) return;
      const parent = this.heap[(i - 1) >> 1];
      const hot = parent.state && n.state;
      edges.push([parent, n, hot ? Theme.orange : null]);
    });
    this.tree.draw(p, edges);

    if (!this.heap.length) Draw.label(p, 'empty heap: push a value', this.W / 2, 200, { size: 16 });
    Draw.label(p, this.kind === 'min' ? 'min-heap: parent ≤ children' : 'max-heap: parent ≥ children', 60, 40, { align: 'left', size: 14, color: Theme.text, bold: true });

    // array view
    Draw.label(p, 'array', this.cellX(0) - 40, this.arrayY, { align: 'right', size: 13 });
    for (let i = 0; i < HeapScene.MAX; i++) {
      const n = this.heap[i];
      const x = this.cellX(i);
      const color = n ? NODE_STATE_COLORS[n.state] : null;
      Draw.box(p, x, this.arrayY, 46, 40, {
        fill: color || (n ? Theme.surface2 : Theme.bg),
        stroke: n ? Theme.accent : Theme.grid,
        label: n ? n.value : '',
        textColor: color ? Theme.bg : Theme.text,
        size: 15,
        weight: 1.5,
      });
      Draw.label(p, i, x, this.arrayY + 32, { size: 11, color: n ? Theme.muted : Theme.dim });
    }

    if (this.extracted.length) drawValueRow(p, 'popped (sorted)', this.extracted.slice(-15), 585, { color: Theme.green, x0: 60, cell: 44 });
  }
}
