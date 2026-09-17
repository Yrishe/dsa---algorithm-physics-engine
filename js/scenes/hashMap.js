// Objects / hash maps: a key is hashed to a bucket index and its entry card
// drops into that bucket. Collisions pile up in the same bucket (chaining).
class HashMapScene extends Scene {
  static id = 'hash-map';
  static title = 'Objects & Hash Maps';
  static nav = 'key → hash → bucket';
  static group = 'Data Structures';
  static subtitle = 'Objects/Maps hash each key to a bucket, so lookups skip straight to the right place.';

  static BUCKETS = 7;

  setup() {
    const B = HashMapScene.BUCKETS;
    this.bucketW = 118;
    this.gap = 16;
    this.left = (this.W - (B * this.bucketW + (B - 1) * this.gap)) / 2;
    this.bucketTop = 290;
    this.bucketBottom = 590;
    this.cardH = 34;
    this.buckets = Array.from({ length: B }, () => []);
    this.hashView = null;
    this.activeBucket = -1;

    for (let b = 0; b < B; b++) {
      const x = this.bucketX(b);
      const h = this.bucketBottom - this.bucketTop;
      const style = { fill: Theme.line };
      this.physics.wall(x - this.bucketW / 2 - 3, this.bucketTop + h / 2, 6, h, style);
      this.physics.wall(x + this.bucketW / 2 + 3, this.bucketTop + h / 2, 6, h, style);
      this.physics.wall(x, this.bucketBottom + 4, this.bucketW + 12, 8, style);
    }

    this.codes = {
      hash: [
        'function hash(key, size) {',
        '  let h = 0;',
        '  for (const ch of key)',
        '    h += ch.charCodeAt(0);',
        '  return h % size;',
        '}',
      ],
      set: [
        'set(key, value) {',
        '  const i = hash(key, this.size);',
        '  const bucket = this.buckets[i];',
        '  const entry = bucket.find(e => e.key === key);',
        '  if (entry) entry.value = value;   // update',
        '  else bucket.push({ key, value }); // insert',
        '}',
      ],
      get: [
        'get(key) {',
        '  const i = hash(key, this.size);',
        '  const bucket = this.buckets[i];',
        '  for (const e of bucket)',
        '    if (e.key === key) return e.value;',
        '  return undefined;',
        '}',
      ],
      delete: [
        'delete(key) {',
        '  const i = hash(key, this.size);',
        '  const bucket = this.buckets[i];',
        '  const j = bucket.findIndex(e => e.key === key);',
        '  if (j !== -1) bucket.splice(j, 1);',
        '}',
      ],
    };

    this.run(async () => {
      const seed = [
        ['name', 'Ada'],
        ['age', '36'],
        ['city', 'London'],
        ['lang', 'JS'],
      ];
      for (const [k, v] of seed) await this.set(k, v, true);
      this.log('Try keys like "mane" (anagram of "name") to force a collision.', 'hint');
    });
  }

  controls() {
    const act = (fn) => () => this.run(fn);
    return [
      { type: 'input', id: 'key', label: 'Key', value: 'role', width: 110, maxLength: 10, onEnter: act(() => this.set()) },
      { type: 'input', id: 'val', label: 'Value', value: 'dev', width: 110, maxLength: 10, onEnter: act(() => this.set()) },
      { type: 'sep' },
      { type: 'button', label: 'set(key, value)', action: act(() => this.set()) },
      { type: 'button', label: 'get(key)', variant: 'secondary', action: act(() => this.get()) },
      { type: 'button', label: 'delete(key)', variant: 'secondary', action: act(() => this.remove()) },
      { type: 'button', label: 'has(key)', variant: 'secondary', action: act(() => this.get(true)) },
      { type: 'sep' },
      { type: 'button', label: 'Random entries', variant: 'ghost', action: act(() => this.randomEntries()) },
      { type: 'button', label: 'Clear', variant: 'danger', action: act(() => this.clear()) },
    ];
  }

  about() {
    return `
      <p>JavaScript <b>objects</b> and <b>Maps</b> are hash tables. A <b>hash function</b> turns a key into a number, and <code>number % bucketCount</code> picks a bucket.</p>
      <p>Because the bucket is computed directly, <code>set</code>, <code>get</code> and <code>delete</code> don't scan the whole table: <code>O(1)</code> on average.</p>
      <p>Two different keys can land in the same bucket. That's a <b>collision</b>; here entries are <i>chained</i> in the bucket and checked one by one. Real engines use better hash functions and grow the table to keep chains short. If every key collided, lookups would degrade to <code>O(n)</code>.</p>`;
  }

  complexity() {
    return [
      ['<code>set</code> / <code>get</code> / <code>delete</code>', 'O(1)', 'average case'],
      ['Same, all keys collide', 'O(n)', 'worst case'],
      ['Iterate all keys', 'O(n)', ''],
      ['Hash a key of length k', 'O(k)', ''],
    ];
  }

  bucketX(b) {
    return this.left + b * (this.bucketW + this.gap) + this.bucketW / 2;
  }

  get size() {
    return this.buckets.reduce((s, b) => s + b.length, 0);
  }

  updateStats() {
    const longest = Math.max(...this.buckets.map((b) => b.length));
    this.setStats({ entries: this.size, buckets: HashMapScene.BUCKETS, 'load factor': (this.size / HashMapScene.BUCKETS).toFixed(2), 'longest chain': longest });
  }

  readKey() {
    const k = this.inputValue('key');
    if (!k) this.log('Enter a key', 'warn');
    return k || null;
  }

  // Animate the hash computation character by character.
  async hashKey(key) {
    const size = HashMapScene.BUCKETS;
    this.hashView = { key, chars: [], sum: 0, index: null, step: -1 };
    this.code('hash', 1);
    await this.wait(200);
    for (let i = 0; i < key.length; i++) {
      this.line(3);
      this.hashView.step = i;
      this.hashView.sum += key.charCodeAt(i);
      await this.wait(Math.max(90, 420 / key.length));
    }
    this.line(4);
    this.hashView.step = key.length;
    this.hashView.index = this.hashView.sum % size;
    this.activeBucket = this.hashView.index;
    await this.wait(450);
    return this.hashView.index;
  }

  async set(key, value, quiet = false) {
    key = key ?? this.readKey();
    if (!key) return;
    value = value ?? (this.inputValue('val') || 'null');

    const i = await this.hashKey(key);
    this.code('set', 1);
    const bucket = this.buckets[i];
    this.line(3);
    for (const e of bucket) {
      e.body.style.highlight = Theme.yellow;
      await this.wait(220);
      if (e.key === key) {
        this.line(4);
        e.value = value;
        e.body.style.label = `${key}: ${value}`;
        e.body.style.textSize = Math.min(13, (this.bucketW - 14) / (0.62 * (key.length + value.length + 2)));
        e.body.style.highlight = Theme.green;
        Body.setVelocity(e.body, { x: 0, y: -6 });
        this.log(`set("${key}") updated existing entry in bucket ${i}`, 'ok');
        await this.wait(500);
        e.body.style.highlight = null;
        this.done();
        return;
      }
      e.body.style.highlight = null;
    }

    this.line(5);
    if (bucket.length >= 8) {
      this.log(`Bucket ${i} is full on screen`, 'warn');
      this.done();
      return;
    }
    const body = this.physics.tile(this.bucketX(i), 200, this.bucketW - 8, this.cardH, `${key}: ${value}`, {
      fill: Theme.colorFor(i),
      textSize: Math.min(13, (this.bucketW - 14) / (0.62 * (key.length + value.length + 2))),
      radius: 5,
    });
    body.friction = 0.1;
    const entry = { key, value, body };
    bucket.push(entry);
    await this.anim.waitUntil(() => Physics.speedOf(body) < 0.05 && body.position.y > this.bucketTop, 2500);
    if (!quiet) this.log(`set("${key}", "${value}") → bucket ${i}${bucket.length > 1 ? ` (collision! chain length ${bucket.length})` : ''}`, bucket.length > 1 ? 'hint' : 'ok');
    this.done();
  }

  async get(onlyHas = false) {
    const key = this.readKey();
    if (!key) return;
    const i = await this.hashKey(key);
    this.code('get', 1);
    let checks = 0;
    for (const e of this.buckets[i]) {
      this.line(4);
      checks++;
      e.body.style.highlight = Theme.yellow;
      await this.wait(320);
      if (e.key === key) {
        e.body.style.highlight = Theme.green;
        e.body.style.glow = Theme.green;
        this.log(onlyHas ? `has("${key}") → true (${checks} check${checks > 1 ? 's' : ''})` : `get("${key}") → "${e.value}" (bucket ${i}, ${checks} check${checks > 1 ? 's' : ''})`, 'ok');
        await this.wait(800);
        e.body.style.highlight = null;
        e.body.style.glow = null;
        this.done();
        return;
      }
      e.body.style.highlight = null;
    }
    this.line(5);
    this.log(onlyHas ? `has("${key}") → false` : `get("${key}") → undefined (bucket ${i} checked ${checks} entries)`, 'warn');
    this.done();
  }

  async remove() {
    const key = this.readKey();
    if (!key) return;
    const i = await this.hashKey(key);
    this.code('delete', 3);
    const bucket = this.buckets[i];
    const j = bucket.findIndex((e) => e.key === key);
    const upto = j === -1 ? bucket.length - 1 : j;
    for (let k = 0; k <= upto; k++) {
      bucket[k].body.style.highlight = Theme.yellow;
      await this.wait(220);
      bucket[k].body.style.highlight = null;
    }
    if (j === -1) {
      this.log(`delete("${key}") → false, key not found`, 'warn');
      this.done();
      return;
    }
    this.line(4);
    const [e] = bucket.splice(j, 1);
    e.body.style.highlight = Theme.red;
    await this.wait(250);
    this.physics.fling(e.body, (Math.random() - 0.5) * 6, -12, (Math.random() - 0.5) * 0.3);
    // wake the cards above so they settle down into the gap
    bucket.forEach((o) => Body.setVelocity(o.body, { x: 0, y: 0.5 }));
    this.log(`delete("${key}") removed it from bucket ${i}`, 'ok');
    await this.wait(600);
    this.done();
  }

  done() {
    this.activeBucket = -1;
    this.hashView = null;
    this.updateStats();
  }

  async randomEntries() {
    const keys = ['id', 'email', 'score', 'level', 'color', 'team', 'role', 'x', 'y', 'zip', 'tags', 'dob'];
    const vals = ['7', 'a@b.io', '99', '3', 'red', 'blue', 'dev', '10', '20', '1234', '[..]', '1990'];
    for (let n = 0; n < 4; n++) {
      const k = Math.floor(Math.random() * keys.length);
      this.ui.key.value = keys[k];
      this.ui.val.value = vals[k];
      await this.set();
    }
  }

  async clear() {
    for (const bucket of this.buckets) for (const e of bucket) this.physics.fling(e.body, (Math.random() - 0.5) * 8, -10 - Math.random() * 5, (Math.random() - 0.5) * 0.4);
    this.buckets = this.buckets.map(() => []);
    this.updateStats();
    await this.wait(300);
  }

  draw(p) {
    // buckets
    for (let b = 0; b < HashMapScene.BUCKETS; b++) {
      const x = this.bucketX(b);
      if (b === this.activeBucket) {
        p.push();
        p.noStroke();
        p.fill(255, 255, 255, 14);
        p.rect(x - this.bucketW / 2, this.bucketTop, this.bucketW, this.bucketBottom - this.bucketTop, 4);
        p.pop();
      }
      Draw.label(p, `[${b}]`, x, this.bucketTop - 18, { color: b === this.activeBucket ? Theme.yellow : Theme.muted, size: 15, bold: b === this.activeBucket });
    }
    this.physics.render(p);

    // hash computation
    const hv = this.hashView;
    const cy = 90;
    if (!hv) {
      Draw.label(p, 'hash(key) = (sum of character codes) % 7', this.W / 2, cy, { size: 16, color: Theme.muted });
      return;
    }
    const chars = hv.key.split('');
    const cw = 44;
    const x0 = this.W / 2 - (chars.length * cw) / 2 + cw / 2;
    Draw.label(p, `hash("${hv.key}")`, this.W / 2, cy - 50, { size: 18, color: Theme.text, bold: true });
    chars.forEach((ch, i) => {
      const x = x0 + i * cw;
      const on = i <= hv.step;
      Draw.box(p, x, cy, cw - 6, 36, { fill: on ? Theme.surface2 : Theme.bg, stroke: i === hv.step ? Theme.yellow : Theme.line, label: ch, textColor: Theme.text, size: 16 });
      if (on) Draw.label(p, ch.charCodeAt(0), x, cy + 32, { size: 12, color: Theme.cyan });
    });
    const sumText = hv.index === null ? `sum = ${hv.sum}` : `${hv.sum} % 7 = ${hv.index}`;
    Draw.label(p, sumText, this.W / 2, cy + 70, { size: 18, color: hv.index === null ? Theme.cyan : Theme.yellow, bold: true });
    if (hv.index !== null) {
      Draw.arrow(p, this.W / 2, cy + 90, this.bucketX(hv.index), this.bucketTop - 40, { color: Theme.yellow, dash: [6, 6] });
    }
  }
}
