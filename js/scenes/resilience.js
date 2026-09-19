// Resilience: what a client does when a dependency misbehaves. Timeouts stop
// waiting, retries multiply load, backoff spreads them out, and a circuit
// breaker stops hammering a service that is already down.
class ResilienceScene extends Scene {
  static id = 'resilience';
  static title = 'Timeouts & Retries';
  static nav = 'backoff, circuit breaker';
  static group = 'System Design';
  static subtitle = 'A dependency starts failing. Naive retries make it worse; a circuit breaker gives it room to recover.';

  static OPEN_MS = 4000; // how long the breaker stays open before probing

  setup() {
    this.rate = 3;
    this.failRate = 0.25;
    this.latency = 500;
    this.timeout = 900;
    this.retryMode = 'backoff';
    this.breakerOn = true;
    this.outage = 0;

    this.succeeded = 0;
    this.failed = 0;
    this.retries = 0;
    this.timeouts = 0;
    this.shortCircuited = 0;
    this.wasted = 0;
    this.inflight = 0;
    this.flow = 0;

    this.breaker = { state: 'closed', fails: 0, left: 0, probe: false };
    this.client = { x: 60, y: 250, w: 180, h: 80 };
    this.gate = { x: 430, y: 170, w: 16, h: 270 };
    this.service = { x: 660, y: 230, w: 240, h: 120 };
    this.bin = { x: 330, y: 470, w: 220, h: 96 };
    this.physics.wall(this.bin.x - 5, this.bin.y + this.bin.h / 2, 10, this.bin.h, { fill: Theme.red });
    this.physics.wall(this.bin.x + this.bin.w + 5, this.bin.y + this.bin.h / 2, 10, this.bin.h, { fill: Theme.red });
    this.physics.wall(this.bin.x + this.bin.w / 2, this.bin.y + this.bin.h + 5, this.bin.w + 20, 10, { fill: Theme.red });

    this.arrivals = new Arrivals(this.rate);
    this.clientRate = new RateMeter();
    this.serviceRate = new RateMeter();
    this.okRate = new RateMeter();
    this.userLatency = new LatencyStat();
    this.binPile = [];

    this.codes = {
      retry: [
        '// retry with exponential backoff + full jitter',
        'async function call(fn, attempts = 3) {',
        '  for (let i = 0; i < attempts; i++) {',
        '    try {',
        '      return await withTimeout(fn(), 900);',
        '    } catch (err) {',
        '      if (!isRetryable(err) || i === attempts - 1) throw err;',
        '      const cap = 200 * 2 ** i;             // 200, 400, 800…',
        '      await sleep(Math.random() * cap);     // jitter!',
        '    }',
        '  }',
        '}',
        '',
        '// without jitter every client retries in lockstep',
        '// and the service gets synchronised waves of load',
      ],
      breaker: [
        '// circuit breaker: stop calling a service that is down',
        'if (state === "open") {',
        '  if (Date.now() < openUntil) throw new Error("circuit open");',
        '  state = "half-open";          // let one probe through',
        '}',
        '',
        'try {',
        '  const res = await withTimeout(call(), timeout);',
        '  fails = 0; state = "closed";  // recovered',
        '  return res;',
        '} catch (err) {',
        '  if (++fails >= 5 || state === "half-open") {',
        '    state = "open";',
        '    openUntil = Date.now() + 4000;',
        '  }',
        '  throw err;',
        '}',
      ],
    };
    this.code('retry');
    this.log('Press "Cause an outage" and compare retry policies with the breaker on and off.', 'hint');
  }

  controls() {
    return [
      { type: 'range', id: 'rate', label: 'Traffic (req/s)', min: 0, max: 10, step: 1, value: 3, onInput: (v) => (this.rate = v) },
      { type: 'range', id: 'fail', label: 'Failure rate (%)', min: 0, max: 100, step: 5, value: 25, onInput: (v) => (this.failRate = v / 100) },
      { type: 'range', id: 'latency', label: 'Service latency (ms)', min: 100, max: 2000, step: 100, value: 500, onInput: (v) => (this.latency = v) },
      { type: 'range', id: 'timeout', label: 'Client timeout (ms)', min: 200, max: 2500, step: 100, value: 900, onInput: (v) => (this.timeout = v) },
      { type: 'break' },
      {
        type: 'select',
        id: 'retry',
        label: 'Retry policy',
        value: 'backoff',
        options: [
          { value: 'none', label: 'no retries' },
          { value: 'immediate', label: '3 immediate retries' },
          { value: 'backoff', label: '3 retries, backoff + jitter' },
        ],
        onChange: (v) => {
          this.retryMode = v;
          this.code('retry');
          if (v === 'immediate') this.log('Immediate retries triple the load on a service that is already struggling', 'warn');
        },
      },
      { type: 'button', label: 'Circuit breaker: ON', lock: false, action: () => this.toggleBreaker() },
      { type: 'button', label: 'Cause an outage', variant: 'danger', lock: false, action: () => this.causeOutage() },
      { type: 'button', label: 'Reset stats', variant: 'ghost', lock: false, action: () => this.resetStats() },
    ];
  }

  about() {
    return `
      <p>Every remote call needs a <b>timeout</b>. Without one, a slow dependency turns into exhausted threads/connections on <i>your</i> side and the failure spreads upstream.</p>
      <p><b>Retries</b> fix transient blips, but they multiply load exactly when a service is unhealthy — a retry storm. Retry only idempotent, retryable failures, cap the attempts, and use <b>exponential backoff with jitter</b> so clients don't synchronise.</p>
      <p>A <b>circuit breaker</b> watches the failure rate. After enough failures it <b>opens</b> and fails fast without calling the service at all, which sheds load and lets it recover. After a cooldown it goes <b>half-open</b> and lets one probe through: success closes it, failure opens it again.</p>
      <p>Related patterns: bulkheads (isolated pools so one dependency can't drown the others), load shedding, hedged requests, and a fallback/degraded response so the user still gets something.</p>
      <p>Watch the <b>service load</b> meter: with no breaker and immediate retries it climbs well above the incoming traffic.</p>`;
  }

  complexityTitle() {
    return 'Rules of thumb';
  }

  complexity() {
    return [
      ['Timeout', '< p99.9', 'never wait forever'],
      ['Retries', '2–3 max', 'idempotent calls only'],
      ['Backoff', '2ⁿ + jitter', 'never a fixed delay'],
      ['Breaker opens', '~5 failures', 'fail fast, shed load'],
      ['Half-open', '1 probe', 'test before restoring'],
    ];
  }

  // ---- controls -------------------------------------------------------------

  toggleBreaker() {
    this.breakerOn = !this.breakerOn;
    const btn = [...document.querySelectorAll('#controls button')].find((b) => b.textContent.startsWith('Circuit breaker'));
    if (btn) btn.textContent = `Circuit breaker: ${this.breakerOn ? 'ON' : 'OFF'}`;
    this.code(this.breakerOn ? 'breaker' : 'retry');
    if (!this.breakerOn) this.breaker = { state: 'closed', fails: 0, left: 0, probe: false };
    this.log(this.breakerOn ? 'Circuit breaker enabled' : 'Circuit breaker disabled — every request reaches the service', this.breakerOn ? 'ok' : 'warn');
  }

  causeOutage() {
    this.outage = 8000;
    this.setRange('fail', 100);
    this.log('The dependency is down for a few seconds', 'warn');
  }

  resetStats() {
    this.succeeded = this.failed = this.retries = this.timeouts = this.shortCircuited = this.wasted = 0;
    this.userLatency.reset();
  }

  // ---- request flow ---------------------------------------------------------

  ball(x, y, color) {
    const b = this.physics.circle(x, y, 11, { fill: color, stroke: Theme.bg, strokeWeight: 1 }, { restitution: 0.2, friction: 0.05, density: 0.003 });
    this.physics.freeze(b);
    return b;
  }

  async request() {
    const start = this.anim.time;
    const body = this.ball(this.client.x + this.client.w - 10, this.client.y + 20 + Math.random() * 40, Theme.accent);
    this.inflight++;
    this.clientRate.add();

    const maxAttempts = this.retryMode === 'none' ? 1 : 4;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        this.retries++;
        body.style.fill = Theme.orange;
        if (this.retryMode === 'backoff') {
          // exponential backoff with full jitter, drawn as a wait next to the client
          const cap = 200 * Math.pow(2, attempt - 1);
          const delay = Math.random() * cap;
          await this.physics.moveTo(this.anim, body, this.client.x + this.client.w + 40, this.client.y + 120, 260, { arc: 30 });
          await this.wait(delay);
        } else {
          await this.physics.moveTo(this.anim, body, this.client.x + this.client.w + 20, this.client.y + 40, 160);
        }
      }

      const outcome = await this.callService(body);
      if (outcome === 'ok') {
        this.succeeded++;
        this.okRate.add();
        this.userLatency.add(this.anim.time - start);
        this.inflight--;
        this.physics.fling(body, 9, -6, 0.2);
        return;
      }
      if (outcome === 'short') {
        // the breaker refused instantly: retrying now is pointless
        break;
      }
    }

    this.failed++;
    this.userLatency.add(this.anim.time - start);
    this.inflight--;
    body.style.fill = Theme.red;
    this.physics.moveTo(this.anim, body, this.bin.x + this.bin.w / 2 + (Math.random() - 0.5) * 100, this.bin.y - 20, 380, { arc: 30 }).then(() => {
      this.physics.release(body);
      this.binPile.push(body);
      while (this.binPile.length > 20) this.physics.remove(this.binPile.shift());
    });
  }

  // Returns 'ok' | 'fail' | 'timeout' | 'short'
  async callService(body) {
    if (this.breakerOn && this.breaker.state === 'open') {
      this.shortCircuited++;
      body.style.fill = Theme.purple;
      await this.physics.moveTo(this.anim, body, this.gate.x - 30, this.gate.y + 80 + Math.random() * 100, 300);
      this.physics.fling(body, -4, -6, 0.3);
      if (this.anim.time - (this.lastShortLog || -4000) > 2500) {
        this.lastShortLog = this.anim.time;
        this.log('circuit open → failing fast without touching the service', 'hint');
      }
      return 'short';
    }

    const halfOpen = this.breakerOn && this.breaker.state === 'half-open';
    if (halfOpen) this.breaker.probe = true;

    this.serviceRate.add();
    await this.physics.moveTo(this.anim, body, this.service.x + 40, this.service.y + 30 + Math.random() * 60, 420, { arc: 40 });

    const willFail = Math.random() < this.failRate;
    const serviceTime = this.latency * (willFail ? 1.6 : 1);
    const timedOut = serviceTime > this.timeout;
    await this.wait(Math.min(serviceTime, this.timeout));

    if (timedOut) {
      this.timeouts++;
      this.wasted++;
      this.onFailure();
      body.style.fill = Theme.orange;
      if (this.anim.time - (this.lastTimeoutLog || -4000) > 2500) {
        this.lastTimeoutLog = this.anim.time;
        this.log(`timeout after ${Flow.ms(this.timeout)} — the client gives up, the service keeps working`, 'warn');
      }
      await this.physics.moveTo(this.anim, body, this.gate.x + 40, this.gate.y + 40, 300);
      return 'timeout';
    }
    if (willFail) {
      this.onFailure();
      body.style.fill = Theme.red;
      await this.physics.moveTo(this.anim, body, this.gate.x + 40, this.gate.y + 40, 300);
      return 'fail';
    }
    this.onSuccess();
    body.style.fill = Theme.green;
    return 'ok';
  }

  onFailure() {
    const b = this.breaker;
    b.fails++;
    if (!this.breakerOn) return;
    if (b.state === 'half-open' || b.fails >= 5) {
      if (b.state !== 'open') this.log(`circuit OPEN after ${b.fails} failures — requests fail fast for ${ResilienceScene.OPEN_MS / 1000}s`, 'warn');
      b.state = 'open';
      b.left = ResilienceScene.OPEN_MS;
      b.probe = false;
    }
  }

  onSuccess() {
    const b = this.breaker;
    if (b.state === 'half-open') this.log('probe succeeded → circuit CLOSED, traffic resumes', 'ok');
    b.fails = 0;
    b.state = 'closed';
    b.probe = false;
  }

  update(dt) {
    if (dt <= 0) return;
    this.flow += dt * 0.05;
    this.clientRate.tick(dt);
    this.serviceRate.tick(dt);
    this.okRate.tick(dt);

    if (this.outage > 0) {
      this.outage -= dt;
      if (this.outage <= 0) {
        this.setRange('fail', 5);
        this.log('The dependency recovered (5% failures)', 'ok');
      }
    }

    if (this.breakerOn && this.breaker.state === 'open') {
      this.breaker.left -= dt;
      if (this.breaker.left <= 0) {
        this.breaker.state = 'half-open';
        this.breaker.fails = 4;
        this.log('circuit HALF-OPEN — letting one probe through', 'hint');
      }
    }

    this.arrivals.rate = this.rate;
    this.arrivals.tick(dt, () => {
      if (this.inflight < 24) this.request();
    });

    const total = this.succeeded + this.failed;
    this.setStats({
      success: `${total ? Math.round((this.succeeded / total) * 100) : 100}%`,
      'client req/s': this.clientRate.rate.toFixed(1),
      'service req/s': this.serviceRate.rate.toFixed(1),
      retries: this.retries,
      timeouts: this.timeouts,
      'fast-failed': this.shortCircuited,
      'user latency': Flow.ms(this.userLatency.avg),
    });
  }

  // ---- drawing --------------------------------------------------------------

  draw(p) {
    const c = this.client;
    const s = this.service;
    const g = this.gate;
    const state = this.breakerOn ? this.breaker.state : 'off';
    const stateColor = { closed: Theme.green, 'half-open': Theme.yellow, open: Theme.red, off: Theme.dim }[state];

    Flow.box(p, { x: c.x, y: c.y, w: c.w, h: c.h, title: 'CLIENT', color: Theme.accent, sub: `${this.clientRate.rate.toFixed(1)} req/s` });
    Draw.label(p, this.retryMode === 'none' ? 'no retries' : this.retryMode === 'immediate' ? '3 immediate retries' : '3 retries, backoff + jitter', c.x + c.w / 2, c.y + c.h + 20, { size: 12 });
    Draw.label(p, `timeout ${Flow.ms(this.timeout)}`, c.x + c.w / 2, c.y + c.h + 38, { size: 12, color: Theme.orange });

    Flow.pipe(p, c.x + c.w, c.y + 40, g.x, g.y + 140, { flow: this.flow, color: state === 'open' ? Theme.red : Theme.line });

    // the breaker itself: an open circuit blocks the path
    p.push();
    p.noStroke();
    p.fill(state === 'open' ? Theme.red : state === 'half-open' ? Theme.yellow : state === 'off' ? Theme.dim : Theme.green);
    p.drawingContext.globalAlpha = state === 'open' ? 0.9 : 0.35;
    p.rect(g.x, g.y, g.w, g.h, 4);
    p.pop();
    Draw.label(p, 'CIRCUIT', g.x + g.w / 2, g.y - 56, { color: stateColor, size: 13, bold: true });
    Draw.label(p, state.toUpperCase(), g.x + g.w / 2, g.y - 38, { color: stateColor, size: 15, bold: true });
    if (state === 'open') Draw.label(p, `retry in ${(this.breaker.left / 1000).toFixed(1)}s`, g.x + g.w / 2, g.y - 18, { color: Theme.red, size: 12 });
    if (state === 'closed') Draw.label(p, `${this.breaker.fails}/5 failures`, g.x + g.w / 2, g.y - 18, { color: Theme.muted, size: 12 });
    if (state === 'half-open') Draw.label(p, 'one probe allowed', g.x + g.w / 2, g.y - 18, { color: Theme.yellow, size: 12 });

    Flow.pipe(p, g.x + g.w, g.y + 140, s.x, s.y + s.h / 2, { flow: state === 'open' ? 0 : this.flow, color: state === 'open' ? Theme.red : Theme.line, active: state !== 'open' });

    const hurting = this.failRate > 0.5;
    Flow.box(p, {
      x: s.x,
      y: s.y,
      w: s.w,
      h: s.h,
      title: 'DEPENDENCY',
      color: hurting ? Theme.red : this.failRate > 0.15 ? Theme.orange : Theme.green,
      sub: `${Math.round(this.failRate * 100)}% failures · ${Flow.ms(this.latency)}`,
    });
    Draw.label(p, 'load', s.x + 30, s.y + s.h - 26, { align: 'left', size: 11 });
    Flow.meter(p, s.x + 70, s.y + s.h - 30, s.w - 100, 8, this.serviceRate.rate / 12, this.serviceRate.rate > this.clientRate.rate * 1.2 ? Theme.red : Theme.cyan);
    if (this.serviceRate.rate > this.clientRate.rate * 1.3 && this.clientRate.rate > 0) {
      Draw.label(p, `retry storm: ${(this.serviceRate.rate / Math.max(0.1, this.clientRate.rate)).toFixed(1)}× the client traffic`, s.x + s.w / 2, s.y - 22, { color: Theme.red, size: 13, bold: true });
    }
    if (this.outage > 0) Draw.label(p, `OUTAGE ${(this.outage / 1000).toFixed(1)}s`, s.x + s.w / 2, s.y + s.h + 26, { color: Theme.red, size: 14, bold: true });

    // failure bin
    p.push();
    p.noStroke();
    p.fill(248, 113, 113, 16);
    p.rect(this.bin.x, this.bin.y, this.bin.w, this.bin.h, 6);
    p.pop();
    Draw.label(p, `errors returned to the user: ${this.failed}`, this.bin.x + this.bin.w / 2, this.bin.y - 16, { color: Theme.red, size: 12, bold: true });

    this.physics.render(p);

    Flow.legend(p, 70, this.H - 16, [
      ['request', Theme.accent],
      ['retry', Theme.orange],
      ['fast fail', Theme.purple],
      ['error', Theme.red],
      ['ok', Theme.green],
    ]);
  }
}
