# Arthur Infinite Parking Garage

This branch is an isolated continuation of the tested Arthur Backrooms v0.12 controller. The live pool/yellow/service generator is not modified here.

## Finished environment pass

The garage is still infinite and deterministic, but the generator now works at two scales instead of treating every cell as an unrelated roll.

At the streaming scale, Arthur is surrounded by a 5x5 neighborhood of 12 m cells. Cells unload behind him and rebuild from coordinates, so there is no authored outer boundary. Vertical levels use the same streaming system with different seeds and physical ramp connections.

At the architectural scale, 8x8-cell districts establish persistent aisle direction, parking density, color language, lighting character, signage, clutter style, sound balance, and landmark placement. This produces long coherent runs that transition between recognizable parts of one garage instead of procedural tile soup.

District families include public decks, long-term parking, service rings, transit decks, closed/abandoned sections, and reserved decks. Each family changes car density, fixture color, environmental hum, utility treatment, and the kinds of spaces that can appear.

The level now includes:

- a multi-cell Central Arrival spawn composition with parking services, terminals, lane gates, wayfinding and a nearby lift/stair core
- coherent parking aisles, stall markings and directional arrows
- physical multilevel ramps with aligned deck openings and ramp signage
- lift/stair cores, maintenance rooms, payment banks, security islands and long-term storage cages
- attendant/toll structures, service architecture and parking control hardware
- ceiling ducts, utility pipe runs, beams, painted column bands and bollards
- abandoned bays, oil stains, psychic debris and broken barriers
- deliberately contradictory sealed exits and level signage as subtle Backrooms wrongness
- district and landmark discovery messages that only fire once per relevant place/level
- fluorescent, warm-service, cool-reserved and emergency lighting families with restricted realtime light counts for mobile

## Arthur abilities

`parking_player.gd` extends `player_v09.gd`; it does not replace Arthur's current controller. Psychic illumination, scout/spread/brightness controls, independent levitation altitude input, psychic grab/throw, psychic field, walking/running, and look controls are inherited from the tested v0.12 player stack.

Empty cars join `psychic_prop`, so Arthur can grab/throw them and include them in the psychic field. Cars temporarily leave that group while occupied so Arthur cannot accidentally telekinetically grab the car he is driving.

## Cars

Cars are generated entirely in Godot, so this branch has no new vehicle-art dependency. They now use several deterministic body silhouettes with separate hood/trunk/cabin shapes, glass, pillars, bumpers, rocker panels, mirrors, wheels/hubs, plates, headlamps and tail lamps.

Driving remains deliberately arcade-like for narrow indoor spaces. The handling pass adds lateral grip, smoother steering and a slightly wider in-car camera while keeping rigid-body collision. Cars are enterable/hideable, physical, psychic when empty, and have local spot headlights.

Desktop vehicle controls:
- `G`: enter/exit nearest car
- `H`: toggle headlights while inside
- `WASD` / arrows: drive

Mobile uses the existing movement control to drive while occupied. A contextual `ENTER / HIDE` / `EXIT CAR` button appears near a car, and a separate `HEADLIGHTS` button appears while driving. Headlights also come on automatically when a driven car starts moving.

## Streaming / performance choices

- 12 m cells
- 5x5 target neighborhood, 7x7 cleanup envelope
- normally two new cells per frame, three while Arthur is moving slowly
- district decisions are deterministic and require no saved map state
- emissive geometry sells most fixtures
- only a subset of cells use realtime `OmniLight3D` nodes
- realtime garage lights and car headlights have shadows disabled
- structural geometry is simple mesh + box collision rather than complex runtime CSG
- most decorative pipes/signs/markings are visual-only
- parked cars and selected clutter remain individual physics bodies because Arthur must be able to manipulate them

## Isolation and validation

Branch: `agent/arthur-infinite-parking-garage`

Branch-only world/player/vehicle files live under `arthur_mobile/parking_garage/`. `main.tscn` is changed only on this branch to point at the parking world and parking player adapter. Shared Arthur controller files are not modified.

`.github/workflows/smoke-arthur-infinite-parking.yml` imports the overlay into the pinned upstream Godot Backrooms project and runs both editor import and a headless runtime smoke test.

`.github/workflows/build-arthur-infinite-parking-apk.yml` exports the branch as its own Android application (`Arthur Parking`, package `com.strawberrygames.arthurinfiniteparking`) and publishes `Arthur-Infinite-Parking.apk` to the `arthur-parking-latest` release, so it installs separately from the ordinary Arthur Backrooms APK.
