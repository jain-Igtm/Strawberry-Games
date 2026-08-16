class_name YellowPlan
extends RefCounted

const BLOCK_CELLS := 12
const CORRIDOR := 0
const UNASSIGNED := -1
const EDGE_OPEN := 0
const EDGE_DOOR := 1
const EDGE_SOLID := 2
const WORLD_SEED := 0x41A7F29D

var _plans: Dictionary = {}

func region_for_cell(cell: Vector2i) -> int:
	var block: Vector2i = _block_for_cell(cell)
	var plan: Dictionary = _plan(block)
	var local: Vector2i = _local_cell(cell, block)
	return int((plan["regions"] as Array)[_index(local.x, local.y)])

func edge_kind(a: Vector2i, b: Vector2i) -> int:
	var block_a: Vector2i = _block_for_cell(a)
	var block_b: Vector2i = _block_for_cell(b)
	var region_a: int = region_for_cell(a)
	var region_b: int = region_for_cell(b)

	if block_a != block_b:
		return EDGE_OPEN if region_a == CORRIDOR and region_b == CORRIDOR else EDGE_SOLID

	if region_a == region_b:
		return EDGE_OPEN

	var plan: Dictionary = _plan(block_a)
	var doors: Dictionary = plan["doors"] as Dictionary
	return EDGE_DOOR if doors.has(_edge_key(a, b)) else EDGE_SOLID

func is_corridor(cell: Vector2i) -> bool:
	return region_for_cell(cell) == CORRIDOR

func room_info(cell: Vector2i) -> Dictionary:
	var block: Vector2i = _block_for_cell(cell)
	var plan: Dictionary = _plan(block)
	var region: int = region_for_cell(cell)
	if region <= CORRIDOR:
		return {}
	var rooms: Dictionary = plan["rooms"] as Dictionary
	if not rooms.has(region):
		return {}
	var local_info: Dictionary = rooms[region] as Dictionary
	var origin := Vector2i(block.x * BLOCK_CELLS, block.y * BLOCK_CELLS)
	var min_local: Vector2i = local_info["min"] as Vector2i
	var max_local: Vector2i = local_info["max"] as Vector2i
	var anchor_local: Vector2i = local_info["anchor"] as Vector2i
	return {
		"block": block,
		"id": region,
		"min": origin + min_local,
		"max": origin + max_local,
		"anchor": origin + anchor_local,
		"width": max_local.x - min_local.x + 1,
		"height": max_local.y - min_local.y + 1
	}

func is_room_anchor(cell: Vector2i) -> bool:
	var info: Dictionary = room_info(cell)
	return not info.is_empty() and (info["anchor"] as Vector2i) == cell

func corridor_width_for_cell(cell: Vector2i) -> int:
	var block: Vector2i = _block_for_cell(cell)
	var plan: Dictionary = _plan(block)
	return int(plan["corridor_width"])

func _plan(block: Vector2i) -> Dictionary:
	if _plans.has(block):
		return _plans[block] as Dictionary
	var generated: Dictionary = _generate_plan(block)
	_plans[block] = generated
	if _plans.size() > 96:
		var keys: Array = _plans.keys()
		_plans.erase(keys[0])
	return generated

func _generate_plan(block: Vector2i) -> Dictionary:
	var regions: Array = []
	regions.resize(BLOCK_CELLS * BLOCK_CELLS)
	regions.fill(UNASSIGNED)

	var corridor_width: int = 2 if _hash(block.x, block.y, 1601) % 5 == 0 else 1
	var junction := Vector2i(
		4 + (_hash(block.x, block.y, 1613) % 4),
		4 + (_hash(block.x, block.y, 1621) % 4)
	)
	var west_gate: int = _vertical_gate(block + Vector2i(-1, 0))
	var east_gate: int = _vertical_gate(block)
	var north_gate: int = _horizontal_gate(block + Vector2i(0, -1))
	var south_gate: int = _horizontal_gate(block)

	_carve_route(regions, Vector2i(0, west_gate), junction, true, corridor_width)
	_carve_route(regions, Vector2i(BLOCK_CELLS - 1, east_gate), junction, true, corridor_width)
	_carve_route(regions, Vector2i(north_gate, 0), junction, false, corridor_width)
	_carve_route(regions, Vector2i(south_gate, BLOCK_CELLS - 1), junction, false, corridor_width)

	var branch_roll: int = _hash(block.x, block.y, 1637) % 4
	if branch_roll == 0:
		_carve_route(regions, junction, Vector2i(2, 2 + (_hash(block.x, block.y, 1649) % 7)), true, 1)
	elif branch_roll == 1:
		_carve_route(regions, junction, Vector2i(9, 2 + (_hash(block.x, block.y, 1657) % 7)), true, 1)
	elif branch_roll == 2:
		_carve_route(regions, junction, Vector2i(2 + (_hash(block.x, block.y, 1663) % 7), 2), false, 1)

	var rooms: Dictionary = {}
	var room_id := 1
	for z in range(BLOCK_CELLS):
		for x in range(BLOCK_CELLS):
			if int(regions[_index(x, z)]) != UNASSIGNED:
				continue
			var seed: int = _hash(block.x * 53 + x, block.y * 59 + z, 1709)
			var wanted_w: int = 2 + (seed % 3)
			var wanted_h: int = 2 + ((seed >> 3) % 3)
			var width: int = _fit_width(regions, x, z, wanted_w)
			var height: int = _fit_height(regions, x, z, width, wanted_h)
			if width <= 0 or height <= 0:
				width = 1
				height = 1
			for rz in range(z, z + height):
				for rx in range(x, x + width):
					regions[_index(rx, rz)] = room_id
			var anchor := Vector2i(x + width / 2, z + height / 2)
			rooms[room_id] = {
				"min": Vector2i(x, z),
				"max": Vector2i(x + width - 1, z + height - 1),
				"anchor": anchor
			}
			room_id += 1

	var doors: Dictionary = {}
	_connect_rooms(block, regions, rooms, doors)

	return {
		"regions": regions,
		"rooms": rooms,
		"doors": doors,
		"corridor_width": corridor_width
	}

func _carve_route(regions: Array, start: Vector2i, target: Vector2i, horizontal_first: bool, width: int) -> void:
	if horizontal_first:
		_carve_horizontal(regions, start.x, target.x, start.y, width)
		_carve_vertical(regions, start.y, target.y, target.x, width)
	else:
		_carve_vertical(regions, start.y, target.y, start.x, width)
		_carve_horizontal(regions, start.x, target.x, target.y, width)

func _carve_horizontal(regions: Array, x1: int, x2: int, z: int, width: int) -> void:
	var from_x: int = mini(x1, x2)
	var to_x: int = maxi(x1, x2)
	for x in range(from_x, to_x + 1):
		_carve_cell(regions, x, z)
		if width > 1:
			var offset_z: int = z + (1 if z < BLOCK_CELLS - 1 else -1)
			_carve_cell(regions, x, offset_z)

func _carve_vertical(regions: Array, z1: int, z2: int, x: int, width: int) -> void:
	var from_z: int = mini(z1, z2)
	var to_z: int = maxi(z1, z2)
	for z in range(from_z, to_z + 1):
		_carve_cell(regions, x, z)
		if width > 1:
			var offset_x: int = x + (1 if x < BLOCK_CELLS - 1 else -1)
			_carve_cell(regions, offset_x, z)

func _carve_cell(regions: Array, x: int, z: int) -> void:
	if x < 0 or z < 0 or x >= BLOCK_CELLS or z >= BLOCK_CELLS:
		return
	regions[_index(x, z)] = CORRIDOR

func _fit_width(regions: Array, x: int, z: int, wanted: int) -> int:
	var width := 0
	for rx in range(x, mini(BLOCK_CELLS, x + wanted)):
		if int(regions[_index(rx, z)]) != UNASSIGNED:
			break
		width += 1
	return width

func _fit_height(regions: Array, x: int, z: int, width: int, wanted: int) -> int:
	if width <= 0:
		return 0
	var height := 0
	for rz in range(z, mini(BLOCK_CELLS, z + wanted)):
		var row_ok := true
		for rx in range(x, x + width):
			if int(regions[_index(rx, rz)]) != UNASSIGNED:
				row_ok = false
				break
		if not row_ok:
			break
		height += 1
	return height

func _connect_rooms(block: Vector2i, regions: Array, rooms: Dictionary, doors: Dictionary) -> void:
	var adjacency: Dictionary = {}
	var candidates: Dictionary = {}
	for id_variant in rooms.keys():
		adjacency[int(id_variant)] = []

	for z in range(BLOCK_CELLS):
		for x in range(BLOCK_CELLS):
			var a_local := Vector2i(x, z)
			var a_region: int = int(regions[_index(x, z)])
			if x + 1 < BLOCK_CELLS:
				_record_adjacency(block, a_local, Vector2i(x + 1, z), a_region, int(regions[_index(x + 1, z)]), adjacency, candidates)
			if z + 1 < BLOCK_CELLS:
				_record_adjacency(block, a_local, Vector2i(x, z + 1), a_region, int(regions[_index(x, z + 1)]), adjacency, candidates)

	var unvisited: Dictionary = {}
	for id_variant in rooms.keys():
		unvisited[int(id_variant)] = true

	while not unvisited.is_empty():
		var component_rooms: Array[int] = []
		var component_queue: Array[int] = [int(unvisited.keys()[0])]
		var component_seen: Dictionary = {}
		component_seen[component_queue[0]] = true
		while not component_queue.is_empty():
			var current: int = component_queue.pop_front()
			component_rooms.append(current)
			var neighbors: Array = adjacency.get(current, []) as Array
			for neighbor_variant in neighbors:
				var neighbor: int = int(neighbor_variant)
				if neighbor <= 0 or component_seen.has(neighbor):
					continue
				component_seen[neighbor] = true
				component_queue.append(neighbor)

		var root_room: int = component_rooms[0]
		for candidate_room in component_rooms:
			if _pair_has_candidates(candidates, candidate_room, CORRIDOR):
				root_room = candidate_room
				break

		if _pair_has_candidates(candidates, root_room, CORRIDOR):
			_add_candidate_door(candidates, doors, root_room, CORRIDOR, block, root_room * 19)

		var visited: Dictionary = {root_room: true}
		var queue: Array[int] = [root_room]
		while not queue.is_empty():
			var current: int = queue.pop_front()
			for neighbor_variant in adjacency.get(current, []) as Array:
				var neighbor: int = int(neighbor_variant)
				if neighbor <= 0 or visited.has(neighbor):
					continue
				_add_candidate_door(candidates, doors, current, neighbor, block, current * 31 + neighbor * 7)
				visited[neighbor] = true
				queue.append(neighbor)

		for room_id in component_rooms:
			unvisited.erase(room_id)

		if component_rooms.size() > 2 and _hash(block.x, block.y, 1901 + root_room) % 3 == 0:
			for room_id in component_rooms:
				for neighbor_variant in adjacency.get(room_id, []) as Array:
					var neighbor: int = int(neighbor_variant)
					if neighbor > 0 and neighbor != room_id and _hash(room_id, neighbor, 1913) % 7 == 0:
						_add_candidate_door(candidates, doors, room_id, neighbor, block, room_id + neighbor)

func _record_adjacency(block: Vector2i, a_local: Vector2i, b_local: Vector2i, a_region: int, b_region: int, adjacency: Dictionary, candidates: Dictionary) -> void:
	if a_region == b_region:
		return
	var key: String = _pair_key(a_region, b_region)
	if not candidates.has(key):
		candidates[key] = []
	var origin := Vector2i(block.x * BLOCK_CELLS, block.y * BLOCK_CELLS)
	(candidates[key] as Array).append([origin + a_local, origin + b_local])
	if a_region > 0:
		_add_unique_neighbor(adjacency, a_region, b_region)
	if b_region > 0:
		_add_unique_neighbor(adjacency, b_region, a_region)

func _add_unique_neighbor(adjacency: Dictionary, room_id: int, neighbor: int) -> void:
	var list: Array = adjacency.get(room_id, []) as Array
	if not list.has(neighbor):
		list.append(neighbor)
	adjacency[room_id] = list

func _pair_has_candidates(candidates: Dictionary, a: int, b: int) -> bool:
	var key := _pair_key(a, b)
	return candidates.has(key) and not (candidates[key] as Array).is_empty()

func _add_candidate_door(candidates: Dictionary, doors: Dictionary, a: int, b: int, block: Vector2i, salt: int) -> void:
	var key := _pair_key(a, b)
	if not candidates.has(key):
		return
	var options: Array = candidates[key] as Array
	if options.is_empty():
		return
	var choice: int = _hash(block.x + a * 11, block.y + b * 13, 2003 + salt) % options.size()
	var edge: Array = options[choice] as Array
	doors[_edge_key(edge[0] as Vector2i, edge[1] as Vector2i)] = true

func _pair_key(a: int, b: int) -> String:
	return "%d:%d" % [mini(a, b), maxi(a, b)]

func _edge_key(a: Vector2i, b: Vector2i) -> String:
	if a.x < b.x or (a.x == b.x and a.y <= b.y):
		return "%d,%d|%d,%d" % [a.x, a.y, b.x, b.y]
	return "%d,%d|%d,%d" % [b.x, b.y, a.x, a.y]

func _block_for_cell(cell: Vector2i) -> Vector2i:
	return Vector2i(
		floori(float(cell.x) / float(BLOCK_CELLS)),
		floori(float(cell.y) / float(BLOCK_CELLS))
	)

func _local_cell(cell: Vector2i, block: Vector2i) -> Vector2i:
	return cell - Vector2i(block.x * BLOCK_CELLS, block.y * BLOCK_CELLS)

func _vertical_gate(left_block: Vector2i) -> int:
	return 2 + (_hash(left_block.x, left_block.y, 2101) % (BLOCK_CELLS - 4))

func _horizontal_gate(top_block: Vector2i) -> int:
	return 2 + (_hash(top_block.x, top_block.y, 2111) % (BLOCK_CELLS - 4))

func _index(x: int, z: int) -> int:
	return z * BLOCK_CELLS + x

func _hash(x: int, z: int, salt: int) -> int:
	var n: int = x * 374761393 + z * 668265263 + WORLD_SEED + salt * 1442695041
	n = (n ^ (n >> 13)) * 1274126177
	n = n ^ (n >> 16)
	return absi(n)
