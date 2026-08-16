extends Label

const CELL := 4.0
const ROOM_SIZE := 6

var player: Node3D
var world: Node
var current_room := Vector2i(999999, 999999)
var seen: Dictionary = {}
var show_timer := 0.0

func _ready() -> void:
	visible = false
	player = get_tree().get_first_node_in_group("player") as Node3D
	world = get_tree().current_scene

func _process(delta: float) -> void:
	if player == null:
		player = get_tree().get_first_node_in_group("player") as Node3D
		if player == null:
			return
	if world == null:
		world = get_tree().current_scene

	var cell := Vector2i(floori(player.global_position.x / CELL), floori(player.global_position.z / CELL))
	var room := Vector2i(floori(float(cell.x) / float(ROOM_SIZE)), floori(float(cell.y) / float(ROOM_SIZE)))
	if room != current_room:
		current_room = room
		_enter_room(room)

	if show_timer > 0.0:
		show_timer -= delta
		if show_timer <= 0.0:
			visible = false

func _enter_room(room: Vector2i) -> void:
	if room == Vector2i.ZERO or world == null:
		return
	if not world.has_method("is_landmark_room") or not world.has_method("get_landmark_name_for_room"):
		return
	var landmark: bool = bool(world.call("is_landmark_room", room))
	if not landmark:
		return
	var key := "%d:%d" % [room.x, room.y]
	if seen.has(key):
		return
	var landmark_name: String = String(world.call("get_landmark_name_for_room", room))
	if landmark_name.is_empty():
		return
	seen[key] = true
	text = "DISCOVERED // %s" % landmark_name
	visible = true
	show_timer = 3.2
