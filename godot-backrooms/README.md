# Arthur Backrooms — Godot migration

This directory contains the mobile overlay used to build the Godot version of Arthur Backrooms.

## Environment base

The Android workflow checks out a pinned revision of `zodiepupper/backrooms`:

- Repository: `zodiepupper/backrooms`
- Commit: `6865f8b804f84441df8db3d0f3b6175a80195fd2`
- License: MIT (preserved under `overlay/THIRD_PARTY_LICENSES/`)

The upstream project provides the authored Godot wall/floor/light/model resources. Strawberry Games owns the mobile player, touch controls, streamed world controller, Godot project configuration, and Android export overlay in this directory.

## Current prototype

- Godot 4.7.1, Mobile renderer
- Android landscape + immersive mode
- Independent multitouch controls: left joystick + right look
- 6.4 walk speed / 9.0 desktop run speed
- Unbounded coordinate-based streaming around the player
- Distant cells are unloaded
- Upstream wall material uses authored texture/normal resources
- Upstream procedural floor material uses noise for albedo, normal and height detail
- Fluorescent fixtures are distance-culled for phone performance
- Occasional imported CRT model props prove the pipeline can use real 3D models rather than generated boxes

## Build

`.github/workflows/build-godot-backrooms-apk.yml` pins Godot 4.7.1, downloads its export templates, overlays this directory onto the pinned environment project, imports it headlessly, and exports `Arthur-Backrooms-Godot-debug.apk`.
