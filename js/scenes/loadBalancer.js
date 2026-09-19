// Load balancing: requests fall from the clients into the balancer, which
// throws each one into a server's queue. Full queues drop requests (503) and
// long queues show up directly as latency.
class LoadBalancerScene extends Scene {
  static id = 'load-balancer';
  static title = 'Load Balancing';
  static nav = 'distribute traffic, scale out';
  static group = 'System Design';
  static subtitle = 'One entry point, many servers. Raise the traffic until the queues fill and requests start failing.';

  static SLOTS = 5;
  static CAPACITY = 8;
  static SERVICE = 620; // ms of work per request on a healthy server

  setup() {
    this.tubeTop = 300;
    this.floorY = 548;
    this.lb = { x: 370, y: 150, w: 260, h: 62 };
    this.clientColors = [Theme.accent, Theme.cyan, Theme.pink, Theme.purple];

    this.algo = 'round-robin';
    this.rate = 5;
    this.count = 3;
    this.rr = 0;
    this.spike = 0;
    this.completed = 0;
    this.dropped = 0;
    this.flow = 0;

    this.arrivals = new Arrivals(this.rate);
    this.inRate = new RateMeter();
    this.outRate = new RateMeter();
    this.latency = new LatencyStat();

    this.servers = Array.from({ length: LoadBalancerScene.SLOTS }, (_, i) => {
      const x = 150 + i * 175;
      const w = 96;
      const h = this.floorY - this.tubeTop;
      this.physics.wall(x - w / 2 - 5, this.tubeTop + h / 2, 10, h, { fill: Theme.line });
      this.physics.wall(x + w / 2 + 5, this.tubeTop + h / 2, 10, h, { fill: Theme.line });
      this.physics.wall(x, this.floorY + 6, w + 20, 12, { fill: Theme.line });
      return { i, x, w, name: `web-${i + 1}`, status: 'up', queue: [], busy: null, processed: 0, dropped: 0, busyTime: 0 };
    });

    this.codes = {
      'round-robin': ['// Round robin: next server every time', 'pick(servers) {', '  const s = servers[this.i % servers.length];', '  this.i++;', '  return s;', '}', '', '// simple and fair, ignores how loaded a server is'],
      'least-connections': ['// Least connections: send to the shortest queue', 'pick(servers) {', '  return servers.reduce((a, b) =>', '    b.inflight < a.inflight ? b : a);', '}', '', '// adapts when some servers are slower than others'],
      random: ['// Random: cheap and surprisingly decent', 'pick(servers) {', '  return servers[Math.floor(Math.random() * servers.length)];', '}', '', '// "power of two choices": pick 2 at random,', '// use the less loaded one - almost as good as', '// least-connections, without global state'],
      weighted: ['// Weighted: bigger servers get more traffic', 'pick(servers) {', '  let r = Math.random() * total(servers);', '  for (const s of servers)', '    if ((r -= s.weight) <= 0) return s;', '}', '', '// weight = CPU size, or measured capacity'],
      'ip-hash': ['// IP hash: the same client always lands', '// on the same server (sticky sessions)', 'pick(servers, clientIp) {', '  return servers[hash(clientIp) % servers.length];', '}', '', '// keeps in-memory sessions working, but a', '// server going away reshuffles its clients'],
    };
    this.code(this.algo);
    this.log('Raise "Traffic" above the total capacity and watch queues fill up.', 'hint');
  }

  controls() {
    return [
      {
        type: 'select',
        id: 'algo',
        label: 'Algorithm',
        value: 'round-robin',
        options: [
          { value: 'round-robin', label: 'round robin' },
          { value: 'least-connections', label: 'least connections' },
          { value: 'random', label: 'random' },
          { value: 'weighted', label: 'weighted' },
          { value: 'ip-hash', label: 'IP hash (sticky)' },
        ],
        onChange: (v) => {
          this.algo = v;
          this.code(v);
          this.log(`Routing with ${v}`);
        },
      },
      { type: 'range', id: 'rate', label: 'Traffic (req/s)', min: 0, max: 24, step: 1, value: 5, onInput: (v) => (this.rate = v) },
      { type: 'range', id: 'servers', label: 'Servers', min: 1, max: LoadBalancerScene.SLOTS, step: 1, value: 3, onInput: (v) => this.setCount(v) },
      { type: 'sep' },
      { type: 'button', label: 'Traffic spike', lock: false, action: () => this.startSpike() },
      { type: 'button', label: 'Kill a server', variant: 'danger', lock: false, action: () => this.killServer() },
      { type: 'button', label: 'Degrade a server', variant: 'secondary', lock: false, action: () => this.degradeServer() },
      { type: 'button', label: 'Heal all', variant: 'secondary', lock: false, action: () => this.healAll() },
      { type: 'button', label: 'Reset stats', variant: 'ghost', lock: false, action: () => this.resetStats() },
    ];
  }

  about() {
    return `
      <p>A <b>load balancer</b> is the single address clients talk to. It spreads requests over a pool of identical servers, checks their health and takes unhealthy ones out of rotation.</p>
      <p>Each server works on one request at a time; the rest wait in its queue. That queue <i>is</i> the latency: with arrival rate λ and service rate μ per server, a pool of <code>k</code> servers is stable only while <code>λ &lt; k · μ</code>. Past that the queue grows without bound and requests are dropped (HTTP 503).</p>
      <p>Adding servers is <b>horizontal scaling</b>. Killing one shows why health checks matter: its in-flight requests are lost, and the rest of the pool absorbs its share.</p>
      <p><b>Sticky sessions</b> (IP hash) keep a client on one server, which is handy for in-memory state but makes scaling and failures messier — prefer shared session storage.</p>`;
  }

  complexityTitle() {
    return 'Rules of thumb';
  }

  complexity() {
    return [
      ['Server capacity', '1.6 req/s', 'here: 620 ms of work each'],
      ['Pool capacity', 'k × μ', 'k servers × per-server rate'],
      ['Stable while', 'λ < k · μ', 'otherwise the queue grows'],
      ['Queue full', '503', 'shed load instead of queueing forever'],
      ['Health checks', 'every few s', 'remove dead servers from rotation'],
    ];
  }

  // ---- simulation ----------------------------------------------------------

  get active() {
    return this.servers.slice(0, this.count);
  }

  get healthy() {
    return this.active.filter((s) => s.status !== 'down');
  }

  setCount(v) {
    if (v < this.count) {
      for (const s of this.servers.slice(v)) this.drainServer(s, 'scaled down');
    }
    this.count = v;
  }

  serviceTime(s) {
    return LoadBalancerScene.SERVICE * (s.status === 'slow' ? 3 : 1);
  }

  startSpike() {
    this.spike = 4000;
    this.log('Traffic spike: 4× for a few seconds', 'hint');
  }

  killServer() {
    const victim = this.healthy[Math.floor(Math.random() * this.healthy.length)];
    if (!victim) return this.log('No healthy server left to kill', 'warn');
    victim.status = 'down';
    this.drainServer(victim, 'server crashed');
    this.log(`${victim.name} is down — health check removes it from the pool`, 'warn');
  }

  degradeServer() {
    const victim = this.healthy.find((s) => s.status === 'up');
    if (!victim) return this.log('No healthy server to degrade', 'warn');
    victim.status = 'slow';
    this.log(`${victim.name} is degraded (3× slower) — watch least-connections route around it`, 'hint');
  }

  healAll() {
    for (const s of this.servers) s.status = 'up';
    this.log('All servers healthy again', 'ok');
  }

  resetStats() {
    this.completed = 0;
    this.dropped = 0;
    this.latency.reset();
    for (const s of this.servers) {
      s.processed = 0;
      s.dropped = 0;
    }
  }

  drainServer(s, why) {
    const lost = s.queue.length + (s.busy ? 1 : 0);
    for (const b of s.queue) {
      b.style.fill = Theme.red;
      this.physics.fling(b, (Math.random() - 0.5) * 10, -9, 0.2);
    }
    if (s.busy) this.physics.fling(s.busy.body, (Math.random() - 0.5) * 10, -9);
    s.queue = [];
    s.busy = null;
    if (lost) {
      this.dropped += lost;
      s.dropped += lost;
      this.log(`${lost} in-flight request${lost > 1 ? 's' : ''} lost (${why})`, 'warn');
    }
  }

  pick(client) {
    const pool = this.healthy;
    if (!pool.length) return null;
    switch (this.algo) {
      case 'least-connections':
        return pool.reduce((a, b) => (this.load(b) < this.load(a) ? b : a));
      case 'random':
        return pool[Math.floor(Math.random() * pool.length)];
      case 'weighted': {
        const total = pool.reduce((t, s) => t + (s.status === 'slow' ? 1 : 3), 0);
        let r = Math.random() * total;
        for (const s of pool) if ((r -= s.status === 'slow' ? 1 : 3) <= 0) return s;
        return pool[pool.length - 1];
      }
      case 'ip-hash':
        return pool[(client * 7 + 3) % pool.length];
      default:
        return pool[this.rr++ % pool.length];
    }
  }

  load(s) {
    return s.queue.length + (s.busy ? 1 : 0);
  }

  spawn() {
    const client = Math.floor(Math.random() * this.clientColors.length);
    const target = this.pick(client);
    const body = this.physics.circle(this.lb.x + this.lb.w / 2 + (Math.random() - 0.5) * 60, this.lb.y + this.lb.h - 6, 11, { fill: this.clientColors[client], stroke: Theme.bg, strokeWeight: 1 }, { restitution: 0.05, friction: 0.02, density: 0.003 });
    this.physics.freeze(body);
    body.tArrive = this.anim.time;
    this.inRate.add();

    if (!target) {
      this.reject(body, this.W / 2, 'no healthy server (503)');
      return;
    }
    if (this.load(target) >= LoadBalancerScene.CAPACITY) {
      target.dropped++;
      this.reject(body, target.x, `${target.name} queue full → 503`);
      return;
    }
    target.queue.push(body);
    this.physics.moveTo(this.anim, body, target.x, this.tubeTop + 10, 420, { arc: 60 }).then(() => this.physics.release(body));
  }

  reject(body, x, why) {
    this.dropped++;
    body.style.fill = Theme.red;
    this.physics.moveTo(this.anim, body, x, this.tubeTop - 40, 380, { arc: 50 }).then(() => this.physics.fling(body, (Math.random() - 0.5) * 8, -7, 0.3));
    if (this.anim.time - (this.lastRejectLog || -2000) > 1200) {
      this.lastRejectLog = this.anim.time;
      this.log(why, 'warn');
    }
  }

  update(dt) {
    if (dt <= 0) return;
    this.flow += dt * 0.06;
    this.inRate.tick(dt);
    this.outRate.tick(dt);
    if (this.spike > 0) this.spike -= dt;
    this.arrivals.rate = this.rate * (this.spike > 0 ? 4 : 1);
    this.arrivals.tick(dt, () => this.spawn());

    for (const s of this.servers) {
      if (s.status === 'down') continue;
      if (s.busy) {
        s.busy.left -= dt;
        s.busyTime += dt;
        if (s.busy.left <= 0) {
          const { body } = s.busy;
          s.busy = null;
          s.processed++;
          this.completed++;
          this.outRate.add();
          this.latency.add(this.anim.time - body.tArrive);
          this.physics.fling(body, 7, -12, 0.2);
        }
      } else if (s.queue.length) {
        const body = s.queue.shift();
        body.style.fill = Theme.yellow;
        body.style.glow = Theme.yellow;
        s.busy = { body, left: this.serviceTime(s) };
      }
    }
    this.updateStats();
  }

  updateStats() {
    const cap = this.healthy.reduce((t, s) => t + 1000 / this.serviceTime(s), 0);
    this.setStats({
      'in (req/s)': this.inRate.rate.toFixed(1),
      'out (req/s)': this.outRate.rate.toFixed(1),
      capacity: cap.toFixed(1),
      'avg latency': Flow.ms(this.latency.avg),
      p95: Flow.ms(this.latency.p95),
      dropped: this.dropped,
    });
  }

  // ---- drawing --------------------------------------------------------------

  draw(p) {
    const lb = this.lb;
    // clients
    Flow.box(p, { x: 60, y: 60, w: 180, h: 62, title: 'CLIENTS', color: Theme.green });
    this.clientColors.forEach((c, i) => {
      p.push();
      p.noStroke();
      p.fill(c);
      p.circle(92 + i * 28, 102, 12);
      p.pop();
    });
    Draw.label(p, `${(this.rate * (this.spike > 0 ? 4 : 1)).toFixed(0)} req/s`, 150, 138, { size: 12 });
    Flow.pipe(p, 240, 91, lb.x, lb.y + lb.h / 2, { flow: this.flow, weight: 10 });

    // balancer
    Flow.box(p, {
      x: lb.x,
      y: lb.y,
      w: lb.w,
      h: lb.h,
      title: 'LOAD BALANCER',
      color: Theme.yellow,
      sub: `${this.algo} · ${this.healthy.length}/${this.count} healthy`,
    });
    if (this.spike > 0) Draw.label(p, 'traffic spike!', lb.x + lb.w + 24, lb.y + 20, { align: 'left', color: Theme.orange, size: 14, bold: true });

    // pipes down to each server
    for (const s of this.active) {
      const down = s.status === 'down';
      Flow.pipe(p, lb.x + lb.w / 2, lb.y + lb.h, s.x, this.tubeTop - 16, { weight: 6, color: down ? Theme.red : Theme.line, flow: down ? 0 : this.flow, active: !down });
    }

    // server tubes
    for (const s of this.servers) {
      const on = s.i < this.count;
      const load = this.load(s);
      p.push();
      p.drawingContext.globalAlpha = on ? 1 : 0.25;
      p.noStroke();
      p.fill(255, 255, 255, s.status === 'down' ? 4 : 8);
      p.rect(s.x - s.w / 2, this.tubeTop, s.w, this.floorY - this.tubeTop);
      p.pop();

      const color = !on ? Theme.dim : s.status === 'down' ? Theme.red : s.status === 'slow' ? Theme.orange : Theme.green;
      const label = !on ? 'not provisioned' : s.status === 'down' ? 'DOWN' : s.status === 'slow' ? 'DEGRADED' : 'healthy';
      Draw.label(p, s.name, s.x, this.tubeTop - 34, { color: on ? Theme.text : Theme.dim, size: 15, bold: true });
      Draw.label(p, label, s.x, this.tubeTop - 16, { color, size: 11, bold: s.status !== 'up' });

      if (!on) continue;
      Flow.meter(p, s.x - 45, this.floorY + 22, 90, 7, load / LoadBalancerScene.CAPACITY, load >= LoadBalancerScene.CAPACITY ? Theme.red : load > 4 ? Theme.orange : Theme.green);
      Draw.label(p, `queue ${load}/${LoadBalancerScene.CAPACITY} · ${s.processed} done`, s.x, this.floorY + 42, { size: 11 });
    }

    this.physics.render(p);

    Flow.legend(p, 80, this.H - 14, [
      ['queued', Theme.accent],
      ['in service', Theme.yellow],
      ['dropped 503', Theme.red],
    ]);
    Draw.label(p, `served ${this.completed} · dropped ${this.dropped}`, this.W - 60, this.H - 14, { align: 'right', size: 12, color: Theme.muted });
  }
}
