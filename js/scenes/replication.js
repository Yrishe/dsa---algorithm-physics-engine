// Replication: one leader takes the writes and streams them to followers.
// Lag makes replica reads stale, a partition makes them staler, and a failover
// can lose whatever the promoted follower never received.
class ReplicationScene extends Scene {
  static id = 'replication';
  static title = 'Replication & CAP';
  static nav = 'leader/follower, lag, failover';
  static group = 'System Design';
  static subtitle = 'Copies of the data on several machines: fast reads and survivable failures, paid for with staleness.';

  static VALUES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  setup() {
    this.leaderSlot = { x: 80, y: 230, w: 230, h: 150 };
    this.followerSlots = [
      { x: 650, y: 80, w: 250, h: 120 },
      { x: 650, y: 240, w: 250, h: 120 },
      { x: 650, y: 400, w: 250, h: 120 },
    ];

    this.nodes = Array.from({ length: 4 }, (_, i) => ({
      i,
      name: i === 0 ? 'db-1' : `db-${i + 1}`,
      version: 0,
      value: '—',
      status: 'up', // up | partitioned | down
      pending: [], // versions that missed the network
      pos: { ...(i === 0 ? this.leaderSlot : this.followerSlots[i - 1]) },
      target: null,
    }));
    this.leader = this.nodes[0];
    this.syncTarget();

    this.mode = 'async';
    this.partitionMode = 'ap';
    this.lag = 900;
    this.writes = 0;
    this.staleReads = 0;
    this.lostWrites = 0;
    this.flow = 0;
    this.writeLatency = new LatencyStat();
    this.pendingWrite = null;

    this.codes = {
      async: [
        '// asynchronous replication (default almost everywhere)',
        'async function write(key, value) {',
        '  await leader.apply(key, value);   // durable on the leader',
        '  for (const f of followers)',
        '    f.send(value);                  // fire and forget',
        '  return ACK;                       // fast, may lose the tail',
        '}',
        '',
        '// reads from a replica can be behind: "read your writes"',
        '// needs sticky routing or a version token',
      ],
      sync: [
        '// synchronous / quorum replication',
        'async function write(key, value) {',
        '  await leader.apply(key, value);',
        '  await Promise.all(healthy.map(f => f.ack(value)));',
        '  return ACK;                       // slower, no lost writes',
        '}',
        '',
        '// quorum: W + R > N gives read-after-write consistency',
        '// (e.g. N=3, W=2, R=2)',
      ],
    };
    this.code('async');
    this.log('Write a few values, then read from a replica while the lag is high.', 'hint');
  }

  controls() {
    return [
      { type: 'button', label: 'Write', lock: false, action: () => this.write() },
      { type: 'button', label: 'Read from leader', variant: 'secondary', lock: false, action: () => this.read(true) },
      { type: 'button', label: 'Read from replica', variant: 'secondary', lock: false, action: () => this.read(false) },
      { type: 'sep' },
      {
        type: 'select',
        id: 'mode',
        label: 'Replication',
        value: 'async',
        options: [
          { value: 'async', label: 'asynchronous' },
          { value: 'sync', label: 'synchronous' },
        ],
        onChange: (v) => {
          this.mode = v;
          this.code(v);
          this.log(v === 'sync' ? 'Synchronous: the client waits for every healthy replica' : 'Asynchronous: the leader acks immediately');
        },
      },
      {
        type: 'select',
        id: 'cap',
        label: 'Partitioned replica',
        value: 'ap',
        options: [
          { value: 'ap', label: 'AP: serve stale data' },
          { value: 'cp', label: 'CP: refuse the read' },
        ],
        onChange: (v) => (this.partitionMode = v),
      },
      { type: 'range', id: 'lag', label: 'Network lag (ms)', min: 200, max: 2500, step: 100, value: 900, onInput: (v) => (this.lag = v) },
      { type: 'sep' },
      { type: 'button', label: 'Partition a replica', variant: 'danger', lock: false, action: () => this.partition() },
      { type: 'button', label: 'Kill the leader', variant: 'danger', lock: false, action: () => this.killLeader() },
      { type: 'button', label: 'Heal everything', variant: 'ghost', lock: false, action: () => this.heal() },
    ];
  }

  about() {
    return `
      <p><b>Leader–follower replication</b>: all writes go to one leader, which streams its change log to the followers. Followers serve reads, which is how you scale reads and survive a machine loss.</p>
      <p>With <b>asynchronous</b> replication the leader acks immediately, so a replica read can return an older value — <b>replication lag</b>. Common fixes: read your own writes from the leader, or pass the version you already saw.</p>
      <p><b>Synchronous</b> replication waits for the replicas, so no acknowledged write is lost — but the client pays a round trip, and one slow replica slows every write.</p>
      <p><b>CAP</b>: when the network partitions you must choose. <b>AP</b> keeps answering with possibly stale data; <b>CP</b> refuses to answer rather than be wrong. Outside of partitions the real trade-off is latency vs consistency (PACELC).</p>
      <p>Killing the leader triggers a <b>failover</b>: the most up-to-date follower is promoted. Anything it had not received yet is gone — that is the price of asynchronous replication.</p>`;
  }

  complexityTitle() {
    return 'Trade-offs';
  }

  complexity() {
    return [
      ['Async replication', 'fast writes', 'stale reads, lost tail on failover'],
      ['Sync replication', 'safe writes', 'slowest replica sets the latency'],
      ['Quorum', 'W + R > N', 'tunable consistency'],
      ['Partition (AP)', 'stale data', 'stays available'],
      ['Partition (CP)', 'errors', 'stays correct'],
    ];
  }

  // ---- layout ---------------------------------------------------------------

  syncTarget() {
    // the leader always sits in the big slot on the left
    const followers = this.nodes.filter((n) => n !== this.leader);
    this.leader.target = this.leaderSlot;
    followers.forEach((n, k) => (n.target = this.followerSlots[k]));
  }

  update(dt) {
    if (dt <= 0) return;
    this.flow += dt * 0.05;
    const k = 1 - Math.exp(-dt / 220);
    for (const n of this.nodes) {
      if (!n.target) continue;
      n.pos.x = lerp(n.pos.x, n.target.x, k);
      n.pos.y = lerp(n.pos.y, n.target.y, k);
      n.pos.w = lerp(n.pos.w, n.target.w, k);
      n.pos.h = lerp(n.pos.h, n.target.h, k);
    }
    this.setStats({
      writes: this.writes,
      'leader version': `v${this.leader.version}`,
      'max lag': `${Math.max(0, ...this.nodes.filter((n) => n !== this.leader && n.status !== 'down').map((n) => this.leader.version - n.version))} versions`,
      'stale reads': this.staleReads,
      'lost writes': this.lostWrites,
      'write latency': Flow.ms(this.writeLatency.avg),
    });
  }

  // ---- operations -----------------------------------------------------------

  packet(from, to, label, color) {
    const body = this.physics.tile(from.x, from.y, 40, 30, label, { fill: color, textSize: 13, radius: 6 });
    this.physics.freeze(body);
    return body;
  }

  async write() {
    if (this.leader.status === 'down') return this.log('No leader — the cluster cannot accept writes', 'warn');
    const v = ++this.leader.version;
    const value = ReplicationScene.VALUES[(v - 1) % 26];
    this.leader.value = value;
    this.writes++;
    this.log(`write x = "${value}" (v${v}) → leader`);

    const start = this.anim.time;
    const followers = this.nodes.filter((n) => n !== this.leader && n.status !== 'down');
    const acks = followers.map((f) => this.replicate(f, v, value));
    if (this.mode === 'sync') {
      this.pendingWrite = { v, acked: 0, of: followers.filter((f) => f.status === 'up').length };
      await Promise.all(acks.filter((_, i) => followers[i].status === 'up'));
      this.pendingWrite = null;
      this.writeLatency.add(this.anim.time - start);
      this.log(`v${v} acknowledged by every healthy replica (${Flow.ms(this.anim.time - start)})`, 'ok');
    } else {
      this.writeLatency.add(60);
    }
  }

  async replicate(node, v, value) {
    const from = this.boxCenter(this.leader);
    const to = this.boxCenter(node);
    const cut = node.status === 'partitioned';
    const body = this.packet(from, to, `v${v}`, cut ? Theme.red : Theme.cyan);
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };

    if (cut) {
      node.pending.push({ v, value });
      await this.physics.moveTo(this.anim, body, mid.x, mid.y, this.lag / 2);
      this.physics.fling(body, 0, 2, 0.4); // the network drops it
      return;
    }
    await this.physics.moveTo(this.anim, body, to.x, to.y, this.lag, { arc: 30 });
    this.physics.fling(body, 0, -3, 0.1);
    if (node.status === 'down') return;
    node.version = Math.max(node.version, v);
    node.value = value;
    if (this.pendingWrite && this.pendingWrite.v === v) this.pendingWrite.acked++;
  }

  async read(fromLeader) {
    const candidates = this.nodes.filter((n) => n !== this.leader && n.status !== 'down');
    const node = fromLeader ? this.leader : candidates[Math.floor(Math.random() * candidates.length)];
    if (!node) return this.log('No replica available to read from', 'warn');
    if (node.status === 'down') return this.log(`${node.name} is down`, 'warn');

    const to = this.boxCenter(node);
    const body = this.packet({ x: 460, y: 570 }, to, 'GET', Theme.yellow);
    await this.physics.moveTo(this.anim, body, to.x, to.y, 420, { arc: 40 });

    if (node.status === 'partitioned' && this.partitionMode === 'cp') {
      body.style.fill = Theme.red;
      body.style.label = 'ERR';
      this.log(`${node.name} is partitioned — CP mode refuses the read (503) rather than serve stale data`, 'warn');
    } else {
      const stale = node.version < this.leader.version;
      body.style.fill = stale ? Theme.orange : Theme.green;
      body.style.label = node.value;
      if (stale) {
        this.staleReads++;
        this.log(`read from ${node.name} → "${node.value}" (v${node.version}) — stale, leader is at v${this.leader.version}`, 'warn');
      } else {
        this.log(`read from ${node.name} → "${node.value}" (v${node.version}) — up to date`, 'ok');
      }
    }
    await this.wait(700);
    this.physics.fling(body, -6, -7, 0.2);
  }

  partition() {
    const victim = this.nodes.find((n) => n !== this.leader && n.status === 'up');
    if (!victim) return this.log('Every replica is already partitioned or down', 'warn');
    victim.status = 'partitioned';
    this.log(`Network partition: ${victim.name} can no longer reach the leader`, 'warn');
  }

  heal() {
    for (const n of this.nodes) {
      if (n.status === 'partitioned') {
        const missed = n.pending.length;
        // catch-up: the leader replays everything the replica missed
        n.pending.forEach((entry, k) => this.catchUp(n, entry, k));
        n.pending = [];
        n.status = 'up';
        if (missed) this.log(`${n.name} reconnected — catching up on ${missed} write${missed > 1 ? 's' : ''}`, 'ok');
      } else if (n.status === 'down') {
        n.status = 'up';
        n.version = 0;
        n.value = '—';
        this.log(`${n.name} restarted — copying the whole dataset from the leader`, 'ok');
        this.resync(n);
      }
    }
  }

  async catchUp(node, entry, k) {
    await this.wait(k * 160);
    if (node.status !== 'up') return;
    const from = this.boxCenter(this.leader);
    const to = this.boxCenter(node);
    const body = this.packet(from, to, `v${entry.v}`, Theme.purple);
    await this.physics.moveTo(this.anim, body, to.x, to.y, this.lag * 0.4, { arc: 20 });
    this.physics.fling(body, 0, -3, 0.1);
    if (entry.v >= node.version) {
      node.version = entry.v;
      node.value = entry.value;
    }
  }

  // A restarted node has no data; it copies the leader's state.
  async resync(node) {
    if (node === this.leader) return;
    const from = this.boxCenter(this.leader);
    const body = this.packet(from, this.boxCenter(node), 'SNAP', Theme.purple);
    await this.physics.moveTo(this.anim, body, this.boxCenter(node).x, this.boxCenter(node).y, this.lag * 1.5, { arc: 30 });
    this.physics.fling(body, 0, -3, 0.1);
    if (node.status !== 'up' || this.leader.status === 'down') return;
    node.version = this.leader.version;
    node.value = this.leader.value;
    this.log(`${node.name} is back in sync at v${node.version}`, 'ok');
  }

  killLeader() {
    if (this.leader.status === 'down') return this.log('The leader is already down', 'warn');
    const old = this.leader;
    old.status = 'down';
    const candidates = this.nodes.filter((n) => n !== old && n.status === 'up');
    if (!candidates.length) return this.log('No healthy replica to promote — the cluster is down', 'warn');

    const promoted = candidates.reduce((a, b) => (b.version > a.version ? b : a));
    const lost = old.version - promoted.version;
    this.leader = promoted;
    this.syncTarget(); // the promoted node slides into the leader slot
    this.log(`Failover: ${promoted.name} promoted to leader at v${promoted.version}`, 'hint');
    if (lost > 0) {
      this.lostWrites += lost;
      this.log(`${lost} acknowledged write${lost > 1 ? 's' : ''} lost (v${promoted.version + 1}…v${old.version}) — async replication's cost`, 'warn');
    } else {
      this.log('No data lost: the promoted replica had every write', 'ok');
    }
  }

  // ---- drawing --------------------------------------------------------------

  boxCenter(n) {
    return { x: n.pos.x + n.pos.w / 2, y: n.pos.y + n.pos.h / 2 };
  }

  draw(p) {
    // pipes from the leader to every other node
    for (const n of this.nodes) {
      if (n === this.leader) continue;
      const a = this.boxCenter(this.leader);
      const b = this.boxCenter(n);
      const cut = n.status === 'partitioned' || n.status === 'down' || this.leader.status === 'down';
      Flow.pipe(p, a.x + this.leader.pos.w / 2 - 10, a.y, b.x - n.pos.w / 2 + 10, b.y, {
        weight: 7,
        color: cut ? Theme.red : Theme.line,
        flow: cut ? 0 : this.flow,
        active: !cut,
      });
      if (n.status === 'partitioned') {
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        Draw.label(p, 'partition', mx, my - 16, { color: Theme.red, size: 12, bold: true });
        p.push();
        p.stroke(Theme.red);
        p.strokeWeight(3);
        p.line(mx - 12, my - 12, mx + 12, my + 12);
        p.line(mx + 12, my - 12, mx - 12, my + 12);
        p.pop();
      }
    }

    for (const n of this.nodes) {
      const isLeader = n === this.leader;
      const lag = this.leader.version - n.version;
      const color = n.status === 'down' ? Theme.red : isLeader ? Theme.yellow : n.status === 'partitioned' ? Theme.orange : Theme.cyan;
      Flow.box(p, {
        x: n.pos.x,
        y: n.pos.y,
        w: n.pos.w,
        h: n.pos.h,
        title: `${isLeader ? 'LEADER' : 'REPLICA'} · ${n.name}`,
        color,
        state: n.status === 'down' ? 'down' : 'up',
      });
      const cx = n.pos.x + n.pos.w / 2;
      if (n.status === 'down') {
        Draw.label(p, 'DOWN', cx, n.pos.y + n.pos.h / 2 + 4, { color: Theme.red, size: 20, bold: true });
      } else {
        Draw.label(p, `x = "${n.value}"`, cx, n.pos.y + n.pos.h / 2 + (isLeader ? 6 : 4), { color: Theme.text, size: isLeader ? 30 : 24, bold: true });
        Draw.label(p, `v${n.version}`, cx, n.pos.y + n.pos.h - 20, { color: Theme.muted, size: 13 });
        if (!isLeader && lag > 0) Draw.label(p, `${lag} behind`, n.pos.x + n.pos.w - 14, n.pos.y + 44, { align: 'right', color: Theme.orange, size: 12, bold: true });
        if (n.status === 'partitioned') Draw.label(p, this.partitionMode === 'cp' ? 'CP: refusing reads' : 'AP: serving stale', cx, n.pos.y + n.pos.h + 16, { color: Theme.orange, size: 12 });
        if (n.pending.length) Draw.label(p, `${n.pending.length} writes missed`, cx, n.pos.y + n.pos.h + 32, { color: Theme.red, size: 11 });
      }
    }

    // client
    Flow.box(p, { x: 360, y: 540, w: 200, h: 56, title: 'CLIENT', color: Theme.green, sub: this.mode === 'sync' ? 'waits for replicas' : 'acked by the leader' });
    if (this.pendingWrite) {
      Draw.label(p, `waiting for ${this.pendingWrite.of - this.pendingWrite.acked} ack(s)…`, 460, 522, { color: Theme.yellow, size: 13, bold: true });
    }
    Flow.pipe(p, 400, 540, this.boxCenter(this.leader).x, this.leader.pos.y + this.leader.pos.h, { flow: this.flow, color: this.leader.status === 'down' ? Theme.red : Theme.green });

    this.physics.render(p);

    Flow.legend(p, 70, this.H - 16, [
      ['replication', Theme.cyan],
      ['catch-up', Theme.purple],
      ['read', Theme.yellow],
      ['stale/dropped', Theme.red],
    ]);
  }
}
