// Stack (LIFO): blocks fall into a tube and only the top one can leave.
// Includes the classic balanced-brackets application.
class StackScene extends Scene {
  static id = 'stack';
  static title = 'Stack';
  static nav = 'LIFO · brackets checker';
  static group = 'Data Structures';
  static subtitle = 'Last In, First Out. Like a stack of plates: you can only add or remove at the top.';

  static CAP = 9;
  static PAIRS = { ')': '(', ']': '[', '}': '{' };

  setup() {
    this.cx = 270;
    this.innerW = 170;
    this.tubeTop = 170;
    this.floorY = 585;
    this.blockH = 42;
    this.items = [];
    this.check = null;

    const h = this.floorY - this.tubeTop;
    this.physics.wall(this.cx - this.innerW / 2 - 6, this.tubeTop + h / 2, 12, h);
    this.physics.wall(this.cx + this.innerW / 2 + 6, this.tubeTop + h / 2, 12, h);
    this.physics.wall(this.cx, this.floorY + 6, this.innerW + 24, 12);

    this.codes = {
      push: ['stack.push(value);', '// place on top: O(1)'],
      pop: ['const top = stack.pop();', '// remove from top: O(1)', 'if (top === undefined) // underflow'],
      peek: ['const top = stack[stack.length - 1];', '// look without removing: O(1)'],
      brackets: [
        'function isBalanced(str) {',
        '  const stack = [];',
        "  const pairs = { ')': '(', ']': '[', '}': '{' };",
        '  for (const ch of str) {',
        "    if ('([{'.includes(ch)) stack.push(ch);",
        '    else if (ch in pairs) {',
        '      if (stack.pop() !== pairs[ch]) return false;',
        '    }',
        '  }',
        '  return stack.length === 0;',
        '}',
      ],
    };

    this.run(async () => {
      for (const v of [4, 8, 15]) await this.push(v, true);
    });
  }

  controls() {
    const act = (fn) => () => this.run(fn);
    return [
      { type: 'input', id: 'value', label: 'Value', value: '23', width: 70, maxLength: 4, onEnter: act(() => this.push()) },
      { type: 'button', label: 'push', action: act(() => this.push()) },
      { type: 'button', label: 'pop', action: act(() => this.pop()) },
      { type: 'button', label: 'peek', variant: 'secondary', action: act(() => this.peek()) },
      { type: 'button', label: 'Clear', variant: 'danger', action: act(() => this.clear()) },
      { type: 'sep' },
      { type: 'input', id: 'expr', label: 'Brackets expression', value: '{[()()]}', width: 180, maxLength: 16, onEnter: act(() => this.checkBrackets()) },
      { type: 'button', label: 'Check balanced', variant: 'secondary', action: act(() => this.checkBrackets()) },
    ];
  }

  about() {
    return `
      <p>A <b>stack</b> is a Last-In-First-Out collection. It supports <code>push</code> (add on top), <code>pop</code> (remove the top) and <code>peek</code> (look at the top), all in <code>O(1)</code>.</p>
      <p>In JavaScript an array works as a stack using <code>push</code> and <code>pop</code>.</p>
      <p>Stacks power the <b>call stack</b>, undo/redo, browser back buttons, depth-first search and parsing. The demo on the right checks balanced brackets: every opener is pushed, and every closer must match the most recent opener.</p>`;
  }

  complexity() {
    return [
      ['<code>push</code>', 'O(1)', ''],
      ['<code>pop</code>', 'O(1)', ''],
      ['<code>peek</code>', 'O(1)', ''],
      ['Search for a value', 'O(n)', 'not what stacks are for'],
      ['Bracket check', 'O(n)', 'one pass over the string'],
    ];
  }

  updateStats() {
    const top = this.items[this.items.length - 1];
    this.setStats({ size: this.items.length, top: top ? top.value : '—' });
  }

  bracketColor(ch) {
    return { '(': Theme.cyan, ')': Theme.cyan, '[': Theme.yellow, ']': Theme.yellow, '{': Theme.pink, '}': Theme.pink }[ch];
  }

  async push(value, quiet = false) {
    const v = value ?? this.inputValue('value');
    if (v === '') return this.log('Enter a value to push', 'warn');
    if (this.items.length >= StackScene.CAP) return this.log('Stack overflow! (the tube is full)', 'warn');
    this.code('push', 0);
    const fill = this.bracketColor(v) || Theme.colorForValue(v);
    const body = this.physics.tile(this.cx, 40, this.innerW - 16, this.blockH, v, { fill, textSize: 20 }, { friction: 0.05 });
    this.items.push({ value: v, body });
    this.updateStats();
    const restY = this.floorY - this.blockH * (this.items.length - 0.5);
    await this.anim.waitUntil(() => body.position.y > restY - 6 && Physics.speedOf(body) < 0.2, 2200);
    if (!quiet) this.log(`push(${v}) → size ${this.items.length}`, 'ok');
  }

  async pop(quiet = false) {
    this.code('pop', 0);
    if (!this.items.length) {
      this.line(2);
      this.log('pop() on empty stack → underflow', 'warn');
      return null;
    }
    const it = this.items.pop();
    it.body.style.highlight = Theme.yellow;
    await this.wait(220);
    this.physics.fling(it.body, 9, -15, 0.2);
    this.updateStats();
    if (!quiet) this.log(`pop() → ${it.value}`, 'ok');
    await this.wait(250);
    return it;
  }

  async peek() {
    this.code('peek', 0);
    const top = this.items[this.items.length - 1];
    if (!top) return this.log('peek() on empty stack → undefined', 'warn');
    top.body.style.highlight = Theme.green;
    top.body.style.glow = Theme.green;
    this.log(`peek() → ${top.value}`, 'ok');
    await this.wait(900);
    top.body.style.highlight = null;
    top.body.style.glow = null;
  }

  async clear() {
    for (const it of this.items) this.physics.fling(it.body, (Math.random() - 0.3) * 10, -10 - Math.random() * 8, (Math.random() - 0.5) * 0.3);
    this.items = [];
    this.updateStats();
    await this.wait(300);
  }

  async checkBrackets() {
    const expr = this.inputValue('expr');
    if (!expr) return this.log('Enter an expression like {[()]}', 'warn');
    await this.clear();
    this.code('brackets', 3);
    this.check = { expr, i: -1, result: null };
    this.log(`isBalanced("${expr}")`);

    for (let i = 0; i < expr.length; i++) {
      const ch = expr[i];
      this.check.i = i;
      this.line(3);
      await this.wait(300);
      if ('([{'.includes(ch)) {
        this.line(4);
        await this.push(ch, true);
        this.code('brackets', 4);
        this.log(`'${ch}' opener → push`, 'step');
      } else if (ch in StackScene.PAIRS) {
        this.line(6);
        const top = this.items[this.items.length - 1];
        if (!top) {
          this.log(`'${ch}' but the stack is empty → unbalanced`, 'warn');
          return this.finishCheck(false);
        }
        const ok = top.value === StackScene.PAIRS[ch];
        top.body.style.highlight = ok ? Theme.green : Theme.red;
        top.body.style.glow = ok ? Theme.green : Theme.red;
        await this.wait(400);
        if (!ok) {
          this.log(`'${ch}' does not match top '${top.value}' → unbalanced`, 'warn');
          return this.finishCheck(false);
        }
        await this.pop(true);
        this.code('brackets', 6);
        this.log(`'${ch}' matches '${top.value}' → pop`, 'step');
      } else {
        this.log(`'${ch}' ignored`, 'step');
      }
    }
    this.line(9);
    await this.wait(300);
    if (this.items.length) this.log(`End of string with ${this.items.length} unclosed opener(s) → unbalanced`, 'warn');
    return this.finishCheck(this.items.length === 0);
  }

  async finishCheck(ok) {
    this.check.result = ok;
    this.check.i = -1;
    this.log(ok ? 'Balanced ✔' : 'Not balanced ✘', ok ? 'ok' : 'warn');
    await this.wait(400);
  }

  draw(p) {
    // tube interior
    p.push();
    p.noStroke();
    p.fill(255, 255, 255, 8);
    p.rect(this.cx - this.innerW / 2, this.tubeTop, this.innerW, this.floorY - this.tubeTop);
    p.pop();
    Draw.label(p, 'push ↓   ↑ pop', this.cx, this.tubeTop - 30, { size: 14, color: Theme.muted });
    Draw.label(p, 'bottom', this.cx, this.floorY + 24, { size: 12, color: Theme.dim });

    this.physics.render(p);

    const top = this.items[this.items.length - 1];
    if (top && !top.body.cull) {
      const y = top.body.position.y;
      Draw.arrow(p, this.cx + this.innerW / 2 + 70, y, this.cx + this.innerW / 2 + 18, y, { color: Theme.yellow });
      Draw.label(p, 'top', this.cx + this.innerW / 2 + 92, y, { color: Theme.yellow, size: 14, bold: true });
    }

    this.drawChecker(p);
  }

  drawChecker(p) {
    const x = 520;
    const y = 120;
    Draw.panel(p, x, y, 440, 300);
    Draw.label(p, 'Balanced brackets checker', x + 20, y + 28, { align: 'left', color: Theme.text, size: 15, bold: true });
    Draw.label(p, 'openers are pushed, closers must match the top', x + 20, y + 50, { align: 'left', size: 12 });

    const c = this.check;
    const expr = c ? c.expr : this.ui.expr ? this.ui.expr.value : '';
    const cw = Math.min(36, 400 / Math.max(1, expr.length));
    const x0 = x + 220 - (expr.length * cw) / 2 + cw / 2;
    for (let i = 0; i < expr.length; i++) {
      const ch = expr[i];
      const cur = c && c.i === i;
      const past = c && (c.i > i || c.result !== null);
      Draw.box(p, x0 + i * cw, y + 130, cw - 4, 44, {
        fill: cur ? Theme.surface2 : Theme.bg,
        stroke: cur ? Theme.yellow : Theme.line,
        label: ch,
        textColor: past ? Theme.dim : this.bracketColor(ch) || Theme.text,
        size: 20,
      });
      if (cur) Draw.pointerUp(p, x0 + i * cw, y + 160, 'ch');
    }

    if (c && c.result !== null) {
      Draw.label(p, c.result ? 'BALANCED ✔' : 'NOT BALANCED ✘', x + 220, y + 250, { color: c.result ? Theme.green : Theme.red, size: 24, bold: true });
    } else {
      Draw.label(p, 'Try: ([]{}) · ([)] · ((( · {a[b]c}', x + 220, y + 250, { size: 13 });
    }
  }
}
