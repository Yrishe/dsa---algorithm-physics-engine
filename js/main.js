// App shell: navigation, shared UI panels and the single p5 sketch that runs
// whichever scene is active.
const SCENES = [
  BigOScene,
  SearchRaceScene,
  ArrayScene,
  HashMapScene,
  StackScene,
  QueueScene,
  LinkedListScene,
  StringScene,
  SortingScene,
  BSTScene,
  HeapScene,
];

const $ = (id) => document.getElementById(id);

const App = {
  p: null,
  scene: null,
  SceneClass: null,
  speed: 1,
  paused: false,
  ui: {},
  view: { scale: 1, ox: 0, oy: 0 },

  init() {
    this.buildNav();
    this.bindGlobalControls();
    new p5((p) => this.sketch(p));
  },

  sketch(p) {
    this.p = p;
    p.setup = () => {
      const stage = $('stage');
      const c = p.createCanvas(stage.clientWidth, stage.clientHeight);
      c.parent(stage);
      p.textFont(Theme.font);
      this.fit();
      const id = location.hash.slice(1);
      this.open(SCENES.find((S) => S.id === id) || SCENES[0]);
    };

    p.draw = () => {
      const s = this.scene;
      if (!s) return;
      const dt = this.paused ? 0 : Math.min(p.deltaTime, 50) * this.speed;
      s.anim.update(dt);
      s.update(dt);
      s.physics.step(dt);

      p.background(Theme.bg);
      const { scale, ox, oy } = this.view;
      p.push();
      p.translate(ox, oy);
      p.scale(scale);
      this.drawGrid(p);
      s.draw(p);
      p.pop();

      if (this.paused) {
        Draw.label(p, '❚❚ PAUSED', 14, 18, { align: 'left', color: Theme.yellow, size: 12, bold: true });
      }
    };

    // the stage also changes size when the controls bar wraps, not just on window resize
    new ResizeObserver(() => {
      const stage = $('stage');
      if (!stage.clientWidth || !stage.clientHeight) return;
      p.resizeCanvas(stage.clientWidth, stage.clientHeight);
      this.fit();
    }).observe($('stage'));
  },

  // Scale the fixed logical scene size to fit the stage, centred.
  fit() {
    const p = this.p;
    const scale = Math.min(p.width / Theme.width, p.height / Theme.height);
    this.view = { scale, ox: (p.width - Theme.width * scale) / 2, oy: (p.height - Theme.height * scale) / 2 };
  },

  drawGrid(p) {
    p.push();
    p.noStroke();
    p.fill(Theme.grid);
    for (let x = 20; x < Theme.width; x += 40) {
      for (let y = 20; y < Theme.height; y += 40) p.rect(x - 1, y - 1, 2, 2);
    }
    p.pop();
  },

  open(SceneClass) {
    if (this.scene) this.scene.destroy();
    this.SceneClass = SceneClass;
    if (location.hash.slice(1) !== SceneClass.id) history.replaceState(null, '', '#' + SceneClass.id);

    document.querySelectorAll('.sidebar a').forEach((a) => a.classList.toggle('active', a.dataset.id === SceneClass.id));
    document.body.classList.remove('menu-open');
    $('sceneTitle').textContent = SceneClass.title;
    $('sceneSubtitle').textContent = SceneClass.subtitle;
    document.title = `${SceneClass.title} · Algorithm Playground`;

    $('log').innerHTML = '';
    $('hud').innerHTML = '';
    this.showCode('', [], -1);

    const scene = new SceneClass(this);
    this.scene = scene;
    this.buildControls(scene.controls());
    $('about').innerHTML = scene.about();
    this.buildComplexity(scene.complexity());
    scene.setup();
  },

  // ---- navigation & global controls ----------------------------------------

  buildNav() {
    const nav = $('sidebar');
    let group = null;
    for (const S of SCENES) {
      if (S.group !== group) {
        group = S.group;
        const h = document.createElement('h3');
        h.textContent = group;
        nav.appendChild(h);
      }
      const a = document.createElement('a');
      a.href = '#' + S.id;
      a.dataset.id = S.id;
      a.innerHTML = `${S.title}<small>${S.nav || ''}</small>`;
      nav.appendChild(a);
    }
    window.addEventListener('hashchange', () => {
      const S = SCENES.find((x) => x.id === location.hash.slice(1));
      if (S && S !== this.SceneClass) this.open(S);
    });
  },

  bindGlobalControls() {
    const speed = $('speed');
    const out = $('speedOut');
    speed.addEventListener('input', () => {
      this.speed = Number(speed.value);
      out.textContent = this.speed + '×';
    });
    $('pauseBtn').addEventListener('click', () => this.togglePause());
    $('resetBtn').addEventListener('click', () => this.open(this.SceneClass));
    $('menuToggle').addEventListener('click', () => document.body.classList.toggle('menu-open'));
    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName;
      if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'BUTTON') {
        e.preventDefault();
        this.togglePause();
      }
    });
  },

  togglePause() {
    this.paused = !this.paused;
    $('pauseBtn').textContent = this.paused ? 'Resume' : 'Pause';
  },

  // ---- scene controls ---------------------------------------------------------

  buildControls(defs) {
    const root = $('controls');
    root.innerHTML = '';
    this.ui = {};
    root.style.display = defs.length ? '' : 'none';

    for (const d of defs) {
      let el;
      switch (d.type) {
        case 'sep':
          el = document.createElement('span');
          el.className = 'sep';
          break;
        case 'break':
          el = document.createElement('span');
          el.className = 'break';
          break;
        case 'button': {
          el = document.createElement('button');
          el.className = 'btn ' + (d.variant || '');
          el.textContent = d.label;
          if (d.title) el.title = d.title;
          el.dataset.lock = d.lock === false ? '0' : '1';
          el.addEventListener('click', () => d.action());
          break;
        }
        case 'input':
        case 'number':
        case 'select':
        case 'range': {
          el = document.createElement('label');
          el.className = 'field';
          const cap = document.createElement('span');
          cap.textContent = d.label || '';
          el.appendChild(cap);
          let input;
          if (d.type === 'select') {
            input = document.createElement('select');
            for (const o of d.options) {
              const opt = document.createElement('option');
              opt.value = o.value;
              opt.textContent = o.label;
              input.appendChild(opt);
            }
            if (d.value !== undefined) input.value = d.value;
            input.addEventListener('change', () => d.onChange && d.onChange(input.value));
          } else {
            input = document.createElement('input');
            input.type = d.type === 'input' ? 'text' : d.type;
            if (d.value !== undefined) input.value = d.value;
            if (d.placeholder) input.placeholder = d.placeholder;
            if (d.maxLength) input.maxLength = d.maxLength;
            for (const k of ['min', 'max', 'step']) if (d[k] !== undefined) input[k] = d[k];
            input.style.width = (d.width || (d.type === 'range' ? 130 : 90)) + 'px';
            if (d.type === 'range') {
              const out = document.createElement('span');
              out.className = 'range-out';
              out.textContent = ` ${input.value}`;
              cap.appendChild(out);
              input.addEventListener('input', () => {
                out.textContent = ` ${input.value}`;
                d.onInput && d.onInput(Number(input.value));
              });
            } else if (d.onEnter) {
              input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') d.onEnter();
              });
            }
          }
          el.appendChild(input);
          this.ui[d.id] = input;
          break;
        }
        default:
          continue;
      }
      root.appendChild(el);
    }
  },

  onBusy(busy) {
    document.querySelectorAll('#controls button[data-lock="1"]').forEach((b) => (b.disabled = busy));
  },

  // ---- side panels ---------------------------------------------------------------

  buildComplexity(rows) {
    const table = $('complexity');
    table.innerHTML = '';
    table.closest('.card').style.display = rows.length ? '' : 'none';
    for (const [op, big, note] of rows) {
      const tr = document.createElement('tr');
      const cls = /O\((1|log n)\)/.test(big) ? 'big-o-good' : /O\(n\)|O\(n log n\)|O\(n \+ m\)|O\(h\)|O\(k\)/.test(big) ? 'big-o-ok' : 'big-o-bad';
      tr.innerHTML = `<td>${op}${note ? `<br><small style="color:var(--muted)">${note}</small>` : ''}</td><td class="${cls}">${big}</td>`;
      table.appendChild(tr);
    }
  },

  showCode(name, lines, hl = -1) {
    $('codeName').textContent = name;
    const pre = $('code');
    pre.innerHTML = '';
    lines.forEach((text, i) => {
      const span = document.createElement('span');
      span.className = 'ln' + (i === hl ? ' hl' : '');
      span.textContent = text || ' ';
      pre.appendChild(span);
    });
  },

  highlightCode(i) {
    const lines = $('code').children;
    for (let k = 0; k < lines.length; k++) lines[k].classList.toggle('hl', k === i);
  },

  log(msg, kind = 'info') {
    const ol = $('log');
    const li = document.createElement('li');
    li.className = kind;
    li.textContent = msg;
    ol.prepend(li);
    while (ol.children.length > 80) ol.lastChild.remove();
  },

  setStats(stats) {
    const hud = $('hud');
    hud.innerHTML = '';
    for (const [k, v] of Object.entries(stats)) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.innerHTML = `${k}<b></b>`;
      chip.querySelector('b').textContent = v;
      hud.appendChild(chip);
    }
  },
};

window.addEventListener('DOMContentLoaded', () => App.init());
