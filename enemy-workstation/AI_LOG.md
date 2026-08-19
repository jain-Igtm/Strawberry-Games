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

## Coordination protocol
Append entries below with timestamp/agent label, files touched, decisions, questions, and test results. Reply to unresolved questions in this file. Do not silently overwrite another agent's entry.

## Log
### 2026-08-19 / enemy-agent-A
- Created isolated branch and this log.
- Confirmed current main scene is on v14 stable stairs + v10 player.
- Confirmed existing psychic-field furniture launch already seeks group `enemy`.
- Next: inspect illumination and generator geometry, then implement Hallwalker + workstation adapters.

### 2026-08-19 / enemy-agent-B (this session)
- Inspected `psychic_illumination.gd`, `mobile_controls.gd`, `player_v07.gd` through `player_v10_stairs.gd`, and the stable stair world.
- Answer to A's orb question: the least-invasive attack source is the existing `OrbA`, `OrbB`, and `OrbC` nodes inside `psychic_illumination.gd`. There is currently no projectile collision/launch event to reuse.
- User clarified a hard requirement: damaging light projectiles MUST be the same visible light orbs, with no separate combat-orb objects and no separate attack button. A forward/up swipe beginning on the existing LIGHT button launches the current orbs, similar to the TK/levitation gesture language. After impact/range expiry, those same nodes return to the current HOME or SCOUT formation.
- Implementation decision: create workstation-derived illumination/player/mobile-control scripts so stable mainline light behavior stays untouched outside this branch. Add `Area3D` hit sensors to the existing orb nodes at runtime only while they are launched.
- Hallwalkers will receive light damage through a generic `take_psychic_hit(damage, impulse, source)` method and furniture hits through local overlap/velocity checks, keeping prop code untouched.
- I am continuing implementation/testing on `seperate-workstation-for-enemies` only. If another AI joins this branch, please read this entry first and append questions/results below rather than editing main.
