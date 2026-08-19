# seperate workstation for enemies.

Branch: `seperate-workstation-for-enemies`

## Isolation rules
- Do not edit or merge `main` from this workstation.
- Do not modify the stairs implementation or the other agents' main-branch work.
- Keep enemy integration behind new derived scripts/scenes wherever possible.
- Arthur must be able to psychically lift every enemy.
- Enemies must take meaningful hits from thrown psychic props/furniture and Arthur's flying light attacks.

## Shared goal
Build a creepy, generic Backrooms-style Hallwalker: vaguely humanoid, patrols corridors, notices Arthur, chases, attacks, can be TK-lifted/thrown, and can be damaged/disabled by Arthur's light projectiles and thrown furniture. Animation should read as grounded human locomotion with deliberately uncanny timing rather than a floating capsule.

## Current repo facts
- Current main scene uses `world_v14_stable_stairs.gd` and `player_v10_stairs.gd`.
- `player_v10_stairs.gd` extends `player_v09.gd`.
- Existing psychic props are `RigidBody3D` nodes in group `psychic_prop`.
- Existing mass psychic launch (`launch_psychic_field_at_enemies`) explicitly targets nodes in group `enemy`.

## Proposed isolated architecture
1. `player_enemy_workstation.gd` extends the current player script and adds enemy-aware single-target TK without changing mainline power files.
2. `world_enemy_workstation.gd` extends the current world script and owns enemy spawning/director hooks.
3. `enemies/hallwalker.gd` + `hallwalker.tscn` implement patrol/chase/attack, health, TK state, physics impact response, and procedural skeletal animation.
4. `enemies/enemy_director.gd` handles sparse spawn/despawn so enemies do not crowd every generated room.
5. Branch-local `main.tscn` points at the workstation player/world scripts only in this branch.

## Questions for the next AI working this branch
Please inspect the current psychic illumination implementation and answer here before/while editing:
- Which node(s) can be treated as the actual flying-orb attack hit source with the least invasive change?
- Is there already a collision or launch event we can reuse, or should the workstation add a small orb-hit Area3D adapter?
- If you find a cleaner existing navigation/pathing helper in the generated Backrooms world, note it here so Hallwalker can reuse it.

## Coordination protocol
Append entries below with timestamp/agent label, files touched, decisions, questions, and test results. Reply to unresolved questions in this file. Do not silently overwrite another agent's entry.

## Log
### 2026-08-19 / enemy-agent-A
- Created isolated branch and this log.
- Confirmed current main scene is on v14 stable stairs + v10 player.
- Confirmed existing psychic-field furniture launch already seeks group `enemy`.
- Next: inspect illumination and generator geometry, then implement Hallwalker + workstation adapters.
