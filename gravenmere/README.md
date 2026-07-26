# Gravenmere

Gravenmere is a phone-first first-person exploration game set across an open
ruin complex and its strange outer grounds. It is designed for Android landscape
play with a left movement joystick, right-side drag look, and large touch actions.

## Play

- Explore the outer grounds, drowned archive, root cloister, crossed stair, and observatory.
- Search the inner ruins for three ward seals.
- Cast **Revelare** to expose hidden writing and traces of old magic.
- Read plaques and objects to fill the field journal.
- Equip the lantern from the character inventory when a passage gets too dark.
- Reveal the three outdoor waystones to open their hidden cache.
- Carry all three seals to the observatory.

Progress is stored privately on the device. The game is fully bundled and does
not need a network connection after installation.

## Local web build

```bash
npm ci
npm test
npm run build
```

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

The GitHub workflow at `.github/workflows/gravenmere-android.yml` builds an
installable `Gravenmere.apk` and uploads it as a workflow artifact.
