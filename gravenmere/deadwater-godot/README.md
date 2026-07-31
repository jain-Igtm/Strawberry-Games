# Ashfall: Godot Mobile Texture Spike

This is an isolated engine experiment. It does not replace or modify the existing Three.js Deadwater build.

## What this tests

- Godot 4 Mobile renderer instead of Three.js.
- Native `CharacterBody3D` movement and collision.
- A texture-first low-poly world with procedurally generated, repeatable surface textures.
- The current Dock Town map seams and landmark coordinates, copied directly from the authored Deadwater plan.
- Android-friendly touch controls and an Android APK export preset.
- MultiMesh forest impostors, simple textured zombies, hitscan shooting, fog, and mobile-scale lighting.

## Map continuity

The prototype keeps the existing locations and street network:

- Main Street, Water Tower Avenue, Hospital Avenue, Shopping Street, Market Street, Shipyard Road, Willow Street, Ash Street, Foundry Lane, and Emergency Drive.
- The twelve-house southwest neighborhood.
- Civic Hotel, Tower House, City Rooms, the water tower, the two-story bar and balcony, and the fuel station.
- St. Agnes Hospital at the existing 76 × 46 footprint, now with a large playable corridor-and-room interior.
- Mercer Machine, Ashfall Tool, the forge, and the six shopping-district buildings.
- The southeast impassable forest, authored zombie fronts, fallout hills, and the Castle Romeo-style solid dark-gray plume.

## Open in Godot

Open `project.godot` in Godot 4.3 or newer and run the project.

Desktop controls:

- WASD: move
- Mouse: look
- Space: jump
- Left click: fire
- Escape: release mouse

Mobile controls:

- Drag the left half of the screen to move.
- Drag the right half to look.
- Tap FIRE to shoot.

## Android APK

The included `export_presets.cfg` targets a single ARM64 APK for modern Android phones. Godot still needs its Android export templates and Android SDK configured on the machine doing the build.

This branch is deliberately a side-by-side evaluation project. The existing Deadwater implementation remains untouched until the Godot version proves that it feels and performs better on the phone.
