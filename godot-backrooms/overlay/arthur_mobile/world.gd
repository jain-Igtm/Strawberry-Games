extends Node3D

const CELL := 4.0
const LOAD_RADIUS := 13
const UNLOAD_RADIUS := 16
const ADD_PER_FRAME := 22
const WORLD_SEED := 0x41A7F29D

const NOWALL: PackedScene = preload("res://procedural/backrooms/nowall.tscn")
const WALL_X: PackedScene = preload("res://procedural/backrooms/wallx.tscn")
const WALL_NEG_X: PackedScene = preload("res://procedural/backrooms/wallnegativex.tscn")
const WALL_NEG_Z: PackedScene = preload("res://procedural/backrooms/wallnegativez.tscn")
const CORNER: PackedScene = preload("res://procedural/backrooms/corner.tscn")
const LIGHT: PackedScene = preload("res://arthur_mobile/light.tscn")
const CRT: PackedScene = preload("res://assets/models/crt/crttv_2.scn")

@onready var tiles: Node3D = $Tiles
@onready var player: CharacterBody3D = $Player
@onready var floor_mesh: CSGBox3D = $Floor
@onready var ceiling_mesh: CSGBox3D = $Ceiling
@onready var hum: AudioStreamPlayer = $Hum
@onready var coords_label: Label = $UI/Overlay/Coords

var active_tiles: Dictionary = {}
var build_queue: Array[Vector2i] = []
var center_cell := Vector2i(999999, 999999)
var cleanup_cursor := 0

func _ready() -> void:
	if OS.has_feature("mobile"):
		DisplayServer.screen_set_orientation(DisplayServer.SCREEN_LANDSCAPE)
	_update_center(true)

func _process(_delta: float) -> void:
	var snapped_x := snappedf(player.global_position.x, CELL)
	var snapped_z := snappedf(player.global_position.z, CELL)
	floor_mesh.global_position.x = snapped_x
	floor_mesh.global_position.z = snapped_z
	ceiling_mesh.global_position.x = snapped_x
	ceiling_mesh.global_position.z = snapped_z
	_update_center(false)
	_build_some_tiles()
	_cleanup_far_tiles()
	if not hum.playing:
		hum.play()
	coords_label.text = "%d, %d   //   %d streamed cells" % [int(player.global_position.x), int(player.global_position.z), active_tiles.size()]

func _update_center(force: bool) -> void:
	var next_center := Vector2i(roundi(player.global_position.x / CELL), roundi(player.global_position.z / CELL))
	if not force and next_center == center_cell:
		return
	center_cell = next_center
	_rebuild_queue()

func _rebuild_queue() -> void:
	build_queue.clear()
	for ring in range(LOAD_RADIUS + 1):
		for z in range(-ring, ring + 1):
			for x in range(-ring, ring + 1):
				if max(abs(x), abs(z)) != ring:
					continue
				var cell := center_cell + Vector2i(x, z)
				if not active_tiles.has(cell):
					build_queue.append(cell)

func _build_some_tiles() -> void:
	var count := mini(ADD_PER_FRAME, build_queue.size())
	for _i in range(count):
		var cell := build_queue.pop_front()
		if active_tiles.has(cell):
			continue
		_add_cell(cell)

func _add_cell(cell: Vector2i) -> void:
	var root := Node3D.new()
	root.name = "cell_%d_%d" % [cell.x, cell.y]
	root.position = Vector3(cell.x * CELL, 0.0, cell.y * CELL)
	var scene := _scene_for_cell(cell)
	var architecture := scene.instantiate()
	root.add_child(architecture)

	var light_roll := _cell_hash(cell.x, cell.y, 17)
	if light_roll % 13 == 0:
		var fixture := LIGHT.instantiate()
		fixture.rotation.y = float((light_roll >> 4) & 1) * PI * 0.5
		root.add_child(fixture)

	var prop_roll := _cell_hash(cell.x, cell.y, 97)
	if prop_roll % 109 == 0 and cell.distance_squared_to(Vector2i.ZERO) > 9:
		var crt := CRT.instantiate()
		crt.position = Vector3(0.55, 0.55, -0.35)
		crt.rotation.y = float(prop_roll % 4) * PI * 0.5
		crt.scale = Vector3.ONE * 1.25
		root.add_child(crt)

	tiles.add_child(root)
	active_tiles[cell] = root

func _scene_for_cell(cell: Vector2i) -> PackedScene:
	# Keep the immediate spawn clear so the player never starts boxed in.
	if abs(cell.x) <= 1 and abs(cell.y) <= 1:
		return NOWALL
	var roll := _cell_hash(cell.x, cell.y, 3) % 100
	if roll < 54:
		return NOWALL
	if roll < 66:
		return WALL_X
	if roll < 78:
		return WALL_NEG_X
	if roll < 91:
		return WALL_NEG_Z
	return CORNER

func _cleanup_far_tiles() -> void:
	if active_tiles.is_empty():
		return
	var keys := active_tiles.keys()
	var checks := mini(70, keys.size())
	for i in range(checks):
		var idx := (cleanup_cursor + i) % keys.size()
		var cell: Vector2i = keys[idx]
		if max(abs(cell.x - center_cell.x), abs(cell.y - center_cell.y)) > UNLOAD_RADIUS:
			var node: Node = active_tiles[cell]
			active_tiles.erase(cell)
			if is_instance_valid(node):
				node.queue_free()
	cleanup_cursor = (cleanup_cursor + checks) % maxi(1, active_tiles.size())

func _cell_hash(x: int, z: int, salt: int) -> int:
	var n: int = x * 374761393 + z * 668265263 + WORLD_SEED + salt * 1442695041
	n = (n ^ (n >> 13)) * 1274126177
	n = n ^ (n >> 16)
	return abs(n)
