extends Node3D

const TILE: Material = preload("res://arthur_mobile/materials/pool_tiles.tres")
const PLASTER: Material = preload("res://arthur_mobile/materials/pool_plaster.tres")
const ACCENT: Material = preload("res://arthur_mobile/materials/pool_accent_v09.tres")
const DEEP_TILE: Material = preload("res://arthur_mobile/materials/deep_pool_tile_v09.tres")
const WATER: Material = preload("res://arthur_mobile/materials/water_surface_v09.tres")
const WaterfallSoundScript = preload("res://arthur_mobile/waterfall_sound_v09.gd")

var variant := 0
var seed := 0

func configure(new_seed: int, new_variant: int) -> void:
	seed = new_seed
	variant = new_variant
	_build()

func _build() -> void:
	# Ceiling fragments keep the room architectural while allowing tall/vertical moments.
	if variant != 3 and variant != 5:
		_box(Vector3(0, 4.05, 0), Vector3(22.8, 0.12, 22.8), PLASTER, false)
	match variant:
		0:
			_build_regular()
		1:
			_build_twins()
		2:
			_build_checker()
		3:
			_build_deep_well()
		4:
			_build_canal_waterfall()
		_:
			_build_slide_gallery()
	_add_room_lights()

func _build_regular() -> void:
	_basin_rect(Vector3(0, 0, 0), Vector2(8.0, 12.0), 2.25, false)
	_box(Vector3(-5.4, 0.28, 0), Vector3(1.2, 0.52, 12.5), ACCENT, true)
	_box(Vector3(5.4, 0.28, 0), Vector3(1.2, 0.52, 12.5), ACCENT, true)
	_add_bench(Vector3(8.0, 0, -6.8), PI * 0.5)

func _build_twins() -> void:
	_basin_rect(Vector3(-4.0, 0, -1.5), Vector2(6.5, 11.0), 2.0, false)
	_basin_rect(Vector3(4.2, 0, 2.2), Vector2(6.0, 8.0), 2.75, false)
	_box(Vector3(0.0, 0.22, 0.0), Vector3(1.35, 0.38, 15.0), ACCENT, true)
	_box(Vector3(0.0, 0.68, 5.2), Vector3(5.5, 0.22, 1.25), TILE, true)
	_add_bench(Vector3(-8.0, 0, 7.2), 0.0)

func _build_checker() -> void:
	var pockets := [Vector3(-4.2, 0, -4.2), Vector3(4.2, 0, -4.2), Vector3(-4.2, 0, 4.2), Vector3(4.2, 0, 4.2)]
	for i in range(pockets.size()):
		var depth := 1.45 + float((seed >> (i * 3)) & 3) * 0.42
		_basin_rect(pockets[i], Vector2(4.8, 4.8), depth, false)
	# Deliberately irregular raised checker islands, not a flat swimming-pool grid.
	_box(Vector3(0, 0.42, 0), Vector3(3.4, 0.8, 3.4), ACCENT, true)
	_box(Vector3(-0.2, 0.25, -7.0), Vector3(7.2, 0.45, 1.3), TILE, true)
	_box(Vector3(6.9, 0.34, 0.6), Vector3(1.25, 0.62, 6.5), ACCENT, true)
	_add_steps(Vector3(-8.0, 0, 0), Vector3(1, 0, 0), 4, 0.22)

func _build_deep_well() -> void:
	_basin_rect(Vector3(0, 0, 0), Vector2(8.0, 8.0), 12.4, true)
	# Tall tiled throat, broken at the bottom by openings into the underwater network.
	_box(Vector3(-4.25, -3.0, 0), Vector3(0.45, 6.2, 8.5), DEEP_TILE, true)
	_box(Vector3(4.25, -3.0, 0), Vector3(0.45, 6.2, 8.5), DEEP_TILE, true)
	_box(Vector3(0, -3.0, -4.25), Vector3(8.5, 6.2, 0.45), DEEP_TILE, true)
	_box(Vector3(-2.8, -3.0, 4.25), Vector3(2.9, 6.2, 0.45), DEEP_TILE, true)
	_box(Vector3(2.8, -3.0, 4.25), Vector3(2.9, 6.2, 0.45), DEEP_TILE, true)
	# Upper ledges make the drop feel architectural rather than a hole punched in the floor.
	_box(Vector3(-7.2, 2.9, 0), Vector3(2.2, 0.25, 14.0), ACCENT, true)
	_add_steps(Vector3(-8.2, 0.0, -5.4), Vector3(0, 0, 1), 12, 0.24)

func _build_canal_waterfall() -> void:
	_basin_rect(Vector3(0, 0, 0), Vector2(16.0, 4.2), 2.35, false)
	_box(Vector3(0, 0.32, -4.0), Vector3(18.0, 0.55, 1.0), ACCENT, true)
	_box(Vector3(0, 0.32, 4.0), Vector3(18.0, 0.55, 1.0), ACCENT, true)
	_add_waterfall(Vector3(-8.0, 2.1, 0), Vector2(4.0, 4.1), PI * 0.5)
	_add_waterfall(Vector3(8.0, 1.55, 1.1), Vector2(2.4, 3.0), -PI * 0.5)
	_add_bench(Vector3(0, 0, 8.0), 0.0)

func _build_slide_gallery() -> void:
	_basin_rect(Vector3(2.3, 0, 2.0), Vector2(10.0, 9.0), 2.5, false)
	# Open upper volume with an eccentric raised landing.
	_box(Vector3(-6.5, 4.7, -4.7), Vector3(7.5, 0.3, 5.5), TILE, true)
	_add_steps(Vector3(-9.2, 0.0, -6.4), Vector3(0, 0, 1), 18, 0.26)
	_add_slide(Vector3(-4.5, 4.4, -2.0), Vector3(0.45, 0, 1.0).normalized(), 12)
	_add_waterfall(Vector3(8.0, 2.45, -1.0), Vector2(3.2, 4.8), -PI * 0.5)
	_box(Vector3(6.7, 2.6, -6.4), Vector3(1.1, 5.2, 5.0), ACCENT, true)

func _basin_rect(center: Vector3, size_xz: Vector2, depth: float, deep: bool) -> void:
	_water_plane(Vector3(center.x, 0.055, center.z), size_xz)
	if not deep:
		_box(Vector3(center.x, -depth, center.z), Vector3(size_xz.x, 0.26, size_xz.y), DEEP_TILE, true)
	var wall_y := -minf(depth, 5.8) * 0.5
	var wall_h := minf(depth, 5.8)
	_box(Vector3(center.x - size_xz.x * 0.5, wall_y, center.z), Vector3(0.28, wall_h, size_xz.y), DEEP_TILE, true)
	_box(Vector3(center.x + size_xz.x * 0.5, wall_y, center.z), Vector3(0.28, wall_h, size_xz.y), DEEP_TILE, true)
	_box(Vector3(center.x, wall_y, center.z - size_xz.y * 0.5), Vector3(size_xz.x, wall_h, 0.28), DEEP_TILE, true)
	if not deep:
		_box(Vector3(center.x, wall_y, center.z + size_xz.y * 0.5), Vector3(size_xz.x, wall_h, 0.28), DEEP_TILE, true)

func _water_plane(position: Vector3, size_xz: Vector2) -> void:
	var mesh := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = size_xz
	plane.subdivide_width = 12
	plane.subdivide_depth = 12
	plane.material = WATER
	mesh.mesh = plane
	mesh.position = position
	add_child(mesh)

func _add_waterfall(position: Vector3, size_xy: Vector2, yaw: float) -> void:
	var sheet := MeshInstance3D.new()
	var quad := QuadMesh.new()
	quad.size = size_xy
	quad.material = WATER
	sheet.mesh = quad
	sheet.position = position
	sheet.rotation.y = yaw
	add_child(sheet)
	var sound := AudioStreamPlayer3D.new()
	sound.set_script(WaterfallSoundScript)
	sound.position = position
	add_child(sound)

func _add_slide(start: Vector3, direction: Vector3, segments: int) -> void:
	for i in range(segments):
		var t := float(i) / float(maxi(1, segments - 1))
		var pos := start + direction * float(i) * 0.72
		pos.y = start.y - t * 4.0
		var segment := _box(pos, Vector3(1.55, 0.20, 0.92), ACCENT, true)
		segment.rotation.y = atan2(direction.x, direction.z)
		segment.rotation.x = deg_to_rad(-18.0)

func _add_steps(start: Vector3, direction: Vector3, count: int, rise: float) -> void:
	for i in range(count):
		var pos := start + direction * float(i) * 0.55
		pos.y += float(i) * rise * 0.5
		var step := _box(pos, Vector3(2.0, rise * float(i + 1), 0.62), TILE, true)
		step.rotation.y = atan2(direction.x, direction.z)

func _add_bench(position: Vector3, yaw: float) -> void:
	var seat := _box(position + Vector3(0, 0.48, 0), Vector3(2.8, 0.18, 0.65), ACCENT, true)
	seat.rotation.y = yaw
	var back := _box(position + Vector3(0, 1.0, 0.28), Vector3(2.8, 0.92, 0.15), ACCENT, true)
	back.rotation.y = yaw

func _add_room_lights() -> void:
	for x in [-7.2, 0.0, 7.2]:
		for z in [-7.2, 0.0, 7.2]:
			if (int(absf(x) + absf(z)) + seed) % 3 == 0:
				continue
			var light := OmniLight3D.new()
			light.position = Vector3(x, 3.55 + float((seed + int(x * 7.0 + z * 5.0)) & 1) * 0.55, z)
			light.light_color = Color(0.66, 0.95, 1.0, 1.0).lerp(Color(0.93, 1.0, 0.84, 1.0), float((seed >> 3) & 3) / 4.0)
			light.light_energy = 1.25 + float((seed + int(x * 11.0)) & 3) * 0.28
			light.omni_range = 11.0
			light.shadow_enabled = false
			add_child(light)

func _box(position: Vector3, size: Vector3, material: Material, collision: bool) -> CSGBox3D:
	var box := CSGBox3D.new()
	box.position = position
	box.size = size
	box.material_override = material
	box.use_collision = collision
	box.collision_layer = 3 if collision else 0
	box.collision_mask = 3 if collision else 0
	add_child(box)
	return box
