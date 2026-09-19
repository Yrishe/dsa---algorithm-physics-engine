// Shared pieces for the system-design simulations: traffic generators, live
// rate/latency meters and the boxes-and-pipes drawing vocabulary.

// Exponentially distributed arrivals (a Poisson process), driven by sim time.
class Arrivals {
  constructor(rate = 1) {
    this.rate = rate; // events per simulated second
    this.next = 0;
    this.schedule();
  }

  schedule() {
    const r = Math.max(0.01, this.rate);
    this.next = (-Math.log(1 - Math.random()) / r) * 1000;
  }

  tick(dt, spawn) {
    if (this.rate <= 0) return;
    this.next -= dt;
    let guard = 0;
    while (this.next <= 0 && guard++ < 20) {
      spawn();
      this.schedule();
    }
  }
}

// Events per second over a sliding window.
class RateMeter {
  constructor(window = 2000, buckets = 20) {
    this.window = window;
    this.buckets = new Array(buckets).fill(0);
    this.i = 0;
    this.t = 0;
  }

  add(n = 1) {
    this.buckets[this.i] += n;
  }

  tick(dt) {
    const step = this.window / this.buckets.length;
    this.t += dt;
    let guard = 0;
    while (this.t >= step && guard++ < this.buckets.length) {
      this.t -= step;
      this.i = (this.i + 1) % this.buckets.length;
      this.buckets[this.i] = 0;
    }
  }

  get rate() {
    return (this.buckets.reduce((a, b) => a + b, 0) * 1000) / this.window;
  }

  reset() {
    this.buckets.fill(0);
  }
}

// Keeps the last N latency samples for an average and a p95.
class LatencyStat {
  constructor(n = 50) {
    this.n = n;
    this.samples = [];
    this.count = 0;
  }

  add(v) {
    this.samples.push(v);
    if (this.samples.length > this.n) this.samples.shift();
    this.count++;
  }

  get avg() {
    if (!this.samples.length) return 0;
    return this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
  }

  get p95() {
    if (!this.samples.length) return 0;
    const s = [...this.samples].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
  }

  reset() {
    this.samples = [];
    this.count = 0;
  }
}

const Flow = {
  // A labelled component box (server, cache, database...).
  box(p, { x, y, w, h, title, sub = '', color = Theme.accent, state = 'up', dim = false, body = null }) {
    const down = state === 'down';
    p.push();
    p.drawingContext.globalAlpha = dim ? 0.35 : 1;
    p.fill(Theme.surface);
    p.stroke(down ? Theme.red : color);
    p.strokeWeight(2);
    p.rect(x, y, w, h, 10);
    p.noStroke();
    p.fill(down ? Theme.red : color);
    p.rect(x, y, w, 26, 10, 10, 0, 0);
    p.pop();
    Draw.label(p, title, x + w / 2, y + 13, { color: Theme.bg, size: 13, bold: true });
    if (sub) Draw.label(p, sub, x + w / 2, y + 44, { color: down ? Theme.red : Theme.muted, size: 12 });
    if (body) body(p, x, y, w, h);
  },

  // Connection between components; `flow` animates dashes along it.
  pipe(p, x1, y1, x2, y2, { color = Theme.line, weight = 8, flow = 0, active = true } = {}) {
    p.push();
    p.stroke(color);
    p.strokeWeight(weight);
    p.strokeCap(p.ROUND);
    p.drawingContext.globalAlpha = active ? 1 : 0.3;
    p.line(x1, y1, x2, y2);
    if (active && flow) {
      p.stroke(Theme.bg);
      p.strokeWeight(Math.max(2, weight - 5));
      p.drawingContext.setLineDash([6, 14]);
      p.drawingContext.lineDashOffset = -flow;
      p.line(x1, y1, x2, y2);
      p.drawingContext.setLineDash([]);
    }
    p.pop();
  },

  // Horizontal fill meter (utilisation, queue depth, hit ratio...).
  meter(p, x, y, w, h, pct, color = Theme.accent, { bg = Theme.grid } = {}) {
    p.push();
    p.noStroke();
    p.fill(bg);
    p.rect(x, y, w, h, h / 2);
    p.fill(color);
    p.rect(x, y, w * clamp(pct, 0, 1), h, h / 2);
    p.pop();
  },

  legend(p, x, y, items) {
    let dx = 0;
    for (const [label, color] of items) {
      p.push();
      p.noStroke();
      p.fill(color);
      p.circle(x + dx, y, 10);
      p.pop();
      Draw.label(p, label, x + dx + 10, y, { align: 'left', size: 11 });
      dx += 16 + label.length * 6.2;
    }
  },

  // Formats simulated milliseconds.
  ms(v) {
    if (v >= 1000) return (v / 1000).toFixed(2) + ' s';
    return Math.round(v) + ' ms';
  },
};
