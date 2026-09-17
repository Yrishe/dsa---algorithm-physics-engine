// Binary search tree: insert, search, delete (all three cases), min/max and
// the four classic traversals. Nodes are spring-anchored physics bodies.
class BSTScene extends Scene {
  static id = 'bst';
  static title = 'Binary Search Tree';
  static nav = 'insert, delete, traversals';
  static group = 'Trees';
  static subtitle = 'Every node keeps smaller values on its left and larger values on its right, so each comparison discards a whole subtree.';
  static gravity = 0;

  static MAX_DEPTH = 5;
  static MAX_NODES = 15;

  setup() {
    this.tree = new TreeView(this.physics);
    this.root = null;
    this.output = [];
    this.outputTitle = '';
    this.queueView = null;
    this.hint = null;

    this.codes = {
      insert: [
        'insert(value) {',
        '  const node = { value, left: null, right: null };',
        '  if (!this.root) return (this.root = node);',
        '  let cur = this.root;',
        '  while (true) {',
        '    const dir = value < cur.value ? "left" : "right";',
        '    if (!cur[dir]) return (cur[dir] = node);',
        '    cur = cur[dir];',
        '  }',
        '}',
      ],
      search: [
        'search(value) {',
        '  let cur = this.root;',
        '  while (cur) {',
        '    if (value === cur.value) return cur;',
        '    cur = value < cur.value ? cur.left : cur.right;',
        '  }',
        '  return null;',
        '}',
      ],
      delete: [
        'delete(node) {',
        '  // 1) leaf: just unlink it',
        '  if (!node.left && !node.right) return null;',
        '  // 2) one child: child takes its place',
        '  if (!node.left) return node.right;',
        '  if (!node.right) return node.left;',
        '  // 3) two children: use in-order successor',
        '  let parent = node, succ = node.right;',
        '  while (succ.left) { parent = succ; succ = succ.left; }',
        '  if (parent !== node) {',
        '    parent.left = succ.right;',
        '    succ.right = node.right;',
        '  }',
        '  succ.left = node.left;',
        '  return succ; // caller links it where node was',
        '}',
      ],
      inorder: ['inorder(node) {', '  if (!node) return;', '  inorder(node.left);', '  visit(node);        // left, ROOT, right', '  inorder(node.right);', '}', '// BST in-order = sorted order!'],
      preorder: ['preorder(node) {', '  if (!node) return;', '  visit(node);        // ROOT, left, right', '  preorder(node.left);', '  preorder(node.right);', '}', '// useful to copy/serialize a tree'],
      postorder: ['postorder(node) {', '  if (!node) return;', '  postorder(node.left);', '  postorder(node.right);', '  visit(node);        // left, right, ROOT', '}', '// useful to delete/free a tree'],
      levelorder: [
        'levelOrder(root) {',
        '  const queue = [root];',
        '  while (queue.length) {',
        '    const node = queue.shift();',
        '    visit(node);',
        '    if (node.left) queue.push(node.left);',
        '    if (node.right) queue.push(node.right);',
        '  }',
        '}',
        '// breadth-first search (BFS)',
      ],
      minmax: ['min(node) {', '  while (node.left) node = node.left;', '  return node;', '}', '// max: keep going right'],
    };

    this.run(async () => {
      for (const v of [50, 30, 70, 20, 40, 60, 80]) await this.insert(v, true);
      this.log('Try deleting 30 or 50 (a node with two children).', 'hint');
    });
  }

  controls() {
    const act = (fn) => () => this.run(fn);
    return [
      { type: 'number', id: 'value', label: 'Value', value: '45', width: 70, onEnter: act(() => this.insert()) },
      { type: 'button', label: 'insert', action: act(() => this.insert()) },
      { type: 'button', label: 'search', action: act(() => this.search()) },
      { type: 'button', label: 'delete', action: act(() => this.remove()) },
      { type: 'sep' },
      {
        type: 'select',
        id: 'order',
        label: 'Traversal',
        value: 'inorder',
        options: [
          { value: 'inorder', label: 'in-order' },
          { value: 'preorder', label: 'pre-order' },
          { value: 'postorder', label: 'post-order' },
          { value: 'levelorder', label: 'level-order (BFS)' },
        ],
      },
      { type: 'button', label: 'Traverse', variant: 'secondary', action: act(() => this.traverse()) },
      { type: 'button', label: 'min', variant: 'secondary', action: act(() => this.extreme('left')) },
      { type: 'button', label: 'max', variant: 'secondary', action: act(() => this.extreme('right')) },
      { type: 'sep' },
      { type: 'button', label: 'Random tree', variant: 'ghost', action: act(() => this.randomTree()) },
      { type: 'button', label: 'Sorted inserts', variant: 'ghost', title: 'Insert sorted values to see a degenerate tree', action: act(() => this.degenerate()) },
      { type: 'button', label: 'Clear', variant: 'danger', action: act(() => this.clear()) },
    ];
  }

  about() {
    return `
      <p>A <b>binary search tree</b> stores values so that for every node, everything in its <b>left</b> subtree is smaller and everything in its <b>right</b> subtree is larger.</p>
      <p>Insert, search and delete walk a single path from the root, so they cost <code>O(h)</code> where <code>h</code> is the height. A balanced tree has <code>h ≈ log₂ n</code>; inserting already-sorted values builds a "stick" with <code>h = n − 1</code>, which is why self-balancing trees (AVL, red-black) exist.</p>
      <p><b>Traversals</b> visit every node once (<code>O(n)</code>): in-order gives sorted output, pre-order copies a tree, post-order deletes one, level-order (BFS) goes row by row using a queue.</p>`;
  }

  complexity() {
    return [
      ['Search / insert / delete', 'O(log n)', 'balanced tree'],
      ['Same, degenerate tree', 'O(n)', 'sorted inserts'],
      ['min / max', 'O(h)', 'walk left / right'],
      ['Any traversal', 'O(n)', ''],
    ];
  }

  update(dt) {
    this.tree.update(dt);
  }

  // ---- helpers ------------------------------------------------------------

  readValue() {
    const v = this.inputNumber('value');
    if (v === null || !Number.isInteger(v) || v < 0 || v > 999) {
      this.log('Enter an integer from 0 to 999', 'warn');
      return null;
    }
    return v;
  }

  inorderList(n = this.root, depth = 0, out = []) {
    if (!n) return out;
    this.inorderList(n.left, depth + 1, out);
    out.push([n, depth]);
    this.inorderList(n.right, depth + 1, out);
    return out;
  }

  height(n = this.root) {
    return n ? 1 + Math.max(this.height(n.left), this.height(n.right)) : 0;
  }

  layout() {
    const list = this.inorderList();
    const spacing = (this.W - 120) / Math.max(1, list.length);
    list.forEach(([n, d], i) => this.tree.moveTo(n, 60 + spacing * (i + 0.5), 100 + d * 78));
    this.updateStats();
  }

  updateStats() {
    const n = this.tree.nodes.size;
    const h = Math.max(0, this.height() - 1);
    this.setStats({ size: n, height: h, 'log₂ n': n ? Math.floor(Math.log2(n)) : 0 });
  }

  resetStates() {
    for (const n of this.tree.nodes) n.state = null;
    this.hint = null;
  }

  replaceChild(parent, oldChild, newChild) {
    if (!parent) this.root = newChild;
    else if (parent.left === oldChild) parent.left = newChild;
    else parent.right = newChild;
  }

  setHint(node, text, color = Theme.yellow) {
    this.hint = { node, text, color };
  }

  // ---- operations ------------------------------------------------------------

  async insert(value, quiet = false) {
    const v = value ?? this.readValue();
    if (v === null) return;
    if (this.tree.nodes.size >= BSTScene.MAX_NODES) return this.log(`Only ${BSTScene.MAX_NODES} nodes fit on screen`, 'warn');
    this.code('insert', 1);
    const node = this.tree.add(v, this.W / 2, 30);
    node.state = 'new';
    const d = quiet ? 0.55 : 1;

    if (!this.root) {
      this.line(2);
      this.root = node;
      this.layout();
      await this.wait(500 * d);
      node.state = null;
      if (!quiet) this.log(`insert(${v}) → becomes the root`, 'ok');
      return;
    }

    let cur = this.root;
    let depth = 0;
    let steps = 0;
    while (true) {
      steps++;
      cur.state = 'visit';
      const p = this.tree.pos(cur);
      this.tree.moveTo(node, p.x, p.y - 58);
      this.line(5);
      if (v === cur.value) {
        this.setHint(cur, `${v} already exists`, Theme.red);
        await this.wait(700 * d);
        this.tree.drop(node);
        this.resetStates();
        return this.log(`insert(${v}) → duplicate ignored`, 'warn');
      }
      const dir = v < cur.value ? 'left' : 'right';
      this.setHint(cur, `${v} ${v < cur.value ? '<' : '>'} ${cur.value} → ${dir}`);
      await this.wait(600 * d);
      cur.state = 'path';
      if (!cur[dir]) {
        if (depth + 1 > BSTScene.MAX_DEPTH) {
          this.tree.drop(node);
          this.resetStates();
          return this.log('Tree would be too tall for the screen', 'warn');
        }
        this.line(6);
        cur[dir] = node;
        break;
      }
      this.line(7);
      cur = cur[dir];
      depth++;
    }
    this.hint = null;
    this.layout();
    await this.wait(650 * d);
    this.resetStates();
    if (!quiet) this.log(`insert(${v}) → depth ${depth + 1}, ${steps} comparison${steps > 1 ? 's' : ''}`, 'ok');
  }

  // Walks toward value, animating each comparison. Returns { node, parent, steps }.
  async find(v, codeKey = 'search') {
    this.code(codeKey, 1);
    let cur = this.root;
    let parent = null;
    let steps = 0;
    while (cur) {
      steps++;
      cur.state = 'visit';
      if (codeKey === 'search') this.line(3);
      if (v === cur.value) {
        this.setHint(cur, `${v} = ${cur.value} ✔`, Theme.green);
        await this.wait(450);
        return { node: cur, parent, steps };
      }
      const dir = v < cur.value ? 'left' : 'right';
      this.setHint(cur, `${v} ${v < cur.value ? '<' : '>'} ${cur.value} → ${dir}`);
      await this.wait(550);
      if (codeKey === 'search') this.line(4);
      cur.state = 'path';
      parent = cur;
      cur = cur[dir];
    }
    return { node: null, parent, steps };
  }

  async search() {
    const v = this.readValue();
    if (v === null) return;
    if (!this.root) return this.log('Tree is empty', 'warn');
    const { node, steps } = await this.find(v);
    if (node) {
      node.state = 'found';
      this.log(`search(${v}) → found after ${steps} comparison${steps > 1 ? 's' : ''} (n = ${this.tree.nodes.size})`, 'ok');
    } else {
      this.line(6);
      this.hint = null;
      this.log(`search(${v}) → null after ${steps} comparisons`, 'warn');
    }
    await this.wait(900);
    this.resetStates();
  }

  async remove() {
    const v = this.readValue();
    if (v === null) return;
    if (!this.root) return this.log('Tree is empty', 'warn');
    const { node, parent } = await this.find(v, 'delete');
    if (!node) {
      this.resetStates();
      return this.log(`delete(${v}) → not found`, 'warn');
    }
    this.code('delete', -1);
    node.state = 'remove';

    if (!node.left && !node.right) {
      this.line(2);
      this.setHint(node, 'leaf: unlink', Theme.red);
      await this.wait(600);
      this.replaceChild(parent, node, null);
      this.tree.drop(node);
      this.log(`delete(${v}) → case 1: leaf removed`, 'ok');
    } else if (!node.left || !node.right) {
      const child = node.left || node.right;
      this.line(node.left ? 5 : 4);
      child.state = 'found';
      this.setHint(node, 'one child: child moves up', Theme.red);
      await this.wait(700);
      this.replaceChild(parent, node, child);
      this.tree.drop(node);
      this.log(`delete(${v}) → case 2: its child ${child.value} took its place`, 'ok');
    } else {
      this.line(7);
      this.setHint(node, 'two children: find successor', Theme.red);
      let succ = node.right;
      let succParent = node;
      succ.state = 'visit';
      await this.wait(600);
      while (succ.left) {
        this.line(8);
        succ.state = 'path';
        succParent = succ;
        succ = succ.left;
        succ.state = 'visit';
        await this.wait(500);
      }
      succ.state = 'found';
      this.setHint(succ, `successor = ${succ.value}`, Theme.green);
      await this.wait(700);
      this.line(9);
      if (succParent === node) {
        // successor is node's direct right child
        succ.left = node.left;
      } else {
        succParent.left = succ.right;
        succ.left = node.left;
        succ.right = node.right;
      }
      this.line(13);
      this.replaceChild(parent, node, succ);
      const p = this.tree.pos(node);
      this.tree.moveTo(succ, p.x, p.y);
      this.tree.drop(node);
      this.log(`delete(${v}) → case 3: in-order successor ${succ.value} replaced it`, 'ok');
    }
    this.hint = null;
    await this.wait(300);
    this.layout();
    await this.wait(700);
    this.resetStates();
  }

  async traverse() {
    if (!this.root) return this.log('Tree is empty', 'warn');
    const order = this.ui.order.value;
    this.resetStates();
    this.output = [];
    this.outputTitle = { inorder: 'in-order', preorder: 'pre-order', postorder: 'post-order', levelorder: 'level-order' }[order];
    this.code(order, -1);
    const pause = 450;

    const visit = async (n, line) => {
      this.line(line);
      n.state = 'visit';
      this.output.push(n.value);
      await this.wait(pause);
      n.state = 'found';
    };

    if (order === 'levelorder') {
      const queue = [this.root];
      this.queueView = queue;
      this.line(1);
      await this.wait(pause);
      while (queue.length) {
        this.line(3);
        const n = queue.shift();
        await visit(n, 4);
        if (n.left) {
          this.line(5);
          queue.push(n.left);
          n.left.state = 'path';
          await this.wait(pause / 2);
        }
        if (n.right) {
          this.line(6);
          queue.push(n.right);
          n.right.state = 'path';
          await this.wait(pause / 2);
        }
      }
      this.queueView = null;
    } else {
      const walk = async (n) => {
        if (!n) return;
        n.state = n.state === 'found' ? 'found' : 'path';
        if (order === 'preorder') await visit(n, 2);
        await this.wait(pause / 3);
        await walk(n.left);
        if (order === 'inorder') await visit(n, 3);
        await walk(n.right);
        if (order === 'postorder') await visit(n, 4);
      };
      await walk(this.root);
    }
    this.log(`${this.outputTitle}: ${this.output.join(', ')}`, 'ok');
    if (order === 'inorder') this.log('In-order traversal of a BST is always sorted.', 'hint');
    await this.wait(900);
    this.resetStates();
  }

  async extreme(dir) {
    if (!this.root) return this.log('Tree is empty', 'warn');
    this.code('minmax', 1);
    let n = this.root;
    let steps = 1;
    n.state = 'visit';
    await this.wait(400);
    while (n[dir]) {
      n.state = 'path';
      n = n[dir];
      n.state = 'visit';
      steps++;
      await this.wait(400);
    }
    n.state = 'found';
    this.log(`${dir === 'left' ? 'min' : 'max'} → ${n.value} (${steps} step${steps > 1 ? 's' : ''}, keep going ${dir})`, 'ok');
    await this.wait(900);
    this.resetStates();
  }

  async clear() {
    this.tree.clear();
    this.root = null;
    this.output = [];
    this.hint = null;
    this.updateStats();
    await this.wait(300);
  }

  async randomTree() {
    await this.clear();
    const values = new Set();
    while (values.size < 9) values.add(5 + Math.floor(Math.random() * 90));
    for (const v of values) await this.insert(v, true);
    this.log(`Inserted ${[...values].join(', ')} (height ${this.height() - 1})`, 'hint');
  }

  async degenerate() {
    await this.clear();
    for (const v of [10, 20, 30, 40, 50, 60]) await this.insert(v, true);
    this.log('Sorted inserts built a "stick": height = n − 1, so search is O(n).', 'warn');
  }

  // ---- drawing ------------------------------------------------------------------

  draw(p) {
    const edges = [];
    for (const n of this.tree.nodes) {
      for (const c of [n.left, n.right]) {
        if (!c) continue;
        const hot = (n.state === 'path' || n.state === 'visit') && (c.state === 'visit' || c.state === 'path' || c.state === 'found');
        edges.push([n, c, hot ? Theme.cyan : null]);
      }
    }
    this.tree.draw(p, edges);

    if (!this.root) Draw.label(p, 'empty tree: insert a value', this.W / 2, 200, { size: 16 });

    if (this.hint && this.tree.nodes.has(this.hint.node)) {
      const { x, y } = this.tree.pos(this.hint.node);
      const right = x < this.W - 200;
      Draw.label(p, this.hint.text, x + (right ? 34 : -34), y + 30, { align: right ? 'left' : 'right', size: 13, color: this.hint.color, bold: true });
    }

    if (this.queueView) drawValueRow(p, 'queue', this.queueView.map((n) => n.value), 540, { color: Theme.cyan });
    if (this.output.length) drawValueRow(p, `${this.outputTitle}`, this.output, 588, { color: Theme.green });
  }
}
