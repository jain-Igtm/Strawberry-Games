extends "res://arthur_mobile/yellow_decor_v07.gd"

func _spawn(root: Node3D, scene: PackedScene, position: Vector3, yaw: float, scale_factor: float, collision_size: Vector3) -> void:
	var body := RigidBody3D.new()
	body.position = position
	body.rotation.y = yaw
	body.scale = Vector3.ONE * scale_factor
	body.freeze = true
	body.freeze_mode = RigidBody3D.FREEZE_MODE_STATIC
	body.mass = _mass_for_size(collision_size)
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

func _spawn_small(root: Node3D, scene: PackedScene, position: Vector3, yaw: float, scale_factor: float) -> void:
	var size := _small_size_for(scene.resource_path)
	var body := RigidBody3D.new()
	body.position = position
	body.rotation.y = yaw
	body.scale = Vector3.ONE * scale_factor
	body.freeze = true
	body.freeze_mode = RigidBody3D.FREEZE_MODE_STATIC
	body.mass = _mass_for_size(size)
	body.collision_layer = 3
	body.collision_mask = 3
	body.add_to_group("psychic_prop")
	body.add_child(scene.instantiate())

	var shape_node := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	shape_node.shape = shape
	shape_node.position.y = size.y * 0.5
	body.add_child(shape_node)
	root.add_child(body)

func _small_size_for(path: String) -> Vector3:
	if path.contains("book"):
		return Vector3(0.7, 0.24, 0.52)
	if path.contains("lamp"):
		return Vector3(0.46, 0.82, 0.46)
	if path.contains("cactus"):
		return Vector3(0.58, 0.76, 0.58)
	return Vector3(0.52, 0.52, 0.52)

func _mass_for_size(size: Vector3) -> float:
	var volume: float = maxf(0.12, size.x * size.y * size.z)
	return clampf(volume * 0.85, 0.28, 10.0)
