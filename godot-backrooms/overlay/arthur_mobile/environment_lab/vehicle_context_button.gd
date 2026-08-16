extends Button

var player: CharacterBody3D

func _ready() -> void:
	player = get_tree().get_first_node_in_group("player") as CharacterBody3D
	pressed.connect(_on_pressed)

func _process(_delta: float) -> void:
	if player == null:
		player = get_tree().get_first_node_in_group("player") as CharacterBody3D
	if player == null:
		visible = false
		return

	var inside := player.has_method("is_in_vehicle") and bool(player.call("is_in_vehicle"))
	var nearby := player.has_method("has_enterable_vehicle_nearby") and bool(player.call("has_enterable_vehicle_nearby"))
	visible = inside or nearby
	if not visible:
		return
	text = "EXIT CAR" if inside else "ENTER / HIDE"

func _on_pressed() -> void:
	if player != null and player.has_method("toggle_vehicle"):
		player.call("toggle_vehicle")
