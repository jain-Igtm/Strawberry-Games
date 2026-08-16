extends Label

const CELL := 4.0
const ROOM_SIZE := 6
const BIOME_CELLS := 36
const BIOME_HALF := 18
const WORLD_SEED := 0x41A7F29D

const BIOME_YELLOW := 0
const BIOME_POOL := 1
const BIOME_SERVICE := 2

var player: Node3D
var current_room := Vector2i(999999, 999999)
var seen: Dictionary = {}
var show_timer := 0.0

func _ready() -> void:
	visible = false
	player = get_tree().get_first_node_in_group("player") as Node3D

func _process(delta: float) -> void:
	if player == null:
		player = get_tree().get_first_node_in_group("player") as Node3D
		if player == null:
			return
	var cell := Vector2i(floori(player.global_position.x / CELL), floori(player.global_position.z / CELL))
	var room := Vector2i(floori(float(cell.x) / float(ROOM_SIZE)), floori(float(cell.y) / float(ROOM_SIZE)))
	if room != current_room:
		current_room = room
		_enter_room(room, cell)
	if show_timer > 0.0:
		show_timer -= delta
		if show_timer <= 0.0:
			visible = false

func _enter_room(room: Vector2i, cell: Vector2i) -> void:
	if room == Vector2i.ZERO:
		return
	var biome: int = _biome_for_cell(cell)
	if not _is_landmark_room(room, biome):
		return
	var key := "%d:%d:%d" % [room.x, room.y, biome]
	if seen.has(key):
		return
	seen[key] = true
	text = "DISCOVERED // %s" % _landmark_name(biome)
	visible = true
	show_timer = 3.2

func _is_landmark_room(room: Vector2i, biome: int) -> bool:
	var roll: int = _room_roll(room)
	if biome == BIOME_YELLOW:
		return roll % 7 == 0
	return roll % 6 == 0

func _landmark_name(biome: int) -> String:
	if biome == BIOME_POOL:
		return "ATRIUM"
	if biome == BIOME_SERVICE:
		return "MACHINE HALL"
	return "RECEPTION"

func _room_roll(room: Vector2i) -> int:
	return _cell_hash(room.x, room.y, 401)

func _biome_for_cell(cell: Vector2i) -> int:
	var region := Vector2i(
		floori(float(cell.x + BIOME_HALF) / float(BIOME_CELLS)),
		floori(float(cell.y + BIOME_HALF) / float(BIOME_CELLS))
	)
	if region == Vector2i.ZERO:
		return BIOME_YELLOW
	if region == Vector2i(1, 0) or region == Vector2i(0, -1):
		return BIOME_POOL
	if region == Vector2i(-1, 0) or region == Vector2i(0, 1):
		return BIOME_SERVICE
	var roll: int = _cell_hash(region.x, region.y, 503) % 10
	if roll < 5:
		return BIOME_YELLOW
	if roll < 8:
		return BIOME_POOL
	return BIOME_SERVICE

func _cell_hash(x: int, z: int, salt: int) -> int:
	var n: int = x * 374761393 + z * 668265263 + WORLD_SEED + salt * 1442695041
	n = (n ^ (n >> 13)) * 1274126177
	n = n ^ (n >> 16)
	return absi(n)
