# Ashfall: Deadwater

Ashfall: Deadwater is a phone-first first-person zombie survival shooter built beside World Explorer in the Gravenmere project branch. It shares the same mobile-first priorities—landscape play, a left movement joystick, right-side drag look, large touch actions, offline assets, and an installable Capacitor Android build—without replacing the World Explorer game.

## Town map

This build contains the Town map only. It follows the hand-drawn block plan: three neighborhood rows in the southwest, a burning inaccessible forest in the southeast, St. Agnes Hospital and its ER across Main Street, an enterable bar with a working points-based fuel station behind it, a dense water-tower block, three close shopping rows with connecting alleys, and two enterable factories beside the paved Shipyard Road bend.

The Shipyard, harbor and beach remain separate future maps. Every outward road is physically barricaded in this build. Fallout hills and a mushroom cloud remain visible beyond the factory road while the recorded civil-defense siren continues to sound from that direction.

The low-poly geometry now uses compact authored WebP atlases for the carbine, zombies, conifers, bark, and dead foliage, plus a panoramic ash-storm sky. Existing building geometry and facade materials remain unchanged.

## Combat

- Automatic Rustline carbine with a 30-round magazine
- Touch fire, reload, sprint, movement, and drag-look controls
- Desktop WASD, mouse look, Shift, left-click, and R controls
- Headshots, hit markers, kills, points, health, ammo, reserve ammo, and reload timing
- Recorded zombie voices and sirens packaged for offline play
- Low-poly zombies with a shared skin and clothing atlas
- Driveable vehicles with fuel consumption and a 300-point gas-station refill
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
