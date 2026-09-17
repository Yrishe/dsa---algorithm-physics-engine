// Base class for every visualisation. A scene owns its own Matter world and
// Animator, declares its controls/info, and draws into Theme.width x height.
class Scene {
  static id = 'scene';
  static title = 'Scene';
  static group = 'Misc';
  static subtitle = '';
  static gravity = 1;

  constructor(app) {
    this.app = app;
    this.anim = new Animator();
    this.physics = new Physics({ gravity: this.constructor.gravity });
    this.busy = false;
    this.codes = {};
    this.W = Theme.width;
    this.H = Theme.height;
  }

  // ---- lifecycle (override) -------------------------------------------------
  setup() {}
  update(dt) {}
  draw(p) {
    this.physics.render(p);
  }
  destroy() {
    this.physics.destroy();
  }

  // ---- declarative content (override) ---------------------------------------
  controls() {
    return [];
  }
  about() {
    return '';
  }
  complexity() {
    return [];
  }

  // ---- helpers -------------------------------------------------------------
  get ui() {
    return this.app.ui;
  }

  wait(ms) {
    return this.anim.wait(ms);
  }

  // Runs an async operation while locking the controls.
  async run(fn) {
    if (this.busy) return;
    this.busy = true;
    this.app.onBusy(true);
    try {
      await fn();
    } catch (err) {
      console.error(err);
      this.log(String(err.message || err), 'warn');
    } finally {
      this.busy = false;
      this.app.onBusy(false);
    }
  }

  log(msg, kind = 'info') {
    this.app.log(msg, kind);
  }

  setStats(stats) {
    this.app.setStats(stats);
  }

  // Show one of this.codes by key and optionally highlight a line.
  code(key, line = -1) {
    this.app.showCode(key, this.codes[key] || [], line);
  }

  line(i) {
    this.app.highlightCode(i);
  }

  inputValue(id) {
    const el = this.ui[id];
    return el ? el.value.trim() : '';
  }

  inputNumber(id) {
    const raw = this.inputValue(id);
    if (raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
}

// Reusable p5 drawing helpers shared by scenes.
const Draw = {
  label(p, str, x, y, { size = 14, color = Theme.muted, align = 'center', baseline = 'center', bold = false, font = Theme.font } = {}) {
    p.push();
    p.noStroke();
    p.fill(color);
    p.textFont(font);
    p.textStyle(bold ? p.BOLD : p.NORMAL);
    p.textSize(size);
    p.textAlign(align === 'left' ? p.LEFT : align === 'right' ? p.RIGHT : p.CENTER, baseline === 'top' ? p.TOP : baseline === 'bottom' ? p.BOTTOM : p.CENTER);
    p.text(str, x, y);
    p.pop();
  },

  arrow(p, x1, y1, x2, y2, { color = Theme.muted, weight = 2, head = 9, dash = null } = {}) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    p.push();
    p.stroke(color);
    p.strokeWeight(weight);
    if (dash) p.drawingContext.setLineDash(dash);
    p.line(x1, y1, x2 - Math.cos(a) * head * 0.6, y2 - Math.sin(a) * head * 0.6);
    p.drawingContext.setLineDash([]);
    p.noStroke();
    p.fill(color);
    p.translate(x2, y2);
    p.rotate(a);
    p.triangle(0, 0, -head, head * 0.55, -head, -head * 0.55);
    p.pop();
  },

  // A labelled pointer triangle pointing down at (x, y).
  pointer(p, x, y, name, color = Theme.yellow) {
    p.push();
    p.noStroke();
    p.fill(color);
    p.triangle(x, y, x - 8, y - 12, x + 8, y - 12);
    p.pop();
    Draw.label(p, name, x, y - 22, { color, size: 13, bold: true });
  },

  // Pointer below (x, y) pointing up.
  pointerUp(p, x, y, name, color = Theme.yellow) {
    p.push();
    p.noStroke();
    p.fill(color);
    p.triangle(x, y, x - 8, y + 12, x + 8, y + 12);
    p.pop();
    Draw.label(p, name, x, y + 24, { color, size: 13, bold: true });
  },

  panel(p, x, y, w, h, { fill = Theme.surface, stroke = Theme.line, radius = 10 } = {}) {
    p.push();
    p.fill(fill);
    p.stroke(stroke);
    p.strokeWeight(1);
    p.rect(x, y, w, h, radius);
    p.pop();
  },

  box(p, x, y, w, h, { fill = Theme.surface2, stroke = null, label = null, textColor = Theme.bg, size = 16, radius = 6, weight = 2 } = {}) {
    p.push();
    p.rectMode(p.CENTER);
    p.fill(fill);
    if (stroke) {
      p.stroke(stroke);
      p.strokeWeight(weight);
    } else p.noStroke();
    p.rect(x, y, w, h, radius);
    p.pop();
    if (label !== null) Draw.label(p, String(label), x, y + 1, { color: textColor, size, bold: true });
  },
};
