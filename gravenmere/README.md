# Gravenmere

Gravenmere is a phone-first first-person exploration game set inside an abandoned
wizard school. It is designed for Android landscape play with a left movement
joystick, right-side drag look, and large touch actions.

## Play

- Search the three school wings for faculty seals.
- Cast **Revelare** to expose hidden writing and traces of old magic.
- Read plaques and objects to fill the field journal.
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
