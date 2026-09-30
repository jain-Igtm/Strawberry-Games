extends StaticBody3D

@export var station_name := "River Fuel"
@export var service_radius := 14.0

var world_controller: Node

func _ready() -> void:
	add_to_group("world_interactable")
	world_controller = get_tree().get_first_node_in_group("world")

func get_interaction_radius() -> float:
	return 3.6

func get_interaction_prompt() -> String:
	var boat := get_tree().get_first_node_in_group("boat")
	if boat == null:
		return "Check fuel pump"
	return "Refuel Northstar at %s  ·  %d%%" % [station_name, roundi(float(boat.get("fuel")))]

func interact(player: Node) -> void:
	var boat := get_tree().get_first_node_in_group("boat")
	if boat == null:
		_show(player, "The pump has no vessel to serve.")
		return
	if global_position.distance_to(boat.global_position) > service_radius:
		_show(player, "Bring the Northstar alongside the fuel dock.")
		return
	if boat.has_method("get_speed_mps") and absf(float(boat.call("get_speed_mps"))) > 0.75:
		_show(player, "The Northstar must be nearly stopped to refuel.")
		return
	var added := float(boat.call("refuel")) if boat.has_method("refuel") else 0.0
	if added <= 0.05:
		_show(player, "The Northstar's tank is already full.")
	else:
		_show(player, "%s pumps %.0f liters aboard. Tank full." % [station_name, added], 3.4)

func _show(player: Node, message: String, seconds: float = 2.6) -> void:
	if player != null and player.has_method("show_status_message"):
		player.call("show_status_message", message, seconds)
