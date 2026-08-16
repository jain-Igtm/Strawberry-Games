# Arthur Environment Lab: Parking / Lived-In Space R&D

This directory is an intentionally isolated experiment. It is designed to be cherry-picked or selectively merged later without changing the live streamed-world generator, enemy work, pool architecture, or shared mobile controls.

## What is actually in the lab

The playable lab builds several connected spaces that naturally admit vehicles instead of widening any existing Backrooms room to suit them:

- **Parking concourse**: broad lanes, parking bays, drainage channels, concrete columns, wheel-stop islands, low fluorescent practicals, dark pockets, and enterable cars.
- **Interior vehicle boulevard**: a long loading/service road that stays completely indoors under a continuous ceiling. Loading shutters and service walls make the road feel infrastructural rather than like an exterior street.
- **Dry car wash**: drive-through geometry with hanging brush forms, drains, cold light, and no obvious water source.
- **Attendant lounge**: a carpeted domestic island occupying parking bays, with a glass booth and CC0 KayKit furniture. It is deliberately too comfortable for its setting.
- **Car cathedral / strange set dressing**: parked-car plinths, incompatible EXIT signs, suspended traffic objects, chairs facing blank concrete, and throwable clutter.
- **Narrow side portals**: pedestrian-scale openings that cars simply cannot use. There is no special "car forbidden" logic. Collision geometry decides what fits.

## Cars

`garage_car.gd` is a compact arcade rigid-body vehicle experiment rather than a `VehicleBody3D` dependency.

Each car:
- is a `RigidBody3D`;
- joins `enterable_car` for interaction;
- joins the existing `psychic_prop` group while unoccupied, so Arthur's current ray grab / field / throw logic can operate on it;
- has a physical collision body and no room-type whitelist;
- can be entered to hide or driven;
- keeps headlights off while the player is merely hiding, then turns them on when the player drives;
- exposes a seat and exit position to the player adapter.

The lab player exposes:
- `is_in_vehicle()`
- `is_hidden_in_vehicle()`
- `get_hiding_vehicle()`
- `has_enterable_vehicle_nearby()`
- `toggle_vehicle()`

That is deliberately enough for a future enemy to ask whether Arthur is hidden without coupling the enemy implementation to the vehicle internals.

## Lighting experiment

This lab targets the project's Mobile renderer. The approach is intentionally theatrical rather than brute-force:

- emissive fluorescent geometry sells the presence of many fixtures;
- only a subset of fixtures create realtime lights;
- most realtime lights have shadows disabled;
- a few local "hero" lights provide warm/cold contrast and one small shadowed area;
- vehicle headlights are local spotlights and do not require global lighting changes;
- roughness changes across concrete, paint, glass, rubber, carpet, rust, and vehicle surfaces provide material separation without expensive screen-space effects;
- fog and low ambient fill preserve readable silhouettes while allowing true dark lanes.

Static repeated decoration can later move to `MultiMesh` if this density is adopted in the streamed world. Objects intended for Arthur to manipulate must stay individual physics bodies instead.

## Art / asset sources

The lab build uses the same pinned upstream Backrooms environment and KayKit Furniture Bits already used by the main Godot build. It additionally checks out Kenney's **Starter Kit Racing** at commit `f5241ebdf00c25bc951bf4fdb7950bb1b78b4bcc` and copies four vehicle GLBs into the build.

Kenney's project README identifies its bundled 3D models and sounds as CC0. The lab does not copy Kenney's vehicle controller code; `garage_car.gd` is a purpose-built controller for Arthur Backrooms.

Current vehicle models:
- `vehicle-truck-yellow.glb`
- `vehicle-truck-green.glb`
- `vehicle-truck-red.glb`
- `vehicle-truck-purple.glb`

If those assets are absent, the controller generates a simple primitive car so the scene still opens.

## Isolation / merge boundary

New files live under:

`godot-backrooms/overlay/arthur_mobile/environment_lab/`

The dedicated build lives at:

`.github/workflows/build-arthur-environment-lab-apk.yml`

The lab workflow swaps the main scene **inside its temporary CI build directory only**. It does not edit `project.godot` on the branch and does not touch the normal Backrooms APK workflow.

A future integration can therefore be done in pieces:
1. merge the car controller and interaction hooks;
2. convert selected garage spaces into streamed room modules;
3. keep only the lighting/material recipes that perform well on the target phone;
4. promote chosen props/assets into the normal asset-copy step;
5. leave rejected experiments behind with no effect on the game.

## Desktop test controls

The normal Arthur desktop controls remain available. In the lab:
- `G`: enter / exit the nearest car
- `H`: toggle headlights while inside a car
- `WASD`: drive while inside
- existing Arthur ability keys remain inherited

On mobile, the normal movement/look/ability overlay remains unchanged. A contextual `ENTER / HIDE` / `EXIT CAR` button appears only when needed.
