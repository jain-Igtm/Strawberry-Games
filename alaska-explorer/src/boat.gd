extends AnimatableBody3D

@export var forward_speed := 6.4
@export var reverse_speed := 2.4
@export var acceleration := 2.2
@export var deceleration := 3.0
@export var turn_rate_degrees := 24.0
@export var fuel_capacity := 100.0
@export var fuel_burn_per_second := 0.72

var pilot: CharacterBody3D
var world_controller: Node
var helm_seat: Marker3D
var helm_exit: Marker3D
var current_speed := 0.0
var moored := true
var throttle_input := 0.0
var steering_input := 0.0
var fuel := 68.0
var low_fuel_warning_given := false
var empty_warning_given := false

func _ready() -> void:
	add_to_group("boat")
	sync_to_physics = true
	process_physics_priority = -10
	world_controller = get_parent().get_parent()
	helm_seat = get_node_or_null("HelmSeat") as Marker3D
	helm_exit = get_node_or_null("HelmExit") as Marker3D

func _physics_process(delta: float) -> void:
	if pilot != null and not is_instance_valid(pilot):
		pilot = null

	var control := Vector2.ZERO
	if pilot != null and pilot.has_method("get_piloting_input"):
		control = pilot.call("get_piloting_input")

	throttle_input = clampf(-control.y, -1.0, 1.0)
	steering_input = clampf(control.x, -1.0, 1.0)
	if absf(throttle_input) < 0.08:
		throttle_input = 0.0
	if absf(steering_input) < 0.08:
		steering_input = 0.0
	if fuel <= 0.01 and absf(throttle_input) > 0.08:
		throttle_input = 0.0
		if not empty_warning_given and pilot != null and pilot.has_method("show_status_message"):
			pilot.call("show_status_message", "The Northstar's engine coughs dry. Find a river fuel dock.", 4.0)
		empty_warning_given = true

	if moored and absf(throttle_input) > 0.08:
		_cast_off()

	var target_speed := throttle_input * (forward_speed if throttle_input >= 0.0 else reverse_speed)
	var rate := acceleration if absf(target_speed) > absf(current_speed) else deceleration
	current_speed = move_toward(current_speed, target_speed, rate * delta)

	var next_transform := global_transform
	if absf(current_speed) > 0.10:
		var steering_strength := clampf(absf(current_speed) / forward_speed, 0.22, 1.0)
		var reverse_sign := 1.0 if current_speed >= 0.0 else -1.0
		var steering_delta := -steering_input * deg_to_rad(turn_rate_degrees) * steering_strength * reverse_sign * delta
		next_transform.basis = next_transform.basis.rotated(Vector3.UP, steering_delta).orthonormalized()

	if absf(current_speed) > 0.01:
		var forward := -next_transform.basis.z.normalized()
		var proposed := next_transform.origin + forward * current_speed * delta
		if world_controller != null and world_controller.has_method("constrain_boat_position"):
			proposed = world_controller.call("constrain_boat_position", proposed)
		next_transform.origin = proposed
		global_transform = next_transform
		_consume_fuel(delta)

func begin_piloting(next_pilot: CharacterBody3D) -> void:
	if pilot != null or next_pilot == null or helm_seat == null:
		return
	pilot = next_pilot
	if pilot.has_method("begin_boat_piloting"):
		pilot.call("begin_boat_piloting", self, helm_seat, helm_exit)

func _cast_off() -> void:
	if not moored:
		return
	moored = false
	if world_controller != null and world_controller.has_method("cast_off_boat"):
		world_controller.call("cast_off_boat")
	if pilot != null and pilot.has_method("show_status_message"):
		pilot.call("show_status_message", "Lines clear. The Northstar answers the throttle.", 2.8)

func end_piloting() -> void:
	if pilot == null:
		return
	var departing_pilot := pilot
	pilot = null
	current_speed = move_toward(current_speed, 0.0, 0.65)
	if departing_pilot.has_method("end_boat_piloting"):
		departing_pilot.call("end_boat_piloting")

func is_being_piloted() -> bool:
	return pilot != null

func get_speed_mps() -> float:
	return current_speed

func get_speed_knots() -> float:
	return absf(current_speed) * 1.94384

func get_throttle_percent() -> int:
	return roundi(throttle_input * 100.0)

func get_fuel_percent() -> float:
	return clampf(fuel / fuel_capacity * 100.0, 0.0, 100.0)

func refuel(amount: float = -1.0) -> float:
	var before := fuel
	fuel = fuel_capacity if amount < 0.0 else minf(fuel_capacity, fuel + amount)
	if fuel > 0.01:
		empty_warning_given = false
	if get_fuel_percent() > 25.0:
		low_fuel_warning_given = false
	return fuel - before

func _consume_fuel(delta: float) -> void:
	if absf(current_speed) <= 0.08 or fuel <= 0.0:
		return
	var load_factor := clampf(absf(current_speed) / forward_speed, 0.16, 1.0)
	fuel = maxf(0.0, fuel - fuel_burn_per_second * load_factor * delta)
	if get_fuel_percent() <= 18.0 and not low_fuel_warning_given:
		low_fuel_warning_given = true
		if pilot != null and pilot.has_method("show_status_message"):
			pilot.call("show_status_message", "Northstar fuel below 18%. Watch for a lit river pump.", 4.0)
