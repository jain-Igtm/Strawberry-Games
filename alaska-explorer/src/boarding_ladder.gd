extends StaticBody3D

var boarding_point: Marker3D

func _ready() -> void:
	var boat := get_parent()
	if boat != null:
		boarding_point = boat.get_node_or_null("BoardingPoint") as Marker3D

func get_interaction_prompt() -> String:
	return "Climb aboard Northstar"

func interact(player: Node) -> void:
	if player != null and boarding_point != null and player.has_method("board_boat"):
		player.call("board_boat", boarding_point)
