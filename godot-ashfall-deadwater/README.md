# Ashfall: Deadwater — Godot rebuild

This directory is the native Godot 4.7.1 rebuild of **Ashfall: Deadwater**, using the approved `ashfall-stable-version-1` Town map and controls as the reference instead of modifying the old Three.js/Capacitor implementation.

## What is preserved

- Dock Town coordinate system and road seams from `src/districts/dock-town-plan.ts`.
- Player start at `(92, 67)`, facing north into the town.
- Main Street, Water Tower Avenue, Hospital Avenue, Shopping Street, Market Street, Shipyard Road, Willow Street, Ash Street, Foundry Lane and Emergency Drive.
- The southwest 12-house neighborhood layout.
- Water tower at `(66, 108)` and the dense tower block.
- Two-storey bar at `(112, 88)`, fuel station at `(105, 111)`, forge at `(54, 128)`.
- H-shaped St. Agnes campus centered at `(176, 106)` inside the original 76 × 46 footprint.
- Factories at Mercer Machine `(21, 148)` and Ashfall Tool `(54, 127)`.
- The six-building shopping district and connecting alleys.
- The southeast forest as an impassable region ending before Main Street.
- Barricaded outward roads and the Town-only playable boundary.
- Fallout hills and the static, grayscale Castle Romeo aftermath plume beyond the Shipyard Road horizon.
- Landscape mobile controls: 116 px left joystick, right-side 63% drag-look zone, 92 px FIRE button, plus RLD / USE / SWP / ADS / JMP / pause.
- Stable look sensitivity presets and the default FAST setting.
- 7.45 movement speed and 69° base camera FOV.
- Rustline Carbine baseline: 30-round magazine, 180 reserve, 0.105 s automatic fire delay, 1.65 s reload, 36 base damage, 1.9× headshot multiplier.
- Ashfall wave count/health/speed/damage/spawn scaling, hit/kill points, delayed health recovery and reserve-ammo wave bonuses.
- Opening civil-defense siren, generated natively at runtime so the project remains fully offline.

## Native rebuild structure

- `ashfall/main.gd` — game state, waves, scoring, settings, interactions and siren.
- `ashfall/world_builder.gd` — Dock Town geometry and collision rebuilt with Godot primitives.
- `ashfall/player.gd` — CharacterBody3D FPS controller and Rustline weapon handling.
- `ashfall/zombie.gd` — native enemy physics, combat and low-poly animation.
- `ashfall/mobile_controls.gd` — phone-first HUD and multitouch controls.
- `ashfall/main.tscn` — project entry scene.

The browser Ashfall source is intentionally left untouched beside this project so it remains a readable reference and rollback point.

## Build

Open `godot-ashfall-deadwater/project.godot` in Godot 4.7.1 or run the repository workflow **Build Godot Ashfall Deadwater APK**. The workflow performs a headless import, smoke-runs the main scene, exports an arm64 Android debug APK, and uploads it as `Ashfall-Deadwater-Godot-debug-apk`.
