# St. Agnes Hospital layout source

The playable ground floor in Ashfall: Deadwater 0.16.0 is an original,
gameplay-oriented adaptation of the following public-domain architectural
survey:

- **St. Elizabeths Hospital, West Wing — First Floor Plan**
- Historic American Buildings Survey HABS DC-349-X, sheet 2 of 7
- Library of Congress / National Park Service
- <https://commons.wikimedia.org/wiki/File:First_Floor_Plan_-_St._Elizabeths_Hospital,_West_Wing,_539-559_Cedar_Drive,_Southeast,_Washington,_District_of_Columbia,_DC_HABS_DC-349-X_(sheet_2_of_7).png>
- Public domain: work of the United States federal government

The game does not redistribute a third-party model or texture pack. It uses the
survey as a spatial reference, then redraws and substantially changes it for
mobile first-person play.

## Adaptation

- The Oak Ward and Gray Ash corridor identities remain as navigation landmarks.
- Ward rooms are simplified and enlarged for touch movement and horde combat.
- Treatment, pharmacy, reception, dining/day-room, and emergency functions are
  regrouped around readable corridor loops.
- A compact east ward spur replaces the survey's more intricate service and
  seclusion-room geometry.
- Door openings are wider and sight lines are shorter than the archival plan.
- Exterior proportions, upper floors, furniture, finishes, entrances, and all
  combat routing are original to the game.

## Performance implementation

Walls still receive exact collision rectangles, but visible walls, windows,
floors, ceiling lights, and most furniture are submitted as material-grouped
`THREE.InstancedMesh` batches. The interior uses emissive ceiling panels rather
than per-room dynamic lights. This keeps the adapted plan inexpensive enough
for the mobile build.
