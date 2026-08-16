extends Button

var player: Node

func _ready() -> void:
	pressed.connect(_on_pressed)
	_find_player()

func _process(_delta: float) -> void:
	if player == null or not is_instance_valid(player):
		_find_player()
	visible = player != null and player.has_method("is_in_vehicle") and bool(player.call("is_in_vehicle"))
	if visible:
		text = "HEADLIGHTS"

func _find_player() -> void:
	player = get_tree().get_first_node_in_group("player")

func _on_pressed() -> void:
	if player != null and player.has_method("toggle_vehicle_headlights"):
		player.call("toggle_vehicle_headlights")
