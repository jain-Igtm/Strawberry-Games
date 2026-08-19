extends "res://arthur_mobile/pool_complex_v12.gd"

const WaterslideV13Script = preload("res://arthur_mobile/waterslide_v13.gd")
const WATER_V13: Material = preload("res://arthur_mobile/materials/water_surface_v13.tres")
const WATERFALL_V13: Material = preload("res://arthur_mobile/materials/waterfall_surface_v13.tres")

var deck_tile: StandardMaterial3D
var wall_tile: StandardMaterial3D
var warm_plaster_v13: StandardMaterial3D
var deep_trim: StandardMaterial3D
var metal_trim: StandardMaterial3D
var ceiling_glow: StandardMaterial3D

func _build() -> void:
	_ensure_v13_materials()
	match variant:
		0:
			_build_long_mirror_bath()
		1:
			_build_twin_bath_court()
		2:
			_build_four_baths()
		3:
			_build_deep_well_v13()
		4:
			_build_canal_v13()
		_:
			_build_slide_hall_v13()
	_add_v13_lighting()
	_add_v13_audio()

func _ensure_v13_materials() -> void:
	if deck_tile != null:
		return
	deck_tile = StandardMaterial3D.new()
	deck_tile.albedo_color = Color(0.77, 0.90, 0.88, 1.0)
	deck_tile.roughness = 0.50

	wall_tile = StandardMaterial3D.new()
	wall_tile.albedo_color = Color(0.69, 0.84, 0.83, 1.0)
	wall_tile.roughness = 0.58

	warm_plaster_v13 = StandardMaterial3D.new()
	warm_plaster_v13.albedo_color = Color(0.94, 0.91, 0.78, 1.0)
	warm_plaster_v13.roughness = 0.72

	deep_trim = StandardMaterial3D.new()
	deep_trim.albedo_color = Color(0.075, 0.22, 0.24, 1.0)
	deep_trim.roughness = 0.45

	metal_trim = StandardMaterial3D.new()
	metal_trim.albedo_color = Color(0.70, 0.64, 0.46, 1.0)
	metal_trim.metallic = 0.12
	metal_trim.roughness = 0.46

	ceiling_glow = StandardMaterial3D.new()
	ceiling_glow.albedo_color = Color(0.95, 1.0, 0.93, 1.0)
	ceiling_glow.emission_enabled = true
	ceiling_glow.emission = Color(0.78, 0.98, 0.91, 1.0)
	ceiling_glow.roughness = 0.25

func _build_long_mirror_bath() -> void:
	_add_coping(Vector3.ZERO, Vector2(8.0, 16.0), deck_tile)
	# Repetition is attached to the room shell instead of dangling over the water.
	for z in [-7.2, -3.6, 0.0, 3.6, 7.2]:
		_add_wall_pier(Vector3(-10.55, 1.55, z), true)
		_add_wall_pier(Vector3(10.55, 1.55, z), true)
	# Two broad dry terraces mirror each other without obstructing the basin.
	_solid_box(Vector3(-7.25, 0.14, 0), Vector3(3.6, 0.20, 15.6), warm_plaster_v13, true)
	_solid_box(Vector3(7.25, 0.14, 0), Vector3(3.6, 0.20, 15.6), warm_plaster_v13, true)
	_add_low_bench(Vector3(-8.15, 0.0, -6.2), true)
	_add_low_bench(Vector3(8.15, 0.0, 6.2), true)

func _build_twin_bath_court() -> void:
	_add_coping(Vector3(-4.0, 0, 0), Vector2(8.0, 16.0), deck_tile)
	_add_coping(Vector3(4.0, 0, 0), Vector2(8.0, 8.0), deck_tile)
	# A substantial central promenade separates the two pools cleanly.
	_solid_box(Vector3(0, 0.16, 0), Vector3(1.55, 0.22, 16.6), warm_plaster_v13, true)
	_solid_box(Vector3(5.9, 0.16, 6.4), Vector3(4.2, 0.22, 2.6), warm_plaster_v13, true)
	for z in [-6.4, 0.0, 6.4]:
		_add_wall_pier(Vector3(-10.55, 1.55, z), true)
		_add_wall_pier(Vector3(10.55, 1.55, z), true)

func _build_four_baths() -> void:
	for x in [-6.0, 6.0]:
		for z in [-6.0, 6.0]:
			_add_coping(Vector3(x, 0, z), Vector2(4.0, 4.0), deck_tile)
	# One simple central island gives the four pools a reason to be arranged this way.
	_solid_box(Vector3(0, 0.18, 0), Vector3(5.2, 0.26, 5.2), warm_plaster_v13, true)
	for axis in [-1.0, 1.0]:
		_solid_box(Vector3(axis * 4.15, 0.17, 0), Vector3(2.9, 0.22, 1.10), deck_tile, true)
		_solid_box(Vector3(0, 0.17, axis * 4.15), Vector3(1.10, 0.22, 2.9), deck_tile, true)
	for x in [-10.55, 10.55]:
		for z in [-6.0, 6.0]:
			_add_wall_pier(Vector3(x, 1.55, z), true)

func _build_deep_well_v13() -> void:
	_add_coping(Vector3.ZERO, Vector2(8.0, 8.0), metal_trim)
	# Wide outer deck and repeated wall ribs make the shaft feel intentionally monumental.
	for x in [-10.55, 10.55]:
		for z in [-6.5, 0.0, 6.5]:
			_add_wall_pier(Vector3(x, 1.65, z), true)
	for z in [-10.55, 10.55]:
		for x in [-6.5, 0.0, 6.5]:
			_add_wall_pier(Vector3(x, 1.65, z), false)
	# A single viewing tongue projects toward the water instead of random ledges everywhere.
	_solid_box(Vector3(-6.1, 0.18, 0), Vector3(4.0, 0.24, 2.2), warm_plaster_v13, true)
	_add_guard_pair(Vector3(-4.65, 0.0, 0), Vector3(0, 0, 1), 2.25)

func _build_canal_v13() -> void:
	_add_coping(Vector3.ZERO, Vector2(16.0, 8.0), deck_tile)
	# Dry side walks run continuously along the canal.
	_solid_box(Vector3(0, 0.14, -7.15), Vector3(17.0, 0.20, 4.2), warm_plaster_v13, true)
	_solid_box(Vector3(0, 0.14, 7.15), Vector3(17.0, 0.20, 4.2), warm_plaster_v13, true)
	# Three identical crossings create the repeated/mirrored architecture the room wants.
	for x in [-5.3, 0.0, 5.3]:
		_solid_box(Vector3(x, 0.25, 0), Vector3(1.28, 0.34, 9.1), deck_tile, true)
		_add_bridge_rails(Vector3(x, 0.0, 0), 9.1)
	for x in [-10.55, 10.55]:
		for z in [-6.5, 0.0, 6.5]:
			_add_wall_pier(Vector3(x, 1.55, z), true)
	# The fall is integrated into a tiled end wall and empties directly into the canal.
	_solid_box(Vector3(-10.05, 1.9, 0), Vector3(0.62, 3.8, 8.8), wall_tile, true)
	_add_waterfall_v13(Vector3(-9.70, 2.05, 0), Vector2(6.8, 3.45), PI * 0.5)

func _build_slide_hall_v13() -> void:
	_add_coping(Vector3(2.0, 0, 2.0), Vector2(12.0, 12.0), deck_tile)
	# Keep the hall open. One wall-side stair reaches the slide launch platform.
	var slide_seed: int = seed ^ 0x71C9
	var side_sign: float = -1.0 if (slide_seed & 1) == 0 else 1.0
	_add_slide_access_stair(side_sign)
	for z in [-6.6, 0.0, 6.6]:
		_add_wall_pier(Vector3(-10.55, 1.55, z), true)
		_add_wall_pier(Vector3(10.55, 1.55, z), true)
	_add_rideable_slide_v13(posmod(seed, 4) == 0)

func _add_slide_access_stair(side_sign: float) -> void:
	var step_count := 15
	var rise := 3.20 / float(step_count)
	var run := 0.38
	var x: float = 8.85 * side_sign
	var start_z := -1.95
	for i in range(step_count):
		var height: float = rise * float(i + 1)
		var z: float = start_z - float(i) * run
		_solid_box(Vector3(x, height * 0.5, z), Vector3(1.75, height, run + 0.02), deck_tile, true)
	_solid_box(Vector3(x, 3.16, -7.55), Vector3(3.1, 0.22, 2.45), warm_plaster_v13, true)

func _add_coping(center: Vector3, size_xz: Vector2, material: Material) -> void:
	var thickness := 0.30
	var y := 0.105
	_solid_box(Vector3(center.x - size_xz.x * 0.5 - thickness * 0.5, y, center.z), Vector3(thickness, 0.16, size_xz.y + thickness * 2.0), material, true)
	_solid_box(Vector3(center.x + size_xz.x * 0.5 + thickness * 0.5, y, center.z), Vector3(thickness, 0.16, size_xz.y + thickness * 2.0), material, true)
	_solid_box(Vector3(center.x, y, center.z - size_xz.y * 0.5 - thickness * 0.5), Vector3(size_xz.x, 0.16, thickness), material, true)
	_solid_box(Vector3(center.x, y, center.z + size_xz.y * 0.5 + thickness * 0.5), Vector3(size_xz.x, 0.16, thickness), material, true)

func _add_wall_pier(position: Vector3, on_x_wall: bool) -> void:
	var size := Vector3(0.38, 3.10, 1.30) if on_x_wall else Vector3(1.30, 3.10, 0.38)
	_solid_box(position, size, wall_tile, true)
	var cap_size := Vector3(0.56, 0.16, 1.48) if on_x_wall else Vector3(1.48, 0.16, 0.56)
	_mesh_box(position + Vector3.UP * 1.58, cap_size, metal_trim)

func _add_low_bench(position: Vector3, along_z: bool) -> void:
	var size := Vector3(1.1, 0.34, 3.2) if along_z else Vector3(3.2, 0.34, 1.1)
	_solid_box(position + Vector3.UP * 0.17, size, metal_trim, true)

func _add_guard_pair(center: Vector3, along: Vector3, length: float) -> void:
	var side: Vector3 = Vector3(-along.z, 0.0, along.x)
	for sign_value in [-1.0, 1.0]:
		var lateral: Vector3 = side * (1.02 * float(sign_value))
		_add_beam_v13(center - along * length * 0.5 + lateral + Vector3.UP * 0.88, center + along * length * 0.5 + lateral + Vector3.UP * 0.88, 0.065, metal_trim)
		_add_post_v13(center - along * length * 0.5 + lateral, 0.88)
		_add_post_v13(center + along * length * 0.5 + lateral, 0.88)

func _add_bridge_rails(center: Vector3, length: float) -> void:
	for x_offset in [-0.52, 0.52]:
		var a := center + Vector3(x_offset, 0.92, -length * 0.5)
		var b := center + Vector3(x_offset, 0.92, length * 0.5)
		_add_beam_v13(a, b, 0.06, metal_trim)
		for z in [-length * 0.5, 0.0, length * 0.5]:
			_add_post_v13(center + Vector3(x_offset, 0.0, z), 0.92)

func _add_v13_lighting() -> void:
	var cheerful: bool = variant == 2 or variant == 4 or posmod(seed, 9) == 0
	var positions: Array[Vector3]
	if cheerful:
		positions = [Vector3(-6.5, 3.72, -6.5), Vector3(6.5, 3.72, -6.5), Vector3(-6.5, 3.72, 6.5), Vector3(6.5, 3.72, 6.5)]
	else:
		positions = [Vector3(-5.8, 3.68, -5.8), Vector3(5.8, 3.68, 5.8)]
	for position in positions:
		_mesh_box(position + Vector3.UP * 0.22, Vector3(3.2, 0.055, 0.72), ceiling_glow)
		var light := OmniLight3D.new()
		light.position = position
		light.light_color = Color(0.78, 0.94, 0.93, 1.0) if not cheerful else Color(1.0, 0.95, 0.78, 1.0)
		light.light_energy = 0.88 if not cheerful else 1.42
		light.omni_range = 10.0 if not cheerful else 12.5
		light.shadow_enabled = false
		add_child(light)

func _add_v13_audio() -> void:
	match variant:
		0:
			_add_looped_sound(Vector3(0, 0.05, 0), WATER_LOOP_A, -23.0, 17.0, 3.2)
		1:
			_add_looped_sound(Vector3(-4.0, 0.05, 0), WATER_LOOP_A, -23.0, 15.0, 3.0)
			_add_looped_sound(Vector3(4.0, 0.05, 1.0), WATER_LOOP_B, -24.0, 13.0, 2.8)
		2:
			_add_looped_sound(Vector3(0, 0.05, 0), WATER_LOOP_A, -24.0, 18.0, 3.2)
		3:
			_add_looped_sound(Vector3(0, -4.5, 0), WATER_LOOP_B, -18.0, 22.0, 4.4)
		4:
			_add_looped_sound(Vector3(-2.0, 0.05, 0), WATER_LOOP_A, -16.0, 23.0, 4.0)
		_:
			_add_looped_sound(Vector3(2.0, 0.05, 2.0), WATER_LOOP_A, -22.0, 18.0, 3.2)

func _add_waterfall_v13(position: Vector3, size_xy: Vector2, yaw: float) -> void:
	var sheet := MeshInstance3D.new()
	var quad := QuadMesh.new()
	quad.size = size_xy
	quad.material = WATERFALL_V13
	sheet.mesh = quad
	sheet.position = position
	sheet.rotation.y = yaw
	add_child(sheet)
	_add_looped_sound(position + Vector3(0, -0.75, 0), WATER_LOOP_C, -8.0, 28.0, 5.5)

func _add_rideable_slide_v13(cross_floor: bool) -> void:
	var slide := WaterslideV13Script.new() as Node3D
	add_child(slide)
	slide.call("configure", seed ^ 0x71C9, cross_floor)

func _solid_box(position: Vector3, size: Vector3, material: Material, collision: bool) -> MeshInstance3D:
	var instance := _mesh_box(position, size, material)
	if collision:
		var body := StaticBody3D.new()
		body.position = position
		body.collision_layer = 3
		body.collision_mask = 3
		var shape_node := CollisionShape3D.new()
		var shape := BoxShape3D.new()
		shape.size = size
		shape_node.shape = shape
		body.add_child(shape_node)
		add_child(body)
	return instance

func _mesh_box(position: Vector3, size: Vector3, material: Material) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = material
	instance.mesh = mesh
	instance.position = position
	add_child(instance)
	return instance

func _add_beam_v13(a: Vector3, b: Vector3, thickness: float, material: Material) -> void:
	var delta := b - a
	if delta.length() <= 0.01:
		return
	var pivot := Node3D.new()
	pivot.position = (a + b) * 0.5
	add_child(pivot)
	pivot.look_at(pivot.global_position + delta.normalized(), Vector3.UP)
	var beam := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(thickness, thickness, delta.length())
	mesh.material = material
	beam.mesh = mesh
	pivot.add_child(beam)

func _add_post_v13(base: Vector3, height: float) -> void:
	_mesh_box(base + Vector3.UP * (height * 0.5), Vector3(0.065, height, 0.065), metal_trim)
