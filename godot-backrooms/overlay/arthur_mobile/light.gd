extends SpotLight3D

var player: Node3D

func _ready() -> void:
	player = get_tree().get_first_node_in_group("player")

func _process(_delta: float) -> void:
	if player == null:
		player = get_tree().get_first_node_in_group("player")
		if player == null:
			visible = false
			return
	visible = global_position.distance_to(player.global_position) < 15.5
