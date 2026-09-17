# Algorithm Playground

Animated, physics-driven visualisations of core programming concepts, built with
[p5.js](https://p5js.org) (drawing) and [Matter.js](https://brm.io/matter-js/) (physics).

| Group | Scenes |
| --- | --- |
| Fundamentals | Big O notation (growth chart + "operation jars"), linear vs binary search race |
| Data structures | Arrays, objects / hash maps, stack (with bracket checker), queue, linked list |
| Strings | `str[i]`, reverse, toUpperCase, slice, concat, naive indexOf, split, palindrome |
| Algorithms | Bubble, selection, insertion, merge and quick sort |
| Trees | Binary search tree (insert / search / delete / traversals), binary heap (push / pop / heap sort) |

Every scene has step-by-step controls, a live code panel that highlights the line being
executed, a complexity table, stats and an operation log. The speed slider and
Pause (or the space bar) apply to every animation.

## Running

No build step. Both libraries are vendored in `lib/`, so it also works offline.

- Open `index.html` directly in a browser, or
- serve the folder: `npx serve .` and open the printed URL.

Deep links work: `index.html#bst`, `index.html#sorting`, ...

## Project layout

```
index.html            page shell + script tags (load order matters)
css/style.css         layout and UI styling
lib/                  p5.min.js 1.11.3, matter.min.js 0.20.0
js/core/theme.js      colours and the fixed logical canvas size (1000 × 620)
js/core/anim.js       Animator: tweens, waits and waitUntil driven by the app clock
js/core/physics.js    Matter.js world wrapper + p5 renderer for bodies
js/core/scene.js      Scene base class and shared Draw helpers
js/core/treeView.js   spring-anchored node renderer shared by the BST and heap
js/scenes/*.js        one file per visualisation
js/main.js            navigation, controls builder, side panels, p5 sketch
```

## Adding a scene

1. Create `js/scenes/myScene.js` with a class extending `Scene`:
   - static `id`, `title`, `nav`, `group`, `subtitle` (and `gravity` if not 1)
   - `setup()` builds the world, `draw(p)` renders it (call `this.physics.render(p)`)
   - `controls()`, `about()`, `complexity()` describe the side panels
   - wrap user operations in `this.run(async () => ...)` so controls lock while animating,
     and use `await this.wait(ms)` / `this.anim.tween(...)` for timing
2. Add a `<script>` tag in `index.html` and the class to `SCENES` in `js/main.js`.

Scenes draw in fixed 1000 × 620 coordinates; the app scales the canvas to fit.
