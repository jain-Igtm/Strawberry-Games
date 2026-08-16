extends "res://arthur_mobile/pool_complex_v11.gd"

const WaterslideV12Script = preload("res://arthur_mobile/waterslide_v12.gd")

var glow_panel: StandardMaterial3D

func _build() -> void:
	# v0.12 deliberately does NOT call the v0.9/v0.11 build chain. The old chain
	# placed extra water slabs and props on top of the cell-level pool surfaces.
	# This layer only builds architecture around the water footprint supplied by
	# world_v12, so basin, deck and room geometry share one plan.
	_ensure_v11_materials()
	_ensure_v12_materials()

	match variant:
		0:
			_build_mirrored_gallery()
		1:
			_build_twin_court()
		2:
			_build_quadrant_baths()
		3:
			_build_deep_well_room()
		4:
			_build_canal_gallery()
		_:
			_build_slide_hall()

	_add_v12_lighting()
	_add_v12_room_audio()

func _ensure_v12_materials() -> void:
	if glow_panel != null:
		return
	glow_panel = StandardMaterial3D.new()
	glow_panel.albedo_color = Color(0.92, 1.0, 0.96, 1.0)
	glow_panel.roughness = 0.25
	glow_panel.emission_enabled = true
	glow_panel.emission = Color(0.72, 0.94, 0.90, 1.0)

func _build_mirrored_gallery() -> void:
	# 8 x 16 m central basin. Everything repeats symmetrically along the pool.
	_add_coping_ring(Vector3.ZERO, Vector2(8.0, 16.0), bright_tile)
	for z in [-7.1, -3.55, 0.0, 3.55, 7.1]:
		_add_column(Vector3(-6.15, 1.62, z), 3.24, 0.42, bright_tile)
		_add_column(Vector3(6.15, 1.62, z), 3.24, 0.42, bright_tile)
		_box(Vector3(0, 3.12, z), Vector3(12.7, 0.22, 0.28), bright_plaster, false)
	for z in [-5.35, 5.35]:
		_box(Vector3(-8.4, 0.30, z), Vector3(2.2, 0.46, 2.6), warm_accent, true)
		_box(Vector3(8.4, 0.30, z), Vector3(2.2, 0.46, 2.6), warm_accent, true)

func _build_twin_court() -> void:
	# Two basins share a long central seam. The seam becomes a real walkable
	# bridge rather than two overlapping water rectangles.
	_add_coping_ring(Vector3(-4.0, 0, 0), Vector2(8.0, 16.0), bright_tile)
	_add_coping_ring(Vector3(4.0, 0, 0), Vector2(8.0, 8.0), bright_tile)
	_box(Vector3(0, 0.17, 0), Vector3(1.05, 0.22, 16.4), ACCENT, true)
	for z in [-6.8, -2.3, 2.3, 6.8]:
		_add_arch_across_x(z, 5.9)
	_box(Vector3(6.3, 0.24, 6.6), Vector3(3.0, 0.36, 2.2), warm_accent, true)

func _build_quadrant_baths() -> void:
	# Four repeated plunge pools around a central dry pavilion.
	for x in [-6.0, 6.0]:
		for z in [-6.0, 6.0]:
			_add_coping_ring(Vector3(x, 0, z), Vector2(4.0, 4.0), bright_tile)
	_box(Vector3(0, 0.22, 0), Vector3(4.8, 0.32, 4.8), bright_plaster, true)
	for x in [-2.25, 2.25]:
		for z in [-2.25, 2.25]:
			_add_column(Vector3(x, 1.65, z), 3.3, 0.34, warm_accent)
	_box(Vector3(0, 3.18, 0), Vector3(5.2, 0.20, 5.2), bright_plaster, false)

func _build_deep_well_room() -> void:
	# The cell system supplies the genuinely deep shaft. Here we make its mouth
	# look intentional: heavy coping, repeated piers and underwater ledges.
	_add_coping_ring(Vector3.ZERO, Vector2(8.0, 8.0), ACCENT)
	for x in [-5.0, 5.0]:
		for z in [-5.0, 5.0]:
			_add_column(Vector3(x, 2.0, z), 4.0, 0.52, DEEP_TILE)
	for side in [-1.0, 1.0]:
		_box(Vector3(side * 5.0, -2.15, 0), Vector3(1.35, 0.24, 7.2), bright_tile, true)
		_box(Vector3(0, -4.9, side * 5.0), Vector3(7.2, 0.24, 1.25), DEEP_TILE, true)
	_box(Vector3(-7.3, 0.28, 0), Vector3(2.2, 0.40, 8.8), warm_accent, true)

func _build_canal_gallery() -> void:
	# 16 x 8 m river crossing the whole chamber. Repeated frames make one piece
	# of architecture appear copied down the channel.
	_add_coping_ring(Vector3.ZERO, Vector2(16.0, 8.0), bright_tile)
	_box(Vector3(0, 0.20, 0), Vector3(1.25, 0.26, 10.4), bright_plaster, true)
	for x in [-6.2, -2.1, 2.1, 6.2]:
		_add_arch_across_z(x, 5.9)
	# Water enters from a tiled spill wall instead of a free-floating quad.
	_box(Vector3(-8.55, 1.95, 0), Vector3(0.50, 3.9, 8.5), DEEP_TILE, true)
	_box(Vector3(-8.05, 3.70, 0), Vector3(1.15, 0.30, 8.5), ACCENT, true)
	_add_waterfall(Vector3(-7.78, 2.05, 0), Vector2(7.3, 3.45), PI * 0.5)

func _build_slide_hall() -> void:
	# The 12 x 12 landing pool is offset +2/+2 to match world_v12's exact water
	# cells. A broad launch deck and a proper ramp make the slide read as part of
	# the room rather than a toy dropped onto the floor.
	_add_coping_ring(Vector3(2.0, 0, 2.0), Vector2(12.0, 12.0), bright_tile)
	_box(Vector3(0, 3.05, -8.25), Vector3(17.5, 0.26, 3.2), bright_plaster, true)
	var ramp := _box(Vector3(-7.0, 1.50, -5.45), Vector3(2.25, 0.24, 7.0), bright_tile, true)
	ramp.rotation.x = deg_to_rad(-25.0)
	for x in [-8.35, 8.35]:
		_add_column(Vector3(x, 1.60, -8.3), 3.2, 0.42, warm_accent)
		_add_column(Vector3(x, 1.60, 7.8), 3.2, 0.42, bright_tile)
	_add_rideable_slide(posmod(seed, 4) == 0)

func _add_coping_ring(center: Vector3, size_xz: Vector2, material: Material) -> void:
	var t := 0.38
	var y := 0.115
	_decor_box(Vector3(center.x - size_xz.x * 0.5 - t * 0.5, y, center.z), Vector3(t, 0.16, size_xz.y + t * 2.0), material)
	_decor_box(Vector3(center.x + size_xz.x * 0.5 + t * 0.5, y, center.z), Vector3(t, 0.16, size_xz.y + t * 2.0), material)
	_decor_box(Vector3(center.x, y, center.z - size_xz.y * 0.5 - t * 0.5), Vector3(size_xz.x, 0.16, t), material)
	_decor_box(Vector3(center.x, y, center.z + size_xz.y * 0.5 + t * 0.5), Vector3(size_xz.x, 0.16, t), material)

func _add_arch_across_x(z: float, half_span: float) -> void:
	_add_column(Vector3(-half_span, 1.55, z), 3.1, 0.32, bright_tile)
	_add_column(Vector3(half_span, 1.55, z), 3.1, 0.32, bright_tile)
	_box(Vector3(0, 3.02, z), Vector3(half_span * 2.0 + 0.6, 0.22, 0.32), bright_plaster, false)

func _add_arch_across_z(x: float, half_span: float) -> void:
	_add_column(Vector3(x, 1.55, -half_span), 3.1, 0.32, bright_tile)
	_add_column(Vector3(x, 1.55, half_span), 3.1, 0.32, bright_tile)
	_box(Vector3(x, 3.02, 0), Vector3(0.32, 0.22, half_span * 2.0 + 0.6), bright_plaster, false)

func _decor_box(position: Vector3, size: Vector3, material: Material) -> MeshInstance3D:
	# Non-interactive trim uses ordinary meshes instead of CSG. This keeps the
	# repeated architecture cheap enough for a phone.
	var mesh_instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = material
	mesh_instance.mesh = mesh
	mesh_instance.position = position
	add_child(mesh_instance)
	return mesh_instance

func _add_v12_lighting() -> void:
	var cheerful := variant == 2 or variant == 4 or posmod(seed, 7) == 0
	var light_positions := [
		Vector3(-7.0, 3.45, -7.0), Vector3(7.0, 3.45, -7.0),
		Vector3(-7.0, 3.45, 7.0), Vector3(7.0, 3.45, 7.0)
	]
	for p in light_positions:
		_decor_box(p + Vector3(0, 0.28, 0), Vector3(2.8, 0.08, 0.62), glow_panel)
		var light := OmniLight3D.new()
		light.position = p
		light.light_color = Color(0.78, 0.96, 1.0, 1.0) if not cheerful else Color(1.0, 0.97, 0.80, 1.0)
		light.light_energy = 1.15 if not cheerful else 2.05
		light.omni_range = 10.5 if not cheerful else 13.5
		light.shadow_enabled = false
		add_child(light)

func _add_v12_room_audio() -> void:
	match variant:
		0:
			_add_looped_sound(Vector3(0, 0.1, -4.8), WATER_LOOP_A, -21.0, 18.0, 4.0)
			_add_looped_sound(Vector3(0, 0.1, 4.8), WATER_LOOP_A, -21.0, 18.0, 4.0)
		1:
			_add_looped_sound(Vector3(-4.0, 0.1, 0), WATER_LOOP_B, -20.0, 19.0, 4.5)
			_add_looped_sound(Vector3(4.0, 0.1, 0), WATER_LOOP_A, -22.0, 15.0, 3.8)
		2:
			for x in [-6.0, 6.0]:
				for z in [-6.0, 6.0]:
					_add_looped_sound(Vector3(x, 0.1, z), WATER_LOOP_A, -24.0, 12.0, 3.0)
		3:
			_add_looped_sound(Vector3(0, -5.8, 0), WATER_LOOP_B, -15.5, 24.0, 5.5)
			_add_looped_sound(Vector3(0, 0.1, 0), WATER_LOOP_A, -22.0, 17.0, 3.5)
		4:
			for x in [-5.5, 0.0, 5.5]:
				_add_looped_sound(Vector3(x, 0.1, 0), WATER_LOOP_A, -15.5, 17.0, 4.0)
		_:
			_add_looped_sound(Vector3(2.0, 0.1, 2.0), WATER_LOOP_B, -18.0, 22.0, 4.5)

func _add_waterfall(position: Vector3, size_xy: Vector2, yaw: float) -> void:
	var sheet := MeshInstance3D.new()
	var quad := QuadMesh.new()
	quad.size = size_xy
	quad.material = WATER
	sheet.mesh = quad
	sheet.position = position
	sheet.rotation.y = yaw
	add_child(sheet)
	_add_looped_sound(position + Vector3(0, -0.8, 0), WATER_LOOP_C, -7.5, 30.0, 6.0)

func _add_stream_sound(position: Vector3, stream: AudioStream, volume: float, distance: float) -> void:
	_add_looped_sound(position, stream, volume, distance, 5.0)

func _add_looped_sound(position: Vector3, source: AudioStream, volume: float, distance: float, unit: float) -> void:
	var stream := source.duplicate() as AudioStream
	if stream is AudioStreamOggVorbis:
		(stream as AudioStreamOggVorbis).loop = true
	var sound := AudioStreamPlayer3D.new()
	sound.stream = stream
	sound.position = position
	sound.autoplay = true
	sound.volume_db = volume
	sound.max_distance = distance
	sound.unit_size = unit
	add_child(sound)

func _add_rideable_slide(cross_floor: bool) -> void:
	var slide := WaterslideV12Script.new() as Node3D
	add_child(slide)
	slide.call("configure", seed ^ 0x71C9, cross_floor)
