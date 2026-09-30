extends AnimatableBody3D

@export var open_angle_degrees := -102.0
@export var travel_seconds := 0.36

var is_open := false
var moving := false
var motion_tween: Tween
var panel_collision: CollisionShape3D

func _ready() -> void:
	sync_to_physics = true
	panel_collision = get_node_or_null("DoorPanelCollision") as CollisionShape3D

func get_interaction_prompt() -> String:
	return "Close cabin door" if is_open else "Open cabin door"

func interact(player: Node) -> void:
	if motion_tween != null and motion_tween.is_valid():
		motion_tween.kill()
	is_open = not is_open
	moving = true
	_set_panel_collision(false)
	var target_angle := deg_to_rad(open_angle_degrees if is_open else 0.0)
	var full_angle := maxf(deg_to_rad(absf(open_angle_degrees)), 0.001)
	var remaining_fraction := absf(target_angle - rotation.y) / full_angle
	motion_tween = create_tween()
	motion_tween.set_trans(Tween.TRANS_SINE)
	motion_tween.set_ease(Tween.EASE_IN_OUT)
	motion_tween.tween_property(self, "rotation:y", target_angle, maxf(0.12, travel_seconds * remaining_fraction))
	motion_tween.finished.connect(_finish_motion)
	if player != null and player.has_method("show_status_message"):
		player.call("show_status_message", "Cabin door opened." if is_open else "Cabin door secured.", 1.4)

func _finish_motion() -> void:
	moving = false
	motion_tween = null
	if is_open:
		_set_panel_collision(false)
		return
	_clear_player_from_doorway()
	_set_panel_collision(true)

func _set_panel_collision(enabled: bool) -> void:
	if panel_collision != null:
		panel_collision.set_deferred("disabled", not enabled)

func _clear_player_from_doorway() -> void:
	var player := get_tree().get_first_node_in_group("player") as CharacterBody3D
	if player == null:
		return
	var local_player := to_local(player.global_position)
	var inside_door_sweep := (
		local_player.x > -0.42
		and local_player.x < 1.64
		and local_player.y > -0.35
		and local_player.y < 2.20
		and absf(local_player.z) < 0.58
	)
	if not inside_door_sweep:
		return
	local_player.z = -0.64 if local_player.z < 0.0 else 0.64
	player.global_position = to_global(local_player)
	player.velocity = Vector3.ZERO
	player.reset_physics_interpolation()
