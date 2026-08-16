# Arthur Infinite Parking Garage

This branch is an isolated continuation of the tested Arthur Backrooms v0.12 controller. The live pool/yellow/service generator is not modified here.

## Core idea

The parking garage is streamed around Arthur as a deterministic 5x5 cell neighborhood. Cells unload behind him and rebuild from coordinates, so the garage has no authored outer boundary. Each vertical level uses the same streaming system with a different procedural seed.

The garage includes concrete slabs and beams, parking stripes, variable aisle direction, fluorescent rhythm, dark/emergency-light pockets, attendant booths, service cores, abandoned bays, dense car rows, oil/debris details, and guaranteed ramp cells in each large block. Floors and ceilings are physical. Ramp cells cut the relevant floor/ceiling deck and carry a physical sloped ramp to the next level.

## Arthur abilities

`parking_player.gd` extends `player_v09.gd`; it does not replace Arthur's current controller. Psychic illumination, scout/spread/brightness controls, independent levitation altitude input, psychic grab/throw, psychic field, walking/running, and look controls are inherited from the tested v0.12 player stack.

Empty cars join `psychic_prop`, so Arthur can grab/throw them and include them in the psychic field. Cars temporarily leave that group while occupied so Arthur cannot accidentally telekinetically grab the car he is driving.

## Cars

Cars are primitive fallback vehicles built entirely in Godot so this branch has no new external art dependency. They are physical, enterable, drivable, and have local headlights.

Desktop vehicle controls:
- `G`: enter/exit nearest car
- `H`: toggle headlights while inside
- `WASD` / arrows: drive

Mobile uses the existing movement control to drive while occupied. A contextual `ENTER / HIDE` / `EXIT CAR` button appears near a car. Headlights come on automatically when the car starts moving.

## Streaming / performance choices

- 12 m cells
- 5x5 target neighborhood, 7x7 cleanup envelope
- four new cells built per frame at most
- emissive geometry sells most fixtures
- only a subset of cells use realtime OmniLight3D nodes
- realtime garage lights have shadows disabled
- repeated structural geometry is simple box mesh + box collision rather than complex CSG
- parked cars and psychic clutter remain individual physics bodies because Arthur must be able to manipulate them

## Isolation

Branch: `agent/arthur-infinite-parking-garage`

Branch-only entry files live under `arthur_mobile/parking_garage/`. `main.tscn` is changed only on this branch to point at the parking world and parking player adapter.

`.github/workflows/smoke-arthur-infinite-parking.yml` imports the overlay into the pinned upstream Godot Backrooms project and runs both editor import and a headless runtime smoke test on this branch.
