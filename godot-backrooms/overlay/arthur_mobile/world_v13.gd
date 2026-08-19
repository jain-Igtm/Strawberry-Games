extends "res://arthur_mobile/world_v12.gd"

const PoolComplexV13Script = preload("res://arthur_mobile/pool_complex_v13.gd")
const WATER_SURFACE_V13: Material = preload("res://arthur_mobile/materials/water_surface_v13.tres")

const STAIR_V13_SEARCH_RADIUS_BLOCKS := 3
const STAIR_V13_MIN_SEPARATION_CELLS := 4
const STAIR_V13_CUT_WIDTH := 2.55
const STAIR_V13_CUT_LENGTH := 4.75

var stair_tread_material: StandardMaterial3D
var stair_riser_material: StandardMaterial3D
var stair_rail_material: StandardMaterial3D
var stair_lamp_material: StandardMaterial3D

func _add_pool_content(root: Node3D, cell: Vector2i, sample: Dictionary) -> void:
	var local_x: int = _positive_mod(cell.x, ROOM_SIZE)
	var local_z: int = _positive_mod(cell.y, ROOM_SIZE)
	if local_x != 0 or local_z != 0:
		return
	var room: Vector2i = _room_for_cell(cell)
	var feature: Node3D = PoolComplexV13Script.new() as Node3D
	feature.position = _macro_room_center()
	root.add_child(feature)
	feature.call("configure", _hash(room.x, room.y, 6501), _pool_variant(room))
	_add_large_transition_detail(root, sample, _macro_room_center())

func _add_cell_water_surface(root: Node3D) -> void:
	var mesh: MeshInstance3D = MeshInstance3D.new()
	var plane: PlaneMesh = PlaneMesh.new()
	plane.size = Vector2(CELL, CELL)
	plane.subdivide_width = 8
	plane.subdivide_depth = 8
	plane.material = WATER_SURFACE_V13
	mesh.mesh = plane
	mesh.position.y = 0.055
	root.add_child(mesh)

func _biome_ambient_energy(biome: int) -> float:
	if biome == BIOME_POOL:
		return 0.74
	return super._biome_ambient_energy(biome)

func _biome_light_energy(biome: int) -> float:
	if biome == BIOME_POOL:
		return 1.28
	return super._biome_light_energy(biome)

func _biome_exposure(biome: int) -> float:
	if biome == BIOME_POOL:
		return 1.14
	return super._biome_exposure(biome)

func _rebuild_connectors(force: bool) -> void:
	if connector_root == null:
		return

	var world_cell: Vector2i = Vector2i(
		floori(player.global_position.x / CELL),
		floori(player.global_position.z / CELL)
	)
	var next_block: Vector2i = _block_for_world_cell(world_cell)
	if not force and next_block == connector_block and current_level == connector_level:
		return

	connector_block = next_block
	connector_level = current_level
	_clear_connectors()

	var up: Dictionary = _nearest_stair(current_level, world_cell)
	var down: Dictionary = _nearest_stair(current_level - 1, world_cell)

	if bool(up.get("valid", false)) and bool(down.get("valid", false)):
		var up_start: Vector2i = up.get("start", Vector2i.ZERO) as Vector2i
		var down_start: Vector2i = down.get("start", Vector2i.ZERO) as Vector2i
		if _stair_starts_too_close(up_start, down_start):
			var alternate_down: Dictionary = _nearest_stair_avoiding(current_level - 1, world_cell, up_start)
			if bool(alternate_down.get("valid", false)):
				down = alternate_down
			else:
				var up_distance: float = Vector2(up_start - world_cell).length_squared()
				var down_distance: float = Vector2(down_start - world_cell).length_squared()
				if down_distance < up_distance:
					up = {"valid": false}
				else:
					down = {"valid": false}

	if bool(up.get("valid", false)):
		_spawn_stair(up, false)
	if bool(down.get("valid", false)):
		_spawn_stair(down, true)

	_position_cutouts()

func _nearest_stair_avoiding(lower_level: int, world_cell: Vector2i, avoid_start: Vector2i) -> Dictionary:
	var center_block: Vector2i = _block_for_world_cell(world_cell)
	var best: Dictionary = {"valid": false}
	var best_distance: float = INF

	for bz in range(center_block.y - STAIR_V13_SEARCH_RADIUS_BLOCKS, center_block.y + STAIR_V13_SEARCH_RADIUS_BLOCKS + 1):
		for bx in range(center_block.x - STAIR_V13_SEARCH_RADIUS_BLOCKS, center_block.x + STAIR_V13_SEARCH_RADIUS_BLOCKS + 1):
			var candidate: Dictionary = _stair_descriptor(Vector2i(bx, bz), lower_level)
			if not bool(candidate.get("valid", false)):
				continue
			var start: Vector2i = candidate.get("start", Vector2i.ZERO) as Vector2i
			if _stair_starts_too_close(start, avoid_start):
				continue
			var dx: float = float(start.x - world_cell.x)
			var dz: float = float(start.y - world_cell.y)
			var distance_sq: float = dx * dx + dz * dz
			if distance_sq < best_distance:
				best_distance = distance_sq
				best = candidate
	return best

func _stair_starts_too_close(a: Vector2i, b: Vector2i) -> bool:
	var dx: int = a.x - b.x
	var dz: int = a.y - b.y
	var minimum: int = STAIR_V13_MIN_SEPARATION_CELLS
	return dx * dx + dz * dz < minimum * minimum

func _build_stair_run(root: Node3D, direction_2d: Vector2i) -> void:
	_ensure_stair_materials()
	var direction: Vector3 = Vector3(float(direction_2d.x), 0.0, float(direction_2d.y))
	var side: Vector3 = Vector3(-direction.z, 0.0, direction.x)
	var yaw: float = PI * 0.5 if direction_2d.x != 0 else 0.0
	var rise: float = STOREY_HEIGHT / float(STAIR_STEPS)
	var start_offset: Vector3 = -direction * 0.55
	var total_run: float = float(STAIR_STEPS - 1) * STAIR_RUN

	# A real closed stair flight: thin visible treads/risers on a continuous soffit,
	# while proven box-step collision remains invisible and cheap.
	var soffit_a: Vector3 = start_offset - direction * 0.18 + Vector3.UP * 0.03
	var soffit_b: Vector3 = start_offset + direction * (total_run + 0.20) + Vector3.UP * (STOREY_HEIGHT - 0.34)
	_add_sloped_stair_slab(root, soffit_a, soffit_b, STAIR_WIDTH * 0.93, 0.16, stair_riser_material)

	for i in range(STAIR_STEPS):
		var top_y: float = rise * float(i + 1)
		var along: Vector3 = start_offset + direction * (float(i) * STAIR_RUN)

		_add_stair_mesh_box(root, along + Vector3.UP * (top_y - 0.045), Vector3(STAIR_WIDTH, 0.09, STAIR_RUN + 0.025), stair_tread_material, yaw)
		var riser_position: Vector3 = along - direction * (STAIR_RUN * 0.5) + Vector3.UP * (top_y - rise * 0.5)
		_add_stair_mesh_box(root, riser_position, Vector3(STAIR_WIDTH, rise, 0.065), stair_riser_material, yaw)

		# One primitive StaticBody per step. It keeps CharacterBody traversal as solid
		# as the earlier staircase without making the visible geometry into tall blocks.
		_add_stair_collision_box(root, along + Vector3.UP * (top_y * 0.5), Vector3(STAIR_WIDTH, top_y, STAIR_RUN + 0.035), yaw)

	var landing_position: Vector3 = start_offset + direction * (total_run + 0.72)
	landing_position.y = STOREY_HEIGHT - 0.09
	_add_stair_mesh_box(root, landing_position, Vector3(STAIR_WIDTH + 0.72, 0.18, 1.70), stair_tread_material, yaw)
	_add_stair_collision_box(root, landing_position, Vector3(STAIR_WIDTH + 0.72, 0.18, 1.70), yaw)

	# Rails sit 95 cm above the stair nosing, with slim balusters every four steps.
	for sign_value in [-1.0, 1.0]:
		var lateral: Vector3 = side * ((STAIR_WIDTH * 0.5 + 0.075) * float(sign_value))
		var rail_a: Vector3 = start_offset + lateral + Vector3.UP * (rise + 0.95)
		var rail_b: Vector3 = start_offset + direction * total_run + lateral + Vector3.UP * (STOREY_HEIGHT + 0.95)
		_add_stair_beam_between(root, rail_a, rail_b, 0.070, stair_rail_material)
		for post_i in range(0, STAIR_STEPS, 4):
			var base_y: float = rise * float(post_i + 1)
			var base: Vector3 = start_offset + direction * (float(post_i) * STAIR_RUN) + lateral
			base.y = base_y
			_add_stair_mesh_box(root, base + Vector3.UP * 0.46, Vector3(0.065, 0.92, 0.065), stair_rail_material, 0.0)

	# Proper coping and guardrails around the upper opening make it read as a stairwell,
	# not a rectangular deletion punched into a floor plane.
	var opening_center: Vector3 = direction * (total_run - 1.15)
	_add_stair_opening_trim(root, opening_center, direction, side, yaw)
	_add_stairwell_light(root, opening_center - direction * 0.30)

func _ensure_stair_materials() -> void:
	if stair_tread_material != null:
		return
	stair_tread_material = StandardMaterial3D.new()
	stair_tread_material.albedo_color = Color(0.72, 0.69, 0.48, 1.0)
	stair_tread_material.roughness = 0.86

	stair_riser_material = StandardMaterial3D.new()
	stair_riser_material.albedo_color = Color(0.61, 0.59, 0.40, 1.0)
	stair_riser_material.roughness = 0.91

	stair_rail_material = StandardMaterial3D.new()
	stair_rail_material.albedo_color = Color(0.79, 0.76, 0.55, 1.0)
	stair_rail_material.metallic = 0.08
	stair_rail_material.roughness = 0.55

	stair_lamp_material = StandardMaterial3D.new()
	stair_lamp_material.albedo_color = Color(1.0, 0.94, 0.72, 1.0)
	stair_lamp_material.emission_enabled = true
	stair_lamp_material.emission = Color(1.0, 0.88, 0.52, 1.0)

func _add_stair_mesh_box(root: Node3D, position: Vector3, size: Vector3, material: Material, yaw: float) -> MeshInstance3D:
	var instance: MeshInstance3D = MeshInstance3D.new()
	var mesh: BoxMesh = BoxMesh.new()
	mesh.size = size
	mesh.material = material
	instance.mesh = mesh
	instance.position = position
	instance.rotation.y = yaw
	root.add_child(instance)
	return instance

func _add_stair_collision_box(root: Node3D, position: Vector3, size: Vector3, yaw: float) -> void:
	var body: StaticBody3D = StaticBody3D.new()
	body.position = position
	body.rotation.y = yaw
	body.collision_layer = 3
	body.collision_mask = 3
	var shape_node: CollisionShape3D = CollisionShape3D.new()
	var shape: BoxShape3D = BoxShape3D.new()
	shape.size = size
	shape_node.shape = shape
	body.add_child(shape_node)
	root.add_child(body)

func _add_sloped_stair_slab(root: Node3D, a: Vector3, b: Vector3, width: float, thickness: float, material: Material) -> void:
	var delta: Vector3 = b - a
	if delta.length() <= 0.01:
		return
	var pivot: Node3D = Node3D.new()
	pivot.position = (a + b) * 0.5
	root.add_child(pivot)
	pivot.look_at(pivot.global_position + delta.normalized(), Vector3.UP)
	var slab: MeshInstance3D = MeshInstance3D.new()
	var mesh: BoxMesh = BoxMesh.new()
	mesh.size = Vector3(width, thickness, delta.length())
	mesh.material = material
	slab.mesh = mesh
	pivot.add_child(slab)

func _add_stair_beam_between(root: Node3D, a: Vector3, b: Vector3, thickness: float, material: Material) -> void:
	var delta: Vector3 = b - a
	if delta.length() <= 0.01:
		return
	var pivot: Node3D = Node3D.new()
	pivot.position = (a + b) * 0.5
	root.add_child(pivot)
	pivot.look_at(pivot.global_position + delta.normalized(), Vector3.UP)
	var beam: MeshInstance3D = MeshInstance3D.new()
	var mesh: BoxMesh = BoxMesh.new()
	mesh.size = Vector3(thickness, thickness, delta.length())
	mesh.material = material
	beam.mesh = mesh
	pivot.add_child(beam)

func _add_stair_opening_trim(root: Node3D, center: Vector3, direction: Vector3, side: Vector3, yaw: float) -> void:
	var y: float = STOREY_HEIGHT + 0.035
	var half_width: float = STAIR_V13_CUT_WIDTH * 0.5
	var half_length: float = STAIR_V13_CUT_LENGTH * 0.5
	for sign_value in [-1.0, 1.0]:
		var side_center: Vector3 = center + side * ((half_width + 0.10) * float(sign_value))
		side_center.y = y
		_add_stair_mesh_box(root, side_center, Vector3(0.18, 0.13, STAIR_V13_CUT_LENGTH + 0.34), stair_tread_material, yaw)

	for sign_value in [-1.0, 1.0]:
		var end_center: Vector3 = center + direction * ((half_length + 0.10) * float(sign_value))
		end_center.y = y
		_add_stair_mesh_box(root, end_center, Vector3(STAIR_V13_CUT_WIDTH + 0.36, 0.13, 0.18), stair_tread_material, yaw)

	# Side guards continue across the exposed upper-floor opening.
	for sign_value in [-1.0, 1.0]:
		var lateral: Vector3 = side * ((half_width + 0.02) * float(sign_value))
		var guard_a: Vector3 = center - direction * half_length + lateral + Vector3.UP * (STOREY_HEIGHT + 0.94)
		var guard_b: Vector3 = center + direction * half_length + lateral + Vector3.UP * (STOREY_HEIGHT + 0.94)
		_add_stair_beam_between(root, guard_a, guard_b, 0.07, stair_rail_material)
		for t in [0.0, 0.5, 1.0]:
			var base: Vector3 = (center - direction * half_length).lerp(center + direction * half_length, float(t)) + lateral
			base.y = STOREY_HEIGHT
			_add_stair_mesh_box(root, base + Vector3.UP * 0.46, Vector3(0.065, 0.92, 0.065), stair_rail_material, 0.0)

func _add_stairwell_light(root: Node3D, opening_center: Vector3) -> void:
	var fixture_position: Vector3 = opening_center + Vector3.UP * (STOREY_HEIGHT - 0.26)
	_add_stair_mesh_box(root, fixture_position, Vector3(1.10, 0.055, 0.24), stair_lamp_material, 0.0)
	var light: OmniLight3D = OmniLight3D.new()
	light.position = opening_center + Vector3.UP * (STOREY_HEIGHT - 0.55)
	light.light_color = Color(1.0, 0.87, 0.58, 1.0)
	light.light_energy = 0.78
	light.omni_range = 5.4
	light.shadow_enabled = false
	root.add_child(light)

func _make_cut(direction: Vector2i, height: float) -> CSGBox3D:
	var cut: CSGBox3D = CSGBox3D.new()
	cut.operation = CSGShape3D.OPERATION_SUBTRACTION
	if direction.x != 0:
		cut.size = Vector3(STAIR_V13_CUT_LENGTH, height, STAIR_V13_CUT_WIDTH)
	else:
		cut.size = Vector3(STAIR_V13_CUT_WIDTH, height, STAIR_V13_CUT_LENGTH)
	cut.calculate_tangents = false
	cut.use_collision = false
	return cut

func _headless_pool_smoke() -> void:
	for variant in range(6):
		var probe: Node3D = PoolComplexV13Script.new() as Node3D
		probe.position = Vector3(float(variant) * 44.0, 40.0, 0.0)
		tiles.add_child(probe)
		probe.call("configure", 0x7130 + variant * 101, variant)
		probe.queue_free()
