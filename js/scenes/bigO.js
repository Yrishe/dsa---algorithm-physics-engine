// Big O: animated growth curves on the left, and on the right one jar per
// complexity class that gets filled with one physics ball per operation.
const COMPLEXITIES = [
  { label: 'O(1)', f: () => 1, color: Theme.green, example: 'arr[i]' },
  { label: 'O(log n)', f: (n) => Math.max(1, Math.log2(Math.max(1, n))), color: Theme.cyan, example: 'binary search' },
  { label: 'O(n)', f: (n) => n, color: Theme.accent, example: 'for loop' },
  { label: 'O(n log n)', f: (n) => Math.max(1, n * Math.log2(Math.max(1, n))), color: Theme.yellow, example: 'merge sort' },
  { label: 'O(n²)', f: (n) => n * n, color: Theme.orange, example: 'nested loops' },
  { label: 'O(2ⁿ)', f: (n) => Math.pow(2, n), color: Theme.red, example: 'all subsets' },
];

class BigOScene extends Scene {
  static id = 'big-o';
  static title = 'Big O Notation';
  static nav = 'How work grows with n';
  static group = 'Fundamentals';
  static subtitle = 'Each ball is one operation. Pick an input size n and pour to see how each class scales.';

  static MAX_N = 12;
  static MAX_BALLS = 170;

  setup() {
    this.n = 6;
    this.shownN = 0;
    this.scale = 'linear';
    this.spawn = [];
    this.balls = [];

    // chart geometry
    this.plot = { x0: 90, x1: 455, y0: 530, y1: 150 };

    // jars
    const jarW = 62;
    const gap = 16;
    const left = 510;
    this.jarTop = 220;
    this.jarBottom = 548;
    this.jars = COMPLEXITIES.map((c, i) => {
      const x = left + i * (jarW + gap) + jarW / 2;
      const style = { fill: Theme.line };
      const h = this.jarBottom - this.jarTop;
      this.physics.wall(x - jarW / 2 - 3, this.jarTop + h / 2, 6, h, style);
      this.physics.wall(x + jarW / 2 + 3, this.jarTop + h / 2, 6, h, style);
      this.physics.wall(x, this.jarBottom + 4, jarW + 12, 8, style);
      return { ...c, x, w: jarW, count: 0, shown: 0 };
    });
    this.physics.wall(this.W / 2, this.H + 20, this.W * 2, 40, { hidden: true });
    this.physics.wall(this.W + 20, this.H / 2, 40, this.H * 2, { hidden: true });

    this.codes.examples = [
      '// O(1)       constant',
      'const first = arr[0];',
      '',
      '// O(log n)   halve the problem',
      'while (lo <= hi) { mid = (lo+hi)>>1; ... }',
      '',
      '// O(n)       touch every item once',
      'for (const x of arr) sum += x;',
      '',
      '// O(n log n) divide & conquer',
      'mergeSort(arr);',
      '',
      '// O(n²)      compare every pair',
      'for (i of arr) for (j of arr) cmp(i, j);',
      '',
      '// O(2ⁿ)      try every subset',
      'const fib = n => n < 2 ? n : fib(n-1) + fib(n-2);',
    ];
    this.code('examples');
    this.anim.to(this, { shownN: this.n }, 900);
    this.updateStats();
    this.log('Move the n slider, then press "Pour" to fill the jars.', 'hint');
  }

  controls() {
    return [
      { type: 'range', id: 'n', label: 'Input size n', min: 1, max: BigOScene.MAX_N, step: 1, value: 6, onInput: (v) => this.setN(v) },
      {
        type: 'select',
        id: 'scale',
        label: 'Chart scale',
        value: 'linear',
        options: [
          { value: 'linear', label: 'linear' },
          { value: 'log', label: 'logarithmic' },
        ],
        onChange: (v) => (this.scale = v),
      },
      { type: 'button', label: 'Pour operations', action: () => this.run(() => this.pour()) },
      { type: 'button', label: 'Sweep n = 1 → 12', variant: 'secondary', action: () => this.run(() => this.sweep()) },
      { type: 'button', label: 'Empty jars', variant: 'danger', action: () => this.run(() => this.empty()) },
    ];
  }

  about() {
    return `
      <p><b>Big O</b> describes how the amount of work an algorithm does grows as the input size <code>n</code> grows. It ignores constants and focuses on the <i>shape</i> of the growth.</p>
      <p>Each jar collects one ball per operation for the chosen <code>n</code>. Watch how <code>O(1)</code> and <code>O(log n)</code> barely change, while <code>O(n²)</code> and <code>O(2ⁿ)</code> overflow quickly.</p>
      <p>Switch the chart to a logarithmic scale to compare classes that differ by orders of magnitude.</p>`;
  }

  complexity() {
    return [
      ['Read <code>arr[i]</code>', 'O(1)', 'constant'],
      ['Binary search', 'O(log n)', 'halves the range each step'],
      ['Linear search', 'O(n)', 'looks at each item'],
      ['Merge / heap sort', 'O(n log n)', ''],
      ['Bubble sort, pair checks', 'O(n²)', 'nested loops'],
      ['Subsets, naive Fibonacci', 'O(2ⁿ)', 'doubles each step'],
    ];
  }

  setN(v) {
    this.n = v;
    this.anim.to(this, { shownN: v }, 350, Ease.outCubic);
    this.updateStats();
  }

  updateStats() {
    this.setStats({ n: this.n, 'O(n²)': fmtOps(this.n * this.n), 'O(2ⁿ)': fmtOps(Math.pow(2, this.n)) });
  }

  async empty() {
    for (const b of this.balls) this.physics.fling(b, (Math.random() - 0.5) * 6, -4 - Math.random() * 4, 0);
    this.balls = [];
    this.spawn = [];
    for (const j of this.jars) j.count = j.shown = 0;
    await this.wait(300);
  }

  async pour() {
    if (this.balls.length) await this.empty();
    const n = this.n;
    this.log(`Pouring operations for n = ${n}`);
    this.jars.forEach((j, i) => {
      j.count = Math.round(j.f(n));
      j.shown = 0;
      this.spawn[i] = Math.min(j.count, BigOScene.MAX_BALLS);
      const t = j.count;
      this.log(`${j.label.padEnd(10)} → ${fmtOps(t)} operation${t === 1 ? '' : 's'}`, 'step');
    });
    await this.anim.waitUntil(() => this.spawn.every((s) => !s), 20000);
    await this.wait(800);
    const worst = this.jars[5];
    if (worst.count > BigOScene.MAX_BALLS) this.log(`O(2ⁿ) needed ${fmtOps(worst.count)} balls - the jar overflowed!`, 'warn');
    else this.log('Done. Try a bigger n.', 'ok');
  }

  async sweep() {
    for (let v = 1; v <= BigOScene.MAX_N; v++) {
      this.ui.n.value = v;
      this.ui.n.dispatchEvent(new Event('input'));
      await this.wait(260);
    }
    await this.pour();
  }

  update(dt) {
    if (!this.spawn.length || dt <= 0) return;
    // drop two balls into each jar every other frame so the pile forms gradually
    this.tick = (this.tick || 0) + 1;
    if (this.tick % 2) return;
    this.jars.forEach((j, i) => {
      for (let k = 0; k < 2 && this.spawn[i] > 0; k++) {
        const x = j.x + (k - 0.5) * 24 + (Math.random() - 0.5) * 6;
        const b = this.physics.circle(x, this.jarTop + 12, 5, { fill: j.color }, { restitution: 0.1, friction: 0.02, density: 0.002 });
        this.balls.push(b);
        this.spawn[i]--;
        j.shown = Math.min(j.count, j.shown + Math.max(1, j.count / Math.min(j.count, BigOScene.MAX_BALLS)));
      }
      if (this.spawn[i] === 0) j.shown = j.count;
    });
  }

  // ---- drawing ---------------------------------------------------------------

  yFor(v) {
    const { y0, y1 } = this.plot;
    if (this.scale === 'log') return lerp(y0, y1, Math.log2(Math.max(1, v)) / BigOScene.MAX_N);
    return lerp(y0, y1, v / 150);
  }

  xFor(n) {
    const { x0, x1 } = this.plot;
    return lerp(x0, x1, n / BigOScene.MAX_N);
  }

  draw(p) {
    this.drawChart(p);
    this.physics.render(p);
    this.drawJarLabels(p);
  }

  drawChart(p) {
    const { x0, x1, y0, y1 } = this.plot;
    Draw.panel(p, 30, 60, 450, 530);
    Draw.label(p, 'Operations vs input size', 50, 85, { align: 'left', color: Theme.text, size: 15, bold: true });

    // axes + ticks
    p.stroke(Theme.line);
    p.strokeWeight(1);
    p.line(x0, y0, x1, y0);
    p.line(x0, y0, x0, y1);
    for (let n = 0; n <= BigOScene.MAX_N; n += 2) {
      Draw.label(p, n, this.xFor(n), y0 + 16, { size: 11 });
    }
    Draw.label(p, 'n', x1, y0 + 36, { size: 12, color: Theme.text });
    const ticks = this.scale === 'log' ? [1, 16, 256, 4096] : [0, 50, 100, 150];
    for (const t of ticks) {
      const y = this.yFor(t);
      p.stroke(Theme.grid);
      p.line(x0, y, x1, y);
      Draw.label(p, fmtOps(t), x0 - 10, y, { size: 11, align: 'right' });
    }
    Draw.label(p, 'ops', x0 - 10, y1 - 22, { size: 12, color: Theme.text, align: 'right' });

    // curves, clipped to the plot area
    const ctx = p.drawingContext;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y1 - 4, x1 - x0 + 4, y0 - y1 + 4);
    ctx.clip();
    p.noFill();
    for (const c of COMPLEXITIES) {
      p.stroke(c.color);
      p.strokeWeight(2.5);
      p.beginShape();
      const steps = 120;
      for (let i = 0; i <= steps; i++) {
        const n = (this.shownN * i) / steps;
        p.vertex(this.xFor(n), this.yFor(c.f(n)));
      }
      p.endShape();
    }
    ctx.restore();

    // marker at current n
    const mx = this.xFor(this.shownN);
    p.stroke(Theme.muted);
    p.strokeWeight(1);
    ctx.setLineDash([4, 4]);
    p.line(mx, y0, mx, y1);
    ctx.setLineDash([]);
    for (const c of COMPLEXITIES) {
      const y = this.yFor(c.f(this.shownN));
      if (y < y1) continue;
      p.noStroke();
      p.fill(c.color);
      p.circle(mx, y, 8);
    }
    Draw.label(p, `n = ${Math.round(this.shownN)}`, mx, y1 - 10, { color: Theme.text, size: 12, bold: true });

    // legend
    COMPLEXITIES.forEach((c, i) => {
      const lx = x0 + 14;
      const ly = y1 + 16 + i * 20;
      p.noStroke();
      p.fill(c.color);
      p.rect(lx, ly - 2, 14, 4, 2);
      Draw.label(p, c.label, lx + 22, ly, { align: 'left', size: 12, color: Theme.text });
    });
  }

  drawJarLabels(p) {
    Draw.label(p, '1 ball = 1 operation', 745, 85, { color: Theme.text, size: 15, bold: true });
    Draw.label(p, `showing up to ${BigOScene.MAX_BALLS} balls per jar`, 745, 106, { size: 12 });
    for (const j of this.jars) {
      Draw.label(p, fmtOps(Math.round(j.shown)), j.x, this.jarTop - 70, { color: j.color, size: 16, bold: true });
      Draw.label(p, 'ops', j.x, this.jarTop - 52, { size: 11 });
      if (j.count > BigOScene.MAX_BALLS && this.spawn[COMPLEXITIES.indexOf(COMPLEXITIES.find((c) => c.label === j.label))] === 0) {
        Draw.label(p, 'OVERFLOW', j.x, this.jarTop - 30, { color: Theme.red, size: 12, bold: true });
      }
      Draw.label(p, j.label, j.x, this.jarBottom + 26, { color: j.color, size: 13, bold: true });
      Draw.label(p, j.example, j.x, this.jarBottom + 44, { size: 10 });
    }
  }
}

function fmtOps(v) {
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1e4) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(Math.round(v));
}
