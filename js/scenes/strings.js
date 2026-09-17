// Strings: letter tiles on a shelf. Because JS strings are immutable, every
// operation copies characters into a brand-new string on the lower shelf.
class StringScene extends Scene {
  static id = 'strings';
  static title = 'String Operations';
  static nav = 'reverse, slice, search…';
  static group = 'Strings';
  static subtitle = 'Strings are sequences of characters. In JavaScript they are immutable: every operation builds a new string.';

  static MAX = 16;

  setup() {
    this.srcY = 250;
    this.resY = 480;
    this.src = { text: '', tiles: [], size: 50 };
    this.res = { tiles: [], label: '', text: null };
    this.ptrs = [];
    this.groups = [];
    this.physics.wall(this.W / 2, this.srcY + 34, this.W - 60, 8);
    this.physics.wall(this.W / 2, this.resY + 34, this.W - 60, 8);

    this.codes = {
      charAt: ['const ch = str[i];      // or str.charAt(i)', '// direct index → O(1)'],
      reverse: ["let out = '';", 'for (let i = str.length - 1; i >= 0; i--)', '  out += str[i];', '// one-liner: [...str].reverse().join("")'],
      upper: ['const out = str.toUpperCase();', '// visits every char → O(n)'],
      slice: ['const part = str.slice(start, end);', '// copies end - start chars → O(k)'],
      concat: ['const out = str + other;   // or str.concat(other)', '// copies both → O(n + m)', '', '// ⚠ building with += in a loop can be O(n²):', '// prefer parts.push(x) then parts.join("")'],
      indexOf: [
        'function indexOf(str, pat) {',
        '  for (let i = 0; i + pat.length <= str.length; i++) {',
        '    let j = 0;',
        '    while (j < pat.length && str[i + j] === pat[j]) j++;',
        '    if (j === pat.length) return i;',
        '  }',
        '  return -1;',
        '}',
        '// naive search: O(n · m) worst case',
      ],
      palindrome: [
        'function isPalindrome(str) {',
        '  let i = 0, j = str.length - 1;',
        '  while (i < j) {',
        '    if (str[i] !== str[j]) return false;',
        '    i++; j--;',
        '  }',
        '  return true;',
        '}',
      ],
      split: ['const parts = str.split(sep);', '// scans once, copying chars between separators', '// → O(n)'],
    };

    this.run(() => this.setString('hello world'));
  }

  controls() {
    const act = (fn) => () => this.run(fn);
    return [
      { type: 'input', id: 'text', label: 'String (max 16)', value: 'hello world', width: 170, maxLength: StringScene.MAX, onEnter: act(() => this.setString()) },
      { type: 'button', label: 'Set', variant: 'secondary', action: act(() => this.setString()) },
      { type: 'input', id: 'arg', label: 'Argument', value: 'o', placeholder: 'index / pattern / sep', width: 120, maxLength: 16 },
      { type: 'sep' },
      { type: 'button', label: 'str[arg]', action: act(() => this.charAt()) },
      { type: 'button', label: 'reverse', action: act(() => this.reverse()) },
      { type: 'button', label: 'toUpperCase', action: act(() => this.upper()) },
      { type: 'button', label: 'slice(a,b)', action: act(() => this.slice()) },
      { type: 'button', label: 'concat', action: act(() => this.concat()) },
      { type: 'button', label: 'indexOf', action: act(() => this.indexOf()) },
      { type: 'button', label: 'split', action: act(() => this.split()) },
      { type: 'button', label: 'isPalindrome', action: act(() => this.palindrome()) },
    ];
  }

  about() {
    return `
      <p>A <b>string</b> is an ordered sequence of characters, indexed from <code>0</code>. Reading <code>str[i]</code> is <code>O(1)</code>.</p>
      <p>JavaScript strings are <b>immutable</b>: <code>reverse</code>, <code>toUpperCase</code>, <code>slice</code> and <code>concat</code> never change the original. They copy characters into a new string (bottom shelf), so their cost grows with the number of characters copied.</p>
      <p>Classic interview patterns shown here: <b>two pointers</b> (palindrome check) and <b>sliding a pattern</b> across the text (naive <code>indexOf</code>).</p>
      <p>Put the argument in the <i>Argument</i> box: an index for <code>str[i]</code>, <code>2,7</code> for <code>slice</code>, a pattern for <code>indexOf</code>, a separator for <code>split</code>, or text to append for <code>concat</code>.</p>`;
  }

  complexity() {
    return [
      ['<code>str[i]</code> / <code>length</code>', 'O(1)', ''],
      ['<code>slice</code> / <code>substring</code>', 'O(k)', 'k = copied chars'],
      ['<code>concat</code> / <code>+</code>', 'O(n + m)', ''],
      ['<code>reverse</code>, <code>toUpperCase</code>, <code>split</code>', 'O(n)', ''],
      ['Palindrome (two pointers)', 'O(n)', ''],
      ['Naive <code>indexOf</code>', 'O(n·m)', 'KMP makes it O(n + m)'],
      ['<code>+=</code> inside a loop', 'O(n²)', 'copies grow each time'],
    ];
  }

  // ---- layout helpers ----------------------------------------------------------

  sizeFor(len) {
    return Math.min(52, (this.W - 100) / Math.max(1, len));
  }

  xFor(i, len, size) {
    return this.W / 2 + (i - (len - 1) / 2) * size;
  }

  makeTile(ch, x, y, size, style = {}) {
    const shown = ch === ' ' ? '␣' : ch;
    return this.physics.tile(x, y, size - 5, size - 5, shown, {
      fill: ch === ' ' ? Theme.surface2 : Theme.colorForValue(ch.toLowerCase()),
      textColor: ch === ' ' ? Theme.muted : Theme.bg,
      textSize: Math.min(22, size * 0.48),
      ...style,
    });
  }

  updateStats() {
    this.setStats({ length: this.src.text.length, result: this.res.text === null ? '—' : JSON.stringify(this.res.text) });
  }

  async clearResult() {
    for (const t of this.res.tiles) this.physics.fling(t, (Math.random() - 0.5) * 6, -6 - Math.random() * 4, (Math.random() - 0.5) * 0.3);
    this.res = { tiles: [], label: '', text: null };
    this.groups = [];
    this.ptrs = [];
    this.clearHighlights();
    this.updateStats();
  }

  clearHighlights() {
    for (const t of this.src.tiles) {
      t.style.highlight = null;
      t.style.glow = null;
    }
  }

  async setString(text) {
    text = text ?? this.ui.text.value;
    if (text.length > StringScene.MAX) text = text.slice(0, StringScene.MAX);
    if (!text.length) return this.log('Enter a string', 'warn');
    await this.clearResult();
    for (const t of this.src.tiles) this.physics.fling(t, (Math.random() - 0.5) * 8, -8, (Math.random() - 0.5) * 0.3);

    const size = this.sizeFor(text.length);
    this.src = { text, tiles: [], size };
    const drops = [];
    [...text].forEach((ch, i) => {
      const x = this.xFor(i, text.length, size);
      const t = this.makeTile(ch, x, -30 - i * 28, size);
      this.src.tiles.push(t);
      drops.push(this.physics.dropTo(this.anim, t, x, this.srcY, 4000));
    });
    this.updateStats();
    await Promise.all(drops);
    this.log(`str = "${text}" (length ${text.length})`, 'ok');
  }

  // Copy a character tile from its source position into a result slot.
  async copyChar(ch, fromIndex, slotX, size, { delay = 260, style = {} } = {}) {
    const from = this.src.tiles[fromIndex];
    const t = this.makeTile(ch, from ? from.position.x : this.W / 2, from ? from.position.y : -40, size, style);
    this.physics.freeze(t);
    this.res.tiles.push(t);
    await this.physics.moveTo(this.anim, t, slotX, this.resY, delay + 120, { arc: 60 });
  }

  // ---- operations ------------------------------------------------------------

  async charAt() {
    const raw = this.inputValue('arg');
    const i = Number(raw);
    const n = this.src.text.length;
    if (raw === '' || !Number.isInteger(i) || i < 0 || i >= n) return this.log(`Argument must be an index 0…${n - 1}`, 'warn');
    await this.clearResult();
    this.code('charAt', 0);
    this.ptrs = [{ i, label: `i=${i}`, color: Theme.yellow }];
    const t = this.src.tiles[i];
    t.style.highlight = Theme.yellow;
    t.style.glow = Theme.yellow;
    await this.wait(700);
    this.log(`str[${i}] → "${this.src.text[i]}" in one step`, 'ok');
    await this.wait(500);
    this.clearHighlights();
    this.ptrs = [];
  }

  async reverse() {
    await this.clearResult();
    const s = this.src.text;
    this.code('reverse', 1);
    this.res.label = 'new string (reversed)';
    for (let i = s.length - 1; i >= 0; i--) {
      const j = s.length - 1 - i;
      this.line(2);
      this.ptrs = [{ i, label: 'i', color: Theme.yellow }];
      await this.copyChar(s[i], i, this.xFor(j, s.length, this.src.size), this.src.size);
    }
    this.ptrs = [];
    this.res.text = [...s].reverse().join('');
    this.updateStats();
    this.log(`reverse → "${this.res.text}" (${s.length} copies, original unchanged)`, 'ok');
  }

  async upper() {
    await this.clearResult();
    const s = this.src.text;
    this.code('upper', 0);
    this.res.label = 'new string (toUpperCase)';
    for (let i = 0; i < s.length; i++) {
      this.ptrs = [{ i, label: 'i', color: Theme.yellow }];
      const changed = s[i] !== s[i].toUpperCase();
      await this.copyChar(s[i].toUpperCase(), i, this.xFor(i, s.length, this.src.size), this.src.size, { delay: 170, style: changed ? { stroke: Theme.text, strokeWeight: 2 } : {} });
    }
    this.ptrs = [];
    this.res.text = s.toUpperCase();
    this.updateStats();
    this.log(`toUpperCase → "${this.res.text}"`, 'ok');
  }

  async slice() {
    const s = this.src.text;
    const parts = this.inputValue('arg').split(',').map((x) => x.trim());
    let a = Number(parts[0]);
    let b = parts[1] === undefined || parts[1] === '' ? s.length : Number(parts[1]);
    if (!Number.isInteger(a) || !Number.isInteger(b)) return this.log('Argument for slice looks like "2,7" (start,end)', 'warn');
    if (a < 0) a = Math.max(0, s.length + a);
    if (b < 0) b = Math.max(0, s.length + b);
    a = Math.min(a, s.length);
    b = Math.min(b, s.length);
    await this.clearResult();
    this.code('slice', 0);
    this.res.label = `str.slice(${a}, ${b})`;
    this.ptrs = [
      { i: a, label: 'start', color: Theme.green },
      { i: Math.max(a, b - 1), label: 'end-1', color: Theme.pink },
    ];
    for (let i = a; i < b; i++) this.src.tiles[i].style.highlight = Theme.yellow;
    await this.wait(600);
    const len = b - a;
    for (let i = a; i < b; i++) await this.copyChar(s[i], i, this.xFor(i - a, len, this.src.size), this.src.size, { delay: 200 });
    this.res.text = s.slice(a, b);
    this.clearHighlights();
    this.ptrs = [];
    this.updateStats();
    this.log(`slice(${a}, ${b}) → "${this.res.text}" (copied ${len} chars)`, 'ok');
  }

  async concat() {
    const s = this.src.text;
    const other = this.ui.arg.value;
    if (!other) return this.log('Put the text to append in Argument', 'warn');
    const total = s.length + other.length;
    if (total > 20) return this.log('Result would be too long to show (max 20 chars)', 'warn');
    await this.clearResult();
    this.code('concat', 0);
    this.res.label = `str + "${other}"`;
    const size = Math.min(this.src.size, this.sizeFor(total));
    for (let i = 0; i < s.length; i++) await this.copyChar(s[i], i, this.xFor(i, total, size), size, { delay: 140 });
    for (let k = 0; k < other.length; k++) {
      const t = this.makeTile(other[k], this.W + 40, 120, size, { stroke: Theme.text, strokeWeight: 2 });
      this.physics.freeze(t);
      this.res.tiles.push(t);
      await this.physics.moveTo(this.anim, t, this.xFor(s.length + k, total, size), this.resY, 300, { arc: 40 });
    }
    this.res.text = s + other;
    this.updateStats();
    this.log(`concat → "${this.res.text}" (${total} chars copied into a new string)`, 'ok');
  }

  async indexOf() {
    const s = this.src.text;
    const pat = this.ui.arg.value;
    if (!pat) return this.log('Put the pattern to search for in Argument', 'warn');
    if (pat.length > s.length) return this.log('Pattern is longer than the string', 'warn');
    await this.clearResult();
    this.code('indexOf', 1);
    this.res.label = `pattern "${pat}"`;
    const size = this.src.size;
    const n = s.length;
    const m = pat.length;
    // pattern tiles sit on the lower shelf and slide under each alignment
    const pTiles = [...pat].map((ch, j) => {
      const t = this.makeTile(ch, this.xFor(j, n, size), this.resY - 90, size);
      this.physics.freeze(t);
      return t;
    });
    this.res.tiles = pTiles;
    await Promise.all(pTiles.map((t, j) => this.physics.moveTo(this.anim, t, this.xFor(j, n, size), this.resY, 400)));

    let comparisons = 0;
    for (let i = 0; i + m <= n; i++) {
      this.line(1);
      await Promise.all(pTiles.map((t, j) => this.physics.moveTo(this.anim, t, this.xFor(i + j, n, size), this.resY, 220)));
      this.ptrs = [{ i, label: `i=${i}`, color: Theme.yellow }];
      let j = 0;
      while (j < m) {
        this.line(3);
        comparisons++;
        const ok = s[i + j] === pat[j];
        const col = ok ? Theme.green : Theme.red;
        this.src.tiles[i + j].style.highlight = col;
        pTiles[j].style.highlight = col;
        this.setStats({ length: n, pattern: m, comparisons });
        await this.wait(230);
        if (!ok) break;
        j++;
      }
      if (j === m) {
        this.line(4);
        for (let k = 0; k < m; k++) this.src.tiles[i + k].style.glow = Theme.green;
        this.res.text = i;
        this.log(`indexOf("${pat}") → ${i} after ${comparisons} character comparisons`, 'ok');
        await this.wait(900);
        this.clearHighlights();
        pTiles.forEach((t) => (t.style.highlight = null));
        this.ptrs = [];
        return;
      }
      await this.wait(120);
      this.clearHighlights();
      pTiles.forEach((t) => (t.style.highlight = null));
    }
    this.line(6);
    this.ptrs = [];
    this.res.text = -1;
    this.log(`indexOf("${pat}") → -1 after ${comparisons} comparisons`, 'warn');
  }

  async split() {
    const s = this.src.text;
    const sep = this.ui.arg.value;
    if (sep.length !== 1) return this.log('Use a single-character separator in Argument (e.g. a space)', 'warn');
    await this.clearResult();
    this.code('split', 0);
    const parts = s.split(sep);
    this.res.label = `str.split("${sep === ' ' ? '␣' : sep}") → ${parts.length} parts`;
    const size = Math.min(this.src.size, this.sizeFor(s.length - (parts.length - 1) + (parts.length - 1) * 1.2));
    // slots: characters of each part with a gap between parts
    const totalUnits = s.length - (parts.length - 1) + (parts.length - 1) * 1.2;
    let unit = 0;
    let i = 0;
    this.groups = [];
    for (let p = 0; p < parts.length; p++) {
      const startUnit = unit;
      for (let k = 0; k < parts[p].length; k++, i++, unit++) {
        this.ptrs = [{ i, label: 'i', color: Theme.yellow }];
        await this.copyChar(s[i], i, this.xFor(unit, totalUnits, size), size, { delay: 150 });
      }
      this.groups.push({ from: this.xFor(startUnit, totalUnits, size) - size / 2 + 3, to: this.xFor(Math.max(startUnit, unit - 1), totalUnits, size) + size / 2 - 3, label: `[${p}] "${parts[p]}"`, empty: parts[p].length === 0 });
      if (p < parts.length - 1) {
        // separator is consumed, not copied
        this.ptrs = [{ i, label: 'sep', color: Theme.red }];
        this.src.tiles[i].style.highlight = Theme.red;
        await this.wait(250);
        this.src.tiles[i].style.highlight = null;
        i++;
        unit += 1.2;
      }
    }
    this.ptrs = [];
    this.res.text = parts;
    this.setStats({ length: s.length, parts: parts.length });
    this.log(`split → [${parts.map((x) => JSON.stringify(x)).join(', ')}]`, 'ok');
  }

  async palindrome() {
    await this.clearResult();
    const s = this.src.text;
    this.code('palindrome', 1);
    let i = 0;
    let j = s.length - 1;
    let comparisons = 0;
    while (i < j) {
      this.line(3);
      this.ptrs = [
        { i, label: 'i', color: Theme.cyan },
        { i: j, label: 'j', color: Theme.pink },
      ];
      comparisons++;
      const ok = s[i] === s[j];
      const a = this.src.tiles[i];
      const b = this.src.tiles[j];
      a.style.highlight = b.style.highlight = ok ? Theme.green : Theme.red;
      await this.wait(450);
      if (!ok) {
        this.log(`"${s}" is NOT a palindrome: '${s[i]}' ≠ '${s[j]}' (${comparisons} comparisons)`, 'warn');
        await this.wait(700);
        this.clearHighlights();
        this.ptrs = [];
        return;
      }
      this.line(4);
      a.style.glow = b.style.glow = Theme.green;
      i++;
      j--;
    }
    this.line(6);
    this.ptrs = [];
    this.log(`"${s}" is a palindrome ✔ (${comparisons} comparisons)`, 'ok');
    await this.wait(900);
    this.clearHighlights();
  }

  // ---- drawing ------------------------------------------------------------------

  draw(p) {
    Draw.label(p, `const str = "${this.src.text}"`, 40, this.srcY - 160, { align: 'left', color: Theme.text, size: 18, bold: true });
    Draw.label(p, 'original (never modified)', 40, this.srcY - 136, { align: 'left', size: 12 });
    const resTitle = this.res.label || 'result';
    Draw.label(p, resTitle, 40, this.resY - 120, { align: 'left', color: Theme.text, size: 16, bold: true });
    if (this.res.text !== null && this.res.text !== undefined) {
      Draw.label(p, `→ ${JSON.stringify(this.res.text)}`, this.W - 40, this.resY - 120, { align: 'right', color: Theme.yellow, size: 16, bold: true });
    }

    // index labels
    const n = this.src.text.length;
    for (let i = 0; i < n; i++) Draw.label(p, i, this.xFor(i, n, this.src.size), this.srcY + 52, { size: 11, color: Theme.dim });

    this.physics.render(p);

    for (const g of this.groups) {
      const y = this.resY + 50;
      p.push();
      p.stroke(Theme.cyan);
      p.strokeWeight(2);
      p.noFill();
      if (!g.empty) {
        p.line(g.from, y, g.to, y);
        p.line(g.from, y, g.from, y - 6);
        p.line(g.to, y, g.to, y - 6);
      }
      p.pop();
      Draw.label(p, g.label, (g.from + g.to) / 2, y + 16, { size: 11, color: Theme.cyan });
    }

    for (const ptr of this.ptrs) {
      const x = this.xFor(ptr.i, n, this.src.size);
      Draw.pointer(p, x, this.srcY - this.src.size / 2 - 6, ptr.label, ptr.color);
    }
  }
}
