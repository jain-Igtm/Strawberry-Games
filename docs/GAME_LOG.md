# Strawberry Games — Development Log

A running journal for the game: what changed, what the player can see, and what changed under the hood.

The goal is not to make a tiny forest demo forever. The forest is the testing ground for a bigger phone-first open-world project: wilderness, roads, cities, vehicles, strange regions, portals, and other dimensions all living in one connected world.

Right now, the main priority is nature. The world needs to feel less like a green floor with objects on it and more like an actual place.

---

## Build v16 — Inverted Horizontal Look Restored

**Status:** Current tested build.

### Visible changes

- Left/right look controls went back to the earlier inverted feel.
- Up/down look stayed the same.
- The graphics work from v15 stayed in place.

### Technical changes

- Changed horizontal look back from `yaw -= ...` to `yaw += ...`.
- Updated the build label to `v16 inverted horizontal look` so the live version is obvious.

### Notes

Controls feel acceptable for now. No more control changes unless testing shows something clearly wrong.

---

## Build v15 — First Graphics Landmark Pass

### Visible changes

- Added a small cabin-style landmark near spawn.
- Added warm glowing windows.
- Added a log pile beside the cabin.
- Added darker forest-floor patches.
- Removed the debug-marker feel from the earlier pink box test.
- Slightly warmed up the lighting and terrain color.

### Technical changes

- Built the cabin from simple Three.js geometry.
- Added materials for wood, roof, trim, and warm windows.
- Added instanced ground patches for forest-floor variation.
- Adjusted fog and tone mapping.

### Notes

The cabin proved landmarks can work, but it should not become the main focus yet. The next visual work should be nature-first: better ground, grass, rocks, fallen logs, bushes, and more believable tree distribution.

---

## Build v14 — Controls Cleanup

### Visible changes

- Removed the pink debug cube near spawn.
- Added a clearer build label.

### Technical changes

- Removed marker geometry and marker material from the chunk generator.
- Temporarily flipped horizontal look direction.

### Notes

The pink cube was useful because it proved a fresh build had loaded. Once the cache problem was solved, it had to go.

---

## Build v13 — Cache Busting and Modular Foundation

### Visible changes

- Newer builds finally started showing up correctly after the script URL in `index.html` was versioned.

### Technical changes

- Updated `index.html` to load versioned JavaScript, such as `src/main.js?v=13`.
- This forced the phone browser to stop using old cached code.
- Added and expanded modular foundation files:
  - `src/config.js`
  - `src/zones.js`
  - `src/modules.js`
  - `src/roads.js`
  - `src/vehicles.js`
  - `src/cities.js`
  - `src/dimensions.js`
  - `src/portals.js`
  - `src/events.js`
  - `src/npcs.js`
  - `src/animals.js`
  - `src/combat.js`
  - `src/magic.js`

### Notes

This was the turning point where the project stopped behaving like one giant file and started becoming a real game project. The cache issue was irritating, but it forced better version discipline.

---

## Build v12 — Stable Asset-Ready Forest

### Visible changes

- Added a visible build label in the top-left corner.
- Shifted the forest toward taller conifer-style trees.
- Added a temporary pink cube marker near spawn to prove the new build was loading.
- Added bigger mountains and clearer distant silhouettes.

### Technical changes

- Wired the Start button before fragile asset checks.
- Made asset checks non-blocking so the menu would not freeze.
- Kept chunk generation playable while asset loading was being tested.

### Notes

This build solved the mystery-screen problem. From this point on, the game could tell us which version was actually running.

---

## Build v11 — Cache Debugging Phase

### Visible changes

- A separate fresh play page was attempted to test whether the problem was the cached entry page.

### Technical changes

- Tried to force fresh CSS and JavaScript loading from `index.html`.
- Direct automated edits to `index.html` kept getting blocked by the connector, so manual cache-busting became the practical fix.

### Notes

Not a fun phase, but useful. It confirmed the browser was loading older code even though newer code existed in GitHub.

---

## Build v10 — Start Button Recovery

### Visible changes

- The Start button became clickable again after the GLTF loading attempt made the game feel frozen.

### Technical changes

- Removed blocking model-loading behavior from the top of the script.
- Moved model loading into the background.
- Allowed the game to start whether the model asset loaded or not.

### Notes

Important lesson: no model, texture, or external asset should ever block the basic menu or controls.

---

## Build v9 — First Local Tree Asset Attempt

### Visible changes

- The result was not reliable yet because the model-loading path caused startup trouble.

### Technical changes

- Added `assets/models/trees/pine_tall.gltf`.
- Started wiring the game toward real model assets instead of only primitive cone/cylinder trees.
- Connected the model-loading path to the forest generator.

### Notes

The direction was right, but the first implementation was too fragile. The game needs real assets, but asset loading has to be safe and non-blocking.

---

## Build v8 — Asset Pipeline Foundation

### Visible changes

- Mostly no visible change. The forest still looked similar.

### Technical changes

- Added asset folders for models and textures.
- Added `src/assets/manifest.js`.
- Added `src/assets/loader.js`.
- Added early planning docs for mobile-friendly realism.

### Notes

This is where the project stopped trying to make high-end graphics out of only primitive shapes. The better path became real models, real textures, LOD, streaming, and mobile optimization.

---

## Build v7 — Modular Project Split

### Visible changes

- The game still looked similar, but the forest started moving toward a more structured conifer-heavy look.

### Technical changes

- Split the project into separate files:
  - `index.html`
  - `style.css`
  - `src/main.js`
- Moved CSS out of the HTML file.
- Moved world/game logic into `src/main.js`.
- Kept the working mobile joystick and drag-look controls.

### Notes

This was one of the most important structural changes. It made the game easier to grow without rewriting a massive single HTML file.

---

## Build v6 — Mobile Performance and Bigger Trees

### Visible changes

- Trees became larger.
- The world looked less like tiny toy trees scattered across a field.
- Some placeholder shapes were still obvious, especially round leafy trees.

### Technical changes

- Reduced expensive rendering settings for mobile.
- Kept shadows disabled for performance.
- Continued using chunk streaming.
- Increased tree scale and spacing.

### Notes

This pass made the world more playable on a phone, but the visuals were still clearly placeholder art.

---

## Build v5 — Better Forest Direction

### Visible changes

- The forest became a little more believable than the earliest prototype.
- The world had more depth with fog, distant shapes, and chunked terrain.

### Technical changes

- Improved procedural terrain and chunk generation.
- Continued tuning tree placement.
- Kept the single joystick mobile control scheme.

### Notes

This was the first point where the prototype started feeling like it could become something, even though the art style was still rough.

---

## Early Builds — First Working Forest Prototype

### Visible changes

- A basic first-person 3D forest appeared in the browser.
- The world had simple terrain, simple trees, rocks, grass, sky, fog, and mountains.
- Early trees looked too small and too much like toy placeholders.
- Earlier leafy trees had the infamous round-ball-on-a-stick look.

### Technical changes

- Created the initial Three.js browser game.
- Added mobile joystick movement.
- Added drag-look camera control.
- Added procedural terrain chunks.
- Added simple object placement for trees, rocks, and grass.
- Added fog and distant mountains to hide draw-distance limits.

### Notes

The earliest builds proved the game could run on a phone through GitHub Pages. They were rough, but they established the basic loop: open the page, press Start, walk around a generated 3D world.

---

# Ongoing Priorities

## Nature pass

The next major visual goal is to make the wilderness feel richer:

- Better forest-floor variation.
- More rocks and natural clutter.
- Fallen logs.
- Bushes and low plants.
- Better grass density.
- More believable tree spacing.
- Less empty green terrain.

## Asset pass

The long-term graphics jump still needs real optimized assets:

- Real tree models.
- Bark and leaf textures.
- Rock models.
- Ground textures.
- Grass/bush models.
- LOD versions for distance.

## World pass

After nature feels better, the world can expand outward:

- Roads.
- Vehicles.
- First town or city edge.
- Interiors.
- Portals.
- Strange zones and dimensions.

---

# Reminder

Do not let the project slide back into one giant file. Keep the game modular, keep builds labeled, and keep visible changes connected to technical changes.
