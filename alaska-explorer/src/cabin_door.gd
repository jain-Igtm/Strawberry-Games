extends AnimatableBody3D

@export var open_angle_degrees := -102.0
@export var travel_seconds := 0.42

var is_open := false
var moving := false

func _ready() -> void:
	sync_to_physics = true

func get_interaction_prompt() -> String:
	if moving:
		return "Cabin door moving"
	return "Close cabin door" if is_open else "Open cabin door"

func interact(player: Node) -> void:
	if moving:
		return
	is_open = not is_open
	moving = true
	var target_angle := deg_to_rad(open_angle_degrees if is_open else 0.0)
	var tween := create_tween()
	tween.set_trans(Tween.TRANS_SINE)
	tween.set_ease(Tween.EASE_IN_OUT)
	tween.tween_property(self, "rotation:y", target_angle, travel_seconds)
	tween.finished.connect(_finish_motion)
	if player != null and player.has_method("show_status_message"):
		player.call("show_status_message", "Cabin door opened." if is_open else "Cabin door secured.", 1.4)

func _finish_motion() -> void:
	moving = false
