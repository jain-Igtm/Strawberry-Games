# St. Agnes Hospital layout sources

The playable hospital in Ashfall: Deadwater 0.18.0 is rebuilt as a pavilion
campus from two public-domain Historic American Buildings Survey plans:

1. **National Home for Disabled Volunteer Soldiers, Mountain Branch,
   Hospital — First Floor Plan**, HABS TN-254-X, sheet 2 of 8. This is the
   source for the symmetrical administration/ER bar, entrance vestibule,
   east/west corridor, offices, waiting rooms, cashier, stairs and elevator.
   <https://commons.wikimedia.org/wiki/File:First_Floor_Plan_-_National_Home_for_Disabled_Volunteer_Soldiers%2C_Mountain_Branch%2C_Hospital%2C_Lamont_and_Veterans_Way%2C_Johnson_City%2C_Washington_County%2C_TN_HABS_TN-254-X_%28sheet_2_of_8%29.png>
2. **Ellis Island, Contagious Disease Hospital, Measles Ward A — First
   Floor Plan**, HABS NY-6086-T, sheet 3 of 8. This is the source for the two
   long ward pavilions, paired patient bays, nurses' stations, linen stores,
   bath/service rooms and connecting passage.
   <https://commons.wikimedia.org/wiki/File:First_Floor_Plan_-_Ellis_Island%2C_Contagious_Disease_Hospital_Measles_Ward_A%2C_New_York_Harbor%2C_New_York%2C_New_York_County%2C_NY_HABS_NY-6086-T_%28sheet_3_of_8%29.png>

Both surveys were produced by the U.S. National Park Service and are public
domain works of the United States federal government.

## Adaptation

- The administration block and two ward pavilions retain the plans' major room
  rhythm and circulation hierarchy.
- The two source buildings are joined into one H-shaped hospital campus.
- Ward rooms and doorways are enlarged for touch movement and horde combat.
- Treatment, pharmacy, reception, day-room, and emergency functions are
  regrouped without flattening the plans into a generic rectangle.
- Door openings are wider and sight lines are shorter than the archival plan.
- Exterior proportions, upper floors, furniture, finishes, entrances, and all
  combat routing are original to the game.

## Performance implementation

Walls still receive exact collision rectangles, but visible walls, windows,
floors, ceiling lights, and most furniture are submitted as material-grouped
`THREE.InstancedMesh` batches. The interior uses emissive ceiling panels rather
than per-room dynamic lights. This keeps the adapted plan inexpensive enough
for the mobile build.
