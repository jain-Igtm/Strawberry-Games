extends StaticBody3D

@export var flag_id := "aurora"
@export var flag_name := "Aurora"

var world_controller: Node
var collected := false

func _ready() -> void:
	add_to_group("world_interactable")
	world_controller = get_tree().get_first_node_in_group("world")

func get_interaction_radius() -> float:
	return 3.2

func get_interaction_prompt() -> String:
	return "Recover the %s flag" % flag_name

func interact(player: Node) -> void:
	if collected:
		return
	if world_controller == null:
		world_controller = get_tree().get_first_node_in_group("world")
	var unlocked := false
	if world_controller != null and world_controller.has_method("unlock_flag"):
		unlocked = bool(world_controller.call("unlock_flag", flag_id))
	if not unlocked:
		if player != null and player.has_method("show_status_message"):
			player.call("show_status_message", "You already recovered this flag.", 1.8)
		return
	collected = true
	visible = false
	for child in get_children():
		if child is CollisionShape3D:
			child.set_deferred("disabled", true)
	if player != null and player.has_method("show_status_message"):
		player.call("show_status_message", "Flag found: %s. Hoist it from the cabin locker." % flag_name, 4.0)

