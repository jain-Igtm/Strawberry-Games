# Third-party resources used by Arthur Backrooms

## zodiepupper/backrooms

- Repository: `zodiepupper/backrooms`
- Pinned commit: `6865f8b804f84441df8db3d0f3b6175a80195fd2`
- License: MIT (as provided by the upstream repository)
- Role: base Godot Backrooms environment resources and imported project assets.

## KayKit Furniture Bits 1.0

- Repository: `KayKit-Game-Assets/KayKit-Furniture-Bits-1.0`
- Pinned commit: `96d5930a8dbdb363409bbc2d3341718b00e17c9c`
- License: CC0 1.0 / public domain dedication (as provided in `LICENSE.txt` by the asset repository)
- Role: furniture and small environmental decoration models used in Level 0. The Android workflow copies the pinned glTF asset directory into the temporary Godot build before import/export.

Both external sources are pinned so future upstream changes cannot silently change a game build.
