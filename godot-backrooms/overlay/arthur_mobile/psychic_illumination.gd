extends Node3D

@onready var orb_a: Node3D = $OrbA
@onready var orb_b: Node3D = $OrbB
@onready var orb_c: Node3D = $OrbC

var anchor: Node3D
var active := false
var phase := 0.0

func _ready() -> void:
	anchor = get_parent() as Node3D
	top_level = true
	visible = false
	set_process(false)

func set_enabled(value: bool) -> void:
	active = value
	visible = value
	set_process(value)
	if value and anchor != null:
		global_position = anchor.global_position

func toggle() -> bool:
	set_enabled(not active)
	return active

func is_enabled() -> bool:
	return active

func _process(delta: float) -> void:
	if anchor == null or not is_instance_valid(anchor):
		return
	phase += delta
	global_position = anchor.global_position
	orb_a.position = Vector3(
		cos(phase * 0.62) * 1.45,
		1.72 + sin(phase * 1.31) * 0.18,
		sin(phase * 0.62) * 1.45
	)
	orb_b.position = Vector3(
		cos(phase * 0.54 + 2.1) * 1.22,
		2.18 + sin(phase * 1.07 + 1.4) * 0.21,
		sin(phase * 0.54 + 2.1) * 1.22
	)
	orb_c.position = Vector3(
		cos(phase * 0.47 + 4.15) * 1.7,
		1.38 + sin(phase * 0.91 + 3.2) * 0.16,
		sin(phase * 0.47 + 4.15) * 1.7
	)
