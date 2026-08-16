# Ashfall — Godot rebuild

This is a from-scratch Godot 4.7 rebuild of the old **Sundown Village western zombie prototype** (the game later referred to as Ashfall).

The rebuild keeps the recognizable map plan and control scheme while replacing the old canvas pseudo-3D renderer with real Godot 3D nodes, physics, lighting, collision, hitscan shooting, mobile touch controls, and wave-based enemies.

## Preserved layout

- Mercantile/storefront row on the left side of the grassy flat.
- Cabins, saloon, blacksmith, and stable on the right.
- Barn, church, and red shed closing the far oval end.
- Dark tree line surrounding the playable town.
- Central fire pit, benches, barrels, porch lighting, and string lights.

The coordinates use the later 3D village pass where it refined the original blockout, so the overall footprint stays familiar while the buildings have more complete 3D massing.

## Controls

**Mobile landscape**
- Left stick: move / strafe.
- Drag the middle-right portion of the screen: look.
- FIRE button: shoot.

**Desktop**
- WASD / arrows: move.
- Mouse: look.
- Left click: fire.
- Escape: release the mouse.

## Gameplay baseline

- Round 1 starts with 9 zombies (`6 + round * 3`).
- Spawns are staggered by 0.42 seconds.
- Zombie contact deals 10 damage on a 650 ms attack cadence.
- Zombie health and speed scale per round using the same basic progression as the original prototype.
- Player movement speed is 5.1 m/s, matching the original zombie build.

## Project

Open `godot-ashfall/project.godot` in Godot 4.7.1, or use the repository workflow to build the Android debug APK.
