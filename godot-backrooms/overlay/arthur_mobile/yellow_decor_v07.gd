extends "res://arthur_mobile/yellow_decor_v06.gd"

const YellowPlanScript = preload("res://arthur_mobile/yellow_plan.gd")
const PORTRAIT_V07: PackedScene = preload("res://arthur_mobile/yellow_portrait.tscn")
const EDGE_SOLID_V07 := 2

var portrait_plan: RefCounted = YellowPlanScript.new()

func _add_portrait(root: Node3D, info: Dictionary, seed: int, ordinal: int) -> void:
	var anchor: Vector2i = info["anchor"] as Vector2i
	var min_cell: Vector2i = info["min"] as Vector2i
	var max_cell: Vector2i = info["max"] as Vector2i
	var candidates: Array = []

	for x in range(min_cell.x, max_cell.x + 1):
		var north := Vector2i(x, min_cell.y)
		if int(portrait_plan.call("edge_kind", north, north + Vector2i(0, -1))) == EDGE_SOLID_V07:
			candidates.append([north, 0])
		var south := Vector2i(x, max_cell.y)
		if int(portrait_plan.call("edge_kind", south, south + Vector2i(0, 1))) == EDGE_SOLID_V07:
			candidates.append([south, 1])

	for z in range(min_cell.y, max_cell.y + 1):
		var west := Vector2i(min_cell.x, z)
		if int(portrait_plan.call("edge_kind", west, west + Vector2i(-1, 0))) == EDGE_SOLID_V07:
			candidates.append([west, 2])
		var east := Vector2i(max_cell.x, z)
		if int(portrait_plan.call("edge_kind", east, east + Vector2i(1, 0))) == EDGE_SOLID_V07:
			candidates.append([east, 3])

	if candidates.is_empty():
		return

	var pick: int = posmod(seed + ordinal * 17, candidates.size())
	var chosen: Array = candidates[pick] as Array
	var cell: Vector2i = chosen[0] as Vector2i
	var side: int = int(chosen[1])
	var relative := Vector3(
		float(cell.x - anchor.x) * PORTRAIT_CELL,
		0.0,
		float(cell.y - anchor.y) * PORTRAIT_CELL
	)

	var portrait: Node3D = PORTRAIT_V07.instantiate() as Node3D
	if side == 0:
		portrait.position = relative + Vector3(0.0, 0.0, -PORTRAIT_CELL * 0.5 + 0.29)
		portrait.rotation.y = 0.0
	elif side == 1:
		portrait.position = relative + Vector3(0.0, 0.0, PORTRAIT_CELL * 0.5 - 0.29)
		portrait.rotation.y = PI
	elif side == 2:
		portrait.position = relative + Vector3(-PORTRAIT_CELL * 0.5 + 0.29, 0.0, 0.0)
		portrait.rotation.y = PI * 0.5
	else:
		portrait.position = relative + Vector3(PORTRAIT_CELL * 0.5 - 0.29, 0.0, 0.0)
		portrait.rotation.y = -PI * 0.5
	portrait.call("configure", seed)
	root.add_child(portrait)

func _spawn(root: Node3D, scene: PackedScene, position: Vector3, yaw: float, scale_factor: float, collision_size: Vector3) -> void:
	var path: String = scene.resource_path
	var movable: bool = (
		path.contains("chair_A.gltf")
		or path.contains("chair_B.gltf")
		or path.contains("armchair.gltf")
		or path.contains("table_low.gltf")
	)
	if not movable:
		super._spawn(root, scene, position, yaw, scale_factor, collision_size)
		return

	var body := RigidBody3D.new()
	body.position = position
	body.rotation.y = yaw
	body.scale = Vector3.ONE * scale_factor
	body.freeze = true
	body.freeze_mode = RigidBody3D.FREEZE_MODE_STATIC
	body.mass = 1.6
	body.collision_layer = 3
	body.collision_mask = 3
	body.add_to_group("psychic_prop")
	body.add_child(scene.instantiate())

	if collision_size.length_squared() > 0.001:
		var shape_node := CollisionShape3D.new()
		var shape := BoxShape3D.new()
		shape.size = collision_size
		shape_node.shape = shape
		shape_node.position.y = collision_size.y * 0.5
		body.add_child(shape_node)

	root.add_child(body)
