# Ashfall: Deadwater

Ashfall: Deadwater is a phone-first first-person zombie survival shooter built beside World Explorer in the Gravenmere project branch. It shares the same mobile-first priorities—landscape play, a left movement joystick, right-side drag look, large touch actions, offline assets, and an installable Capacitor Android build—without replacing the World Explorer game.

## Dock Town map

This build contains Dock Town only. Its authored road network connects the neighborhood, downtown, warehouse edge, water tower, harbor administration field, and ruined transmission corridor. A huge irregular forest occupies the district interior, forcing the player around it by road. Its dense interior is deliberately inaccessible and burns behind several layers of trees.

Adjacent districts are separate future maps. Both road stubs are physically barricaded, and no Shipyard geometry or direct cross-map route is loaded in Dock Town.

The low-poly geometry now uses compact authored WebP atlases for the carbine, zombies, conifers, bark, and dead foliage, plus a panoramic ash-storm sky. Existing building geometry and facade materials remain unchanged.

## Combat

- Automatic Rustline carbine with a 30-round magazine
- Touch fire, reload, sprint, movement, and drag-look controls
- Desktop WASD, mouse look, Shift, left-click, and R controls
- Headshots, hit markers, kills, points, health, ammo, reserve ammo, and reload timing
- Recorded zombie voices and sirens packaged for offline play
- Low-poly zombies with a shared skin and clothing atlas
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
