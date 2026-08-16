extends "res://arthur_mobile/world_v09.gd"

# v0.10.1 keeps the proven v0.9 world generator intact and moves one complete
# 2D world plane between storeys. Only the active storey is streamed.
# This avoids building seven complete floors at once and prevents lights from
# unloaded storeys bleeding through the current geometry.
const STOREY_HEIGHT := 4.4
const STOREY_SOURCE_OFFSET := Vector2i(997, -613)

const STAIR_STEPS := 20
const STAIR_RUN := 0.36
const STAIR_WIDTH := 1.80
const STAIR_SEARCH_RADIUS_BLOCKS := 2
const STAIR_CUT_WIDTH := 2.75
const STAIR_CUT_LENGTH := 4.25

const FLOOR_LOCAL_Y := -0.5
const CEILING_LOCAL_Y := 4.12
const UP_SWITCH_MARGIN := 0.15
const DOWN_SWITCH_MARGIN := -0.15

var current_level := 0
var stair_cache: Dictionary = {}
var connector_root: Node3D
var connector_block := Vector2i(999999, 999999)
var connector_level := 999999
var floor_cutouts: Array[CSGBox3D] = []
var ceiling_cutouts: Array[CSGBox3D] = []
var last_floor_anchor := Vector2(999999.0, 999999.0)

func _ready() -> void:
	super._ready()
	connector_root = Node3D.new()
	connector_root.name = "VerticalConnectors"
	add_child(connector_root)
	_update_floor_anchor(true)
	_rebuild_connectors(true)

func _process(delta: float) -> void:
	_maybe_switch_storey()
	_update_floor_anchor(false)

	_update_center(false)
	_build_some_tiles()
	_cleanup_far_tiles()
	_rebuild_connectors(false)
	_update_atmosphere(delta)

	if not hum.playing:
		hum.play()
	if not atmosphere.playing:
		atmosphere.play()

	var world_cell := Vector2i(
		floori(player.global_position.x / CELL),
		floori(player.global_position.z / CELL)
	)
	var source_cell: Vector2i = _virtual_cell(world_cell, current_level)
	var sample: Dictionary = _biome_sample_for_cell(source_cell)
	var primary: int = int(sample["primary"])
	var local_floor: bool = primary != BIOME_YELLOW

	# Preserve v0.9's floor strategy exactly: the broad yellow plane is used only
	# in the yellow biome. Pool/service surfaces remain the original per-cell geometry.
	floor_mesh.visible = not local_floor
	floor_mesh.use_collision = not local_floor
	ceiling_mesh.visible = not local_floor

	var base_y: float = float(current_level) * STOREY_HEIGHT
	if primary == BIOME_POOL and player.global_position.y < base_y - 4.6:
		coords_label.text = "UNDERWATER POOL ROOMS  //  SUBMERGED PASSAGE  //  FLOOR %+d  //  %d, %d  //  y %.1f" % [
			current_level,
			int(player.global_position.x),
			int(player.global_position.z),
			player.global_position.y
		]
	elif primary == BIOME_SERVICE and absf(player.global_position.y - base_y) > 3.8:
		coords_label.text = "SERVICE LEVEL  //  VERTICAL SHAFT  //  FLOOR %+d  //  %d, %d  //  y %.1f" % [
			current_level,
			int(player.global_position.x),
			int(player.global_position.z),
			player.global_position.y
		]
	else:
		coords_label.text = "%s  //  %s  //  FLOOR %+d  //  %d, %d  //  y %.1f" % [
			_sample_name(sample),
			_location_descriptor(source_cell, sample),
			current_level,
			int(player.global_position.x),
			int(player.global_position.z),
			player.global_position.y
		]

func _virtual_cell(world_cell: Vector2i, level: int) -> Vector2i:
	if level == 0:
		return world_cell
	return world_cell + STOREY_SOURCE_OFFSET * level

func _biome_sample_at_world(position: Vector3) -> Dictionary:
	# Shift only the procedural source coordinates. The player's actual world-space
	# position stays untouched, so atmosphere blending behaves exactly like v0.9.
	var source_offset: Vector2i = STOREY_SOURCE_OFFSET * current_level
	var shifted := position + Vector3(
		float(source_offset.x) * CELL,
		0.0,
		float(source_offset.y) * CELL
	)
	return super._biome_sample_at_world(shifted)

func _add_cell(world_cell: Vector2i) -> void:
	# Ask the exact v0.9 generator to build a source cell, then move that finished
	# cell to this storey's world-space location. No biome internals are rebuilt here.
	var source_cell: Vector2i = _virtual_cell(world_cell, current_level)
	super._add_cell(source_cell)
	if not active_tiles.has(source_cell):
		return

	var root: Node3D = active_tiles[source_cell] as Node3D
	active_tiles.erase(source_cell)
	root.name = "cell_%d_%+d_%d" % [world_cell.x, current_level, world_cell.y]
	root.position = Vector3(
		float(world_cell.x) * CELL,
		float(current_level) * STOREY_HEIGHT,
		float(world_cell.y) * CELL
	)
	active_tiles[world_cell] = root

func is_water_at_position(position: Vector3) -> bool:
	var local_y: float = position.y - float(current_level) * STOREY_HEIGHT
	if local_y >= 0.18:
		return false
	var world_cell := Vector2i(
		floori(position.x / CELL),
		floori(position.z / CELL)
	)
	var source_cell: Vector2i = _virtual_cell(world_cell, current_level)
	return int(_biome_sample_for_cell(source_cell)["primary"]) == BIOME_POOL

func _maybe_switch_storey() -> void:
	# Pool rooms intentionally descend far below their floor. Never interpret a
	# dive as a storey change.
	if is_water_at_position(player.global_position):
		return

	var base_y: float = float(current_level) * STOREY_HEIGHT
	if player.global_position.y > base_y + STOREY_HEIGHT + UP_SWITCH_MARGIN:
		_switch_storey(current_level + 1)
	elif player.global_position.y < base_y + DOWN_SWITCH_MARGIN:
		_switch_storey(current_level - 1)

func _switch_storey(next_level: int) -> void:
	if next_level == current_level:
		return

	current_level = next_level

	# Drop only the old active plane. The v0.9 generator will repopulate the new
	# storey around the player's unchanged X/Z position.
	for raw_root in active_tiles.values():
		if raw_root is Node:
			var root := raw_root as Node
			if is_instance_valid(root):
				root.queue_free()
	active_tiles.clear()
	build_queue.clear()
	center_cell = Vector2i(999999, 999999)
	cleanup_cursor = 0
	_update_center(true)

	connector_block = Vector2i(999999, 999999)
	connector_level = 999999
	_update_floor_anchor(true)
	_rebuild_connectors(true)

func _update_floor_anchor(force: bool) -> void:
	var snapped_x: float = snappedf(player.global_position.x, CELL)
	var snapped_z: float = snappedf(player.global_position.z, CELL)
	var next_anchor := Vector2(snapped_x, snapped_z)
	if force or next_anchor != last_floor_anchor:
		last_floor_anchor = next_anchor
		floor_mesh.global_position.x = snapped_x
		floor_mesh.global_position.z = snapped_z
		ceiling_mesh.global_position.x = snapped_x
		ceiling_mesh.global_position.z = snapped_z

	var base_y: float = float(current_level) * STOREY_HEIGHT
	floor_mesh.global_position.y = base_y + FLOOR_LOCAL_Y
	ceiling_mesh.global_position.y = base_y + CEILING_LOCAL_Y
	_position_cutouts()

func _block_for_world_cell(cell: Vector2i) -> Vector2i:
	return Vector2i(
		floori(float(cell.x) / float(PLAN_BLOCK_CELLS)),
		floori(float(cell.y) / float(PLAN_BLOCK_CELLS))
	)

func _rebuild_connectors(force: bool) -> void:
	if connector_root == null:
		return

	var world_cell := Vector2i(
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
	if bool(up.get("valid", false)):
		_spawn_stair(up, false)

	var down: Dictionary = _nearest_stair(current_level - 1, world_cell)
	if bool(down.get("valid", false)):
		_spawn_stair(down, true)

	_position_cutouts()

func _clear_connectors() -> void:
	for child in connector_root.get_children():
		connector_root.remove_child(child)
		child.queue_free()

	for cut in floor_cutouts:
		if is_instance_valid(cut):
			floor_mesh.remove_child(cut)
			cut.queue_free()
	for cut in ceiling_cutouts:
		if is_instance_valid(cut):
			ceiling_mesh.remove_child(cut)
			cut.queue_free()

	floor_cutouts.clear()
	ceiling_cutouts.clear()

func _nearest_stair(lower_level: int, world_cell: Vector2i) -> Dictionary:
	var center_block: Vector2i = _block_for_world_cell(world_cell)
	var best: Dictionary = {"valid": false}
	var best_distance := INF

	for bz in range(
		center_block.y - STAIR_SEARCH_RADIUS_BLOCKS,
		center_block.y + STAIR_SEARCH_RADIUS_BLOCKS + 1
	):
		for bx in range(
			center_block.x - STAIR_SEARCH_RADIUS_BLOCKS,
			center_block.x + STAIR_SEARCH_RADIUS_BLOCKS + 1
		):
			var candidate: Dictionary = _stair_descriptor(Vector2i(bx, bz), lower_level)
			if not bool(candidate.get("valid", false)):
				continue
			var start: Vector2i = candidate.get("start", Vector2i.ZERO) as Vector2i
			var dx: float = float(start.x - world_cell.x)
			var dz: float = float(start.y - world_cell.y)
			var distance_sq: float = dx * dx + dz * dz
			if distance_sq < best_distance:
				best_distance = distance_sq
				best = candidate

	return best

func _stair_descriptor(block: Vector2i, lower_level: int) -> Dictionary:
	var cache_key := Vector3i(block.x, lower_level, block.y)
	if stair_cache.has(cache_key):
		return stair_cache[cache_key] as Dictionary

	var block_origin := Vector2i(
		block.x * PLAN_BLOCK_CELLS,
		block.y * PLAN_BLOCK_CELLS
	)
	var seed: int = _hash(
		block.x + lower_level * 37,
		block.y - lower_level * 53,
		7601
	)

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

		if int(_biome_sample_for_cell(low)["primary"]) != BIOME_YELLOW:
			return false
		if int(_biome_sample_for_cell(high)["primary"]) != BIOME_YELLOW:
			return false
		if not bool(yellow_plan.call("is_corridor", low)):
			return false
		if not bool(yellow_plan.call("is_corridor", high)):
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

func _spawn_stair(stair: Dictionary, cuts_current_floor: bool) -> void:
	var lower_level: int = int(stair.get("lower_level", current_level))
	var start: Vector2i = stair.get("start", Vector2i.ZERO) as Vector2i
	var direction_2d: Vector2i = stair.get("direction", Vector2i(1, 0)) as Vector2i

	var stair_root := Node3D.new()
	stair_root.name = "stair_%d_%+d_%d" % [start.x, lower_level, start.y]
	stair_root.position = Vector3(
		float(start.x) * CELL,
		float(lower_level) * STOREY_HEIGHT,
		float(start.y) * CELL
	)
	connector_root.add_child(stair_root)
	_build_stair_run(stair_root, direction_2d)

	var direction := Vector3(float(direction_2d.x), 0.0, float(direction_2d.y))
	var total_run: float = float(STAIR_STEPS - 1) * STAIR_RUN
	var cut_distance: float = total_run - 1.15
	var cut_world := Vector3(
		float(start.x) * CELL,
		0.0,
		float(start.y) * CELL
	) + direction * cut_distance

	if cuts_current_floor:
		_add_floor_cut(cut_world, direction_2d)
	else:
		_add_ceiling_cut(cut_world, direction_2d)

func _build_stair_run(root: Node3D, direction_2d: Vector2i) -> void:
	var direction := Vector3(float(direction_2d.x), 0.0, float(direction_2d.y))
	var start_offset: Vector3 = -direction * 0.55

	for i in range(STAIR_STEPS):
		var progress: float = float(i + 1) / float(STAIR_STEPS)
		var height: float = STOREY_HEIGHT * progress
		var step_position: Vector3 = start_offset + direction * (float(i) * STAIR_RUN)
		step_position.y = height * 0.5

		var step_box := CSGBox3D.new()
		step_box.position = step_position
		step_box.size = Vector3(STAIR_WIDTH, height, STAIR_RUN + 0.06)
		if direction_2d.x != 0:
			step_box.rotation.y = PI * 0.5
		step_box.material_override = YELLOW_FLOOR
		step_box.use_collision = true
		step_box.collision_layer = 3
		step_box.collision_mask = 3
		root.add_child(step_box)

	var total_run: float = float(STAIR_STEPS - 1) * STAIR_RUN
	var landing_position: Vector3 = start_offset + direction * (total_run + 0.62)
	landing_position.y = STOREY_HEIGHT - 0.10

	var landing := CSGBox3D.new()
	landing.position = landing_position
	landing.size = Vector3(3.0, 0.20, 1.9)
	if direction_2d.x != 0:
		landing.rotation.y = PI * 0.5
	landing.material_override = YELLOW_FLOOR
	landing.use_collision = true
	landing.collision_layer = 3
	landing.collision_mask = 3
	root.add_child(landing)

	# Two low rails are enough to make the connector readable without turning it
	# into another dense procedural structure.
	var side := Vector3(-direction.z, 0.0, direction.x)
	for sign_value in [-1.0, 1.0]:
		var rail := CSGBox3D.new()
		rail.position = start_offset + direction * (total_run * 0.5)
		rail.position += side * (STAIR_WIDTH * 0.57 * sign_value)
		rail.position.y = STOREY_HEIGHT * 0.52
		rail.size = Vector3(0.12, STOREY_HEIGHT * 0.88, total_run + 0.9)
		if direction_2d.x != 0:
			rail.rotation.y = PI * 0.5
		rail.material_override = YELLOW_WALL
		rail.use_collision = true
		rail.collision_layer = 3
		rail.collision_mask = 3
		root.add_child(rail)

func _add_floor_cut(world_position: Vector3, direction: Vector2i) -> void:
	var cut := _make_cut(direction, 2.2)
	cut.set_meta("world_x", world_position.x)
	cut.set_meta("world_z", world_position.z)
	floor_mesh.add_child(cut)
	floor_cutouts.append(cut)

func _add_ceiling_cut(world_position: Vector3, direction: Vector2i) -> void:
	var cut := _make_cut(direction, 1.2)
	cut.set_meta("world_x", world_position.x)
	cut.set_meta("world_z", world_position.z)
	ceiling_mesh.add_child(cut)
	ceiling_cutouts.append(cut)

func _make_cut(direction: Vector2i, height: float) -> CSGBox3D:
	var cut := CSGBox3D.new()
	cut.operation = CSGShape3D.OPERATION_SUBTRACTION
	if direction.x != 0:
		cut.size = Vector3(STAIR_CUT_LENGTH, height, STAIR_CUT_WIDTH)
	else:
		cut.size = Vector3(STAIR_CUT_WIDTH, height, STAIR_CUT_LENGTH)
	cut.use_collision = false
	return cut

func _position_cutouts() -> void:
	for cut in floor_cutouts:
		if not is_instance_valid(cut):
			continue
		cut.global_position = Vector3(
			float(cut.get_meta("world_x")),
			floor_mesh.global_position.y,
			float(cut.get_meta("world_z"))
		)

	for cut in ceiling_cutouts:
		if not is_instance_valid(cut):
			continue
		cut.global_position = Vector3(
			float(cut.get_meta("world_x")),
			ceiling_mesh.global_position.y,
			float(cut.get_meta("world_z"))
		)
