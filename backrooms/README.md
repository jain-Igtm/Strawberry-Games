# Arthur Backrooms Prototype

A mobile-first, genuinely unbounded Backrooms explorer built for the Strawberry Games repository.

## Why it is infinite

The world is not a finite map that repeats. Each `(chunkX, chunkZ)` coordinate deterministically generates a sector. Shared edge hashes guarantee that adjacent sectors agree on doorway positions. A 5x5 window of sectors is rendered around the player and old rendered sectors are unloaded. Sector data is regenerated from coordinates when revisited, so exploration has no fixed boundary.

## Current room families

- Classic yellow Level 0 partitions
- Pool rooms with tiled water chambers and columns
- Pastel playrooms with occasional curved slides
- Concrete service sectors with ceiling pipes
- Tall gallery rooms
- Mint liminal halls

## Controls

- Phone: left joystick moves, right-side drag looks. Pointer IDs are independent so both actions work simultaneously.
- Desktop: WASD to move, mouse click to lock pointer and look, Shift to run.

## Web development

```bash
npm install
npm run dev
```

## APK

The repository workflow `Build Backrooms APK` installs dependencies, bundles the Vite app, creates the Capacitor Android shell and builds a debug APK. Run it manually from GitHub Actions or push changes under `backrooms/`.
