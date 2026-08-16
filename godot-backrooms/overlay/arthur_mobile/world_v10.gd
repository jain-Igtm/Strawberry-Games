extends "res://arthur_mobile/world_v09.gd"

# v0.10 turns the old X/Z-only streamer into a true 3D storey lattice.
# 4.4 m intentionally matches the existing service-shaft catwalk spacing.
const STOREY_HEIGHT := 4.4
const STACK_LOAD_RADIUS_XZ := 6
const STACK_UNLOAD_RADIUS_XZ := 8
const STACK_LOAD_RADIUS_Y := 3
const STACK_UNLOAD_RADIUS_Y := 4
const STACK_ADD_PER_FRAME := 22
const STAIR_STEPS := 24
const STAIR_RUN := 0.31
const STAIR_WIDTH := 1.72

var stack_tiles: Dictionary = {}
var stack_queue: Array[Vector3i] = []
var stack_center := Vector3i(999999, 999999, 999999)
var stair_cache: Dictionary = {}

func _ready() -> void:
	super._ready()
	# The inherited 2D streamer only queued work in _ready(); discard it before any tile is built.
	build_queue.clear()
	for old_root in active_tiles.values():
		if old_root is Node:
			(old_root as Node).queue_free()
	active_tiles.clear()
	floor_mesh.visible = false
	floor_mesh.use_collision = false
	ceiling_mesh.visible = false
	ceiling_mesh.use_collision = false
	_update_stack_center(true)

func _process(delta: float) -> void:
	# Never call the inherited _process(): it is the old one-storey streamer.
	floor_mesh.visible = false
	floor_mesh.use_collision = false
	ceiling_mesh.visible = false
	ceiling_mesh.use_collision = false

	_update_stack_center(false)
	_build_stack_tiles()
	_cleanup_stack_tiles()
	_update_atmosphere(delta)

	if not hum.playing:
		hum.play()
	if not atmosphere.playing:
		atmosphere.play()

	var level: int = _level_for_y(player.global_position.y)
	var world_cell := Vector2i(
		floori(player.global_position.x / CELL),
		floori(player.global_position.z / CELL)
	)
	var virtual_cell: Vector2i = _virtual_cell(world_cell, level)
	var sample: Dictionary = _biome_sample_for_cell(virtual_cell)
	var suffix := ""
	if player.has_method("is_underwater") and bool(player.call("is_underwater")):
		suffix = "  //  SUBMERGED"
	coords_label.text = "%s  //  %s  //  FLOOR %+d  //  %d, %d  //  y %.1f%s" % [
		_sample_name(sample),
		_location_descriptor(virtual_cell, sample),
		level,
		int(player.global_position.x),
		int(player.global_position.z),
		player.global_position.y,
		suffix
	]

func _level_for_y(y: float) -> int:
	return roundi(y / STOREY_HEIGHT)

func _virtual_cell(world_cell: Vector2i, level: int) -> Vector2i:
	# Large irrational-ish offsets give every storey a different deterministic plan/biome field.
	return world_cell + Vector2i(level * 997, level * -613)

func _biome_sample_at_world(position: Vector3) -> Dictionary:
	var level: int = _level_for_y(position.y)
	var world_cell := Vector2i(
		floori(position.x / CELL),
		floori(position.z / CELL)
	)
	return _biome_sample_for_cell(_virtual_cell(world_cell, level))

func _update_stack_center(force: bool) -> void:
	var next := Vector3i(
		roundi(player.global_position.x / CELL),
		_level_for_y(player.global_position.y),
		roundi(player.global_position.z / CELL)
	)
	if not force and next == stack_center:
		return
	stack_center = next
	_rebuild_stack_queue()

func _rebuild_stack_queue() -> void:
	stack_queue.clear()
	var vertical_order: Array[int] = [0, 1, -1, 2, -2, 3, -3]
	for y_offset in vertical_order:
		if absi(y_offset) > STACK_LOAD_RADIUS_Y:
			continue
		for ring in range(STACK_LOAD_RADIUS_XZ + 1):
			for z_offset in range(-ring, ring + 1):
				for x_offset in range(-ring, ring + 1):
					if maxi(absi(x_offset), absi(z_offset)) != ring:
						continue
					var key := Vector3i(
						stack_center.x + x_offset,
						stack_center.y + y_offset,
						stack_center.z + z_offset
					)
					if not stack_tiles.has(key):
						stack_queue.append(key)

func _build_stack_tiles() -> void:
	var count: int = mini(STACK_ADD_PER_FRAME, stack_queue.size())
	for _i in range(count):
		var key: Vector3i = stack_queue.pop_front()
		if stack_tiles.has(key):
			continue
		_add_stack_cell(key)

func _cleanup_stack_tiles() -> void:
	var remove_keys: Array[Vector3i] = []
	for raw_key in stack_tiles.keys():
		var key: Vector3i = raw_key as Vector3i
		var horizontal_far: bool = maxi(absi(key.x - stack_center.x), absi(key.z - stack_center.z)) > STACK_UNLOAD_RADIUS_XZ
		var vertical_far: bool = absi(key.y - stack_center.y) > STACK_UNLOAD_RADIUS_Y
		if horizontal_far or vertical_far:
			remove_keys.append(key)
	for key in remove_keys:
		var root: Node3D = stack_tiles[key] as Node3D
		stack_tiles.erase(key)
		if is_instance_valid(root):
			root.queue_free()

func _add_stack_cell(key: Vector3i) -> void:
	var world_cell := Vector2i(key.x, key.z)
	var level: int = key.y
	var virtual_cell: Vector2i = _virtual_cell(world_cell, level)
	var root := Node3D.new()
	root.name = "stack_%d_%+d_%d" % [key.x, level, key.z]
	root.position = Vector3(float(key.x) * CELL, float(level) * STOREY_HEIGHT, float(key.z) * CELL)
	tiles.add_child(root)
	stack_tiles[key] = root

	# Leave the old v0.9 underwater volume under the original pool layer unobstructed.
	if _reserved_for_origin_pool_volume(world_cell, level):
		return

	var sample: Dictionary = _biome_sample_for_cell(virtual_cell)
	var primary: int = int(sample["primary"])
	var material: Material = _wall_material_for_biome(primary)
	var shaft_hole: bool = _origin_service_shaft_hole(world_cell, level)
	var stair_up: bool = _is_stair_opening(world_cell, level)
	var stair_down: bool = _is_stair_opening(world_cell, level - 1)
	var stair_space: bool = stair_up or stair_down

	# Stair/shaft footprint cells deliberately suppress ordinary partition walls.
	if not stair_space and not shaft_hole:
		_add_topology(root, virtual_cell, material)
	_add_light_for_cell(root, virtual_cell, sample)

	if primary == BIOME_YELLOW:
		_add_yellow_content(root, virtual_cell, sample)
	elif primary == BIOME_SERVICE:
		_add_service_content(root, virtual_cell, sample)
	else:
		_add_vertical_pool_content(root, virtual_cell, sample, level)

	_add_storey_surfaces(root, world_cell, virtual_cell, level, primary, stair_up, stair_down, shaft_hole)

	var stair: Dictionary = _stair_descriptor(_block_for_world_cell(world_cell), level)
	if bool(stair.get("valid", false)) and world_cell == (stair.get("start", Vector2i.ZERO) as Vector2i):
		_add_stair_run(root, stair)

func _add_storey_surfaces(
	root: Node3D,
	world_cell: Vector2i,
	virtual_cell: Vector2i,
	level: int,
	primary: int,
	stair_up: bool,
	stair_down: bool,
	shaft_hole: bool
) -> void:
	var floor_open: bool = stair_down or shaft_hole
	var ceiling_open: bool = stair_up or shaft_hole

	if level == 0 and primary == BIOME_POOL:
		# Preserve the v0.9 surface pools and underwater network on the original storey.
		_add_pool_surface_cell(root, virtual_cell)
		_add_underwater_cell(root, virtual_cell)
		return
	if level == 0 and primary == BIOME_SERVICE:
		# Preserve the original service floor/ceiling except where a true vertical opening exists.
		if not floor_open:
			_box_on(root, Vector3(0, -0.11, 0), Vector3(CELL, 0.22, CELL), SERVICE_CONCRETE, true)
		if not ceiling_open:
			_box_on(root, Vector3(0, 4.06, 0), Vector3(CELL, 0.12, CELL), SERVICE_CONCRETE, false)
		return

	var floor_material: Material = YELLOW_FLOOR
	var ceiling_material: Material = YELLOW_CEILING
	if primary == BIOME_SERVICE:
		floor_material = SERVICE_CONCRETE
		ceiling_material = SERVICE_CONCRETE
	elif primary == BIOME_POOL:
		floor_material = POOL_TILE
		ceiling_material = POOL_TILE

	if primary == BIOME_POOL and level != 0 and _vertical_pool_is_water(virtual_cell):
		if not floor_open:
			_box_on(root, Vector3(0, -0.82, 0), Vector3(CELL, 0.22, CELL), DEEP_POOL_TILE, true)
		_add_cell_water_surface(root)
	else:
		if not floor_open:
			_box_on(root, Vector3(0, -0.11, 0), Vector3(CELL, 0.22, CELL), floor_material, true)

	if not ceiling_open:
		_box_on(root, Vector3(0, 4.06, 0), Vector3(CELL, 0.12, CELL), ceiling_material, false)

func _add_vertical_pool_content(root: Node3D, cell: Vector2i, sample: Dictionary, level: int) -> void:
	# Upper/lower pool storeys stay tiled and architectural without duplicating the 13 m deep v0.9 well in every 4.4 m floor.
	if bool(yellow_plan.call("is_room_anchor", cell)):
		var info: Dictionary = yellow_plan.call("room_info", cell) as Dictionary
		var width: int = int(info.get("width", 1))
		var height: int = int(info.get("height", 1))
		if width >= 2 and height >= 2 and _hash(cell.x, cell.y, 7811 + level * 17) % 5 == 0:
			var bench := CSGBox3D.new()
			bench.position = Vector3(0.5, 0.34, -0.6)
			bench.size = Vector3(2.6, 0.42, 0.72)
			bench.material_override = POOL_ACCENT_V09
			bench.use_collision = true
			bench.collision_layer = 3
			bench.collision_mask = 3
			root.add_child(bench)
	_add_large_transition_detail(root, sample, Vector3.ZERO)

func _vertical_pool_is_water(cell: Vector2i) -> bool:
	var room: Vector2i = _room_for_cell(cell)
	return _pool_surface_is_water(cell, room) and _hash(cell.x, cell.y, 7823) % 3 != 0

func _block_for_world_cell(cell: Vector2i) -> Vector2i:
	return Vector2i(
		floori(float(cell.x) / float(PLAN_BLOCK_CELLS)),
		floori(float(cell.y) / float(PLAN_BLOCK_CELLS))
	)

func _stair_descriptor(block: Vector2i, lower_level: int) -> Dictionary:
	var cache_key := Vector3i(block.x, lower_level, block.y)
	if stair_cache.has(cache_key):
		return stair_cache[cache_key] as Dictionary

	var block_origin := Vector2i(block.x * PLAN_BLOCK_CELLS, block.y * PLAN_BLOCK_CELLS)
	var seed: int = _hash(block.x + lower_level * 37, block.y - lower_level * 53, 7601)
	for attempt in range(72):
		var roll: int = _hash(seed + attempt * 17, lower_level * 101 + attempt, 7613)
		var along_x: bool = (roll & 1) == 0
		var local_x: int = 2 + posmod(roll >> 3, 6)
		var local_z: int = 2 + posmod(roll >> 9, 6)
		var start := block_origin + Vector2i(local_x, local_z)
		var direction := Vector2i(1, 0) if along_x else Vector2i(0, 1)
		if _stair_path_works(start, direction, lower_level):
			var found := {
				"valid": true,
				"start": start,
				"direction": direction,
				"lower_level": lower_level
			}
			stair_cache[cache_key] = found
			return found

	var none := {"valid": false}
	stair_cache[cache_key] = none
	return none

func _stair_path_works(start: Vector2i, direction: Vector2i, lower_level: int) -> bool:
	for step in range(3):
		var world_cell: Vector2i = start + direction * step
		var low: Vector2i = _virtual_cell(world_cell, lower_level)
		var high: Vector2i = _virtual_cell(world_cell, lower_level + 1)
		var low_sample: Dictionary = _biome_sample_for_cell(low)
		var high_sample: Dictionary = _biome_sample_for_cell(high)
		if int(low_sample["primary"]) != BIOME_YELLOW or int(high_sample["primary"]) != BIOME_YELLOW:
			return false
		if not bool(yellow_plan.call("is_corridor", low)) or not bool(yellow_plan.call("is_corridor", high)):
			return false
		if step > 0:
			var previous_world: Vector2i = world_cell - direction
			var previous_low: Vector2i = _virtual_cell(previous_world, lower_level)
			var previous_high: Vector2i = _virtual_cell(previous_world, lower_level + 1)
			if int(yellow_plan.call("edge_kind", low, previous_low)) == EDGE_SOLID:
				return false
			if int(yellow_plan.call("edge_kind", high, previous_high)) == EDGE_SOLID:
				return false
	return true

func _is_stair_opening(world_cell: Vector2i, lower_level: int) -> bool:
	var block: Vector2i = _block_for_world_cell(world_cell)
	var stair: Dictionary = _stair_descriptor(block, lower_level)
	if not bool(stair.get("valid", false)):
		return false
	var start: Vector2i = stair.get("start", Vector2i.ZERO) as Vector2i
	var direction: Vector2i = stair.get("direction", Vector2i.ZERO) as Vector2i
	for step in range(3):
		if world_cell == start + direction * step:
			return true
	return false

func _add_stair_run(root: Node3D, stair: Dictionary) -> void:
	var direction_2d: Vector2i = stair.get("direction", Vector2i(1, 0)) as Vector2i
	var direction := Vector3(float(direction_2d.x), 0.0, float(direction_2d.y))
	var total_run: float = float(STAIR_STEPS - 1) * STAIR_RUN
	var start_offset: Vector3 = -direction * 0.55
	for i in range(STAIR_STEPS):
		var progress: float = float(i + 1) / float(STAIR_STEPS)
		var height: float = STOREY_HEIGHT * progress
		var position: Vector3 = start_offset + direction * (float(i) * STAIR_RUN)
		position.y = height * 0.5
		var step_box := CSGBox3D.new()
		step_box.position = position
		step_box.size = Vector3(STAIR_WIDTH, height, STAIR_RUN + 0.06)
		if direction_2d.x != 0:
			step_box.rotation.y = PI * 0.5
		step_box.material_override = YELLOW_FLOOR
		step_box.use_collision = true
		step_box.collision_layer = 3
		step_box.collision_mask = 3
		root.add_child(step_box)

	var landing_position: Vector3 = start_offset + direction * (total_run + 0.72)
	landing_position.y = STOREY_HEIGHT - 0.10
	var landing := CSGBox3D.new()
	landing.position = landing_position
	landing.size = Vector3(3.1, 0.20, 2.0)
	if direction_2d.x != 0:
		landing.rotation.y = PI * 0.5
	landing.material_override = YELLOW_FLOOR
	landing.use_collision = true
	landing.collision_layer = 3
	landing.collision_mask = 3
	root.add_child(landing)

	# Low rails make the stair read as a deliberate connector rather than a ramp of boxes.
	var side := Vector3(-direction.z, 0.0, direction.x)
	for sign_value in [-1.0, 1.0]:
		var rail := CSGBox3D.new()
		rail.position = start_offset + direction * (total_run * 0.5) + side * (STAIR_WIDTH * 0.56 * sign_value)
		rail.position.y = STOREY_HEIGHT * 0.52
		rail.size = Vector3(0.12, STOREY_HEIGHT * 0.88, total_run + 1.0)
		if direction_2d.x != 0:
			rail.rotation.y = PI * 0.5
		rail.material_override = YELLOW_WALL
		rail.use_collision = true
		rail.collision_layer = 3
		rail.collision_mask = 3
		root.add_child(rail)

func _origin_service_shaft_hole(world_cell: Vector2i, level: int) -> bool:
	if level < -2 or level > 3:
		return false
	var base_sample: Dictionary = _biome_sample_for_cell(world_cell)
	if int(base_sample["primary"]) != BIOME_SERVICE:
		return false
	var room: Vector2i = _room_for_cell(world_cell)
	if not _is_service_shaft_room(room):
		return false
	var local_x: int = _positive_mod(world_cell.x, ROOM_SIZE)
	var local_z: int = _positive_mod(world_cell.y, ROOM_SIZE)
	return local_x >= 2 and local_x <= 3 and local_z >= 2 and local_z <= 3

func _reserved_for_origin_pool_volume(world_cell: Vector2i, level: int) -> bool:
	if level >= 0 or level < -3:
		return false
	var base_sample: Dictionary = _biome_sample_for_cell(world_cell)
	return int(base_sample["primary"]) == BIOME_POOL

func is_water_at_position(position: Vector3) -> bool:
	var world_cell := Vector2i(
		floori(position.x / CELL),
		floori(position.z / CELL)
	)
	# Original v0.9 water column, including the deep-well / underwater layer.
	var base_sample: Dictionary = _biome_sample_for_cell(world_cell)
	if int(base_sample["primary"]) == BIOME_POOL and position.y <= 0.18 and position.y >= -13.8:
		var base_room: Vector2i = _room_for_cell(world_cell)
		if _pool_surface_is_water(world_cell, base_room):
			return true

	var level: int = _level_for_y(position.y)
	if level == 0:
		return false
	var local_y: float = position.y - float(level) * STOREY_HEIGHT
	if local_y > 0.18 or local_y < -1.15:
		return false
	var virtual_cell: Vector2i = _virtual_cell(world_cell, level)
	var sample: Dictionary = _biome_sample_for_cell(virtual_cell)
	return int(sample["primary"]) == BIOME_POOL and _vertical_pool_is_water(virtual_cell)
