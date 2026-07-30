# Ashfall: Deadwater

Ashfall: Deadwater is a phone-first first-person zombie survival shooter built beside World Explorer in the Gravenmere project branch. It shares the same mobile-first priorities—landscape play, a left movement joystick, right-side drag look, large touch actions, offline assets, and an installable Capacitor Android build—without replacing the World Explorer game.

## Town map

This build contains the Town map only. It follows the hand-drawn block plan: three neighborhood rows in the southwest, a burning inaccessible forest in the southeast, the block-spanning St. Agnes Hospital campus across Main Street, a two-storey enterable bar with a playable jump balcony and a points-based fuel station behind it, a dense water-tower block, three close shopping rows with connecting alleys, and two enterable factories beside the paved Shipyard Road bend.

St. Agnes is a primary combat space rather than a small facade. Its playable ground floor contains a long central hall, a crossing corridor, ward and treatment rooms, reception, pharmacy, waiting areas, emergency entrances and rear/side exits. The Town blocks are spaced farther apart than the preceding build, the water tank clears the surrounding roofline, and the enlarged mushroom cloud rises high enough to require looking upward near the factory road.

The Shipyard, harbor and beach remain separate future maps. Every outward road is physically barricaded in this build. Fallout hills and a mushroom cloud remain visible beyond the factory road while the recorded civil-defense siren continues to sound from that direction.

The low-poly geometry now uses compact authored WebP atlases for the carbine, zombies, conifers, bark, and dead foliage, plus a panoramic ash-storm sky. Existing building geometry and facade materials remain unchanged.

## Combat

- Automatic Rustline carbine with a 30-round magazine
- Touch fire, reload, jump, use, movement, and drag-look controls
- Desktop WASD, mouse look, Space, E, left-click, and R controls
- Headshots, hit markers, kills, points, health, ammo, reserve ammo, and reload timing
- Recorded zombie voices and sirens packaged for offline play
- Low-poly zombies with a shared skin and clothing atlas
- Driveable vehicles with fuel consumption and a 300-point gas-station refill
- A working weapon forge; every level raises damage and magazine capacity, changes the gun silhouette and cycles optics
- Mild balcony fall damage and steady health regeneration after avoiding damage
- More numerous, faster and louder zombies, with stronger count, health, speed, damage and spawn scaling each round
- A raised, always-visible road centerline and non-operational traffic signals
- Mobile zombie cap to preserve frame rate while later waves continue scaling through total count and enemy strength

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
