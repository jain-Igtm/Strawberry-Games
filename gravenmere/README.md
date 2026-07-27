# World Explorer

World Explorer is a landscape-first Android exploration game set throughout Gravenmere’s connected halls, courts, gardens, archives, towers, and interior ranges.

The game preserves its dark architectural atmosphere while keeping deep shadows readable on a phone. The lantern can be toggled with a second finger while moving.

## Current build

- Android version: `0.3.2` (`7`)
- APK: `World-Explorer.apk`
- Fully offline after installation
- Existing saves and package identity are preserved across updates

## Exploration

- Explore the Gate Hall, drowned archive, root cloister, rebuilt grand stair, observatory, South Vestibule, Long Gallery, Founders’ Court, Moon Cloister, Survey Hall, Winter Garden, Lantern Conservatory, Quiet Undercroft, and Chamber of Tides.
- Search the ranges for three ward seals.
- Cast **Revelare** to expose hidden writing and traces of old magic.
- Read plaques and objects to fill the field journal.
- Toggle the lantern at any time, including while walking with the touch joystick.

Progress is stored privately on the device.

## Mobile rendering

The expanded school uses spatially grouped instanced masonry, frozen static transforms, emissive decorative lanterns backed by room-scale lighting, reduced particle density, and adaptive internal resolution. These changes reduce draw calls and per-pixel lighting work without removing rooms or applying a new color grade.

## Local build

```bash
npm ci
npm test
npm run build
```

The GitHub workflow at `.github/workflows/gravenmere-android.yml` builds an installable `World-Explorer.apk` and uploads it as a workflow artifact.
