# World Explorer

World Explorer is a phone-first first-person exploration game centered on the connected ranges of Gravenmere. It is designed for Android landscape play with a left movement joystick, right-side drag look, and large touch actions.

## Gravenmere plan

The southern school is generated from a fixed circulation plan rather than room-by-room improvisation:

- South Gatehouse and Processional Gallery
- four connected cloister walks around Founders' Court
- Library Range to the west and Great Hall Range to the east
- service passages leading to the Winter and Lantern courts
- enclosed west and east stair towers
- a short northern threshold into the older inner keep

The original outdoor-grounds layer is removed from the same coordinates before the planned school is built, preventing unrelated structures, trees, paths, and colliders from occupying the building footprint.

## Play

- Search the school and inner keep for three ward seals.
- Cast **Revelare** to expose hidden writing and the three court waystones.
- Read plaques, books, and objects to fill the field journal.
- Toggle the lantern at any time, including while walking with the touch joystick.
- Reveal the three waystones to open the cloister cache.
- Carry all three seals to the observatory.

Progress is stored privately on the device. The game is fully bundled and does not need a network connection after installation.

## Local web build

```bash
npm ci
npm test
npm run build
```

The test suite validates that every planned space is reachable from the gatehouse, staircases remain inside dedicated stair cores, outdoor spaces are enclosed courts or gardens, and every connection refers to a real space.

## Android

```bash
npm run build
npx cap add android
npm run configure:android
npm run assets:android
npx cap sync android
cd android
./gradlew assembleDebug
```

The GitHub workflow at `.github/workflows/gravenmere-android.yml` builds an installable `World-Explorer.apk` and uploads it as a workflow artifact.
