extends StaticBody3D

var world_controller: Node

func _ready() -> void:
	add_to_group("world_interactable")
	world_controller = get_tree().get_first_node_in_group("world")

func get_interaction_radius() -> float:
	return 2.7

func get_interaction_prompt() -> String:
	if world_controller == null:
		return "Open flag locker"
	var next_name := str(world_controller.call("get_next_flag_name")) if world_controller.has_method("get_next_flag_name") else "flag"
	return "Hoist the %s flag" % next_name

func interact(player: Node) -> void:
	if world_controller == null:
		world_controller = get_tree().get_first_node_in_group("world")
	if world_controller != null and world_controller.has_method("cycle_flag"):
		world_controller.call("cycle_flag", player)

