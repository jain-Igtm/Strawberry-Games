extends "res://arthur_mobile/world_v13.gd"

const PoolComplexV13FinalScript = preload("res://arthur_mobile/pool_complex_v13_stairfix.gd")

func _add_pool_content(root: Node3D, cell: Vector2i, sample: Dictionary) -> void:
	var local_x: int = _positive_mod(cell.x, ROOM_SIZE)
	var local_z: int = _positive_mod(cell.y, ROOM_SIZE)
	if local_x != 0 or local_z != 0:
		return
	var room: Vector2i = _room_for_cell(cell)
	var feature: Node3D = PoolComplexV13FinalScript.new() as Node3D
	feature.position = _macro_room_center()
	root.add_child(feature)
	feature.call("configure", _hash(room.x, room.y, 6501), _pool_variant(room))
	_add_large_transition_detail(root, sample, _macro_room_center())

func _headless_pool_smoke() -> void:
	# Execute every pool plan, including the slide-hall access stair and the smooth
	# ride trough, before Android export.
	for variant in range(6):
		var probe: Node3D = PoolComplexV13FinalScript.new() as Node3D
		probe.position = Vector3(float(variant) * 44.0, 40.0, 0.0)
		tiles.add_child(probe)
		probe.call("configure", 0x7130 + variant * 101, variant)
		probe.queue_free()

	# Execute both orientations of the inter-floor stair builder too. This catches
	# rail, soffit, landing, collision, and opening-trim errors in CI instead of on phone.
	var stair_x := Node3D.new()
	stair_x.position = Vector3(0.0, 40.0, 60.0)
	tiles.add_child(stair_x)
	_build_stair_run(stair_x, Vector2i(1, 0))
	stair_x.queue_free()

	var stair_z := Node3D.new()
	stair_z.position = Vector3(20.0, 40.0, 60.0)
	tiles.add_child(stair_z)
	_build_stair_run(stair_z, Vector2i(0, 1))
	stair_z.queue_free()
