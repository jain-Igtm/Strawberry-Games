extends "res://scripts/world.gd"

# Terrain correction layer for the Android build. The first generator carved a
# very narrow path directly into full-strength ridge terrain. Near the outer
# edge of that carve, the 17x17 mobile mesh turned the elevation transition into
# huge planar shelves. Those shelves looked like chunks floating above the
# player even though grounding itself was working.
#
# Keep the authored forest systems from world.gd, but use a smoother terrain
# field and a broad *elevation* corridor around the narrow visible trail.

const FIXED_MOBILE_RES: int = 29
const FIXED_DESKTOP_RES: int = 41

func _ready() -> void:
    view_radius = 2 if OS.has_feature("mobile") else 3
    terrain_resolution = FIXED_MOBILE_RES if OS.has_feature("mobile") else FIXED_DESKTOP_RES
    _configure_noise()
    _build_shared_resources()
    _build_environment()

    var spawn_abs: Vector2 = Vector2(6.0, _path_center_z(6.0))
    player.global_position = Vector3(
        spawn_abs.x,
        height_at(spawn_abs.x, spawn_abs.y) + 2.2,
        spawn_abs.y
    )
    _refresh_streaming(true)

func _raw_height(x: float, z: float) -> float:
    var continental: float = terrain_noise.get_noise_2d(x, z)
    var hills: float = hill_noise.get_noise_2d(x, z)
    var ridge: float = 1.0 - absf(ridge_noise.get_noise_2d(x, z))
    ridge = pow(clampf(ridge, 0.0, 1.0), 3.4)
    var detail: float = detail_noise.get_noise_2d(x, z)
    var ridge_gate: float = smoothstep(0.03, 0.72, continental * 0.5 + 0.5)

    # Preserve large landforms without producing five-to-fifteen metre walls
    # over a single mobile terrain cell.
    return continental * 6.0 + hills * 3.7 + ridge * 9.2 * ridge_gate + detail * 0.42

func height_at(x: float, z: float) -> float:
    var raw: float = _raw_height(x, z)
    var lake: float = _lake_mask_from_raw(x, z, raw)
    var h: float = lerpf(raw, WATER_LEVEL - 0.82, lake * 0.92)

    var center_z: float = _path_center_z(x)
    var distance_to_path: float = absf(z - center_z)
    var path_raw: float = _raw_height(x, center_z)
    var path_lake: float = _lake_mask_from_raw(x, center_z, path_raw)
    var path_h: float = lerpf(path_raw, WATER_LEVEL + 0.2, path_lake * 0.86)

    # The visible dirt trail remains narrow (_path_blend still controls its
    # material and vegetation exclusion). Elevation transitions over a much
    # broader corridor so leaving the trail produces a hillside, not a shelf.
    var corridor: float = 1.0 - smoothstep(5.0, 34.0, distance_to_path)
    h = lerpf(h, path_h, corridor * 0.62)

    var trail: float = _path_blend(x, z)
    if trail > 0.0:
        h = lerpf(h, path_h, trail * 0.48)
        h -= trail * 0.045

    return h
