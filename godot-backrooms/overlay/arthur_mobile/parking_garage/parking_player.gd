extends "res://arthur_mobile/player_v09.gd"

@export var vehicle_search_radius: float = 3.4

var active_vehicle: RigidBody3D
var vehicle_touch_input: Vector2 = Vector2.ZERO
var saved_collision_layer: int = 1
var saved_collision_mask: int = 3

func set_mobile_move(value: Vector2) -> void:
	if is_in_vehicle():
		vehicle_touch_input = value.limit_length(1.0)
	else:
		vehicle_touch_input = Vector2.ZERO
		super.set_mobile_move(value)

func is_in_vehicle() -> bool:
	return active_vehicle != null and is_instance_valid(active_vehicle)

func is_hidden_in_vehicle() -> bool:
	return is_in_vehicle()

func get_hiding_vehicle() -> Node3D:
	return active_vehicle

func has_enterable_vehicle_nearby() -> bool:
	return _nearest_enterable_vehicle() != null

func toggle_vehicle() -> bool:
	if is_in_vehicle():
		_exit_vehicle()
		return false
	var candidate: RigidBody3D = _nearest_enterable_vehicle()
	if candidate == null:
		return false
	_enter_vehicle(candidate)
	return true

func toggle_vehicle_headlights() -> bool:
	if not is_in_vehicle() or not active_vehicle.has_method("toggle_headlights"):
		return false
	return bool(active_vehicle.call("toggle_headlights"))

func _nearest_enterable_vehicle() -> RigidBody3D:
	var nearest: RigidBody3D = null
	var nearest_distance: float = vehicle_search_radius
	for node: Node in get_tree().get_nodes_in_group("enterable_car"):
		if not (node is RigidBody3D):
			continue
		var car: RigidBody3D = node as RigidBody3D
		if car.has_method("has_driver") and bool(car.call("has_driver")):
			continue
		var distance: float = global_position.distance_to(car.global_position)
		if distance <= nearest_distance:
			nearest = car
			nearest_distance = distance
	return nearest

func _enter_vehicle(car: RigidBody3D) -> void:
	if car == null or not is_instance_valid(car):
		return
	if psychic_field_active:
		end_psychic_field()
	if has_psychic_hold():
		psychic_interact()
	set_psychic_levitation(false)
	set_water_swimming(false)
	underwater = false
	if psychic_bubble != null:
		psychic_bubble.call("set_active", false)

	active_vehicle = car
	vehicle_touch_input = Vector2.ZERO
	saved_collision_layer = collision_layer
	saved_collision_mask = collision_mask
	collision_layer = 0
	collision_mask = 0
	velocity = Vector3.ZERO
	mobile_move = Vector2.ZERO
	active_vehicle.call("set_driver", self)
	_sync_to_vehicle()

func _exit_vehicle() -> void:
	if not is_in_vehicle():
		active_vehicle = null
		return
	var car: RigidBody3D = active_vehicle
	car.call("set_drive_input", Vector2.ZERO)
	var exit_position: Vector3 = car.call("get_exit_position") as Vector3
	car.call("set_driver", null)
	active_vehicle = null
	vehicle_touch_input = Vector2.ZERO
	collision_layer = saved_collision_layer
	collision_mask = saved_collision_mask
	global_position = exit_position
	velocity = Vector3.ZERO

func _sync_to_vehicle() -> void:
	if not is_in_vehicle():
		return
	var seat_position: Vector3 = active_vehicle.call("get_seat_position") as Vector3
	global_position = seat_position
	rotation.y = active_vehicle.global_rotation.y

func _physics_process(delta: float) -> void:
	if is_in_vehicle():
		if is_self_levitating():
			set_psychic_levitation(false)
		var drive: Vector2 = (_desktop_move() + vehicle_touch_input).limit_length(1.0)
		active_vehicle.call("set_drive_input", drive)
		_sync_to_vehicle()
		velocity = Vector3.ZERO
		return
	super._physics_process(delta)

func _unhandled_input(event: InputEvent) -> void:
	super._unhandled_input(event)
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_G:
			toggle_vehicle()
		elif event.keycode == KEY_H and is_in_vehicle():
			toggle_vehicle_headlights()