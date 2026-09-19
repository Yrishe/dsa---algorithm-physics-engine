// Caching: every request looks in the cache first. A hit returns immediately;
// a miss falls through to the slow database and fills the cache, evicting the
// least recently used entry when it is full.
class CachingScene extends Scene {
  static id = 'caching';
  static title = 'Caching & Eviction';
  static nav = 'cache-aside, LRU, hit ratio';
  static group = 'System Design';
  static subtitle = 'A small fast store in front of a slow one. The hit ratio decides your average latency.';

  static KEYS = 'ABCDEFGHIJKLMNOPQRST'.split('');
  static HIT_MS = 5;
  static DB_MS = 120;

  setup() {
    this.capacity = 5;
    this.policy = 'lru';
    this.workload = 'hot';
    this.rate = 1.6;
    this.cache = []; // [0] = least recently used, [n-1] = most recent
    this.shelfY = 300;
    this.slotW = 96;
    this.tileW = 78;
    this.tileH = 58;
    this.db = { x: 370, y: 470, w: 260, h: 86 };
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.inflight = 0;
    this.scanAt = 0;
    this.flow = 0;
    this.dbBusy = 0;

    this.physics.wall(this.W / 2, this.shelfY + this.tileH / 2 + 6, 7 * this.slotW, 8, { fill: Theme.line });
    this.arrivals = new Arrivals(this.rate);
    this.dbRate = new RateMeter();
    this.reqRate = new RateMeter();

    this.codes = {
      aside: [
        '// cache-aside (lazy loading)',
        'async function get(key) {',
        '  const cached = await cache.get(key);',
        '  if (cached !== undefined) return cached;   // HIT',
        '',
        '  const value = await db.query(key);         // MISS',
        '  await cache.set(key, value, { ttl: 300 });',
        '  return value;',
        '}',
        '',
        '// average latency =',
        '//   hitRatio × 5ms + (1 − hitRatio) × 125ms',
      ],
    };
    this.code('aside');
    this.log('Hot-key traffic warms the cache. Switch to "scan" to see LRU thrash.', 'hint');
  }

  controls() {
    return [
      {
        type: 'select',
        id: 'workload',
        label: 'Workload',
        value: 'hot',
        options: [
          { value: 'hot', label: 'hot keys (80/20)' },
          { value: 'uniform', label: 'uniform random' },
          { value: 'scan', label: 'sequential scan' },
        ],
        onChange: (v) => {
          this.workload = v;
          this.log(v === 'scan' ? 'Scanning every key in turn: each one evicts the entry we need next.' : `Workload: ${v}`, v === 'scan' ? 'hint' : 'info');
        },
      },
      {
        type: 'select',
        id: 'policy',
        label: 'Eviction',
        value: 'lru',
        options: [
          { value: 'lru', label: 'LRU' },
          { value: 'fifo', label: 'FIFO' },
          { value: 'random', label: 'random' },
        ],
        onChange: (v) => (this.policy = v),
      },
      { type: 'range', id: 'cap', label: 'Cache size', min: 2, max: 7, step: 1, value: 5, onInput: (v) => this.setCapacity(v) },
      { type: 'range', id: 'rate', label: 'Traffic (req/s)', min: 0, max: 6, step: 0.5, value: 1.5, onInput: (v) => (this.rate = v) },
      { type: 'sep' },
      { type: 'button', label: 'Cache stampede', lock: false, title: 'Six requests for the same cold key at once', action: () => this.stampede() },
      { type: 'button', label: 'Flush cache', variant: 'danger', lock: false, action: () => this.flush() },
      { type: 'button', label: 'Reset stats', variant: 'ghost', lock: false, action: () => this.resetStats() },
    ];
  }

  about() {
    return `
      <p>The <b>cache-aside</b> pattern: look in the cache, and only on a miss ask the database and store the answer. Here a hit costs <code>5 ms</code> and a miss <code>125 ms</code>, so the average latency is <code>hitRatio × 5 + (1 − hitRatio) × 125</code>.</p>
      <p>Caches are small, so something must go when they fill up. <b>LRU</b> evicts the least recently used entry — great for hot keys, terrible for a <i>sequential scan</i>, where every entry is evicted just before it is needed again.</p>
      <p>A <b>cache stampede</b> happens when many requests miss the same key at once and all hit the database. Fixes: single-flight/request coalescing, a short lock, or refreshing entries before they expire.</p>
      <p>Other knobs: <b>TTL</b> (entries expire), <b>write-through</b> vs <b>write-back</b> vs <b>write-around</b>, and cache invalidation — famously one of the two hard problems.</p>
      <p>The stats show the <i>modelled</i> latency; the animation is slowed down so you can watch it.</p>`;
  }

  complexityTitle() {
    return 'Rules of thumb';
  }

  complexity() {
    return [
      ['Cache hit', '5 ms', 'RAM / Redis'],
      ['Cache miss', '125 ms', 'lookup + database'],
      ['90% hit ratio', '17 ms avg', '10% of traffic reaches the DB'],
      ['50% hit ratio', '65 ms avg', 'half the traffic reaches the DB'],
      ['Hot keys', 'LRU wins', 'scans defeat it'],
    ];
  }

  // ---- cache helpers --------------------------------------------------------

  slotX(i, n = this.capacity) {
    return this.W / 2 + (i - (n - 1) / 2) * this.slotW;
  }

  setCapacity(v) {
    this.capacity = v;
    while (this.cache.length > v) this.evict('resized');
    this.relayout();
  }

  relayout() {
    this.cache.forEach((e, i) => this.physics.moveTo(this.anim, e.body, this.slotX(i), this.shelfY, 320));
  }

  touch(i) {
    // move the entry to the most-recently-used end
    const [e] = this.cache.splice(i, 1);
    this.cache.push(e);
    this.relayout();
  }

  evict(why = 'capacity') {
    if (!this.cache.length) return;
    let i = 0; // LRU and FIFO both evict from the left
    if (this.policy === 'random') i = Math.floor(Math.random() * this.cache.length);
    const [e] = this.cache.splice(i, 1);
    e.body.style.fill = Theme.red;
    this.physics.fling(e.body, -2 + Math.random() * 4, -9, 0.3);
    this.evictions++;
    this.relayout();
    if (why === 'capacity') this.log(`evicted "${e.key}" (${this.policy.toUpperCase()})`, 'step');
    return e;
  }

  insert(key) {
    if (this.cache.some((e) => e.key === key)) return;
    if (this.cache.length >= this.capacity) this.evict();
    const x = this.slotX(this.cache.length);
    const body = this.physics.tile(x, 120, this.tileW, this.tileH, key, { fill: Theme.colorForValue(key), textSize: 24, radius: 8 });
    const entry = { key, body };
    this.cache.push(entry);
    this.physics.dropTo(this.anim, body, x, this.shelfY, 2500);
  }

  flush() {
    while (this.cache.length) {
      const [e] = this.cache.splice(0, 1);
      e.body.style.fill = Theme.red;
      this.physics.fling(e.body, (Math.random() - 0.5) * 8, -8, 0.3);
    }
    this.log('Cache flushed — the next requests all miss (cold cache)', 'warn');
  }

  resetStats() {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  nextKey() {
    const keys = CachingScene.KEYS;
    if (this.workload === 'scan') {
      this.scanAt = (this.scanAt + 1) % keys.length;
      return keys[this.scanAt];
    }
    if (this.workload === 'uniform') return keys[Math.floor(Math.random() * keys.length)];
    // hot keys: 80% of traffic on the first 20% of keys
    const hot = Math.max(1, Math.round(keys.length * 0.2));
    return Math.random() < 0.8 ? keys[Math.floor(Math.random() * hot)] : keys[hot + Math.floor(Math.random() * (keys.length - hot))];
  }

  stampede() {
    const key = CachingScene.KEYS.find((k) => !this.cache.some((e) => e.key === k)) || 'Z';
    this.log(`Stampede: 6 requests for "${key}" at once — every one of them misses`, 'warn');
    for (let i = 0; i < 6; i++) this.request(key, i * 60);
  }

  // ---- request flow ---------------------------------------------------------

  async request(key, delay = 0) {
    const body = this.physics.tile(120 + Math.random() * 40, 120, 34, 34, key, { fill: Theme.surface2, textColor: Theme.text, textSize: 16, radius: 17, stroke: Theme.accent });
    this.physics.freeze(body);
    this.inflight++;
    this.reqRate.add();
    if (delay) await this.wait(delay);

    this.line(2);
    await this.physics.moveTo(this.anim, body, this.W / 2, this.shelfY - 130, 420, { arc: 30 });

    const i = this.cache.findIndex((e) => e.key === key);
    let latency;
    if (i >= 0) {
      // hit
      const entry = this.cache[i];
      this.line(3);
      entry.body.style.highlight = Theme.green;
      entry.body.style.glow = Theme.green;
      body.style.fill = Theme.green;
      body.style.textColor = Theme.bg;
      this.hits++;
      await this.physics.moveTo(this.anim, body, entry.body.position.x, this.shelfY - 54, 260);
      if (this.policy === 'lru') this.touch(i);
      await this.wait(160);
      entry.body.style.highlight = null;
      entry.body.style.glow = null;
      latency = CachingScene.HIT_MS;
    } else {
      // miss → database
      this.line(5);
      body.style.fill = Theme.orange;
      this.misses++;
      this.dbRate.add();
      await this.physics.moveTo(this.anim, body, this.db.x + this.db.w / 2, this.db.y + 30, 480, { arc: -30 });
      this.dbBusy = Math.max(this.dbBusy, 600);
      await this.wait(620);
      this.line(6);
      body.style.fill = Theme.green;
      body.style.textColor = Theme.bg;
      this.insert(key);
      await this.physics.moveTo(this.anim, body, this.W / 2 + 120, this.shelfY - 130, 420, { arc: 40 });
      latency = CachingScene.DB_MS + CachingScene.HIT_MS;
    }

    this.line(7);
    this.inflight--;
    this.physics.fling(body, 11, -5, 0.1);
  }

  update(dt) {
    if (dt <= 0) return;
    this.flow += dt * 0.05;
    this.dbBusy = Math.max(0, this.dbBusy - dt);
    this.reqRate.tick(dt);
    this.dbRate.tick(dt);
    this.arrivals.rate = this.rate;
    this.arrivals.tick(dt, () => {
      if (this.inflight < 14) this.request(this.nextKey());
    });

    const total = this.hits + this.misses;
    const ratio = total ? this.hits / total : 0;
    this.setStats({
      hits: this.hits,
      misses: this.misses,
      'hit ratio': `${Math.round(ratio * 100)}%`,
      'avg latency': Flow.ms(total ? ratio * CachingScene.HIT_MS + (1 - ratio) * (CachingScene.DB_MS + CachingScene.HIT_MS) : 0),
      evictions: this.evictions,
      'DB req/s': this.dbRate.rate.toFixed(1),
    });
  }

  // ---- drawing --------------------------------------------------------------

  draw(p) {
    Flow.box(p, { x: 60, y: 60, w: 160, h: 58, title: 'CLIENTS', color: Theme.green, sub: `${this.reqRate.rate.toFixed(1)} req/s` });
    Flow.pipe(p, 220, 89, this.W / 2 - 200, this.shelfY - 130, { flow: this.flow });

    // cache shelf
    const left = this.slotX(0) - this.slotW / 2;
    const right = this.slotX(this.capacity - 1) + this.slotW / 2;
    Draw.panel(p, left - 14, this.shelfY - 118, right - left + 28, 190, { fill: 'rgba(124,156,255,0.06)', stroke: Theme.accent });
    Draw.label(p, 'CACHE', (left + right) / 2, this.shelfY - 100, { color: Theme.accent, size: 14, bold: true });
    Draw.label(p, `${this.cache.length}/${this.capacity} entries · ${this.policy.toUpperCase()} eviction · 5 ms`, (left + right) / 2, this.shelfY - 80, { size: 12 });

    for (let i = 0; i < this.capacity; i++) {
      const x = this.slotX(i);
      p.push();
      p.noFill();
      p.stroke(i < this.cache.length ? Theme.line : Theme.grid);
      p.strokeWeight(1.5);
      p.drawingContext.setLineDash(i < this.cache.length ? [] : [5, 5]);
      p.rect(x - this.tileW / 2 - 4, this.shelfY - this.tileH / 2 - 4, this.tileW + 8, this.tileH + 8, 8);
      p.pop();
    }
    Draw.label(p, this.policy === 'fifo' ? 'oldest insert →' : 'least recent →', left + 4, this.shelfY + 56, { align: 'left', size: 11, color: Theme.dim });
    Draw.label(p, '← most recent', right - 4, this.shelfY + 56, { align: 'right', size: 11, color: Theme.dim });

    // database
    Flow.pipe(p, this.W / 2, this.shelfY + 72, this.db.x + this.db.w / 2, this.db.y, { flow: this.flow, color: this.dbBusy ? Theme.orange : Theme.line });
    Flow.box(p, {
      x: this.db.x,
      y: this.db.y,
      w: this.db.w,
      h: this.db.h,
      title: 'DATABASE',
      color: this.dbBusy ? Theme.orange : Theme.cyan,
      sub: `source of truth · 120 ms`,
    });
    Flow.meter(p, this.db.x + 30, this.db.y + this.db.h - 20, this.db.w - 60, 8, this.dbRate.rate / 4, this.dbRate.rate > 3 ? Theme.red : Theme.cyan);
    Draw.label(p, `${this.dbRate.rate.toFixed(1)} req/s reaching the database`, this.db.x + this.db.w / 2, this.db.y + this.db.h + 22, { size: 12 });

    this.physics.render(p);

    Flow.legend(p, 70, this.H - 14, [
      ['request', Theme.accent],
      ['hit', Theme.green],
      ['miss → DB', Theme.orange],
      ['evicted', Theme.red],
    ]);
  }
}
