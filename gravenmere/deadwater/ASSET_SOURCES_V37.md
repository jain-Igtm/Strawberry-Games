# Ashfall authored infected asset (v37)

## Source and license

- **Asset:** [Zombie by Pixelhouse](https://opengameart.org/content/zombie)
- **Author:** Pixelhouse
- **License:** [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)
- **Credit:** Zombie model and original textures by Pixelhouse.

The source rig and texture were already bundled in Ashfall's v18 offline asset module.

## Ashfall treatment

The v37 runtime asset samples the source walk clip at 20 percent and bakes that
natural asymmetric stance into one static mesh. It then:

- normalizes the soles to `y = 0` and the figure to a 2.28 m display height;
- rotates the source body once from its authored local `+Z` face direction into
  Ashfall's local `-Z` movement-facing convention;
- strips the skeleton, bones, clips, animation mixer, normal map, and specular map;
- neutralizes blood-red pixels into charcoal grime, desaturates the diffuse map,
  cold-grades it, and stores it as a 256 px WebP with no visible gore;
- adds a small dark hair cap and broken fringe, then merges them into the same mesh;
- shares one geometry and one texture across the horde while retaining one material
  per infected for the existing damage flash.

Walking, running, and attacking do not animate the living mesh. Existing navigation,
combat, hitboxes, headshots, collision, spawn counts, world rendering, and thermal
budget logic remain unchanged.
