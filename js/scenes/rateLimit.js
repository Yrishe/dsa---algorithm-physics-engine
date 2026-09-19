// Rate limiting: three classic algorithms, all made of buckets you can watch
// fill and drain. Requests that cannot get through are answered with 429.
class RateLimitScene extends Scene {
  static id = 'rate-limit';
  static title = 'Rate Limiting';
  static nav = 'token bucket, leaky bucket';
  static group = 'System Design';
  static subtitle = 'Protect a service from too much traffic: allow a steady rate, absorb small bursts, reject the rest.';

  setup() {
    this.algo = 'token';
    this.limit = 3; // allowed requests per second
    this.burst = 6; // bucket capacity
    this.rate = 4; // incoming requests per second
    this.allowed = 0;
    this.rejected = 0;
    this.tokens = [];
    this.bucket = []; // leaky bucket contents
    this.windowCount = 0;
    this.prevCount = 0;
    this.windowLeft = 2000;
    this.windowMs = 2000;
    this.flow = 0;
    this.drainLeft = 0;
    this.inflight = 0;
    this.binPile = [];

    this.box = { x: 390, y: 215, w: 170, h: 200 };
    const b = this.box;
    this.physics.wall(b.x - 7, b.y + b.h / 2, 14, b.h, { fill: Theme.line });
    this.physics.wall(b.x + b.w + 7, b.y + b.h / 2, 14, b.h, { fill: Theme.line });
    this.physics.wall(b.x + b.w / 2, b.y + b.h + 7, b.w + 28, 14, { fill: Theme.line });

    this.service = { x: 760, y: 190, w: 190, h: 80 };
    this.bin = { x: 760, y: 430, w: 190, h: 110 };
    this.physics.wall(this.bin.x - 5, this.bin.y + this.bin.h / 2, 10, this.bin.h, { fill: Theme.red });
    this.physics.wall(this.bin.x + this.bin.w + 5, this.bin.y + this.bin.h / 2, 10, this.bin.h, { fill: Theme.red });
    this.physics.wall(this.bin.x + this.bin.w / 2, this.bin.y + this.bin.h + 5, this.bin.w + 20, 10, { fill: Theme.red });

    this.arrivals = new Arrivals(this.rate);
    this.inRate = new RateMeter();
    this.okRate = new RateMeter();

    this.codes = {
      token: [
        '// token bucket: steady refill, bursts up to `capacity`',
        'refill() {',
        '  const now = Date.now();',
        '  tokens = Math.min(capacity, tokens + rate * (now - last) / 1000);',
        '  last = now;',
        '}',
        '',
        'allow() {',
        '  refill();',
        '  if (tokens >= 1) { tokens -= 1; return true; }',
        '  return false;               // 429 Too Many Requests',
        '}',
      ],
      leaky: [
        '// leaky bucket: a queue drained at a constant rate',
        'allow(req) {',
        '  if (queue.length >= capacity) return false;  // 429',
        '  queue.push(req);            // waits its turn',
        '  return true;',
        '}',
        '',
        'setInterval(() => {',
        '  const req = queue.shift();',
        '  if (req) forward(req);      // perfectly smooth output',
        '}, 1000 / rate);',
      ],
      fixed: [
        '// fixed window counter: cheapest, least accurate',
        'allow(key) {',
        '  const w = Math.floor(Date.now() / windowMs);',
        '  if (w !== current) { current = w; count = 0; }',
        '  return ++count <= limit;',
        '}',
        '',
        '// ⚠ a client can do 2 × limit around a boundary:',
        '// all of window 1 at its end + all of window 2 at its start.',
        '// sliding window log / counter smooths that out.',
      ],
    };
    this.code('token');
    this.log('Incoming 4 req/s, limit 3 req/s — the extra requests get 429.', 'hint');
  }

  controls() {
    return [
      {
        type: 'select',
        id: 'algo',
        label: 'Algorithm',
        value: 'token',
        options: [
          { value: 'token', label: 'token bucket' },
          { value: 'leaky', label: 'leaky bucket' },
          { value: 'fixed', label: 'fixed window' },
        ],
        onChange: (v) => this.setAlgo(v),
      },
      { type: 'range', id: 'limit', label: 'Limit (req/s)', min: 1, max: 8, step: 1, value: 3, onInput: (v) => (this.limit = v) },
      { type: 'range', id: 'burst', label: 'Burst capacity', min: 1, max: 10, step: 1, value: 6, onInput: (v) => (this.burst = v) },
      { type: 'range', id: 'rate', label: 'Incoming (req/s)', min: 0, max: 20, step: 1, value: 4, onInput: (v) => (this.rate = v) },
      { type: 'sep' },
      { type: 'button', label: 'Send burst of 12', lock: false, action: () => this.sendBurst() },
      { type: 'button', label: 'Reset stats', variant: 'ghost', lock: false, action: () => this.resetStats() },
    ];
  }

  about() {
    return `
      <p>Rate limiting keeps one noisy client (or a bad deploy) from taking a service down, and makes quotas enforceable. Over the limit the answer is <code>429 Too Many Requests</code>, usually with a <code>Retry-After</code> header.</p>
      <p><b>Token bucket</b> — tokens are added at a steady rate up to a <i>capacity</i>; each request spends one. Idle time banks tokens, so it allows short bursts and then settles at the refill rate. This is what most API gateways use.</p>
      <p><b>Leaky bucket</b> — requests queue up and leave at a perfectly constant rate. It <i>shapes</i> traffic (smooth output, added latency) and rejects only when the bucket overflows.</p>
      <p><b>Fixed window counter</b> — count per window, reset at the boundary. Cheap and easy, but a client can fire the whole limit at the end of one window and again at the start of the next: <b>2× the limit</b> in an instant. Sliding window log or sliding window counter fixes that.</p>
      <p>In a distributed system the counter lives in a shared store (Redis) — or each node gets a share of the limit and gossip corrects the drift.</p>`;
  }

  complexityTitle() {
    return 'Choosing one';
  }

  complexity() {
    return [
      ['Token bucket', 'bursty OK', 'refill rate + capacity'],
      ['Leaky bucket', 'smooth out', 'adds queueing delay'],
      ['Fixed window', 'cheap', '2× limit at boundaries'],
      ['Sliding window', 'accurate', 'more memory / CPU'],
      ['Over the limit', '429', 'send Retry-After'],
    ];
  }

  setAlgo(v) {
    this.algo = v;
    this.code(v);
    this.clearBucket();
    this.windowCount = 0;
    this.prevCount = 0;
    this.windowLeft = this.windowMs;
    this.log(`Switched to ${v === 'token' ? 'token bucket' : v === 'leaky' ? 'leaky bucket' : 'fixed window'}`);
  }

  clearBucket() {
    for (const t of this.tokens) this.physics.fling(t, (Math.random() - 0.5) * 6, -6);
    for (const r of this.bucket) this.physics.fling(r, (Math.random() - 0.5) * 6, -6);
    this.tokens = [];
    this.bucket = [];
  }

  resetStats() {
    this.allowed = 0;
    this.rejected = 0;
  }

  sendBurst() {
    for (let i = 0; i < 12; i++) this.request(i * 45);
    this.log('Burst of 12: the bucket absorbs what it can, the rest are rejected', 'hint');
  }

  // ---- request flow ---------------------------------------------------------

  newBall(color) {
    const body = this.physics.circle(150 + Math.random() * 30, 130, 12, { fill: color, stroke: Theme.bg, strokeWeight: 1 }, { restitution: 0.1, friction: 0.05, density: 0.003 });
    this.physics.freeze(body);
    return body;
  }

  async request(delay = 0) {
    const body = this.newBall(Theme.accent);
    this.inflight++;
    this.inRate.add();
    if (delay) await this.wait(delay);
    await this.physics.moveTo(this.anim, body, this.box.x - 70, this.box.y - 40, 360, { arc: 40 });

    if (this.algo === 'leaky') {
      if (this.bucket.length >= this.burst) {
        this.reject(body);
      } else {
        this.bucket.push(body);
        await this.physics.moveTo(this.anim, body, this.box.x + this.box.w / 2 + (Math.random() - 0.5) * 60, this.box.y - 10, 260);
        this.physics.release(body);
      }
      this.inflight--;
      return;
    }

    const ok = this.algo === 'token' ? this.takeToken() : this.countWindow();
    if (ok) await this.pass(body);
    else this.reject(body);
    this.inflight--;
  }

  takeToken() {
    if (!this.tokens.length) return false;
    // spend the token closest to the top of the pile
    const token = this.tokens.reduce((a, b) => (b.position.y < a.position.y ? b : a));
    this.tokens.splice(this.tokens.indexOf(token), 1);
    token.style.fill = Theme.green;
    this.physics.fling(token, 6, -9, 0.3);
    return true;
  }

  countWindow() {
    if (this.windowCount >= this.limit) return false;
    this.windowCount++;
    return true;
  }

  async pass(body) {
    this.allowed++;
    this.okRate.add();
    body.style.fill = Theme.green;
    if (this.algo === 'fixed') {
      // allowed requests pile up inside the window box
      await this.physics.moveTo(this.anim, body, this.box.x + this.box.w / 2 + (Math.random() - 0.5) * 60, this.box.y - 10, 240);
      this.physics.release(body);
      return;
    }
    await this.physics.moveTo(this.anim, body, this.service.x + this.service.w / 2, this.service.y + this.service.h / 2, 420, { arc: 50 });
    this.physics.fling(body, 8, -6, 0.2);
  }

  reject(body) {
    this.rejected++;
    body.style.fill = Theme.red;
    // keep the bin from filling the screen: oldest rejects disappear
    this.binPile.push(body);
    while (this.binPile.length > 22) this.physics.remove(this.binPile.shift());
    this.physics.moveTo(this.anim, body, this.bin.x + this.bin.w / 2 + (Math.random() - 0.5) * 80, this.bin.y - 20, 420, { arc: -30 }).then(() => this.physics.release(body));
    if (this.anim.time - (this.lastLog || -3000) > 2000) {
      this.lastLog = this.anim.time;
      this.log('429 Too Many Requests', 'warn');
    }
  }

  // ---- simulation -----------------------------------------------------------

  update(dt) {
    if (dt <= 0) return;
    this.flow += dt * 0.05;
    this.inRate.tick(dt);
    this.okRate.tick(dt);
    this.arrivals.rate = this.rate;
    this.arrivals.tick(dt, () => {
      if (this.inflight < 20) this.request();
    });

    if (this.algo === 'token') {
      // refill: one token per 1/limit seconds, up to the capacity
      this.drainLeft -= dt;
      if (this.drainLeft <= 0) {
        this.drainLeft = 1000 / this.limit;
        if (this.tokens.length < this.burst) {
          const t = this.physics.circle(this.box.x + this.box.w / 2 + (Math.random() - 0.5) * 70, this.box.y - 30, 11, { fill: Theme.yellow }, { restitution: 0.15, friction: 0.05, density: 0.002 });
          this.tokens.push(t);
        }
      }
      this.tokens = this.tokens.filter((t) => t.position.y < this.H + 100);
    } else if (this.algo === 'leaky') {
      // drain one request per 1/limit seconds, straight through the hole
      this.drainLeft -= dt;
      if (this.drainLeft <= 0 && this.bucket.length) {
        this.drainLeft = 1000 / this.limit;
        const lowest = this.bucket.reduce((a, b) => (b.position.y > a.position.y ? b : a));
        this.bucket.splice(this.bucket.indexOf(lowest), 1);
        lowest.style.fill = Theme.green;
        this.allowed++;
        this.okRate.add();
        this.physics.fling(lowest, 1.5, 4, 0);
      }
    } else {
      this.windowLeft -= dt;
      if (this.windowLeft <= 0) {
        this.windowLeft = this.windowMs;
        this.prevCount = this.windowCount;
        this.windowCount = 0;
        this.flushWindow();
      }
    }

    this.setStats({
      allowed: this.allowed,
      rejected: this.rejected,
      'in (req/s)': this.inRate.rate.toFixed(1),
      'out (req/s)': this.okRate.rate.toFixed(1),
      [this.algo === 'token' ? 'tokens' : this.algo === 'leaky' ? 'bucket' : 'window']:
        this.algo === 'token' ? `${this.tokens.length}/${this.burst}` : this.algo === 'leaky' ? `${this.bucket.length}/${this.burst}` : `${this.windowCount}/${this.limit}`,
    });
  }

  // Empty the window box when the counter resets.
  flushWindow() {
    for (const b of Composite.allBodies(this.physics.world)) {
      if (b.isStatic || b.cull || b.style?.kind !== 'circle') continue;
      if (b.position.x > this.box.x && b.position.x < this.box.x + this.box.w && b.position.y > this.box.y) {
        this.physics.fling(b, 7, -5, 0.2);
      }
    }
  }

  // ---- drawing --------------------------------------------------------------

  draw(p) {
    const b = this.box;
    Flow.box(p, { x: 60, y: 60, w: 170, h: 60, title: 'CLIENTS', color: Theme.green, sub: `${this.inRate.rate.toFixed(1)} req/s` });
    Flow.pipe(p, 230, 90, b.x - 70, b.y - 40, { flow: this.flow });

    // limiter body
    p.push();
    p.noStroke();
    p.fill(255, 255, 255, 6);
    p.rect(b.x, b.y, b.w, b.h);
    p.pop();

    const titles = { token: 'TOKEN BUCKET', leaky: 'LEAKY BUCKET', fixed: 'FIXED WINDOW' };
    Draw.label(p, titles[this.algo], b.x + b.w / 2, b.y - 120, { color: Theme.yellow, size: 16, bold: true });

    if (this.algo === 'token') {
      Draw.label(p, `refill ${this.limit}/s · capacity ${this.burst}`, b.x + b.w / 2, b.y - 98, { size: 12 });
      Flow.pipe(p, b.x + b.w / 2, b.y - 84, b.x + b.w / 2, b.y - 20, { weight: 10, color: Theme.yellow, flow: this.flow * 2 });
      Draw.label(p, `${this.tokens.length}/${this.burst} tokens`, b.x + b.w / 2, b.y + b.h + 30, { color: Theme.yellow, size: 14, bold: true });
      Draw.label(p, 'one token = one request', b.x + b.w / 2, b.y + b.h + 48, { size: 11 });
    } else if (this.algo === 'leaky') {
      Draw.label(p, `leaks ${this.limit}/s · capacity ${this.burst}`, b.x + b.w / 2, b.y - 98, { size: 12 });
      Draw.label(p, `${this.bucket.length}/${this.burst} waiting`, b.x - 24, b.y + b.h - 10, { align: 'right', color: Theme.accent, size: 14, bold: true });
      // the hole and the drain pipe
      p.push();
      p.noStroke();
      p.fill(Theme.bg);
      p.rect(b.x + b.w / 2 - 20, b.y + b.h, 40, 16);
      p.pop();
      Flow.pipe(p, b.x + b.w / 2, b.y + b.h + 16, b.x + b.w / 2, b.y + b.h + 90, { weight: 10, flow: this.flow * 2, color: Theme.green });
      Flow.pipe(p, b.x + b.w / 2, b.y + b.h + 90, this.service.x, this.service.y + this.service.h / 2 + 40, { weight: 10, flow: this.flow * 2, color: Theme.green });
      Draw.label(p, 'constant output rate', b.x + b.w / 2, b.y + b.h + 118, { size: 11, color: Theme.green });
    } else {
      Draw.label(p, `${this.limit} requests per ${this.windowMs / 1000}s window`, b.x + b.w / 2, b.y - 98, { size: 12 });
      Draw.label(p, `${this.windowCount}/${this.limit} used`, b.x + b.w / 2, b.y + b.h + 30, { color: this.windowCount >= this.limit ? Theme.red : Theme.green, size: 15, bold: true });
      Flow.meter(p, b.x, b.y + b.h + 44, b.w, 8, 1 - this.windowLeft / this.windowMs, Theme.accent);
      Draw.label(p, `window resets in ${(this.windowLeft / 1000).toFixed(1)}s`, b.x + b.w / 2, b.y + b.h + 66, { size: 11 });
      Draw.label(p, `previous window: ${this.prevCount}`, b.x + b.w / 2, b.y - 78, { size: 11, color: Theme.dim });
      if (this.prevCount + this.windowCount > this.limit) {
        Draw.label(p, `⚠ ${this.prevCount + this.windowCount} allowed across the boundary (limit ${this.limit})`, b.x + b.w / 2, this.H - 60, { size: 13, color: Theme.orange, bold: true });
      }
    }

    // service + reject bin
    Flow.box(p, { x: this.service.x, y: this.service.y, w: this.service.w, h: this.service.h, title: 'SERVICE', color: Theme.green, sub: `${this.okRate.rate.toFixed(1)} req/s allowed` });
    if (this.algo !== 'leaky') Flow.pipe(p, b.x + b.w + 14, b.y + 30, this.service.x, this.service.y + this.service.h / 2, { flow: this.flow, color: Theme.green });
    p.push();
    p.noStroke();
    p.fill(248, 113, 113, 16);
    p.rect(this.bin.x, this.bin.y, this.bin.w, this.bin.h, 6);
    p.pop();
    Draw.label(p, '429 rejected', this.bin.x + this.bin.w / 2, this.bin.y - 16, { color: Theme.red, size: 13, bold: true });
    Draw.label(p, `${this.rejected}`, this.bin.x + this.bin.w / 2, this.bin.y + this.bin.h + 22, { color: Theme.red, size: 16, bold: true });

    this.physics.render(p);

    Flow.legend(p, 70, this.H - 24, [
      ['request', Theme.accent],
      ['token', Theme.yellow],
      ['allowed', Theme.green],
      ['429', Theme.red],
    ]);
  }
}
