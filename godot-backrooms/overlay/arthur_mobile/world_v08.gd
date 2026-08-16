extends "res://arthur_mobile/world_v07.gd"

const YellowDecorV08Script = preload("res://arthur_mobile/yellow_decor_v08.gd")

func _ready() -> void:
	super._ready()
	yellow_decor = YellowDecorV08Script.new()

func _add_crt(root: Node3D, position: Vector3, quarter_turns: int) -> void:
	var body := RigidBody3D.new()
	body.position = position
	body.rotation.y = float(quarter_turns % 4) * PI * 0.5
	body.scale = Vector3.ONE * 1.08
	body.freeze = true
	body.freeze_mode = RigidBody3D.FREEZE_MODE_STATIC
	body.mass = 4.2
	body.collision_layer = 3
	body.collision_mask = 3
	body.add_to_group("psychic_prop")
	body.add_child(CRT.instantiate())

	var shape_node := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(1.05, 0.92, 0.82)
	shape_node.shape = shape
	shape_node.position.y = 0.46
	body.add_child(shape_node)
	root.add_child(body)
