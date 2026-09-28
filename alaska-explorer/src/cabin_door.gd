extends AnimatableBody3D

@export var open_angle_degrees := -102.0
@export var travel_seconds := 0.36

var is_open := false
var moving := false
var motion_tween: Tween

func _ready() -> void:
	sync_to_physics = true

func get_interaction_prompt() -> String:
	return "Close cabin door" if is_open else "Open cabin door"

func interact(player: Node) -> void:
	if motion_tween != null and motion_tween.is_valid():
		motion_tween.kill()
	is_open = not is_open
	moving = true
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
