# Ashfall v0.17 Asset Sources

## Mushroom cloud

- Asset: `Castle Romeo.jpg`
- Subject: Operation Castle, ROMEO Event, 27 March 1954
- Author: United States Department of Energy
- Source: https://commons.wikimedia.org/wiki/File:Castle_Romeo.jpg
- License: Public domain; work of a United States Department of Energy employee
- Runtime use: Wikimedia's official 500-pixel render of the historical JPEG is
  embedded in `src/generated-assets-v17.ts`, keeping GPU texture memory low. A
  shader crops the relevant part of the photograph and derives transparency at
  runtime; the photograph is not generatively altered.

## Zombie

- Asset: `Zombie_Basic.gltf` from the Zombie Apocalypse Kit
- Author: Quaternius
- Source: https://quaternius.com/packs/zombieapocalypsekit.html
- License: Creative Commons Zero (CC0)
- Runtime use: only the authored Walk, Run, Idle Attack, and Death animations
  are retained. The glTF was resampled, pruned, and quantized into an embedded
  354 KB GLB to reduce APK size, loading time, and runtime bandwidth.
