// Message queues: producers drop messages onto the queue, consumers pull them
// off one at a time. Produce faster than you consume and the backlog — and the
// consumer lag — grows in front of you.
class MessageQueueScene extends Scene {
  static id = 'message-queue';
  static title = 'Message Queues';
  static nav = 'async work, backlog, DLQ';
  static group = 'System Design';
  static subtitle = 'Producers and consumers are decoupled by a queue. Scale consumers until the backlog stops growing.';

  static VISIBLE = 15; // messages drawn on the belt; the rest are only counted
  static SLOT = 37;
  static MAX_ATTEMPTS = 3;

  setup() {
    this.rate = 3;
    this.consumers = 2;
    this.service = 700;
    this.failRate = 0.1;
    this.consumersOff = false;
    this.nextId = 1;
    this.produced = 0;
    this.consumed = 0;
    this.retried = 0;
    this.flow = 0;
    this.queue = []; // FIFO of { id, t, attempts, body }
    this.dlq = [];

    this.arrivals = new Arrivals(this.rate);
    this.inRate = new RateMeter();
    this.outRate = new RateMeter();
    this.lag = new LatencyStat();

    // the belt: messages hold their slot and slide forward when one leaves
    this.beltY = 348;
    this.chan = { x1: 150, cx: 430, len: 580 };
    this.gateX = 712;
    this.physics.wall(this.chan.cx, this.beltY + 22, this.chan.len, 10, { fill: Theme.line });
    this.physics.wall(this.gateX, this.beltY - 28, 12, 80, { fill: Theme.muted });

    // dead letter bin
    this.dlqBox = { x: 780, y: 478, w: 190, h: 88 };
    this.physics.wall(this.dlqBox.x - 4, this.dlqBox.y + this.dlqBox.h / 2, 8, this.dlqBox.h, { fill: Theme.red });
    this.physics.wall(this.dlqBox.x + this.dlqBox.w + 4, this.dlqBox.y + this.dlqBox.h / 2, 8, this.dlqBox.h, { fill: Theme.red });
    this.physics.wall(this.dlqBox.x + this.dlqBox.w / 2, this.dlqBox.y + this.dlqBox.h + 4, this.dlqBox.w + 16, 8, { fill: Theme.red });

    this.workers = Array.from({ length: 4 }, (_, i) => ({ i, x: 768, y: 84 + i * 88, w: 192, h: 70, busy: null, done: 0, failed: 0 }));

    this.codes = {
      queue: [
        '// producer: fire and forget',
        'await queue.publish("orders", { id, items });',
        '',
        '// consumer: pull, work, acknowledge',
        'for await (const msg of queue.consume("orders")) {',
        '  try {',
        '    await handle(msg);',
        '    await msg.ack();        // done, remove it',
        '  } catch (err) {',
        '    await msg.nack();       // retry later',
        '    if (msg.attempts >= 3)',
        '      await deadLetter.publish(msg);',
        '  }',
        '}',
      ],
    };
    this.code('queue');
    this.log('Producing 3/s with 2 consumers. Try "Pause consumers" and watch the lag.', 'hint');
  }

  controls() {
    return [
      { type: 'range', id: 'rate', label: 'Produce (msg/s)', min: 0, max: 12, step: 1, value: 3, onInput: (v) => (this.rate = v) },
      { type: 'range', id: 'consumers', label: 'Consumers', min: 0, max: 4, step: 1, value: 2, onInput: (v) => (this.consumers = v) },
      { type: 'range', id: 'service', label: 'Work per msg (ms)', min: 200, max: 1600, step: 100, value: 700, onInput: (v) => (this.service = v) },
      { type: 'range', id: 'fail', label: 'Failures (%)', min: 0, max: 40, step: 5, value: 10, onInput: (v) => (this.failRate = v / 100) },
      { type: 'sep' },
      { type: 'button', label: 'Burst +20', lock: false, action: () => this.burst() },
      { type: 'button', label: 'Pause consumers', lock: false, variant: 'danger', action: () => this.togglePause() },
      { type: 'button', label: 'Drain DLQ', variant: 'ghost', lock: false, action: () => this.clearDlq() },
    ];
  }

  about() {
    return `
      <p>A <b>queue</b> decouples producers from consumers. The producer returns as soon as the message is stored, and consumers do the slow work later — that is how you absorb spikes instead of dropping them.</p>
      <p>Throughput is set by the consumers: <code>consumers / workPerMessage</code>. While that is below the produce rate the <b>backlog</b> and the <b>consumer lag</b> (age of the oldest message) grow. The fix is more consumers, faster handlers, or slowing producers down (backpressure).</p>
      <p>Delivery is usually <b>at least once</b>: a failed message is redelivered, so handlers must be <b>idempotent</b>. After a few attempts it goes to the <b>dead letter queue</b> for inspection instead of blocking the queue forever.</p>
      <p>Queue depth and lag are the two metrics worth alerting on. Kafka, SQS, RabbitMQ and Pub/Sub all expose them.</p>`;
  }

  complexityTitle() {
    return 'Rules of thumb';
  }

  complexity() {
    return [
      ['Consumer throughput', 'c / t', 'consumers ÷ work per message'],
      ['Backlog grows while', 'λ > c / t', 'add consumers or speed up work'],
      ['Delivery', 'at least once', 'handlers must be idempotent'],
      ['Retries', '3 then DLQ', 'with exponential backoff'],
      ['Alert on', 'lag & depth', 'not on CPU'],
    ];
  }

  // ---- geometry -------------------------------------------------------------

  // slot 0 is at the gate, the rest line up behind it
  slotX(i) {
    return this.gateX - 28 - i * MessageQueueScene.SLOT;
  }

  // ---- simulation -----------------------------------------------------------

  produce() {
    const msg = { id: this.nextId++, t: this.anim.time, attempts: 0, body: null };
    this.queue.push(msg);
    this.produced++;
    this.inRate.add();
    this.materialize();
  }

  // Only the first few messages are drawn; the rest are just counted.
  materialize() {
    this.queue.forEach((m, i) => {
      if (i >= MessageQueueScene.VISIBLE) {
        if (m.body) {
          this.physics.fling(m.body, 0, -1, 0);
          m.body = null;
        }
        return;
      }
      if (!m.body) {
        m.body = this.physics.tile(this.slotX(i), this.beltY - 130, 34, 28, m.id % 100, { fill: Theme.colorForValue(m.id), textSize: 13, radius: 5 });
        this.physics.freeze(m.body);
      }
    });
  }

  // Ease every queued message toward its slot: the line visibly moves up.
  advance(dt) {
    const k = 1 - Math.exp(-dt / 110);
    this.queue.forEach((m, i) => {
      if (!m.body || i >= MessageQueueScene.VISIBLE) return;
      const b = m.body;
      Body.setPosition(b, { x: lerp(b.position.x, this.slotX(i), k), y: lerp(b.position.y, this.beltY, k) });
    });
  }

  burst() {
    for (let i = 0; i < 20; i++) this.produce();
    this.log('Burst of 20 messages — the queue absorbs it, consumers catch up later', 'hint');
  }

  togglePause() {
    this.consumersOff = !this.consumersOff;
    const btn = [...document.querySelectorAll('#controls button')].find((b) => b.textContent.includes('consumers'));
    if (btn) btn.textContent = this.consumersOff ? 'Resume consumers' : 'Pause consumers';
    this.log(this.consumersOff ? 'Consumers stopped — producers keep going, backlog grows' : 'Consumers back online — they work through the backlog', this.consumersOff ? 'warn' : 'ok');
  }

  clearDlq() {
    for (const m of this.dlq) this.physics.fling(m.body, 6, -8, 0.2);
    this.log(`Drained ${this.dlq.length} dead-lettered message${this.dlq.length === 1 ? '' : 's'}`);
    this.dlq = [];
  }

  async consume(w, msg) {
    w.busy = { msg, left: this.service, total: this.service, state: 'work' };
    const body = msg.body;
    if (body) {
      body.style.glow = Theme.yellow;
      this.physics.moveTo(this.anim, body, w.x - 26, w.y + w.h / 2, 320, { arc: 40 });
    }
    await this.wait(this.service);
    if (!w.busy) return; // scene reset

    const failed = Math.random() < this.failRate;
    msg.attempts++;
    if (!failed) {
      w.done++;
      this.consumed++;
      this.outRate.add();
      this.lag.add(this.anim.time - msg.t);
      if (body) {
        body.style.fill = Theme.green;
        body.style.glow = Theme.green;
        this.physics.fling(body, 9, -6, 0.2);
      }
      w.busy = null;
      return;
    }

    w.failed++;
    if (body) body.style.fill = Theme.red;
    if (msg.attempts >= MessageQueueScene.MAX_ATTEMPTS) {
      this.dlq.push(msg);
      while (this.dlq.length > 12) {
        const old = this.dlq.shift();
        if (old.body) this.physics.remove(old.body);
      }
      if (body) {
        body.style.glow = Theme.red;
        this.physics.moveTo(this.anim, body, this.dlqBox.x + 30 + Math.random() * (this.dlqBox.w - 60), this.dlqBox.y + 10, 400, { arc: 30 }).then(() => this.physics.release(body));
      }
      this.log(`msg ${msg.id} failed ${msg.attempts}× → dead letter queue`, 'warn');
    } else {
      // at-least-once: put it back at the tail of the queue
      this.retried++;
      this.queue.push(msg);
      this.log(`msg ${msg.id} failed (attempt ${msg.attempts}) → redelivered`, 'step');
      if (body) {
        body.style.fill = Theme.orange;
        this.physics.fling(body, -9, -7, -0.2);
        msg.body = null; // it re-enters the belt at the tail
      }
    }
    w.busy = null;
  }

  update(dt) {
    if (dt <= 0) return;
    this.flow += dt * 0.05;
    this.advance(dt);
    this.inRate.tick(dt);
    this.outRate.tick(dt);
    this.arrivals.rate = this.rate;
    this.arrivals.tick(dt, () => this.produce());

    for (const w of this.workers) {
      if (w.busy) {
        w.busy.left -= dt;
        continue;
      }
      if (w.i >= this.consumers || this.consumersOff) continue;
      // pull the oldest message that has arrived at the gate
      const idx = this.queue.findIndex((m) => m.body && Math.abs(m.body.position.x - this.slotX(0)) < 14);
      if (idx === -1) continue;
      const [msg] = this.queue.splice(idx, 1);
      this.consume(w, msg);
      this.materialize();
    }

    this.materialize();
    const oldest = this.queue[0];
    this.setStats({
      backlog: this.queue.length,
      'in (msg/s)': this.inRate.rate.toFixed(1),
      'out (msg/s)': this.outRate.rate.toFixed(1),
      lag: oldest ? Flow.ms(this.anim.time - oldest.t) : '0 ms',
      DLQ: this.dlq.length,
      retries: this.retried,
    });

    if (this.queue.length > 30 && this.anim.time - (this.lastWarn || -20000) > 8000) {
      this.lastWarn = this.anim.time;
      this.log(`Backlog is ${this.queue.length} and growing — consumers can only do ${(this.consumers * 1000) / this.service} msg/s`, 'warn');
    }
  }

  // ---- drawing --------------------------------------------------------------

  draw(p) {
    const capacity = (this.consumers * 1000) / this.service;
    Flow.box(p, { x: 60, y: 60, w: 190, h: 66, title: 'PRODUCERS', color: Theme.green, sub: `${this.inRate.rate.toFixed(1)} msg/s` });
    Flow.pipe(p, 155, 126, this.slotX(MessageQueueScene.VISIBLE - 1), this.beltY - 130, { flow: this.flow });
    // belt surface
    Flow.pipe(p, this.chan.x1 - 14, this.beltY + 28, this.gateX - 6, this.beltY + 28, { weight: 8, color: Theme.surface2, flow: this.flow * 4 });

    Draw.label(p, 'QUEUE (FIFO)', this.chan.x1 - 10, this.beltY - 150, { align: 'left', color: Theme.accent, size: 15, bold: true });
    Draw.label(p, `backlog ${this.queue.length}${this.queue.length > MessageQueueScene.VISIBLE ? ` (showing ${MessageQueueScene.VISIBLE})` : ''}`, this.chan.x1 - 10, this.beltY - 130, { align: 'left', size: 12 });

    // consumers
    for (const w of this.workers) {
      const on = w.i < this.consumers && !this.consumersOff;
      const state = w.busy ? 'working' : on ? 'idle' : this.consumersOff ? 'paused' : 'off';
      Flow.box(p, {
        x: w.x,
        y: w.y,
        w: w.w,
        h: w.h,
        title: `CONSUMER ${w.i + 1}`,
        color: w.busy ? Theme.yellow : on ? Theme.accent : Theme.dim,
        dim: !on && !w.busy,
        sub: `${state} · ok ${w.done} · err ${w.failed}`,
      });
      if (w.busy) Flow.meter(p, w.x + 20, w.y + w.h - 14, w.w - 40, 6, 1 - w.busy.left / w.busy.total, Theme.yellow);
      if (w.i < this.consumers) Flow.pipe(p, this.gateX + 8, this.beltY - 10, w.x, w.y + w.h / 2, { weight: 5, flow: this.flow, active: on });
    }

    // dead letter queue
    const d = this.dlqBox;
    p.push();
    p.noStroke();
    p.fill(248, 113, 113, 18);
    p.rect(d.x, d.y, d.w, d.h, 6);
    p.pop();
    Draw.label(p, `DEAD LETTER QUEUE · ${this.dlq.length}`, d.x + d.w / 2, d.y - 14, { color: Theme.red, size: 12, bold: true });

    this.physics.render(p);

    // throughput comparison
    const y = this.H - 40;
    Draw.label(p, `produce ${this.rate}/s`, 70, y, { align: 'left', size: 13, color: Theme.green });
    Flow.meter(p, 70, y + 12, 200, 8, this.rate / 12, Theme.green);
    Draw.label(p, `consume capacity ${capacity.toFixed(1)}/s`, 320, y, { align: 'left', size: 13, color: capacity < this.rate ? Theme.red : Theme.cyan });
    Flow.meter(p, 320, y + 12, 200, 8, capacity / 12, capacity < this.rate ? Theme.red : Theme.cyan);
    if (capacity < this.rate) Draw.label(p, '← backlog grows', 540, y + 8, { align: 'left', size: 13, color: Theme.red, bold: true });
  }
}
