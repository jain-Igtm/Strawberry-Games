# Ashfall: Dependency-Free Mobile Raycaster Spike

This is the replacement for the abandoned Godot experiment. It is intentionally isolated from the existing Three.js Deadwater build.

## Why this engine can actually be tested here

The renderer has no external game-engine dependency. It is a purpose-built Canvas 2D raycaster: a texture-driven first-person technique descended from early *Wolfenstein/Doom*-era engines, adapted for a modern mobile browser shell. The project runs as static files, so it can be launched and visually inspected without downloading an editor or an npm rendering package.

Capacitor is used only as the Android container. The game itself does not rely on Capacitor to run in a browser.

## Preserved map structure

The code carries over the exact authored road control points and landmark positions from the current Dock Town plan, including:

- Main Street, Water Tower Avenue, Hospital Avenue, Shopping Street, Market Street, Shipyard Road, Willow Street, Ash Street, Foundry Lane, and Emergency Drive.
- The twelve-house southwest neighborhood.
- Civic Hotel, Tower House, City Rooms, water tower, bar, fuel station, factories, forge, shopping district, and impassable southeast forest.
- St. Agnes Hospital at the existing 76 × 46 footprint.
- Existing zombie spawn fronts and player start.

## New implementation

- No Three.js and no imported rendering library.
- Custom grid collision and sliding movement.
- Runtime-generated brick, board, concrete, hospital, metal, forest, glass, asphalt, sidewalk, wood, and soil textures.
- A large St. Agnes interior with a central cross-corridor, ward corridors, repeated rooms, reception objects, and multiple entrances.
- An actual second bar layer with stairs and an open balcony.
- Textured billboard zombies with line-of-sight shooting and increasingly difficult waves.
- Mobile split controls: drag left to move, drag right to look, FIRE and USE buttons.
- Generated civil-defense siren audio after the player starts the game.
- 400 × 225 internal rendering resolution, scaled to the display for predictable phone performance.

## Run locally

From this directory:

```sh
npm test
npm run build
python3 -m http.server 4173 -d www
```

Then open `http://localhost:4173`.

Desktop controls: WASD, mouse, click to shoot, E to use stairs, R to reload.

## Android APK

The branch includes a branch-scoped GitHub Actions workflow. It installs Capacitor and builds an ARM64-compatible debug APK from these same tested static files. The workflow never runs for the existing Deadwater branch.
