extends "res://arthur_mobile/pool_complex_v09.gd"

const WaterslideV11Script = preload("res://arthur_mobile/waterslide_v11.gd")
const WATER_LOOP_A: AudioStream = preload("res://arthur_mobile/audio/loop_water_01.ogg")
const WATER_LOOP_B: AudioStream = preload("res://arthur_mobile/audio/loop_water_02.ogg")
const WATER_LOOP_C: AudioStream = preload("res://arthur_mobile/audio/loop_water_03.ogg")

var bright_tile: StandardMaterial3D
var bright_plaster: StandardMaterial3D
var warm_accent: StandardMaterial3D

func _build() -> void:
	_ensure_v11_materials()
	super._build()
	_enable_roof_collisions()
	_add_v11_architecture()

func _ensure_v11_materials() -> void:
	if bright_tile != null:
		return
	bright_tile = StandardMaterial3D.new()
	bright_tile.albedo_color = Color(0.78, 0.94, 0.92, 1.0)
	bright_tile.roughness = 0.34
	bright_tile.metallic = 0.02

	bright_plaster = StandardMaterial3D.new()
	bright_plaster.albedo_color = Color(0.96, 0.94, 0.78, 1.0)
	bright_plaster.roughness = 0.56

	warm_accent = StandardMaterial3D.new()
	warm_accent.albedo_color = Color(0.98, 0.70, 0.42, 1.0)
	warm_accent.roughness = 0.40

func _build_slide_gallery() -> void:
	# v0.11 replaces the old decorative stair-step "slide" with an actual rideable
	# watercourse while keeping the room's raised-gallery idea.
	_basin_rect(Vector3(2.8, 0, 2.2), Vector2(9.2, 8.6), 2.5, false)
	_box(Vector3(-6.6, 3.35, -5.7), Vector3(7.8, 0.28, 5.2), bright_tile, true)
	_add_steps(Vector3(-9.2, 0.0, -7.1), Vector3(0, 0, 1), 14, 0.235)
	_box(Vector3(7.2, 2.4, -5.9), Vector3(0.72, 4.8, 5.6), ACCENT, true)
	_add_waterfall(Vector3(7.45, 2.2, -1.8), Vector2(2.8, 4.2), -PI * 0.5)

func _add_waterfall(position: Vector3, size_xy: Vector2, yaw: float) -> void:
	# All v0.11 waterfalls use recorded internet-sourced CC0 loops. No synthesized
	# noise generator is attached to these rooms.
	var sheet := MeshInstance3D.new()
	var quad := QuadMesh.new()
	quad.size = size_xy
	quad.material = WATER
	sheet.mesh = quad
	sheet.position = position
	sheet.rotation.y = yaw
	add_child(sheet)

	var sound := AudioStreamPlayer3D.new()
	sound.stream = WATER_LOOP_C
	sound.position = position
	sound.autoplay = true
	sound.volume_db = -9.5
	sound.max_distance = 32.0
	sound.unit_size = 6.5
	add_child(sound)

func _add_room_lights() -> void:
	# Pool rooms are allowed to be startlingly bright sometimes. Other seeds keep
	# broad quiet pools of light without the red/orange wash that polluted v0.10.
	var cheerful := posmod(seed, 7) == 0 or variant == 5
	var positions := [
		Vector3(-7.0, 3.58, -7.0), Vector3(0.0, 3.72, -7.0), Vector3(7.0, 3.58, -7.0),
		Vector3(-7.0, 3.72, 0.0), Vector3(0.0, 3.62, 0.0), Vector3(7.0, 3.72, 0.0),
		Vector3(-7.0, 3.58, 7.0), Vector3(0.0, 3.72, 7.0), Vector3(7.0, 3.58, 7.0)
	]
	for i in range(positions.size()):
		if not cheerful and (i + seed) % 2 == 0:
			continue
		var light := OmniLight3D.new()
		light.position = positions[i]
		light.light_color = Color(0.76, 0.96, 1.0, 1.0) if not cheerful else Color(1.0, 0.965, 0.78, 1.0)
		light.light_energy = 1.55 if not cheerful else 2.55
		light.omni_range = 12.5 if not cheerful else 15.0
		light.shadow_enabled = false
		add_child(light)

func _enable_roof_collisions() -> void:
	for child in get_children():
		if child is CSGBox3D:
			var box := child as CSGBox3D
			if box.position.y >= 3.8 and box.size.y <= 0.40:
				box.use_collision = true
				box.collision_layer = 3
				box.collision_mask = 3

func _add_v11_architecture() -> void:
	var motif := posmod(seed, 6)
	match motif:
		0:
			_add_mirrored_colonnade()
		1:
			_add_river_hall(false)
		2:
			_add_repeating_arches()
		3:
			_add_bright_bath()
		4:
			_add_river_hall(true)
		_:
			_add_mirrored_islands()

	if variant == 5 or posmod(seed, 11) == 0:
		_add_rideable_slide(posmod(seed, 3) == 0)

func _add_mirrored_colonnade() -> void:
	for z in [-8.0, -4.0, 0.0, 4.0, 8.0]:
		for x in [-7.2, 7.2]:
			_add_column(Vector3(x, 1.75, z), 3.5, 0.54, bright_tile)
		# Mirrored lintels repeat one architectural fragment down the room.
		_box(Vector3(0, 3.35, z), Vector3(14.8, 0.28, 0.48), bright_tile, false)
	_add_stream_sound(Vector3(0, 0.4, 0), WATER_LOOP_A, -17.0, 25.0)

func _add_repeating_arches() -> void:
	for z in [-8.2, -4.1, 0.0, 4.1, 8.2]:
		_box(Vector3(-3.0, 1.65, z), Vector3(0.42, 3.3, 0.42), bright_plaster, true)
		_box(Vector3(3.0, 1.65, z), Vector3(0.42, 3.3, 0.42), bright_plaster, true)
		_box(Vector3(0, 3.18, z), Vector3(6.4, 0.34, 0.42), bright_plaster, true)
		var mirrored_offset := -1.0 if int((z + 9.0) * 10.0) % 2 == 0 else 1.0
		_box(Vector3(mirrored_offset * 6.0, 0.36, z), Vector3(2.4, 0.42, 1.25), ACCENT, true)

func _add_river_hall(with_cascade: bool) -> void:
	# A shallow river occupies the hallway axis and visually continues through the
	# room edges, so it feels like infrastructure rather than a freestanding pool.
	_water_plane(Vector3(0, 0.07, 0), Vector2(3.25, 22.5))
	_box(Vector3(-1.82, -0.30, 0), Vector3(0.28, 0.72, 22.8), DEEP_TILE, true)
	_box(Vector3(1.82, -0.30, 0), Vector3(0.28, 0.72, 22.8), DEEP_TILE, true)
	_box(Vector3(0, -0.62, 0), Vector3(3.36, 0.20, 22.8), DEEP_TILE, true)
	for z in [-7.5, -2.5, 2.5, 7.5]:
		_box(Vector3(-4.8, 0.26, z), Vector3(4.8, 0.34, 0.75), bright_tile, true)
		_box(Vector3(4.8, 0.26, -z), Vector3(4.8, 0.34, 0.75), bright_tile, true)
	if with_cascade:
		_add_waterfall(Vector3(0, 2.1, -9.8), Vector2(3.0, 4.1), 0.0)
	_add_stream_sound(Vector3(0, 0.0, 0), WATER_LOOP_A, -10.5 if with_cascade else -14.0, 32.0)

func _add_bright_bath() -> void:
	# A deliberately cheerful interruption: warm plaster, pale tile and broad white
	# light. It should feel almost public-pool normal for a minute.
	for x in [-7.0, 0.0, 7.0]:
		for z in [-7.0, 0.0, 7.0]:
			_box(Vector3(x, 0.16, z), Vector3(3.0, 0.22, 3.0), bright_plaster if int(absf(x + z)) % 2 == 0 else bright_tile, true)
	for x in [-8.6, 8.6]:
		for z in [-6.0, 0.0, 6.0]:
			_add_column(Vector3(x, 1.7, z), 3.4, 0.44, warm_accent)
	_add_stream_sound(Vector3(0, 0.0, 2.0), WATER_LOOP_B, -15.0, 28.0)

func _add_mirrored_islands() -> void:
	var positions := [
		Vector3(-6.0, 0.32, -5.5), Vector3(6.0, 0.32, -5.5),
		Vector3(-6.0, 0.32, 5.5), Vector3(6.0, 0.32, 5.5),
		Vector3(0.0, 0.48, 0.0)
	]
	for i in range(positions.size()):
		var size := Vector3(3.6, 0.42, 2.2) if i < 4 else Vector3(4.2, 0.72, 4.2)
		_box(positions[i], size, bright_tile if i % 2 == 0 else ACCENT, true)
	_add_stream_sound(Vector3(0, 0.0, 0), WATER_LOOP_B, -16.0, 24.0)

func _add_rideable_slide(cross_floor: bool) -> void:
	var slide := WaterslideV11Script.new() as Node3D
	add_child(slide)
	slide.call("configure", seed ^ 0x31A7, cross_floor)

func _add_column(position: Vector3, height: float, radius: float, material: Material) -> void:
	var column := CSGCylinder3D.new()
	column.position = position
	column.height = height
	column.radius = radius
	column.sides = 12
	column.material_override = material
	column.use_collision = true
	column.collision_layer = 3
	column.collision_mask = 3
	add_child(column)

func _add_stream_sound(position: Vector3, stream: AudioStream, volume: float, distance: float) -> void:
	var sound := AudioStreamPlayer3D.new()
	sound.stream = stream
	sound.position = position
	sound.autoplay = true
	sound.volume_db = volume
	sound.max_distance = distance
	sound.unit_size = 6.0
	add_child(sound)
