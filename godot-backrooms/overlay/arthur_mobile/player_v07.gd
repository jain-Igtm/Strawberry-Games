extends "res://arthur_mobile/player.gd"

const PsychicIlluminationScene: PackedScene = preload("res://arthur_mobile/psychic_illumination.tscn")

@export var psychic_grab_distance := 7.0
@export var psychic_hold_distance := 3.2
@export var psychic_throw_impulse := 12.5

var illumination: Node3D
var held_prop: RigidBody3D

func _ready() -> void:
	super._ready()
	illumination = PsychicIlluminationScene.instantiate() as Node3D
	add_child(illumination)

func toggle_psychic_light() -> bool:
	if illumination == null:
		return false
	return bool(illumination.call("toggle"))

func is_psychic_light_enabled() -> bool:
	return illumination != null and bool(illumination.call("is_enabled"))

func toggle_psychic_scout() -> bool:
	if illumination == null:
		return false
	return bool(illumination.call("toggle_scout"))

func is_psychic_scout_far() -> bool:
	return illumination != null and bool(illumination.call("is_scout_far"))

func psychic_interact() -> void:
	if held_prop != null and is_instance_valid(held_prop):
		_throw_held_prop()
		return
	_try_grab_prop()

func has_psychic_hold() -> bool:
	return held_prop != null and is_instance_valid(held_prop)

func _try_grab_prop() -> void:
	var from: Vector3 = camera.global_position
	var to: Vector3 = from + (-camera.global_transform.basis.z).normalized() * psychic_grab_distance
	var query := PhysicsRayQueryParameters3D.create(from, to)
	query.exclude = [get_rid()]
	query.collision_mask = 3
	var result: Dictionary = get_world_3d().direct_space_state.intersect_ray(query)
	if result.is_empty():
		return
	var collider: Object = result.get("collider") as Object
	if collider is RigidBody3D:
		var body := collider as RigidBody3D
		if body.is_in_group("psychic_prop"):
			held_prop = body
			held_prop.freeze = true
			held_prop.gravity_scale = 0.0
			held_prop.linear_velocity = Vector3.ZERO
			held_prop.angular_velocity = Vector3.ZERO
			held_prop.collision_layer = 0
			held_prop.collision_mask = 0

func _throw_held_prop() -> void:
	if held_prop == null or not is_instance_valid(held_prop):
		held_prop = null
		return
	var body := held_prop
	held_prop = null
	body.collision_layer = 3
	body.collision_mask = 3
	body.gravity_scale = 1.0
	body.freeze = false
	body.sleeping = false
	var direction: Vector3 = (-camera.global_transform.basis.z).normalized()
	body.apply_central_impulse(direction * psychic_throw_impulse * maxf(0.75, body.mass))

func _update_held_prop(delta: float) -> void:
	if held_prop == null:
		return
	if not is_instance_valid(held_prop):
		held_prop = null
		return
	var target: Vector3 = camera.global_position + (-camera.global_transform.basis.z).normalized() * psychic_hold_distance
	target.y -= 0.18
	held_prop.global_position = held_prop.global_position.lerp(target, clampf(delta * 11.0, 0.0, 1.0))
	held_prop.linear_velocity = Vector3.ZERO
	held_prop.angular_velocity = Vector3.ZERO

func _physics_process(delta: float) -> void:
	super._physics_process(delta)
	_update_held_prop(delta)

func _unhandled_input(event: InputEvent) -> void:
	super._unhandled_input(event)
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_F:
			toggle_psychic_light()
		elif event.keycode == KEY_G:
			toggle_psychic_scout()
		elif event.keycode == KEY_E:
			psychic_interact()
