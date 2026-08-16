extends "res://arthur_mobile/world_v10.gd"

const PoolComplexV12Script = preload("res://arthur_mobile/pool_complex_v12.gd")
const POOL_BUILD_BUDGET := 8

func _ready() -> void:
	super._ready()
	# The global yellow ceiling was previously visual-only. Pool/service cells have
	# their own ceilings, but ordinary yellow rooms must stop levitation too.
	ceiling_mesh.use_collision = true
	ceiling_mesh.collision_layer = 3
	ceiling_mesh.collision_mask = 3
	if DisplayServer.get_name().to_lower() == "headless":
		_headless_pool_smoke()

func _build_some_tiles() -> void:
	# Keep the full v0.10.1 streaming radius, but amortize expensive CSG creation
	# over more frames to reduce one-second mobile stalls.
	var count: int = mini(POOL_BUILD_BUDGET, build_queue.size())
	for _i in range(count):
		var cell: Vector2i = build_queue.pop_front()
		if active_tiles.has(cell):
			continue
		_add_cell(cell)

func _topology_edge(a: Vector2i, b: Vector2i) -> int:
	var biome_a: int = int(_biome_sample_for_cell(a)["primary"])
	var biome_b: int = int(_biome_sample_for_cell(b)["primary"])
	if biome_a != BIOME_POOL or biome_b != BIOME_POOL:
		return super._topology_edge(a, b)

	var room_a: Vector2i = _room_for_cell(a)
	var room_b: Vector2i = _room_for_cell(b)
	if room_a == room_b:
		# A pool macro-room is one architectural chamber. Do not drag the yellow
		# maze's random internal partitions through its basins.
		return EDGE_OPEN

	# Neighboring 24 m pool chambers meet at centered, deterministic broad openings.
	# This retains room boundaries without slicing water with arbitrary corridor walls.
	var boundary_seed: int = _hash(mini(room_a.x, room_b.x), mini(room_a.y, room_b.y), 8127)
	var half_width := 2 if posmod(boundary_seed, 4) == 0 else 1
	var along_index: int
	if room_a.x != room_b.x:
		along_index = _positive_mod(a.y, ROOM_SIZE)
	else:
		along_index = _positive_mod(a.x, ROOM_SIZE)
	var center_left := 2
	var center_right := 3
	if half_width == 2:
		return EDGE_OPEN if along_index >= 1 and along_index <= 4 else EDGE_SOLID
	return EDGE_OPEN if along_index == center_left or along_index == center_right else EDGE_SOLID

func _add_pool_content(root: Node3D, cell: Vector2i, sample: Dictionary) -> void:
	var local_x: int = _positive_mod(cell.x, ROOM_SIZE)
	var local_z: int = _positive_mod(cell.y, ROOM_SIZE)
	if local_x != 0 or local_z != 0:
		return
	var room: Vector2i = _room_for_cell(cell)
	var feature: Node3D = PoolComplexV12Script.new() as Node3D
	feature.position = _macro_room_center()
	root.add_child(feature)
	feature.call("configure", _hash(room.x, room.y, 6501), _pool_variant(room))
	_add_large_transition_detail(root, sample, _macro_room_center())

func _add_pool_surface_cell(root: Node3D, cell: Vector2i) -> void:
	var room: Vector2i = _room_for_cell(cell)
	var open_water: bool = _pool_surface_is_water(cell, room)
	if open_water:
		_add_cell_water_surface(root)
	else:
		var accent: bool = _hash(cell.x, cell.y, 6511) % 11 == 0
		_box_on(root, Vector3(0, -0.11, 0), Vector3(CELL, 0.22, CELL), POOL_ACCENT_V09 if accent else POOL_TILE, true)

	var variant: int = _pool_variant(room)
	var vertical_opening: bool = (variant == 3 or variant == 5) and open_water
	if not vertical_opening:
		var roof := _box_on(root, Vector3(0, 4.06, 0), Vector3(CELL, 0.12, CELL), POOL_TILE, true)
		roof.collision_layer = 3
		roof.collision_mask = 3

func _add_service_surface_cell(root: Node3D, cell: Vector2i) -> void:
	var room: Vector2i = _room_for_cell(cell)
	var local_x: int = _positive_mod(cell.x, ROOM_SIZE)
	var local_z: int = _positive_mod(cell.y, ROOM_SIZE)
	var shaft_hole: bool = _is_service_shaft_room(room) and local_x >= 2 and local_x <= 3 and local_z >= 2 and local_z <= 3
	if not shaft_hole:
		_box_on(root, Vector3(0, -0.11, 0), Vector3(CELL, 0.22, CELL), SERVICE_CONCRETE, true)
		var roof := _box_on(root, Vector3(0, 4.06, 0), Vector3(CELL, 0.12, CELL), SERVICE_CONCRETE, true)
		roof.collision_layer = 3
		roof.collision_mask = 3

func _add_light_for_cell(root: Node3D, cell: Vector2i, sample: Dictionary) -> void:
	if int(sample["primary"]) == BIOME_POOL:
		# v0.12 pool complexes own their lighting as a room-level composition. The
		# old per-cell fixture spray was both expensive and visually incoherent.
		return
	super._add_light_for_cell(root, cell, sample)

func _location_descriptor(cell: Vector2i, sample: Dictionary) -> String:
	if int(sample["primary"]) != BIOME_POOL:
		return super._location_descriptor(cell, sample)
	var room: Vector2i = _room_for_cell(cell)
	match _pool_variant(room):
		0:
			return "MIRRORED BATH"
		1:
			return "TWIN COURT"
		2:
			return "QUADRANT BATHS"
		3:
			return "DEEP WELL"
		4:
			return "CANAL GALLERY"
		_:
			return "SLIDE HALL"

func _build_stair_run(root: Node3D, direction_2d: Vector2i) -> void:
	var direction := Vector3(float(direction_2d.x), 0.0, float(direction_2d.y))
	var side := Vector3(-direction.z, 0.0, direction.x)
	var start_offset: Vector3 = -direction * 0.55
	var rise: float = STOREY_HEIGHT / float(STAIR_STEPS)

	# Invisible solid stair collision keeps the proven traversal behavior. The
	# visible geometry is a set of thin treads, so the staircase no longer reads
	# as twenty increasingly tall concrete blocks.
	for i in range(STAIR_STEPS):
		var height: float = rise * float(i + 1)
		var along: Vector3 = start_offset + direction * (float(i) * STAIR_RUN)

		var collision_step := CSGBox3D.new()
		collision_step.position = along + Vector3(0, height * 0.5, 0)
		collision_step.size = Vector3(STAIR_WIDTH, height, STAIR_RUN + 0.05)
		if direction_2d.x != 0:
			collision_step.rotation.y = PI * 0.5
		collision_step.visible = false
		collision_step.use_collision = true
		collision_step.collision_layer = 3
		collision_step.collision_mask = 3
		root.add_child(collision_step)

		var tread := MeshInstance3D.new()
		var tread_mesh := BoxMesh.new()
		tread_mesh.size = Vector3(STAIR_WIDTH, 0.09, STAIR_RUN + 0.06)
		tread_mesh.material = YELLOW_FLOOR
		tread.mesh = tread_mesh
		tread.position = along + Vector3(0, height + 0.015, 0)
		if direction_2d.x != 0:
			tread.rotation.y = PI * 0.5
		root.add_child(tread)

	var total_run: float = float(STAIR_STEPS - 1) * STAIR_RUN
	var landing_position: Vector3 = start_offset + direction * (total_run + 0.72)
	landing_position.y = STOREY_HEIGHT - 0.08
	var landing := CSGBox3D.new()
	landing.position = landing_position
	landing.size = Vector3(2.55, 0.18, 1.75)
	if direction_2d.x != 0:
		landing.rotation.y = PI * 0.5
	landing.material_override = YELLOW_FLOOR
	landing.use_collision = true
	landing.collision_layer = 3
	landing.collision_mask = 3
	root.add_child(landing)

	# Actual handrails follow the stair slope, with spaced balusters instead of
	# the old full-height side slabs.
	var rail_start := start_offset + direction * 0.05 + Vector3.UP * 0.90
	var rail_end := start_offset + direction * (total_run + 0.25) + Vector3.UP * (STOREY_HEIGHT + 0.90)
	for sign_value in [-1.0, 1.0]:
		var lateral := side * (STAIR_WIDTH * 0.56 * sign_value)
		_add_sloped_rail(root, rail_start + lateral, rail_end + lateral)
		for post_i in range(6):
			var t := float(post_i) / 5.0
			var base := start_offset + direction * lerpf(0.10, total_run + 0.20, t)
			base.y = lerpf(rise, STOREY_HEIGHT, t)
			_add_stair_post(root, base + lateral, 0.88)

func _add_sloped_rail(root: Node3D, a: Vector3, b: Vector3) -> void:
	var delta := b - a
	var pivot := Node3D.new()
	pivot.position = (a + b) * 0.5
	root.add_child(pivot)
	pivot.look_at(pivot.global_position + delta.normalized(), Vector3.UP)
	var rail := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.11, 0.11, delta.length())
	mesh.material = YELLOW_WALL
	rail.mesh = mesh
	pivot.add_child(rail)

func _add_stair_post(root: Node3D, base: Vector3, height: float) -> void:
	var post := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.10, height, 0.10)
	mesh.material = YELLOW_WALL
	post.mesh = mesh
	post.position = base + Vector3.UP * (height * 0.5)
	root.add_child(post)

func _make_cut(direction: Vector2i, height: float) -> CSGBox3D:
	var cut := CSGBox3D.new()
	cut.operation = CSGShape3D.OPERATION_SUBTRACTION
	var cut_width := 2.42
	var cut_length := 3.86
	if direction.x != 0:
		cut.size = Vector3(cut_length, height, cut_width)
	else:
		cut.size = Vector3(cut_width, height, cut_length)
	cut.use_collision = false
	return cut

func waterslide_arrive(floor_delta: int) -> void:
	if floor_delta == 0:
		return
	_switch_storey(current_level + floor_delta)
	var pos := player.global_position
	pos.y = float(current_level) * STOREY_HEIGHT + 0.85
	player.global_position = pos

func _headless_pool_smoke() -> void:
	# The normal spawn is yellow. Explicitly building every pool variant here means
	# CI now executes the architecture and audio code that previously escaped tests.
	for variant in range(6):
		var probe: Node3D = PoolComplexV12Script.new() as Node3D
		probe.position = Vector3(float(variant) * 40.0, 40.0, 0.0)
		tiles.add_child(probe)
		probe.call("configure", 0x7120 + variant * 97, variant)
		probe.queue_free()
