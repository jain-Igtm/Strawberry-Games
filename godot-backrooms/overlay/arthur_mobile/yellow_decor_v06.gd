extends "res://arthur_mobile/yellow_decor.gd"

const PORTRAIT: PackedScene = preload("res://arthur_mobile/yellow_portrait.tscn")
const PORTRAIT_CELL := 4.0

func decorate_room(root: Node3D, info: Dictionary, transition_weight: float, secondary_biome: int) -> void:
	super.decorate_room(root, info, transition_weight, secondary_biome)
	if info.is_empty():
		return
	var width_cells: int = int(info.get("width", 1))
	var height_cells: int = int(info.get("height", 1))
	var area: int = width_cells * height_cells
	if area < 4:
		return

	var block: Vector2i = info["block"] as Vector2i
	var room_id: int = int(info["id"])
	var roll: int = _hash(block.x * 149 + room_id, block.y * 137 - room_id, 5601)
	var room_kind: String = room_name(info)
	var chance_gate: int = 5 if room_kind == "LOUNGE" or room_kind == "WAITING ROOM" else 4
	if roll % 10 >= chance_gate:
		return

	_add_portrait(root, info, roll, 0)
	if area >= 8 and roll % 13 == 0:
		_add_portrait(root, info, roll + 919, 1)

func _add_portrait(root: Node3D, info: Dictionary, seed: int, ordinal: int) -> void:
	var width_cells: int = int(info["width"])
	var height_cells: int = int(info["height"])
	var anchor: Vector2i = info["anchor"] as Vector2i
	var min_cell: Vector2i = info["min"] as Vector2i
	var max_cell: Vector2i = info["max"] as Vector2i
	var center_world := Vector2(
		(float(min_cell.x + max_cell.x) * 0.5) * PORTRAIT_CELL,
		(float(min_cell.y + max_cell.y) * 0.5) * PORTRAIT_CELL
	)
	var anchor_world := Vector2(float(anchor.x) * PORTRAIT_CELL, float(anchor.y) * PORTRAIT_CELL)
	var center := Vector3(center_world.x - anchor_world.x, 0.0, center_world.y - anchor_world.y)
	var half_x: float = float(width_cells) * PORTRAIT_CELL * 0.5
	var half_z: float = float(height_cells) * PORTRAIT_CELL * 0.5
	var wall: int = posmod(seed + ordinal * 3, 4)
	var offset: float = (float((seed >> 5) % 5) - 2.0) * 0.42

	var portrait: Node3D = PORTRAIT.instantiate() as Node3D
	if wall == 0:
		portrait.position = center + Vector3(clampf(offset, -maxf(0.0, half_x - 1.2), maxf(0.0, half_x - 1.2)), 0.0, -half_z + 0.28)
		portrait.rotation.y = 0.0
	elif wall == 1:
		portrait.position = center + Vector3(clampf(offset, -maxf(0.0, half_x - 1.2), maxf(0.0, half_x - 1.2)), 0.0, half_z - 0.28)
		portrait.rotation.y = PI
	elif wall == 2:
		portrait.position = center + Vector3(-half_x + 0.28, 0.0, clampf(offset, -maxf(0.0, half_z - 1.2), maxf(0.0, half_z - 1.2)))
		portrait.rotation.y = PI * 0.5
	else:
		portrait.position = center + Vector3(half_x - 0.28, 0.0, clampf(offset, -maxf(0.0, half_z - 1.2), maxf(0.0, half_z - 1.2)))
		portrait.rotation.y = -PI * 0.5
	portrait.call("configure", seed)
	root.add_child(portrait)
