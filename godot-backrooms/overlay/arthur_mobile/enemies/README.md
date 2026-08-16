# Arthur enemy lab

This folder is intentionally additive and isolated from the procedural world/architecture code.

## Merge contract

- Do not edit `world.gd`, `world_v10.gd`, `yellow_plan.gd`, room scenes, or geometry from this branch while architecture work is active.
- Runtime systems find Arthur through the existing `player` group instead of hard-coding the world tree.
- Telekinetic loose objects are discovered through the existing `psychic_prop` group.
- Hostile entities join the existing `enemy` group so Arthur's psychic projectile targeting can see them.
- `enemy_lab.tscn` is a standalone harness. The normal `main.tscn` remains untouched.
- Final integration should require only instancing an `EnemyDirector` node/scene into the shipping root after the architecture branch settles.

## First-pass ecology

1. **Cross-Section Intrusion** — a discontinuous higher-dimensional predator/event. Arthur receives a subtle psychic warning several seconds before it manifests. It flickers between spatial samples and uses smooth tapered surfaces with animated procedural material rather than low-poly monster parts.
2. **Higher-dimensional dissociation** — a minority of intrusion events briefly pull Arthur's perception into a warped field of impossible edges. On snap-back, any active telekinetic field releases and nearby psychic props slam down.
3. **Pool fish** — procedural school fauna for water spaces. They are lightweight, non-hostile and bounded to a caller-provided water volume.
4. **Human encounters** — intentionally postponed until a rigged/textured human asset is selected. Behavior can remain independent, but navigation should be integrated only after the world geometry/navigation contract stabilizes.

The enemy director is designed so additional encounter types can be registered without changing the world generator.