# Alaska Explorer

A survival-first Godot prototype for Strawberry Games. The first playable build deliberately has no creatures, combat, or supernatural systems. It establishes the place and the survival rules first.

## First playable slice

- Large walkable Alaskan winter valley rendered from deterministic procedural terrain
- Curving open river with current, animated water, new ice, snowbanks, rocks, and spruce forest
- Boardable river boat with a fully walkable cabin, open gangway, bunk, helm, food, fuel, and working diesel heater
- Grounded survival simulation: core temperature, exposure, wetness, hunger, stamina, health, shelter, water immersion, drying, and heater fuel
- Snowfall, low winter sun, distance fog, warm cabin lighting, and headlamp
- Android landscape controls with independent movement/look touches and dedicated use, run, and lamp controls
- Desktop controls for quick testing

## Controls

| Action | Desktop | Android |
| --- | --- | --- |
| Move | WASD | Left touch joystick |
| Look | Mouse | Drag right side |
| Run | Shift | Hold RUN |
| Use | E | Tap USE |
| Headlamp | F | Tap LAMP |
| Swim upward | Space | Move and let buoyancy lift you |

## Survival model

The boat begins with the diesel heater running. The cabin blocks the wind; standing near the heater raises core temperature and dries wet clothing. Falling into the river saturates clothing and cools the player quickly. Food and diesel are finite in this prototype, making the boat a real refuge without pretending that the first map already contains a complete gathering/crafting economy.

## Technical target

- Godot 4.7.1
- Mobile renderer
- Android arm64 landscape/immersive export
- No downloaded runtime assets or untracked licenses
- Standalone project; Arthur Backrooms files and build remain unchanged
