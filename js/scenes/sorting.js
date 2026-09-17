// Sorting algorithms. Each algorithm is a generator that yields events
// (compare, swap, write, ...) which the scene animates one at a time.
const SORTS = {
  bubble: {
    name: 'Bubble sort',
    big: 'O(n²)',
    code: [
      'for (let i = 0; i < n - 1; i++) {',
      '  let swapped = false;',
      '  for (let j = 0; j < n - 1 - i; j++) {',
      '    if (a[j] > a[j + 1]) {',
      '      [a[j], a[j + 1]] = [a[j + 1], a[j]];',
      '      swapped = true;',
      '    }',
      '  }',
      '  if (!swapped) break;   // already sorted',
      '}',
    ],
    *run(a) {
      const n = a.length;
      for (let i = 0; i < n - 1; i++) {
        let swapped = false;
        for (let j = 0; j < n - 1 - i; j++) {
          yield { t: 'cmp', i: j, j: j + 1, line: 3 };
          if (a[j] > a[j + 1]) {
            [a[j], a[j + 1]] = [a[j + 1], a[j]];
            swapped = true;
            yield { t: 'swap', i: j, j: j + 1, line: 4 };
          }
        }
        yield { t: 'done', i: n - 1 - i };
        if (!swapped) {
          yield { t: 'line', line: 8 };
          break;
        }
      }
      yield { t: 'allDone' };
    },
  },

  selection: {
    name: 'Selection sort',
    big: 'O(n²)',
    code: [
      'for (let i = 0; i < n - 1; i++) {',
      '  let min = i;',
      '  for (let j = i + 1; j < n; j++)',
      '    if (a[j] < a[min]) min = j;',
      '  if (min !== i)',
      '    [a[i], a[min]] = [a[min], a[i]];',
      '}',
    ],
    *run(a) {
      const n = a.length;
      for (let i = 0; i < n - 1; i++) {
        let min = i;
        yield { t: 'pivot', i: min, line: 1 };
        for (let j = i + 1; j < n; j++) {
          yield { t: 'cmp', i: j, j: min, line: 3 };
          if (a[j] < a[min]) {
            min = j;
            yield { t: 'pivot', i: min, line: 3 };
          }
        }
        if (min !== i) {
          [a[i], a[min]] = [a[min], a[i]];
          yield { t: 'swap', i, j: min, line: 5 };
        }
        yield { t: 'pivot', i: -1 };
        yield { t: 'done', i };
      }
      yield { t: 'allDone' };
    },
  },

  insertion: {
    name: 'Insertion sort',
    big: 'O(n²)',
    code: [
      'for (let i = 1; i < n; i++) {',
      '  let j = i;',
      '  while (j > 0 && a[j - 1] > a[j]) {',
      '    [a[j - 1], a[j]] = [a[j], a[j - 1]];',
      '    j--;',
      '  }',
      '}',
      '// best case (already sorted): O(n)',
    ],
    *run(a) {
      const n = a.length;
      for (let i = 1; i < n; i++) {
        yield { t: 'range', lo: 0, hi: i, line: 0 };
        let j = i;
        while (j > 0) {
          yield { t: 'cmp', i: j - 1, j, line: 2 };
          if (a[j - 1] <= a[j]) break;
          [a[j - 1], a[j]] = [a[j], a[j - 1]];
          yield { t: 'swap', i: j - 1, j, line: 3 };
          j--;
        }
      }
      yield { t: 'range', lo: -1, hi: -1 };
      yield { t: 'allDone' };
    },
  },

  merge: {
    name: 'Merge sort',
    big: 'O(n log n)',
    code: [
      'function mergeSort(a, lo, hi) {',
      '  if (lo >= hi) return;',
      '  const mid = (lo + hi) >> 1;',
      '  mergeSort(a, lo, mid);',
      '  mergeSort(a, mid + 1, hi);',
      '  const L = a.slice(lo, mid + 1), R = a.slice(mid + 1, hi + 1);',
      '  let i = 0, j = 0, k = lo;',
      '  while (i < L.length && j < R.length)',
      '    a[k++] = L[i] <= R[j] ? L[i++] : R[j++];',
      '  while (i < L.length) a[k++] = L[i++];',
      '  while (j < R.length) a[k++] = R[j++];',
      '}',
    ],
    *run(a) {
      function* sort(lo, hi) {
        if (lo >= hi) return;
        const mid = (lo + hi) >> 1;
        yield { t: 'range', lo, hi, line: 2 };
        yield* sort(lo, mid);
        yield* sort(mid + 1, hi);
        yield { t: 'range', lo, hi, line: 5 };
        const L = a.slice(lo, mid + 1);
        const R = a.slice(mid + 1, hi + 1);
        let i = 0;
        let j = 0;
        let k = lo;
        while (i < L.length && j < R.length) {
          yield { t: 'cmp', i: k, j: mid + 1 + j, line: 8 };
          const v = L[i] <= R[j] ? L[i++] : R[j++];
          a[k] = v;
          yield { t: 'set', i: k++, v, line: 8 };
        }
        while (i < L.length) {
          a[k] = L[i++];
          yield { t: 'set', i: k, v: a[k], line: 9 };
          k++;
        }
        while (j < R.length) {
          a[k] = R[j++];
          yield { t: 'set', i: k, v: a[k], line: 10 };
          k++;
        }
      }
      yield* sort(0, a.length - 1);
      yield { t: 'range', lo: -1, hi: -1 };
      yield { t: 'allDone' };
    },
  },

  quick: {
    name: 'Quick sort',
    big: 'O(n log n)',
    code: [
      'function quickSort(a, lo, hi) {',
      '  if (lo >= hi) return;',
      '  const pivot = a[hi];',
      '  let i = lo;',
      '  for (let j = lo; j < hi; j++)',
      '    if (a[j] < pivot) swap(a, i++, j);',
      '  swap(a, i, hi);          // pivot in place',
      '  quickSort(a, lo, i - 1);',
      '  quickSort(a, i + 1, hi);',
      '}',
      '// worst case (bad pivots): O(n²)',
    ],
    *run(a) {
      function* sort(lo, hi) {
        if (lo > hi) return;
        if (lo === hi) {
          yield { t: 'done', i: lo };
          return;
        }
        yield { t: 'range', lo, hi, line: 1 };
        const pivot = a[hi];
        yield { t: 'pivot', i: hi, line: 2 };
        let i = lo;
        for (let j = lo; j < hi; j++) {
          yield { t: 'cmp', i: j, j: hi, line: 5 };
          if (a[j] < pivot) {
            if (i !== j) {
              [a[i], a[j]] = [a[j], a[i]];
              yield { t: 'swap', i, j, line: 5 };
            }
            i++;
          }
        }
        if (i !== hi) {
          [a[i], a[hi]] = [a[hi], a[i]];
          yield { t: 'swap', i, j: hi, line: 6 };
        }
        yield { t: 'pivot', i: -1 };
        yield { t: 'done', i };
        yield* sort(lo, i - 1);
        yield* sort(i + 1, hi);
      }
      yield* sort(0, a.length - 1);
      yield { t: 'range', lo: -1, hi: -1 };
      yield { t: 'allDone' };
    },
  },
};

class SortingScene extends Scene {
  static id = 'sorting';
  static title = 'Sorting Algorithms';
  static nav = 'bubble, insertion, merge, quick…';
  static group = 'Algorithms';
  static subtitle = 'Watch each algorithm compare and move bars. Count the comparisons to feel the difference between O(n²) and O(n log n).';

  setup() {
    this.algo = 'bubble';
    this.n = 16;
    this.input = 'random';
    this.floorY = 540;
    this.bars = [];
    this.stats = { comparisons: 0, swaps: 0, writes: 0 };
    this.cmp = null;
    this.pivot = -1;
    this.range = null;
    this.physics.wall(this.W / 2, this.floorY + 6, this.W - 80, 12);
    this.showAlgo();
    this.run(() => this.shuffle());
  }

  controls() {
    const act = (fn) => () => this.run(fn);
    return [
      {
        type: 'select',
        id: 'algo',
        label: 'Algorithm',
        value: 'bubble',
        options: Object.entries(SORTS).map(([value, s]) => ({ value, label: `${s.name}  ${s.big}` })),
        onChange: (v) => {
          if (this.busy) return (this.ui.algo.value = this.algo);
          this.algo = v;
          this.showAlgo();
        },
      },
      {
        type: 'select',
        id: 'size',
        label: 'Size',
        value: '16',
        options: [8, 16, 24, 32].map((v) => ({ value: String(v), label: String(v) })),
        onChange: (v) => {
          if (this.busy) return (this.ui.size.value = String(this.n));
          this.n = Number(v);
          this.run(() => this.shuffle());
        },
      },
      {
        type: 'select',
        id: 'input',
        label: 'Input',
        value: 'random',
        options: [
          { value: 'random', label: 'random' },
          { value: 'nearly', label: 'nearly sorted' },
          { value: 'reversed', label: 'reversed' },
          { value: 'few', label: 'few unique' },
        ],
        onChange: (v) => {
          if (this.busy) return (this.ui.input.value = this.input);
          this.input = v;
          this.run(() => this.shuffle());
        },
      },
      { type: 'sep' },
      { type: 'button', label: '▶ Sort', action: act(() => this.sort()) },
      { type: 'button', label: 'Shuffle', variant: 'secondary', action: act(() => this.shuffle()) },
    ];
  }

  about() {
    return `
      <p><b>Bubble</b>, <b>selection</b> and <b>insertion</b> sort compare neighbours or scan the rest of the array for every element, giving <code>O(n²)</code> comparisons.</p>
      <p><b>Merge sort</b> splits the array in half, sorts each half and merges them: <code>log n</code> levels × <code>n</code> work per level = <code>O(n log n)</code>. <b>Quick sort</b> partitions around a pivot and is <code>O(n log n)</code> on average.</p>
      <p>Try <i>nearly sorted</i> input with insertion sort (almost <code>O(n)</code>), or <i>reversed</i> input with quick sort (its worst case with a last-element pivot).</p>
      <p><span style="color:#fbbf24">■</span> comparing &nbsp;<span style="color:#f87171">■</span> moving &nbsp;<span style="color:#f472b6">■</span> pivot / min &nbsp;<span style="color:#4ade80">■</span> in final place</p>`;
  }

  complexity() {
    return [
      ['Bubble sort', 'O(n²)', 'best O(n) with early exit'],
      ['Selection sort', 'O(n²)', 'always, even if sorted'],
      ['Insertion sort', 'O(n²)', 'best O(n), great for small n'],
      ['Merge sort', 'O(n log n)', 'stable, needs O(n) memory'],
      ['Quick sort', 'O(n log n)', 'average; worst O(n²)'],
    ];
  }

  showAlgo() {
    this.codes.algo = SORTS[this.algo].code;
    this.app.showCode(SORTS[this.algo].name, SORTS[this.algo].code, -1);
  }

  get barW() {
    return (this.W - 120) / this.n;
  }

  slotX(i) {
    return 60 + this.barW * (i + 0.5);
  }

  heightFor(v) {
    return 20 + (v / 100) * 360;
  }

  updateStats() {
    const n = this.n;
    this.setStats({
      n,
      comparisons: this.stats.comparisons,
      swaps: this.stats.swaps,
      writes: this.stats.writes,
      'n²': n * n,
      'n log₂ n': Math.round(n * Math.log2(n)),
    });
  }

  makeValues() {
    const n = this.n;
    let vals = Array.from({ length: n }, () => 5 + Math.floor(Math.random() * 95));
    if (this.input === 'nearly') {
      vals.sort((a, b) => a - b);
      for (let k = 0; k < Math.max(1, n / 8); k++) {
        const i = Math.floor(Math.random() * (n - 1));
        [vals[i], vals[i + 1]] = [vals[i + 1], vals[i]];
      }
    } else if (this.input === 'reversed') {
      vals.sort((a, b) => b - a);
    } else if (this.input === 'few') {
      const pool = [20, 45, 70, 95];
      vals = vals.map(() => pool[Math.floor(Math.random() * pool.length)]);
    }
    return vals;
  }

  // New values rain down as physics bodies, then become plain bars.
  async shuffle() {
    this.bars = [];
    this.cmp = null;
    this.pivot = -1;
    this.range = null;
    this.stats = { comparisons: 0, swaps: 0, writes: 0 };
    this.updateStats();
    const values = this.makeValues();
    const w = this.barW * 0.8;
    const bodies = values.map((v, i) => {
      const h = this.heightFor(v);
      return this.physics.rect(this.slotX(i), -h / 2 - 40 - Math.random() * 200, w, h, { fill: this.barColor(v), radius: 3 }, { inertia: Infinity, friction: 0.5, restitution: 0 });
    });
    await Promise.all(bodies.map((b, i) => this.physics.dropTo(this.anim, b, this.slotX(i), this.floorY - this.heightFor(values[i]) / 2, 4000)));
    bodies.forEach((b) => this.physics.remove(b));
    this.bars = values.map((v, i) => ({ value: v, x: this.slotX(i), h: this.heightFor(v), lift: 0, done: false, state: null }));
    this.log(`New ${this.input} array of ${this.n} values`, 'hint');
  }

  barColor(v) {
    const c = this.app.p.lerpColor(this.app.p.color(Theme.cyan), this.app.p.color(Theme.purple), v / 100);
    return c.toString('#rrggbb');
  }

  delay() {
    return clamp(1300 / this.n, 18, 110);
  }

  async sort() {
    if (!this.bars.length) return;
    if (this.bars.every((b) => b.done)) await this.shuffle();
    const algo = SORTS[this.algo];
    this.showAlgo();
    this.stats = { comparisons: 0, swaps: 0, writes: 0 };
    this.log(`${algo.name} on ${this.n} ${this.input} values…`);
    const values = this.bars.map((b) => b.value);
    const d = this.delay();

    for (const ev of algo.run(values)) {
      if (ev.line !== undefined) this.line(ev.line);
      switch (ev.t) {
        case 'cmp':
          this.stats.comparisons++;
          this.cmp = [ev.i, ev.j];
          this.updateStats();
          await this.wait(d);
          break;
        case 'swap':
          this.stats.swaps++;
          this.updateStats();
          await this.animateSwap(ev.i, ev.j, d * 1.6);
          break;
        case 'set':
          this.stats.writes++;
          this.updateStats();
          await this.animateSet(ev.i, ev.v, d * 1.4);
          break;
        case 'pivot':
          this.pivot = ev.i;
          break;
        case 'range':
          this.range = ev.lo < 0 ? null : [ev.lo, ev.hi];
          break;
        case 'done':
          this.bars[ev.i].done = true;
          break;
        case 'allDone':
          this.cmp = null;
          await this.sweep();
          break;
      }
    }
    const { comparisons, swaps, writes } = this.stats;
    this.log(`${algo.name}: ${comparisons} comparisons, ${swaps} swaps${writes ? `, ${writes} writes` : ''}`, 'ok');
    const n = this.n;
    this.log(`For n = ${n}: n² = ${n * n}, n log n ≈ ${Math.round(n * Math.log2(n))}`, 'step');
  }

  async animateSwap(i, j, duration) {
    const a = this.bars[i];
    const b = this.bars[j];
    a.state = b.state = 'swap';
    const xa = a.x;
    const xb = b.x;
    await this.anim.tween(duration, (e) => {
      a.x = lerp(xa, xb, e);
      b.x = lerp(xb, xa, e);
      a.lift = Math.sin(Math.PI * e) * 24;
      b.lift = -Math.sin(Math.PI * e) * 10;
    });
    a.lift = b.lift = 0;
    a.state = b.state = null;
    this.bars[i] = b;
    this.bars[j] = a;
  }

  async animateSet(i, v, duration) {
    const bar = this.bars[i];
    bar.state = 'swap';
    const h0 = bar.h;
    const h1 = this.heightFor(v);
    bar.value = v;
    await this.anim.tween(duration, (e) => (bar.h = lerp(h0, h1, e)));
    bar.state = null;
  }

  async sweep() {
    this.range = null;
    this.pivot = -1;
    for (const b of this.bars) {
      b.done = true;
      b.lift = 12;
      await this.wait(clamp(400 / this.n, 10, 40));
      b.lift = 0;
    }
    // a little celebration
    for (let k = 0; k < 36; k++) {
      const c = this.physics.circle(this.W / 2 + (Math.random() - 0.5) * 200, this.floorY - 420, 4 + Math.random() * 3, { fill: Theme.colorFor(k) });
      this.physics.fling(c, (Math.random() - 0.5) * 16, -6 - Math.random() * 10, 0);
    }
  }

  draw(p) {
    const inRange = (i) => !this.range || (i >= this.range[0] && i <= this.range[1]);
    const w = this.barW * 0.8;

    if (this.range) {
      const x0 = this.slotX(this.range[0]) - this.barW / 2;
      const x1 = this.slotX(this.range[1]) + this.barW / 2;
      p.push();
      p.noStroke();
      p.fill(255, 255, 255, 10);
      p.rect(x0, this.floorY - 400, x1 - x0, 400, 6);
      p.pop();
      Draw.label(p, `[${this.range[0]}…${this.range[1]}]`, (x0 + x1) / 2, this.floorY - 412, { size: 12, color: Theme.muted });
    }

    this.bars.forEach((b, i) => {
      let fill = this.barColor(b.value);
      if (b.done) fill = Theme.green;
      if (i === this.pivot) fill = Theme.pink;
      if (this.cmp && (this.cmp[0] === i || this.cmp[1] === i)) fill = Theme.yellow;
      if (b.state === 'swap') fill = Theme.red;
      p.push();
      p.noStroke();
      p.fill(fill);
      p.drawingContext.globalAlpha = inRange(i) || b.done ? 1 : 0.35;
      p.rect(b.x - w / 2, this.floorY - b.h - b.lift, w, b.h, 3, 3, 0, 0);
      p.pop();
      if (this.n <= 24) Draw.label(p, b.value, b.x, this.floorY - b.h - b.lift - 12, { size: this.n <= 16 ? 13 : 10, color: Theme.muted });
    });

    this.physics.render(p);

    Draw.label(p, SORTS[this.algo].name, 60, 70, { align: 'left', color: Theme.text, size: 20, bold: true });
    Draw.label(p, SORTS[this.algo].big, 60, 96, { align: 'left', color: SORTS[this.algo].big === 'O(n²)' ? Theme.orange : Theme.yellow, size: 15 });

    // comparisons vs reference curves
    const c = this.stats.comparisons;
    const n = this.n;
    const refs = [
      ['comparisons', c, Theme.yellow],
      ['n²', n * n, Theme.orange],
      ['n log n', n * Math.log2(n), Theme.cyan],
    ];
    const maxV = n * n;
    refs.forEach(([label, v, color], k) => {
      const y = 580 + k * 0;
      const x = 330 + k * 220;
      Draw.label(p, `${label}: ${Math.round(v)}`, x, y, { align: 'left', size: 12, color });
      p.push();
      p.noStroke();
      p.fill(Theme.grid);
      p.rect(x, y + 10, 180, 5, 3);
      p.fill(color);
      p.rect(x, y + 10, (180 * Math.min(v, maxV)) / maxV, 5, 3);
      p.pop();
    });
  }
}
