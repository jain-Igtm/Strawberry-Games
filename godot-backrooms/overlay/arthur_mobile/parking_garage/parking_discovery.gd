extends Label

const CELL: float = 12.0
const DISTRICT_CELLS: int = 8

var player: Node3D
var world: Node
var current_district: Vector2i = Vector2i(999999, 999999)
var current_level: int = 999999
var current_landmark: String = ""
var seen_districts: Dictionary = {}
var seen_landmarks: Dictionary = {}
var show_timer: float = 0.0

func _ready() -> void:
	visible = false
	player = get_tree().get_first_node_in_group("player") as Node3D
	world = get_tree().current_scene

func _process(delta: float) -> void:
	if player == null or not is_instance_valid(player):
		player = get_tree().get_first_node_in_group("player") as Node3D
		if player == null:
			return
	if world == null:
		world = get_tree().current_scene
	if world == null:
		return

	var cell: Vector2i = Vector2i(
		floori((player.global_position.x + CELL * 0.5) / CELL),
		floori((player.global_position.z + CELL * 0.5) / CELL)
	)
	var district: Vector2i = Vector2i(
		floori(float(cell.x) / float(DISTRICT_CELLS)),
		floori(float(cell.y) / float(DISTRICT_CELLS))
	)
	var level: int = int(world.get("current_level"))

	if district != current_district or level != current_level:
		current_district = district
		current_level = level
		current_landmark = ""
		_enter_district(district, level)

	var landmark: String = ""
	if world.has_method("parking_landmark_name_at"):
		landmark = String(world.call("parking_landmark_name_at", player.global_position))
	if landmark != current_landmark:
		current_landmark = landmark
		if not landmark.is_empty():
			_show_landmark(landmark, level)

	if show_timer > 0.0:
		show_timer -= delta
		if show_timer <= 0.0:
			visible = false

func _enter_district(district: Vector2i, level: int) -> void:
	if world == null or not world.has_method("parking_district_name_at"):
		return
	var key: String = "%d:%d:%d" % [district.x, district.y, level]
	if seen_districts.has(key):
		return
	seen_districts[key] = true
	var district_name: String = String(world.call("parking_district_name_at", player.global_position))
	if district_name == "CENTRAL ARRIVAL":
		return
	text = "ENTERING // %s // LEVEL %+d" % [district_name, level]
	visible = true
	show_timer = 2.6

func _show_landmark(name: String, level: int) -> void:
	var key: String = "%d:%s" % [level, name]
	if seen_landmarks.has(key):
		return
	seen_landmarks[key] = true
	text = "DISCOVERED // %s" % name
	visible = true
	show_timer = 3.0
