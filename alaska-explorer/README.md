# Alaska Explorer

A survival-first Godot prototype for Strawberry Games. The first playable build deliberately has no hostile creatures, combat, or supernatural systems. It establishes the place and the survival rules first, with one friendly dog companion.

## First playable slice

- Large walkable Alaskan winter valley with upward-facing terrain collision and stable slope traversal
- Curving open river with current, animated water, new ice, snowbanks, rocks, spruce forest, and positional river ambience
- Boardable and drivable river boat with throttle, steering, channel limits, a cast-off gangway, a stern reboarding ramp, bunk, working helm, food, fuel, and diesel heater
- Hinged cabin door that opens for entry and must be closed to restore full wind shelter
- Grounded survival simulation: core temperature, exposure, wetness, hunger, stamina, health, shelter, water immersion, drying, and heater fuel
- Full day/night cycle with short early-winter daylight, moonlight, changing fog and sky light
- Cycling winter weather: clear spells, flurries, steady snow, overcast conditions, and squalls that alter visibility, wind, and exposure
- A pet dog companion that follows the player, rides the Northstar, and can be petted
- Snowfall, distance fog, warm cabin lighting, headlamp, and continuous winter wind
- Android landscape controls with independent movement/look touches and dedicated use, run, and lamp controls
- Desktop controls for quick testing

## Controls

| Action | Desktop | Android |
| --- | --- | --- |
| Move | WASD | Left touch joystick |
| Pilot boat | W/S throttle, A/D steer | Left touch joystick |
| Look | Mouse | Drag right side |
| Run | Shift | Hold RUN |
| Use / leave helm | E | Tap USE / LEAVE |
| Headlamp | F | Tap LAMP |
| Swim upward | Space | Move and let buoyancy lift you |

## Survival model

The boat begins moored with the diesel heater running. Open the cabin door to enter, close it to block the wind, and stand near the heater to raise core temperature and dry wet clothing. Taking the helm casts off the gangway and lets the player steer the Northstar along the river. Falling into the river saturates clothing and cools the player quickly. Food and diesel are finite in this prototype, making the boat a real refuge without pretending that the first map already contains a complete gathering/crafting economy.

## Technical target

- Godot 4.7.1
- Mobile renderer
- Android arm64 landscape/immersive export
- Third-party runtime assets are license-tracked in `THIRD_PARTY_ASSETS.md`
- Standalone project; Arthur Backrooms files and build remain unchanged
