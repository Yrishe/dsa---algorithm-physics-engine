// Tiny animation clock. Every scene owns one Animator; it only advances while
// the app is running, so the global speed slider and pause button affect all
// tweens and waits uniformly. When a scene is destroyed its pending promises
// simply never resolve, which cancels any in-flight async operation.
const Ease = {
  linear: (t) => t,
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

class Animator {
  constructor() {
    this.items = [];
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
    if (!this.items.length) return;
    const items = this.items.slice();
    for (const it of items) {
      if (it.done) continue;
      it.t += dt;
      if (it.check) {
        if (it.check() || it.t >= it.duration) this._finish(it, it.t < it.duration);
        continue;
      }
      const k = it.duration <= 0 ? 1 : Math.min(1, it.t / it.duration);
      it.onUpdate && it.onUpdate(it.ease(k), k);
      if (k >= 1) this._finish(it, true);
    }
    this.items = this.items.filter((it) => !it.done);
  }

  _finish(it, value) {
    it.done = true;
    it.resolve(value);
  }

  // Calls onUpdate(easedProgress) every frame for `duration` ms.
  tween(duration, onUpdate, ease = Ease.inOutCubic) {
    return new Promise((resolve) => {
      this.items.push({ t: 0, duration, onUpdate, ease, resolve });
    });
  }

  wait(ms) {
    return this.tween(ms, null, Ease.linear);
  }

  // Resolves true when predicate becomes truthy, false on timeout.
  waitUntil(predicate, timeout = 3000) {
    return new Promise((resolve) => {
      this.items.push({ t: 0, duration: timeout, check: predicate, resolve });
    });
  }

  // Tween numeric properties of a plain object.
  to(obj, props, duration, ease = Ease.inOutCubic) {
    const from = {};
    for (const k in props) from[k] = obj[k];
    return this.tween(
      duration,
      (e) => {
        for (const k in props) obj[k] = lerp(from[k], props[k], e);
      },
      ease
    );
  }
}
