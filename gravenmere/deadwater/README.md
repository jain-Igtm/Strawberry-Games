# Ashfall: Deadwater

Ashfall: Deadwater is a phone-first first-person zombie survival shooter built beside World Explorer in the Gravenmere project branch. It shares the same mobile-first priorities—landscape play, a left movement joystick, right-side drag look, large touch actions, offline assets, and an installable Capacitor Android build—without replacing the World Explorer game.

## Island design

Deadwater is a broad industrial island designed around movement rather than room defense. The central yard, refinery field, warehouse road, turbine quarter, shipbreaker yard, intake shore, diagonal service roads, and outer ring remain connected by multiple routes. The intake pier is an intentionally visible dead end; the rest of the island favors loops and wide bypasses.

The visual language is original but loosely inspired by grimy apocalyptic wave shooters: ash-dark sky, orange firelight, rusty metal, concrete service roads, tanks, pipes, containers, cranes, black water, and drifting embers. The map contains no trees.

## Combat

- Automatic Rustline carbine with a 30-round magazine
- Touch fire, reload, sprint, movement, and drag-look controls
- Desktop WASD, mouse look, Shift, left-click, and R controls
- Headshots, hit markers, kills, points, health, ammo, reserve ammo, and reload timing
- Procedural gunfire, empty-click, and zombie audio with no downloaded sound assets
- Low-poly procedural zombies built entirely from game geometry
- Inter-wave health and ammunition recovery
- Endless waves with increasing enemy count, health, speed, damage, and spawn pressure
- Mobile zombie cap to preserve frame rate while later waves continue scaling through enemy strength

## Build

```bash
npm install
npm test
npm run build
npx cap add android
npm run configure:android
npx cap sync android
cd android
./gradlew assembleDebug
```

The workflow at `.github/workflows/deadwater-android.yml` builds `Ashfall-Deadwater.apk` and uploads it as the `Ashfall-Deadwater-Android` workflow artifact.
