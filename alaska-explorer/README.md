# Alaska Explorer

A survival-first Godot prototype for Strawberry Games. The current build still has no hostile creatures or supernatural encounters. It establishes the place, exploration loop, and survival rules first, with one friendly dog companion.

## First playable slice

- Large walkable Alaskan winter valley with upward-facing terrain collision and stable slope traversal
- Curving open river with current, animated water, new ice, snowbanks, rocks, spruce forest, and positional river ambience
- Boardable and drivable river boat with throttle, steering, consumable vessel fuel, channel limits, a cast-off gangway, a stern ramp plus forgiving waterline ladder, an unobstructed cabin aisle, bunk, working helm, food, and diesel heater
- Four illuminated river fuel docks spaced in both exploration directions, each with a working pump and a recoverable flag
- Five-flag collection with a thin sectional cloth flag, tied folded discoveries, and a compact cabin signal folio used to hoist any recovered design
- Sheathable first-person sword with a tapered forged blade, narrow guard, wrapped grip, a full wind-up/forward-strike/recovery animation, impact-timed hit check, sound, and separate draw, strike, and sheathe controls
- Compact marine cabin receiver with a fixed faceplate, tuning scale, knobs, speaker grille, working amber dial light, OFF position, original old-time waltz, open-carrier static, and three voiced unsettling river transmissions
- Hinged cabin door with nearby-use assistance, instant reversal, and shelter that returns only when the door is fully secured
- Grounded survival simulation: core temperature, exposure, wetness, hunger, stamina, health, shelter, water immersion, drying, and heater fuel
- Full day/night cycle with short early-winter daylight, moonlight, changing fog and sky light
- Cycling winter weather: clear spells, flurries, steady snow, overcast conditions, and squalls that alter visibility, wind, and exposure
- Scout, a dog companion who follows at a comfortable distance, rides the Northstar, and obeys sit/stay and recall commands
- Snowfall, distance fog, warm cabin lighting, headlamp, and continuous winter wind
- Clean Android landscape controls with a fixed movement/helm joystick, independent look touch, and dedicated use, run, and lamp controls
- Desktop controls for quick testing

## Controls

| Action | Desktop | Android |
| --- | --- | --- |
| Move | WASD | Left touch joystick |
| Pilot boat | W/S throttle, A/D steer | Left touch joystick |
| Look | Mouse | Drag right side |
| Run | Shift | Hold RUN |
| Use / command Scout / board / leave helm | E | Tap USE / LEAVE |
| Headlamp | F | Tap LAMP |
| Draw / sheathe sword | X | Tap DRAW / SHEATHE |
| Strike with drawn sword | Left mouse | Tap STRIKE |
| Tune radio / refuel / collect or hoist flag | E | Tap USE |
| Swim upward | Space | Move and let buoyancy lift you |

## Survival model

The boat begins moored with the diesel heater running and 68% vessel fuel. Open the cabin door to enter, close it to block the wind, and stand near the heater to raise core temperature and dry wet clothing. Taking the helm leaves the gangway in place until throttle is applied; then the player can steer the Northstar along the river. Pull alongside a lit fuel dock, nearly stop the boat, step onto the dock, and USE the pump to refill. Each stop also holds a distinct flag; recover it, then USE the cabin flag locker to hoist the next collected design. The stern ramp remains walkable, while USE near the hull provides a dependable ladder climb back to deck. Falling into the river saturates clothing and cools the player quickly, with colder weather and wind chill increasing exposure.

## Technical target

- Godot 4.7.1
- Mobile renderer
- Android arm64 landscape/immersive export
- Third-party runtime assets are license-tracked in `THIRD_PARTY_ASSETS.md`
- Standalone project; Arthur Backrooms files and build remain unchanged
