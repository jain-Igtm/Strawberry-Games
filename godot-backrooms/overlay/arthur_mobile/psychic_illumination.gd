extends Node3D

@onready var orb_a: Node3D = $OrbA
@onready var orb_b: Node3D = $OrbB
@onready var orb_c: Node3D = $OrbC

var anchor: Node3D
var camera: Camera3D
var active := false
var scouting := false
var phase := 0.0
var formation_radius := 1.45
var visual_anchor := Vector3.ZERO

const MIN_RADIUS := 0.16
const MAX_RADIUS := 5.6
const COMBINE_RADIUS := 0.42
const SCOUT_DISTANCE := 7.2

func _ready() -> void:
	anchor = get_parent() as Node3D
	if anchor != null:
		camera = anchor.get_node_or_null("CameraPivot/Camera3D") as Camera3D
		visual_anchor = anchor.global_position
	top_level = true
	visible = false
	set_process(false)

func set_enabled(value: bool) -> void:
	active = value
	visible = value
	set_process(value)
	if value and anchor != null:
		visual_anchor = anchor.global_position
		global_position = visual_anchor
	if not value:
		scouting = false

func toggle() -> bool:
	set_enabled(not active)
	return active

func is_enabled() -> bool:
	return active

func toggle_scout() -> bool:
	if not active:
		set_enabled(true)
	scouting = not scouting
	return scouting

func is_scouting() -> bool:
	return scouting

func adjust_radius(amount: float) -> float:
	if not active:
		set_enabled(true)
	scouting = false
	formation_radius = clampf(formation_radius + amount, MIN_RADIUS, MAX_RADIUS)
	return formation_radius

func is_combined() -> bool:
	return formation_radius <= COMBINE_RADIUS

func get_formation_radius() -> float:
	return formation_radius

func _process(delta: float) -> void:
	if anchor == null or not is_instance_valid(anchor):
		return
	if camera == null or not is_instance_valid(camera):
		camera = anchor.get_node_or_null("CameraPivot/Camera3D") as Camera3D

	phase += delta
	var target_anchor: Vector3 = anchor.global_position
	if scouting and camera != null:
		var look: Vector3 = (-camera.global_transform.basis.z).normalized()
		target_anchor += look * SCOUT_DISTANCE
	visual_anchor = visual_anchor.lerp(target_anchor, clampf(delta * 5.4, 0.0, 1.0))
	global_position = visual_anchor

	if is_combined():
		_update_combined()
	else:
		_update_separate()

func _update_separate() -> void:
	orb_a.visible = true
	orb_b.visible = true
	orb_c.visible = true
	orb_a.scale = Vector3.ONE
	orb_b.scale = Vector3.ONE
	orb_c.scale = Vector3.ONE
	_restore_light(orb_a, 1.45, 9.5)
	_restore_light(orb_b, 1.2, 8.5)
	_restore_light(orb_c, 1.15, 8.0)

	var r := formation_radius
	orb_a.position = Vector3(
		cos(phase * 0.62) * r,
		1.72 + sin(phase * 1.31) * 0.18,
		sin(phase * 0.62) * r
	)
	orb_b.position = Vector3(
		cos(phase * 0.54 + 2.1) * r * 0.84,
		2.18 + sin(phase * 1.07 + 1.4) * 0.21,
		sin(phase * 0.54 + 2.1) * r * 0.84
	)
	orb_c.position = Vector3(
		cos(phase * 0.47 + 4.15) * r * 1.17,
		1.38 + sin(phase * 0.91 + 3.2) * 0.16,
		sin(phase * 0.47 + 4.15) * r * 1.17
	)

func _update_combined() -> void:
	orb_a.visible = true
	orb_b.visible = false
	orb_c.visible = false
	var merge: float = 1.0 - clampf((formation_radius - MIN_RADIUS) / maxf(0.001, COMBINE_RADIUS - MIN_RADIUS), 0.0, 1.0)
	orb_a.scale = Vector3.ONE * lerpf(1.55, 2.45, merge)
	orb_a.position = Vector3(
		sin(phase * 0.55) * 0.16,
		1.83 + sin(phase * 0.88) * 0.13,
		cos(phase * 0.49) * 0.16
	)
	var light := orb_a.get_node_or_null("Light") as OmniLight3D
	if light != null:
		light.light_energy = lerpf(2.7, 4.2, merge)
		light.omni_range = lerpf(11.5, 14.0, merge)

func _restore_light(orb: Node3D, energy: float, light_range: float) -> void:
	var light := orb.get_node_or_null("Light") as OmniLight3D
	if light != null:
		light.light_energy = energy
		light.omni_range = light_range
