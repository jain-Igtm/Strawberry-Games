# Ashfall v0.18.2 visual asset sources

## Grayscale Castle Romeo mushroom cloud

- Asset: `Castle Romeo.jpg`
- Subject: Operation Castle, ROMEO Event, 27 March 1954
- Author: United States Department of Energy
- Source: https://commons.wikimedia.org/wiki/File:Castle_Romeo.jpg
- License: Public domain; work of a United States Department of Energy employee
- Runtime treatment: Wikimedia's 500-pixel historical JPEG is converted to
  neutral grayscale and WebP. The billboard shader crops the original
  photograph, limits it to the cloud silhouette, remaps the blast into a
  subdued gray range, and feathers every edge into the sky.

## Muted animated zombie

- Source mesh, rig, UVs, and animation: *Zombie* by Pixelhouse
- License: Creative Commons Attribution 3.0
- Source page: https://opengameart.org/content/zombie
- Style reference supplied by the user: *Top Down Animated Zombie Set* by
  Riley Gombart (OGA-BY 3.0)
- Reference page: https://opengameart.org/content/top-down-animated-zombie-set
- Runtime treatment: the correctly oriented upright Pixelhouse rig remains in
  use, while its diffuse map is reduced to 32px, converted to neutral gray,
  blurred, contrast-compressed, and palette-limited. The material removes the
  detailed emissive texture and uses smooth, non-specular shading to match the
  reference's restrained low-detail appearance.

Credit: Pixelhouse — https://opengameart.org/users/pixelhouse
