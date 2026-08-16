extends "res://arthur_mobile/player_v07.gd"

@export var psychic_field_radius := 9.0
@export var psychic_field_min_rise := 1.15
@export var psychic_field_max_rise := 3.1

var psychic_field_active := false
var psychic_field_phase := 0.0
var psychic_field_bodies: Array[RigidBody3D] = []
var psychic_field_bases: Dictionary = {}

func lights_scout_toggle() -> bool:
	if illumination == null:
		return false
	return bool(illumination.call("toggle_scout"))

func lights_adjust_radius(amount: float) -> float:
	if illumination == null:
		return 0.0
	return float(illumination.call("adjust_radius", amount))

func is_psychic_scouting() -> bool:
	return illumination != null and bool(illumination.call("is_scouting"))

func is_psychic_light_combined() -> bool:
	return illumination != null and bool(illumination.call("is_combined"))

func begin_psychic_field() -> void:
	if psychic_field_active:
		return
	psychic_field_active = true
	psychic_field_phase = 0.0
	psychic_field_bodies.clear()
	psychic_field_bases.clear()

	if held_prop != null and is_instance_valid(held_prop):
		held_prop.collision_layer = 3
		held_prop.collision_mask = 3
		held_prop.gravity_scale = 0.0
		held_prop.freeze = true
		held_prop = null

	for node in get_tree().get_nodes_in_group("psychic_prop"):
		if not (node is RigidBody3D):
			continue
		var body := node as RigidBody3D
		if not is_instance_valid(body):
			continue
		if body.global_position.distance_to(global_position) > psychic_field_radius:
			continue
		psychic_field_bodies.append(body)
		psychic_field_bases[body.get_instance_id()] = body.global_position
		body.freeze = true
		body.gravity_scale = 0.0
		body.sleeping = false
		body.linear_velocity = Vector3.ZERO
		body.angular_velocity = Vector3.ZERO
		body.collision_layer = 3
		body.collision_mask = 3

func end_psychic_field() -> void:
	if not psychic_field_active:
		return
	psychic_field_active = false
	for body in psychic_field_bodies:
		if not is_instance_valid(body):
			continue
		var seed: float = float(posmod(body.get_instance_id(), 997)) / 997.0
		body.gravity_scale = 1.0
		body.freeze = false
		body.sleeping = false
		body.linear_velocity = Vector3.ZERO
		body.angular_velocity = Vector3(
			(seed - 0.5) * 0.7,
			(0.5 - seed) * 0.55,
			(seed * 2.0 - 1.0) * 0.62
		)
	psychic_field_bodies.clear()
	psychic_field_bases.clear()

func is_psychic_field_active() -> bool:
	return psychic_field_active

func _update_psychic_field(delta: float) -> void:
	if not psychic_field_active:
		return
	psychic_field_phase += delta
	var survivors: Array[RigidBody3D] = []
	for body in psychic_field_bodies:
		if not is_instance_valid(body):
			continue
		var id := body.get_instance_id()
		if not psychic_field_bases.has(id):
			continue
		var base: Vector3 = psychic_field_bases[id] as Vector3
		var seed: float = float(posmod(id, 997)) / 997.0
		var rise: float = lerpf(psychic_field_min_rise, psychic_field_max_rise, seed)
		var phase_offset: float = seed * TAU * 2.0
		var target := base + Vector3(
			sin(psychic_field_phase * 0.72 + phase_offset) * 0.24,
			rise + sin(psychic_field_phase * 1.13 + phase_offset) * 0.14,
			cos(psychic_field_phase * 0.64 + phase_offset) * 0.24
		)
		body.global_position = body.global_position.lerp(target, clampf(delta * 4.6, 0.0, 1.0))
		body.rotation.x += delta * (0.08 + seed * 0.18)
		body.rotation.y += delta * (0.11 + (1.0 - seed) * 0.16)
		body.rotation.z += delta * (0.05 + seed * 0.12)
		body.linear_velocity = Vector3.ZERO
		body.angular_velocity = Vector3.ZERO
		survivors.append(body)
	psychic_field_bodies = survivors

func _physics_process(delta: float) -> void:
	super._physics_process(delta)
	_update_psychic_field(delta)
