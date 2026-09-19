// Sharding: which server owns a key? With `hash % N` almost every key moves
// when the cluster changes size. With a hash ring, only one arc moves.
class ShardingScene extends Scene {
  static id = 'sharding';
  static title = 'Sharding & Hash Ring';
  static nav = 'consistent hashing, rebalancing';
  static group = 'System Design';
  static subtitle = 'Split data across servers — and survive adding one. Compare hash % N with consistent hashing.';

  static MAX_SERVERS = 5;
  static MAX_KEYS = 40;

  setup() {
    this.mode = 'ring';
    this.vnodes = 4;
    this.servers = [];
    this.keys = [];
    this.moved = 0;
    this.lastTotal = 0;
    this.nextKey = 1;
    this.ring = { x: 300, y: 300, r: 140 };
    this.binTop = 330;
    this.binBottom = 560;
    this.binW = 74;

    for (let i = 0; i < ShardingScene.MAX_SERVERS; i++) {
      const x = this.binX(i);
      const h = this.binBottom - this.binTop;
      this.physics.wall(x - this.binW / 2 - 4, this.binTop + h / 2, 8, h, { fill: Theme.line });
      this.physics.wall(x + this.binW / 2 + 4, this.binTop + h / 2, 8, h, { fill: Theme.line });
      this.physics.wall(x, this.binBottom + 4, this.binW + 16, 8, { fill: Theme.line });
    }

    this.codes = {
      modulo: [
        '// the naive way',
        'function owner(key, servers) {',
        '  return servers[hash(key) % servers.length];',
        '}',
        '',
        '// add one server and (N-1)/N of all keys change owner:',
        '//   3 → 4 servers moves ~75% of the data',
      ],
      ring: [
        '// consistent hashing: keys and servers share one ring',
        'build(servers) {',
        '  ring = [];',
        '  for (const s of servers)',
        '    for (let v = 0; v < VNODES; v++)      // virtual nodes',
        '      ring.push({ pos: hash(`${s}#${v}`), server: s });',
        '  ring.sort((a, b) => a.pos - b.pos);',
        '}',
        '',
        'owner(key) {',
        '  const p = hash(key);',
        '  return ring.find(n => n.pos >= p) ?? ring[0];  // clockwise',
        '}',
        '',
        '// adding a server only steals the arcs in front of its vnodes:',
        '//   ~1/N of the keys move, nothing else is touched',
      ],
    };
    this.code('ring');

    this.addServer(true);
    this.addServer(true);
    this.addServer(true);
    this.addKeys(12, true);
    this.log('Press "Add server" and compare how many keys move in each mode.', 'hint');
  }

  controls() {
    return [
      {
        type: 'select',
        id: 'mode',
        label: 'Strategy',
        value: 'ring',
        options: [
          { value: 'ring', label: 'consistent hashing' },
          { value: 'modulo', label: 'hash % N' },
        ],
        onChange: (v) => {
          this.mode = v;
          this.code(v);
          this.log(v === 'ring' ? 'Consistent hashing: keys land on the ring and belong to the next node clockwise' : 'hash % N: the number of servers is baked into every lookup');
          this.remap('switched strategy');
        },
      },
      { type: 'range', id: 'vnodes', label: 'Virtual nodes', min: 1, max: 8, step: 1, value: 4, onInput: (v) => this.setVnodes(v) },
      { type: 'sep' },
      { type: 'button', label: 'Add 8 keys', lock: false, action: () => this.addKeys(8) },
      { type: 'button', label: 'Add server', lock: false, action: () => this.addServer() },
      { type: 'button', label: 'Remove server', variant: 'danger', lock: false, action: () => this.removeServer() },
      { type: 'button', label: 'Clear keys', variant: 'ghost', lock: false, action: () => this.clearKeys() },
    ];
  }

  about() {
    return `
      <p>One machine eventually runs out of disk, memory or write throughput. <b>Sharding</b> (horizontal partitioning) splits the keyspace across servers — the question is <i>which server owns which key</i>.</p>
      <p><code>hash(key) % N</code> is the obvious answer and the wrong one: <code>N</code> appears in the formula, so changing the number of servers reshuffles almost everything. Growing from 3 to 4 servers moves about <b>75%</b> of your data.</p>
      <p><b>Consistent hashing</b> puts servers and keys on the same ring, and a key belongs to the first server clockwise from it. Adding a server only takes over the arc in front of it: about <code>1/N</code> of the keys move, and nobody else notices.</p>
      <p><b>Virtual nodes</b> (several ring positions per server) even out the arcs, so no single server gets a huge slice — and a removed server's load spreads over all the others instead of landing on its neighbour.</p>
      <p>Used by Dynamo/Cassandra, Riak, memcached clients, CDNs and many shard routers. The alternative is a routing table (range partitioning) kept in a coordinator, as in HBase or Vitess.</p>`;
  }

  complexityTitle() {
    return 'Rebalancing cost';
  }

  complexity() {
    return [
      ['hash % N, N→N+1', '~(N−1)/N', 'almost everything moves'],
      ['Hash ring, N→N+1', '~1/(N+1)', 'only one arc moves'],
      ['Lookup', 'O(log V)', 'binary search over V vnodes'],
      ['Virtual nodes', '100–256', 'per server in practice'],
      ['Hot key', 'still hot', 'sharding does not fix skew'],
    ];
  }

  // ---- hashing --------------------------------------------------------------

  hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 100000) / 100000; // 0…1
  }

  get markers() {
    const out = [];
    this.servers.forEach((s, i) => {
      for (let v = 0; v < this.vnodes; v++) out.push({ pos: this.hash(`${s.name}#${v}`), server: s, index: i });
    });
    return out.sort((a, b) => a.pos - b.pos);
  }

  ownerOf(key) {
    if (!this.servers.length) return null;
    if (this.mode === 'modulo') return this.servers[Math.floor(key.h * 100000) % this.servers.length];
    const markers = this.markers;
    return (markers.find((m) => m.pos >= key.h) || markers[0]).server;
  }

  // ---- layout ---------------------------------------------------------------

  binX(i) {
    return 600 + i * (this.binW + 14);
  }

  ringPoint(pos, r = this.ring.r) {
    const a = pos * Math.PI * 2 - Math.PI / 2;
    return { x: this.ring.x + Math.cos(a) * r, y: this.ring.y + Math.sin(a) * r };
  }

  // ---- operations -----------------------------------------------------------

  addServer(quiet = false) {
    if (this.servers.length >= ShardingScene.MAX_SERVERS) return this.log('No room for more servers on screen', 'warn');
    const i = this.servers.length;
    this.servers.push({ name: `shard-${i + 1}`, color: Theme.colorFor(i), i });
    if (!quiet) this.remap(`added shard-${i + 1}`);
  }

  removeServer() {
    if (this.servers.length <= 1) return this.log('Keep at least one server', 'warn');
    const gone = this.servers.pop();
    this.remap(`removed ${gone.name}`);
  }

  setVnodes(v) {
    this.vnodes = v;
    if (this.mode === 'ring') this.remap(`${v} virtual node${v > 1 ? 's' : ''} per server`);
  }

  addKeys(n, quiet = false) {
    if (this.keys.length + n > ShardingScene.MAX_KEYS) n = ShardingScene.MAX_KEYS - this.keys.length;
    if (n <= 0) return this.log('That is enough keys for this screen', 'warn');
    for (let i = 0; i < n; i++) {
      const name = `k${this.nextKey++}`;
      const key = { name, h: this.hash(name), owner: null, body: null };
      this.keys.push(key);
      this.route(key, i * 220, quiet);
    }
  }

  clearKeys() {
    for (const k of this.keys) if (k.body) this.physics.fling(k.body, (Math.random() - 0.5) * 8, -9, 0.3);
    this.keys = [];
    this.moved = 0;
  }

  // Send a key to its owner: along the ring, then down into the shard's bin.
  async route(key, delay = 0, quiet = false) {
    const owner = this.ownerOf(key);
    if (!owner) return;
    key.owner = owner;
    if (delay) await this.wait(delay);

    const start = this.ringPoint(key.h);
    if (!key.body) {
      key.body = this.physics.tile(start.x, start.y, 34, 26, key.name, { fill: owner.color, textSize: 12, radius: 5 });
      this.physics.freeze(key.body);
    }

    if (this.mode === 'ring') {
      // walk clockwise around the ring to the owning node
      const markers = this.markers;
      const marker = markers.find((m) => m.pos >= key.h) || markers[0];
      const from = key.h;
      const to = marker.pos > from ? marker.pos : marker.pos + 1;
      await this.anim.tween(
        520,
        (e) => {
          const pt = this.ringPoint(lerp(from, to, e));
          Body.setPosition(key.body, pt);
        },
        Ease.inOutSine
      );
    } else {
      await this.physics.moveTo(this.anim, key.body, this.ring.x, this.ring.y, 260);
    }

    key.body.style.fill = owner.color;
    const x = this.binX(owner.i) + (Math.random() - 0.5) * 30;
    await this.physics.moveTo(this.anim, key.body, x, this.binTop - 30, 420, { arc: 60 });
    this.physics.release(key.body);
    if (!quiet) this.setStats(this.stats());
  }

  // Recompute ownership; only the keys that changed owner actually move.
  async remap(why) {
    const before = this.keys.map((k) => k.owner);
    let moved = 0;
    this.keys.forEach((key, i) => {
      const owner = this.ownerOf(key);
      if (owner === before[i]) return;
      moved++;
      key.owner = owner;
      if (key.body) {
        key.body.style.highlight = Theme.yellow;
        this.moveKey(key, moved * 90);
      }
    });
    this.moved = moved;
    this.lastTotal = this.keys.length;
    const pct = this.keys.length ? Math.round((moved / this.keys.length) * 100) : 0;
    const kind = pct >= 50 ? 'warn' : 'ok';
    this.log(`${why}: ${moved}/${this.keys.length} keys moved (${pct}%)`, this.keys.length ? kind : 'info');
    if (this.mode === 'modulo' && pct >= 50) this.log('That is the cost of hash % N — most of the cluster reshuffles', 'hint');
  }

  async moveKey(key, delay) {
    await this.wait(delay);
    if (!key.body || !key.owner) return;
    this.physics.freeze(key.body);
    const x = this.binX(key.owner.i) + (Math.random() - 0.5) * 30;
    await this.physics.moveTo(this.anim, key.body, x, this.binTop - 40, 520, { arc: 90 });
    key.body.style.fill = key.owner.color;
    key.body.style.highlight = null;
    this.physics.release(key.body);
  }

  stats() {
    const counts = this.servers.map((s) => this.keys.filter((k) => k.owner === s).length);
    return {
      servers: this.servers.length,
      keys: this.keys.length,
      'moved (last change)': `${this.moved}${this.lastTotal ? ` / ${this.lastTotal}` : ''}`,
      balance: counts.length ? `${Math.min(...counts)}–${Math.max(...counts)}` : '—',
      vnodes: this.mode === 'ring' ? this.vnodes : '—',
    };
  }

  update(dt) {
    if (dt <= 0) return;
    this.setStats(this.stats());
  }

  // ---- drawing --------------------------------------------------------------

  draw(p) {
    if (this.mode === 'ring') this.drawRing(p);
    else this.drawModulo(p);

    // shards
    for (let i = 0; i < ShardingScene.MAX_SERVERS; i++) {
      const s = this.servers[i];
      const x = this.binX(i);
      p.push();
      p.noStroke();
      p.fill(255, 255, 255, s ? 8 : 3);
      p.rect(x - this.binW / 2, this.binTop, this.binW, this.binBottom - this.binTop);
      p.pop();
      if (!s) {
        Draw.label(p, 'empty slot', x, this.binTop - 16, { size: 11, color: Theme.dim });
        continue;
      }
      const count = this.keys.filter((k) => k.owner === s).length;
      Draw.label(p, s.name, x, this.binTop - 32, { color: s.color, size: 13, bold: true });
      Draw.label(p, `${count} keys`, x, this.binTop - 16, { size: 11 });
    }

    this.physics.render(p);
    Draw.label(p, 'each key is stored on exactly one shard', this.W / 2 + 180, this.binBottom + 30, { size: 12 });
  }

  drawRing(p) {
    const { x, y, r } = this.ring;
    Draw.label(p, 'HASH RING', x, y - r - 60, { color: Theme.text, size: 16, bold: true });
    Draw.label(p, 'hash(key) → a point on the circle', x, y - r - 40, { size: 12 });

    // arcs coloured by the server that owns them
    const markers = this.markers;
    p.push();
    p.noFill();
    p.strokeWeight(14);
    if (!markers.length) {
      p.stroke(Theme.grid);
      p.circle(x, y, r * 2);
    }
    markers.forEach((m, k) => {
      const prev = markers[(k - 1 + markers.length) % markers.length];
      const from = prev.pos;
      const to = m.pos > from ? m.pos : m.pos + 1;
      p.stroke(m.server.color);
      p.arc(x, y, r * 2, r * 2, from * Math.PI * 2 - Math.PI / 2, to * Math.PI * 2 - Math.PI / 2);
    });
    p.pop();

    // node markers
    for (const m of markers) {
      const pt = this.ringPoint(m.pos);
      p.push();
      p.fill(Theme.bg);
      p.stroke(m.server.color);
      p.strokeWeight(3);
      p.circle(pt.x, pt.y, 16);
      p.pop();
    }
    // key positions on the ring
    for (const k of this.keys) {
      const pt = this.ringPoint(k.h, r - 26);
      p.push();
      p.noStroke();
      p.fill(k.owner ? k.owner.color : Theme.muted);
      p.drawingContext.globalAlpha = 0.6;
      p.circle(pt.x, pt.y, 7);
      p.pop();
    }
    Draw.label(p, 'a key belongs to the', x, y - 12, { size: 12 });
    Draw.label(p, 'next node clockwise', x, y + 8, { size: 13, color: Theme.text, bold: true });
    Draw.label(p, `${this.servers.length} servers × ${this.vnodes} vnodes`, x, y + 30, { size: 11, color: Theme.dim });
  }

  drawModulo(p) {
    const { x, y } = this.ring;
    Draw.label(p, 'HASH % N', x, y - 200, { color: Theme.text, size: 16, bold: true });
    Draw.panel(p, x - 190, y - 70, 380, 150);
    Draw.label(p, `owner = servers[ hash(key) % ${this.servers.length} ]`, x, y - 30, { color: Theme.yellow, size: 17, bold: true });
    Draw.label(p, 'the server count is part of the formula,', x, y + 10, { size: 13 });
    Draw.label(p, 'so changing it re-homes almost every key', x, y + 32, { size: 13 });
    const pct = this.servers.length ? Math.round((this.servers.length / (this.servers.length + 1)) * 100) : 0;
    Draw.label(p, `adding one server now → ~${pct}% of keys move`, x, y + 110, { size: 13, color: Theme.orange, bold: true });
  }
}
