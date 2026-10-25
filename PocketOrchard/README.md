# Pocket Orchard

An original, complete monochrome platformer for Android, Linux, and browsers, built in Godot 4.4.1. Made for the small, readable, springy feel of an early handheld platform game. All characters, sprites, stages, melodies and effects are original; there are no external art or sound dependencies.

Pip, a little orchard rabbit, has six deliveries to make. Cross the low orchard, the water mills, and the night garden; find the seed cellars; defeat the Thorn Engine and ring the last bell.

## Play

Download **PocketOrchard.apk** from the repository's [Releases](https://github.com/jain-Igtm/Strawberry-Games/releases). Install and open it on an ARM64 Android phone. The game runs offline and asks for no permissions. The Linux download is a self-contained executable. The Web download can be unzipped and served over HTTP, e.g. `python3 -m http.server`; WebGL 2 is required. Android is the primary phone build.

The LCD is exactly **160 x 144 pixels**, with nearest-neighbor scaling and one of two four-shade palettes. On-screen controls sit outside the picture, work in portrait or landscape, and support simultaneous directional, run and jump touches. Gamepads are supported.

| Action | Keyboard | Phone / gamepad |
| --- | --- | --- |
| Move | Arrows or WASD | D-pad / left stick |
| Jump | Z or Space | A |
| Run / fire pollen | X or Shift | B |
| Enter a door | Down | Down |
| Pause | Enter or Escape | Start / Android Back |
| Change LCD palette | Tab, on title/pause | Select |
| Toggle audio | M | Sound button |
| Return to title | Hold Up + X while paused | Hold Up + B while paused |

Hold jump for a higher arc. Build speed with B before long gaps. Stomp enemies from above; holding A gives a higher stomp bounce. A berry lets Pip grow and absorb a hit. A flower grants a pollen suit: release and press B to fire a bouncing pollen shot. Every hundred seeds awards a life. A pennant saves your checkpoint for the current attempt. Cleared courses remain unlocked after closing the app; choose **Course** on the title screen and use Left/Right to select one. All six courses have a bonus room. The final boss takes five hits.

## Open or build

Import `project.godot` in Godot **4.4.1**. There are no addons or package installs.

```sh
godot --headless --editor --path PocketOrchard --import
godot --headless --path PocketOrchard --script tests/test_game.gd
godot --path PocketOrchard
```

`.github/workflows/build-pocket-orchard.yml` runs script validation, gameplay tests and a runtime check, exports Android/Linux/Web, and publishes the three playable downloads when this game changes on main. Pull requests run the same builds without publishing a release. Android uses standard debug signing for sideloading and targets ARM64.

## Source map

- `shell.gd`: adaptive LCD layout, keyboard, controller and multitouch input.
- `game.gd`: fixed-step physics, actors, menus, camera, power-ups, boss, checkpoints and persistence.
- `world.gd`: six explicitly authored courses and their secret rooms.
- `art.gd`: original pixel sprites, bitmap lettering and four-shade palettes.
- `sound.gd`: synthesized original pulse-wave music, bass, noise percussion and effects.
- `tests/test_game.gd`: behavior checks for movement, jump arcs, blocks, combat, springs, moving platforms, secrets, lives and course completion.

The save file is `user://orchard.cfg`. Progress stores unlocked courses and the high score; it does not save a live run halfway through a course.
