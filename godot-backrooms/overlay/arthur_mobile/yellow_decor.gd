class_name YellowDecor
extends RefCounted

const CELL := 4.0
const WORLD_SEED := 0x41A7F29D

const CHAIR_A: PackedScene = preload("res://arthur_assets/kaykit/gltf/chair_A.gltf")
const CHAIR_B: PackedScene = preload("res://arthur_assets/kaykit/gltf/chair_B.gltf")
const ARMCHAIR: PackedScene = preload("res://arthur_assets/kaykit/gltf/armchair.gltf")
const COUCH: PackedScene = preload("res://arthur_assets/kaykit/gltf/couch.gltf")
const TABLE_MEDIUM: PackedScene = preload("res://arthur_assets/kaykit/gltf/table_medium.gltf")
const TABLE_LONG: PackedScene = preload("res://arthur_assets/kaykit/gltf/table_medium_long.gltf")
const TABLE_LOW: PackedScene = preload("res://arthur_assets/kaykit/gltf/table_low.gltf")
const CABINET: PackedScene = preload("res://arthur_assets/kaykit/gltf/cabinet_medium_decorated.gltf")
const SHELF_LARGE: PackedScene = preload("res://arthur_assets/kaykit/gltf/shelf_B_large_decorated.gltf")
const SHELF_SMALL: PackedScene = preload("res://arthur_assets/kaykit/gltf/shelf_A_small.gltf")
const LAMP_TABLE: PackedScene = preload("res://arthur_assets/kaykit/gltf/lamp_table.gltf")
const BOOKS: PackedScene = preload("res://arthur_assets/kaykit/gltf/book_set.gltf")
const CACTUS: PackedScene = preload("res://arthur_assets/kaykit/gltf/cactus_medium_A.gltf")

func decorate_room(root: Node3D, info: Dictionary, transition_weight: float, secondary_biome: int) -> void:
	if info.is_empty():
		return
	var block: Vector2i = info["block"] as Vector2i
	var room_id: int = int(info["id"])
	var width_cells: int = int(info["width"])
	var height_cells: int = int(info["height"])
	var anchor: Vector2i = info["anchor"] as Vector2i
	var min_cell: Vector2i = info["min"] as Vector2i
	var max_cell: Vector2i = info["max"] as Vector2i
	var center_world := Vector2(
		(float(min_cell.x + max_cell.x) * 0.5) * CELL,
		(float(min_cell.y + max_cell.y) * 0.5) * CELL
	)
	var anchor_world := Vector2(float(anchor.x) * CELL, float(anchor.y) * CELL)
	var center := Vector3(center_world.x - anchor_world.x, 0.0, center_world.y - anchor_world.y)
	var half_x: float = maxf(1.45, float(width_cells) * CELL * 0.5 - 0.75)
	var half_z: float = maxf(1.45, float(height_cells) * CELL * 0.5 - 0.75)
	var roll: int = _hash(block.x * 101 + room_id, block.y * 97 - room_id, 3101)
	var area: int = width_cells * height_cells

	if area <= 2:
		_decorate_closet(root, center, half_x, half_z, roll)
		return

	var archetype: int = roll % 6
	if archetype == 0:
		_decorate_office(root, center, half_x, half_z, roll)
	elif archetype == 1:
		_decorate_waiting(root, center, half_x, half_z, roll)
	elif archetype == 2:
		_decorate_storage(root, center, half_x, half_z, roll)
	elif archetype == 3:
		_decorate_lounge(root, center, half_x, half_z, roll)
	elif archetype == 4:
		_decorate_archive(root, center, half_x, half_z, roll)
	else:
		_decorate_sparse(root, center, half_x, half_z, roll)

	if transition_weight > 0.16:
		_add_transition_hint(root, center, half_x, half_z, secondary_biome, roll)

func room_name(info: Dictionary) -> String:
	if info.is_empty():
		return "HALLWAY"
	var block: Vector2i = info["block"] as Vector2i
	var room_id: int = int(info["id"])
	var roll: int = _hash(block.x * 101 + room_id, block.y * 97 - room_id, 3101) % 6
	if roll == 0:
		return "OFFICE"
	if roll == 1:
		return "WAITING ROOM"
	if roll == 2:
		return "STORAGE ROOM"
	if roll == 3:
		return "LOUNGE"
	if roll == 4:
		return "ARCHIVE"
	return "EMPTY ROOM"

func decorate_corridor(root: Node3D, cell: Vector2i, corridor_width: int) -> void:
	var roll: int = _hash(cell.x, cell.y, 3301)
	if roll % 41 == 0:
		var side: float = -1.25 if ((roll >> 4) & 1) == 0 else 1.25
		_spawn(root, CHAIR_B, Vector3(side, 0.0, 0.5), float((roll >> 6) % 4) * PI * 0.5, 0.96, Vector3(0.72, 1.22, 0.72))
	elif corridor_width > 1 and roll % 53 == 0:
		_spawn(root, CABINET, Vector3(1.25, 0.0, 0.0), PI * 0.5, 0.86, Vector3(0.7, 1.75, 0.72))

func _decorate_closet(root: Node3D, center: Vector3, half_x: float, half_z: float, roll: int) -> void:
	if roll % 2 == 0:
		_spawn(root, CABINET, center + Vector3(_edge(half_x), 0.0, 0.0), PI * 0.5, 0.88, Vector3(0.72, 1.8, 0.72))
	else:
		_spawn(root, SHELF_SMALL, center + Vector3(0.0, 0.0, _edge(half_z)), 0.0, 0.9, Vector3(1.2, 1.6, 0.55))

func _decorate_office(root: Node3D, center: Vector3, half_x: float, half_z: float, roll: int) -> void:
	var yaw: float = 0.0 if half_x >= half_z else PI * 0.5
	_spawn(root, TABLE_LONG, center + Vector3(0.0, 0.0, -minf(1.0, half_z * 0.22)), yaw, 0.92, Vector3(2.2, 0.85, 0.9))
	_spawn(root, CHAIR_A, center + Vector3(-0.95, 0.0, 1.15), PI, 0.96, Vector3(0.72, 1.22, 0.72))
	if half_x > 3.3:
		_spawn(root, CHAIR_A, center + Vector3(0.95, 0.0, 1.15), PI, 0.96, Vector3(0.72, 1.22, 0.72))
	_spawn(root, CABINET, center + Vector3(_edge(half_x), 0.0, -minf(half_z * 0.45, 1.8)), PI * 0.5, 0.9, Vector3(0.72, 1.8, 0.72))
	_spawn_small(root, BOOKS, center + Vector3(0.25, 0.82, -0.45), yaw, 0.86)
	if roll % 3 == 0:
		_spawn_small(root, LAMP_TABLE, center + Vector3(-0.55, 0.82, -0.35), yaw, 0.88)

func _decorate_waiting(root: Node3D, center: Vector3, half_x: float, half_z: float, roll: int) -> void:
	var count: int = 2 if half_x < 4.0 else 3
	for i in range(count):
		var offset: float = (float(i) - float(count - 1) * 0.5) * 1.35
		_spawn(root, CHAIR_B, center + Vector3(offset, 0.0, -_inner_edge(half_z)), 0.0, 0.96, Vector3(0.72, 1.22, 0.72))
	_spawn(root, TABLE_LOW, center + Vector3(0.0, 0.0, minf(1.4, half_z * 0.30)), 0.0, 0.92, Vector3(1.45, 0.52, 0.9))
	if roll % 2 == 0:
		_spawn_small(root, CACTUS, center + Vector3(_inner_edge(half_x), 0.0, _inner_edge(half_z)), 0.0, 0.92)

func _decorate_storage(root: Node3D, center: Vector3, half_x: float, half_z: float, roll: int) -> void:
	_spawn(root, SHELF_LARGE, center + Vector3(0.0, 0.0, -_inner_edge(half_z)), 0.0, 0.9, Vector3(1.8, 1.85, 0.62))
	_spawn(root, CABINET, center + Vector3(_inner_edge(half_x), 0.0, minf(1.3, half_z * 0.3)), PI * 0.5, 0.88, Vector3(0.72, 1.8, 0.72))
	if half_x > 3.5:
		_spawn(root, SHELF_SMALL, center + Vector3(-_inner_edge(half_x), 0.0, minf(1.4, half_z * 0.25)), -PI * 0.5, 0.9, Vector3(1.2, 1.6, 0.55))
	if roll % 2 == 0:
		_spawn_small(root, BOOKS, center + Vector3(0.0, 0.12, 0.35), 0.25, 0.9)

func _decorate_lounge(root: Node3D, center: Vector3, half_x: float, half_z: float, roll: int) -> void:
	_spawn(root, COUCH, center + Vector3(0.0, 0.0, -_inner_edge(half_z)), 0.0, 0.92, Vector3(2.15, 1.05, 0.92))
	_spawn(root, ARMCHAIR, center + Vector3(-minf(half_x * 0.45, 2.0), 0.0, minf(half_z * 0.25, 1.25)), PI * 0.5, 0.92, Vector3(0.95, 1.25, 0.95))
	_spawn(root, TABLE_LOW, center + Vector3(0.45, 0.0, minf(half_z * 0.25, 1.25)), 0.0, 0.88, Vector3(1.45, 0.52, 0.9))
	if roll % 2 == 0:
		_spawn_small(root, CACTUS, center + Vector3(_inner_edge(half_x), 0.0, -_inner_edge(half_z)), 0.0, 0.95)

func _decorate_archive(root: Node3D, center: Vector3, half_x: float, half_z: float, roll: int) -> void:
	_spawn(root, SHELF_LARGE, center + Vector3(-_inner_edge(half_x), 0.0, 0.0), -PI * 0.5, 0.9, Vector3(1.8, 1.85, 0.62))
	_spawn(root, SHELF_LARGE, center + Vector3(_inner_edge(half_x), 0.0, 0.0), PI * 0.5, 0.9, Vector3(1.8, 1.85, 0.62))
	if half_z > 3.3:
		_spawn(root, TABLE_MEDIUM, center + Vector3(0.0, 0.0, minf(half_z * 0.35, 1.7)), 0.0, 0.9, Vector3(1.7, 0.82, 0.9))
		_spawn(root, CHAIR_A, center + Vector3(0.0, 0.0, minf(half_z * 0.35, 1.7) + 1.0), PI, 0.94, Vector3(0.72, 1.22, 0.72))
	if roll % 3 == 0:
		_spawn_small(root, BOOKS, center + Vector3(0.0, 0.12, -0.35), 0.0, 0.92)

func _decorate_sparse(root: Node3D, center: Vector3, half_x: float, half_z: float, roll: int) -> void:
	if roll % 2 == 0:
		_spawn(root, CHAIR_A, center + Vector3(-_inner_edge(half_x), 0.0, _inner_edge(half_z)), float(roll % 4) * PI * 0.5, 0.96, Vector3(0.72, 1.22, 0.72))
	if roll % 3 == 0:
		_spawn(root, CABINET, center + Vector3(_inner_edge(half_x), 0.0, -_inner_edge(half_z)), PI * 0.5, 0.88, Vector3(0.72, 1.8, 0.72))

func _add_transition_hint(root: Node3D, center: Vector3, half_x: float, half_z: float, secondary_biome: int, roll: int) -> void:
	if secondary_biome == 1:
		_spawn_small(root, CACTUS, center + Vector3(_inner_edge(half_x), 0.0, _inner_edge(half_z)), float(roll % 4) * PI * 0.5, 0.88)
	elif secondary_biome == 2:
		_spawn(root, CABINET, center + Vector3(_inner_edge(half_x), 0.0, _inner_edge(half_z)), PI * 0.5, 0.82, Vector3(0.68, 1.7, 0.68))

func _spawn(root: Node3D, scene: PackedScene, position: Vector3, yaw: float, scale_factor: float, collision_size: Vector3) -> void:
	var holder := Node3D.new()
	holder.position = position
	holder.rotation.y = yaw
	holder.scale = Vector3.ONE * scale_factor
	var model: Node = scene.instantiate()
	holder.add_child(model)
	if collision_size.length_squared() > 0.001:
		var body := StaticBody3D.new()
		body.collision_layer = 3
		body.collision_mask = 3
		var shape_node := CollisionShape3D.new()
		var shape := BoxShape3D.new()
		shape.size = collision_size
		shape_node.shape = shape
		shape_node.position.y = collision_size.y * 0.5
		body.add_child(shape_node)
		holder.add_child(body)
	root.add_child(holder)

func _spawn_small(root: Node3D, scene: PackedScene, position: Vector3, yaw: float, scale_factor: float) -> void:
	var holder := Node3D.new()
	holder.position = position
	holder.rotation.y = yaw
	holder.scale = Vector3.ONE * scale_factor
	holder.add_child(scene.instantiate())
	root.add_child(holder)

func _edge(value: float) -> float:
	return value - 0.55

func _inner_edge(value: float) -> float:
	return maxf(0.75, value - 0.8)

func _hash(x: int, z: int, salt: int) -> int:
	var n: int = x * 374761393 + z * 668265263 + WORLD_SEED + salt * 1442695041
	n = (n ^ (n >> 13)) * 1274126177
	n = n ^ (n >> 16)
	return absi(n)
