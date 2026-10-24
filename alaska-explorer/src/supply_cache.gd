extends StaticBody3D

@export_enum("food", "fuel") var supply_kind := "food"
@export var remaining := 3
@export var fuel_per_container := 24.0

func get_interaction_prompt() -> String:
	if remaining <= 0:
		return "Empty supply box"
	if supply_kind == "food":
		return "Eat trail ration (%d left)" % remaining
	return "Pour diesel into heater (%d left)" % remaining

func interact(player: Node) -> void:
	if remaining <= 0:
		_notify(player, "Nothing useful remains.")
		return

	if supply_kind == "food":
		if player != null and player.has_method("eat_ration"):
			if bool(player.call("eat_ration")):
				remaining -= 1
		return

	var heater := get_tree().get_first_node_in_group("heater")
	if heater != null and heater.has_method("add_fuel"):
		if bool(heater.call("add_fuel", fuel_per_container)):
			remaining -= 1
			_notify(player, "Added diesel to the cabin heater.")
		else:
			_notify(player, "The heater tank is already full.")

func _notify(player: Node, message: String) -> void:
	if player != null and player.has_method("show_status_message"):
		player.call("show_status_message", message)
