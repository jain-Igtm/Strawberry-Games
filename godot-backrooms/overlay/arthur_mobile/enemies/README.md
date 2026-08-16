# Arthur enemy lab

This folder is intentionally additive and isolated from the procedural world/architecture code.

## Merge contract

- Do not edit `world.gd`, `world_v10.gd`, `yellow_plan.gd`, room scenes, or geometry from this branch while architecture work is active.
- Runtime systems find Arthur through the existing `player` group instead of hard-coding the world tree.
- Telekinetic loose objects are discovered through the existing `psychic_prop` group.
- Hostile entities join the existing `enemy` group so Arthur's psychic projectile targeting can see them.
- `enemy_lab.tscn` is a standalone harness. The normal `main.tscn` remains untouched.
- Final integration should require only instancing an `EnemyDirector` node/scene into the shipping root after the architecture branch settles.

## Current ecology

1. **Cross-Section Intrusion** — a discontinuous higher-dimensional predator/event. Arthur receives a subtle psychic warning several seconds before it manifests. The visible cross-sections are deliberately rare and have a strict mobile rendering budget.
2. **Higher-dimensional dissociation** — a minority of intrusion events briefly distort Arthur's perception. The fullscreen effect is hidden completely outside active events. On snap-back, any active telekinetic field releases and nearby psychic props slam down.
3. **Ground Stalker** — the ordinary dry-space physical attacker. It uses the tiny official Godot `Squash the Creeps` mob model instead of procedural body geometry. The director searches for valid same-floor ground behind Arthur and skips the encounter if it cannot find a plausible unobstructed spawn. The creature chases with lightweight `CharacterBody3D` motion, steers off walls, makes short committed dashes, and has no navmesh dependency yet.
4. **Pool Eel** — lightweight aquatic predator. It is only eligible after Arthur has remained underwater for several seconds and is placed behind his current view rather than appearing the instant he enters water.
5. **Pool fish** — procedural school fauna for water spaces. They are lightweight, non-hostile and bounded to a caller-provided water volume.
6. **Human encounters** — intentionally postponed until a rigged/textured human asset is selected. Navigation should be integrated only after the world geometry/navigation contract stabilizes.

## Asset provenance

The isolated lab workflows inject the official Godot demo model `3d/squash_the_creeps/art/mob.glb` from `godotengine/godot-demo-projects`, pinned to commit `34fc99545fc41520a958248f607101e7d0b95b05`. That repository's MIT license is copied beside the asset in the assembled lab project. The binary is not committed into the Arthur overlay branch, keeping this branch small and making the dependency explicit/reproducible.

The retired overhead Veil Ray prototype has been removed. Dry-space ambient enemies should enter on or near traversable ground rather than dropping from the ceiling or visibly materializing in front of the player.

The enemy director is designed so additional encounter types can be registered without changing the world generator.