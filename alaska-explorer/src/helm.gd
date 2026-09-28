extends StaticBody3D

var boat: Node

func _ready() -> void:
	boat = get_parent()

func get_interaction_prompt() -> String:
	if boat == null:
		return "Helm unavailable"
	if bool(boat.get("moored")):
		return "Take the helm"
	if bool(boat.call("is_being_piloted")):
		return "Helm occupied"
	return "Take the helm"

func interact(player: Node) -> void:
	if boat != null and boat.has_method("begin_piloting") and player is CharacterBody3D:
		boat.call("begin_piloting", player)
