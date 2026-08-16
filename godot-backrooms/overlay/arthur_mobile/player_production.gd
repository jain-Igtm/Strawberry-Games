extends "res://arthur_mobile/player_v09.gd"

@export var driveable_interact_radius := 2.8

var current_vehicle: CharacterBody3D
var saved_collision_layer := 1
var saved_collision_mask := 3
var interaction_label: Label

func _ready() -> void:
	super._ready()
	interaction_label = get_node_or_null("../UI/Overlay/Interaction") as Label

func _process(_delta: float) -> void:
	if current_vehicle != null and not is_instance_valid(current_vehicle):
		_restore_from_missing_vehicle()

	if current_vehicle != null and not OS.has_feature("mobile"):
		current_vehicle.call("set_drive_input", _desktop_move())

	_update_interaction_hint()

func set_mobile_move(value: Vector2) -> void:
	if current_vehicle != null and is_instance_valid(current_vehicle):
		mobile_move = Vector2.ZERO
		current_vehicle.call("set_drive_input", value.limit_length(1.0))
		return
	super.set_mobile_move(value)

func psychic_interact() -> void:
	if current_vehicle != null and is_instance_valid(current_vehicle):
		_exit_vehicle()
		return

	var nearby := _nearest_driveable()
	if nearby != null:
		_enter_vehicle(nearby)
		return

	super.psychic_interact()

func is_driving() -> bool:
	return current_vehicle != null and is_instance_valid(current_vehicle)

func has_nearby_driveable() -> bool:
	return _nearest_driveable() != null

func _nearest_driveable() -> CharacterBody3D:
	var best: CharacterBody3D
	var best_distance := driveable_interact_radius
	for node in get_tree().get_nodes_in_group("driveable"):
		if not (node is CharacterBody3D):
			continue
		var candidate := node as CharacterBody3D
		if not is_instance_valid(candidate):
			continue
		if candidate.has_method("has_driver") and bool(candidate.call("has_driver")):
			continue
		var distance := global_position.distance_to(candidate.global_position)
		if distance < best_distance:
			best_distance = distance
			best = candidate
	return best

func _enter_vehicle(vehicle: CharacterBody3D) -> void:
	if current_vehicle != null:
		return
	current_vehicle = vehicle
	saved_collision_layer = collision_layer
	saved_collision_mask = collision_mask
	collision_layer = 0
	collision_mask = 0
	velocity = Vector3.ZERO
	mobile_move = Vector2.ZERO
	set_psychic_levitation(false)
	set_water_swimming(false)
	underwater = false
	if psychic_bubble != null:
		psychic_bubble.call("set_active", false)
	if psychic_field_active:
		end_psychic_field()
	if held_prop != null and is_instance_valid(held_prop):
		_throw_held_prop()
	vehicle.call("set_driver", self)
	set_physics_process(false)
	global_position = vehicle.call("seat_position") as Vector3

func _exit_vehicle() -> void:
	if current_vehicle == null or not is_instance_valid(current_vehicle):
		_restore_from_missing_vehicle()
		return
	var vehicle := current_vehicle
	current_vehicle = null
	vehicle.call("set_drive_input", Vector2.ZERO)
	var exit_pos := vehicle.call("exit_position") as Vector3
	vehicle.call("clear_driver")
	collision_layer = saved_collision_layer
	collision_mask = saved_collision_mask
	global_position = exit_pos
	velocity = Vector3.ZERO
	set_physics_process(true)
	_update_water_state()

func _restore_from_missing_vehicle() -> void:
	current_vehicle = null
	collision_layer = saved_collision_layer
	collision_mask = saved_collision_mask
	velocity = Vector3.ZERO
	set_physics_process(true)

func _update_interaction_hint() -> void:
	if interaction_label == null:
		return
	if current_vehicle != null and is_instance_valid(current_vehicle):
		interaction_label.visible = true
		interaction_label.text = "TK TAP  //  EXIT CART"
		return
	var nearby := _nearest_driveable()
	if nearby != null:
		interaction_label.visible = true
		interaction_label.text = "TK TAP  //  DRIVE MAINTENANCE CART"
	else:
		interaction_label.visible = false
