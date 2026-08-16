extends Node3D

@onready var orb_a: Node3D = $OrbA
@onready var orb_b: Node3D = $OrbB
@onready var orb_c: Node3D = $OrbC

var anchor: Node3D
var active := false
var phase := 0.0
var scout_far := false
var _follow_position := Vector3.ZERO

@export var near_distance := 3.4
@export var far_distance := 11.5
@export var wall_clearance := 0.75

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
		_follow_position = anchor.global_position
		global_position = _follow_position

func toggle() -> bool:
	set_enabled(not active)
	return active

func is_enabled() -> bool:
	return active

func toggle_scout() -> bool:
	scout_far = not scout_far
	if not active:
		set_enabled(true)
	return scout_far

func is_scout_far() -> bool:
	return scout_far

func _process(delta: float) -> void:
	if anchor == null or not is_instance_valid(anchor):
		return
	phase += delta

	var forward := -anchor.global_transform.basis.z
	forward.y = 0.0
	if forward.length_squared() < 0.001:
		forward = Vector3.FORWARD
	else:
		forward = forward.normalized()

	var desired_distance := far_distance if scout_far else near_distance
	var actual_distance := _clear_distance(forward, desired_distance)
	var target := anchor.global_position + forward * actual_distance
	var responsiveness := 8.0 if scout_far else 10.5
	var alpha := 1.0 - exp(-responsiveness * delta)
	_follow_position = _follow_position.lerp(target, alpha)
	global_position = _follow_position

	var orbit_scale := 0.72 if scout_far else 1.0
	orb_a.position = Vector3(
		cos(phase * 0.62) * 1.45 * orbit_scale,
		1.72 + sin(phase * 1.31) * 0.18,
		sin(phase * 0.62) * 1.45 * orbit_scale
	)
	orb_b.position = Vector3(
		cos(phase * 0.54 + 2.1) * 1.22 * orbit_scale,
		2.18 + sin(phase * 1.07 + 1.4) * 0.21,
		sin(phase * 0.54 + 2.1) * 1.22 * orbit_scale
	)
	orb_c.position = Vector3(
		cos(phase * 0.47 + 4.15) * 1.7 * orbit_scale,
		1.38 + sin(phase * 0.91 + 3.2) * 0.16,
		sin(phase * 0.47 + 4.15) * 1.7 * orbit_scale
	)

func _clear_distance(forward: Vector3, desired_distance: float) -> float:
	if anchor == null or not anchor.is_inside_tree():
		return desired_distance
	var origin := anchor.global_position + Vector3.UP * 1.55
	var target := origin + forward * desired_distance
	var query := PhysicsRayQueryParameters3D.create(origin, target)
	if anchor is CollisionObject3D:
		query.exclude = [(anchor as CollisionObject3D).get_rid()]
	query.collision_mask = 3
	query.collide_with_areas = false
	var result := anchor.get_world_3d().direct_space_state.intersect_ray(query)
	if result.is_empty():
		return desired_distance
	var hit_position: Vector3 = result.get("position", target)
	return maxf(0.8, origin.distance_to(hit_position) - wall_clearance)
