extends Node3D

const CELL := 4.0
const ROOM_SIZE := 6
const ROOM_HALF := 3
const BIOME_CELLS := 36
const BIOME_HALF := 18
const LOAD_RADIUS := 11
const UNLOAD_RADIUS := 14
const ADD_PER_FRAME := 18
const WORLD_SEED := 0x41A7F29D

const NOWALL: PackedScene = preload("res://procedural/backrooms/nowall.tscn")
const WALL_NEG_X: PackedScene = preload("res://procedural/backrooms/wallnegativex.tscn")
const WALL_NEG_Z: PackedScene = preload("res://procedural/backrooms/wallnegativez.tscn")
const CORNER: PackedScene = preload("res://procedural/backrooms/corner.tscn")
const LIGHT: PackedScene = preload("res://arthur_mobile/light.tscn")
const CRT: PackedScene = preload("res://assets/models/crt/crttv_2.scn")
const DSLR: PackedScene = preload("res://assets/models/camera/DSLR.glb")

const YELLOW_OFFICE: PackedScene = preload("res://arthur_mobile/yellow_office_remains.tscn")
const YELLOW_RECEPTION: PackedScene = preload("res://arthur_mobile/landmark_yellow_reception.tscn")
const POOL_ROOM: PackedScene = preload("res://arthur_mobile/pool_room.tscn")
const POOL_ARCADE: PackedScene = preload("res://arthur_mobile/pool_arcade.tscn")
const POOL_ATRIUM: PackedScene = preload("res://arthur_mobile/landmark_pool_atrium.tscn")
const SERVICE_ROOM: PackedScene = preload("res://arthur_mobile/service_room.tscn")
const SERVICE_PIPE_GALLERY: PackedScene = preload("res://arthur_mobile/service_pipe_gallery.tscn")
const SERVICE_HUB: PackedScene = preload("res://arthur_mobile/landmark_service_hub.tscn")

const YELLOW_WALL: Material = preload("res://procedural/assets/wall.tres")
const YELLOW_FLOOR: Material = preload("res://procedural/assets/floor.tres")
const YELLOW_CEILING: Material = preload("res://arthur_mobile/materials/yellow_ceiling.tres")
const POOL_TILE: Material = preload("res://arthur_mobile/materials/pool_tiles.tres")
const POOL_PLASTER: Material = preload("res://arthur_mobile/materials/pool_plaster.tres")
const SERVICE_CONCRETE: Material = preload("res://arthur_mobile/materials/service_concrete.tres")

const BIOME_YELLOW := 0
const BIOME_POOL := 1
const BIOME_SERVICE := 2

@onready var tiles: Node3D = $Tiles
@onready var player: CharacterBody3D = $Player
@onready var floor_mesh: CSGBox3D = $Floor
@onready var ceiling_mesh: CSGBox3D = $Ceiling
@onready var hum: AudioStreamPlayer = $Hum
@onready var atmosphere: AudioStreamPlayer = $Atmosphere
@onready var coords_label: Label = $UI/Overlay/Coords
@onready var world_environment: WorldEnvironment = $WorldEnvironment

var active_tiles: Dictionary = {}
var build_queue: Array[Vector2i] = []
var center_cell := Vector2i(999999, 999999)
var cleanup_cursor := 0
var current_biome := -1

func _ready() -> void:
	if OS.has_feature("mobile"):
		DisplayServer.screen_set_orientation(DisplayServer.SCREEN_LANDSCAPE)
	_update_center(true)
	_update_biome_visuals(true)

func _process(_delta: float) -> void:
	var snapped_x: float = snappedf(player.global_position.x, CELL)
	var snapped_z: float = snappedf(player.global_position.z, CELL)
	floor_mesh.global_position.x = snapped_x
	floor_mesh.global_position.z = snapped_z
	ceiling_mesh.global_position.x = snapped_x
	ceiling_mesh.global_position.z = snapped_z
	_update_center(false)
	_build_some_tiles()
	_cleanup_far_tiles()
	_update_biome_visuals(false)
	if not hum.playing:
		hum.play()
	if not atmosphere.playing:
		atmosphere.play()
	var player_cell := Vector2i(floori(player.global_position.x / CELL), floori(player.global_position.z / CELL))
	var biome: int = _biome_for_cell(player_cell)
	var room: Vector2i = _room_for_cell(player_cell)
	coords_label.text = "%s  //  %s  //  %d, %d" % [_biome_name(biome), _room_descriptor(room, biome), int(player.global_position.x), int(player.global_position.z)]

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
				if maxi(abs(x), abs(z)) != ring:
					continue
				var cell := center_cell + Vector2i(x, z)
				if not active_tiles.has(cell):
					build_queue.append(cell)

func _build_some_tiles() -> void:
	var count: int = mini(ADD_PER_FRAME, build_queue.size())
	for _i in range(count):
		var cell: Vector2i = build_queue.pop_front()
		if active_tiles.has(cell):
			continue
		_add_cell(cell)

func _add_cell(cell: Vector2i) -> void:
	var root := Node3D.new()
	root.name = "cell_%d_%d" % [cell.x, cell.y]
	root.position = Vector3(cell.x * CELL, 0.0, cell.y * CELL)

	var biome: int = _biome_for_cell(cell)
	var architecture_scene: PackedScene = _scene_for_cell(cell)
	var architecture: Node = architecture_scene.instantiate()
	if biome == BIOME_POOL:
		_apply_material_recursive(architecture, POOL_TILE)
	elif biome == BIOME_SERVICE:
		_apply_material_recursive(architecture, SERVICE_CONCRETE)
	else:
		_apply_material_recursive(architecture, YELLOW_WALL)
	root.add_child(architecture)

	var room: Vector2i = _room_for_cell(cell)
	var local_x: int = _positive_mod(cell.x, ROOM_SIZE)
	var local_z: int = _positive_mod(cell.y, ROOM_SIZE)
	_add_room_fixture(root, room, local_x, local_z, biome)

	if local_x == 0 and local_z == 0:
		_add_room_feature(root, room, biome)

	tiles.add_child(root)
	active_tiles[cell] = root

func _scene_for_cell(cell: Vector2i) -> PackedScene:
	if abs(cell.x) <= 1 and abs(cell.y) <= 1:
		return NOWALL

	var room: Vector2i = _room_for_cell(cell)
	var biome: int = _biome_for_cell(cell)
	var local_x: int = _positive_mod(cell.x, ROOM_SIZE)
	var local_z: int = _positive_mod(cell.y, ROOM_SIZE)
	var wall_west := false
	var wall_north := false

	if local_x == 0 and not _boundary_merged(room.x, room.y, 31):
		var west_gate: int = 1 + (_cell_hash(room.x, room.y, 131) % (ROOM_SIZE - 2))
		wall_west = local_z != west_gate and local_z != mini(ROOM_SIZE - 1, west_gate + 1)

	if local_z == 0 and not _boundary_merged(room.x, room.y, 47):
		var north_gate: int = 1 + (_cell_hash(room.x, room.y, 149) % (ROOM_SIZE - 2))
		wall_north = local_x != north_gate and local_x != mini(ROOM_SIZE - 1, north_gate + 1)

	if not _is_landmark_room(room, biome):
		var layout: int = _cell_hash(room.x, room.y, 211) % 10
		var gate_a: int = 1 + (_cell_hash(room.x, room.y, 223) % (ROOM_SIZE - 2))
		var gate_b: int = 1 + (_cell_hash(room.x, room.y, 229) % (ROOM_SIZE - 2))

		if layout == 2 or layout == 4:
			if local_x == ROOM_HALF and local_z != gate_a and local_z != mini(ROOM_SIZE - 1, gate_a + 1):
				wall_west = true
		if layout == 3 or layout == 4:
			if local_z == ROOM_HALF and local_x != gate_b and local_x != mini(ROOM_SIZE - 1, gate_b + 1):
				wall_north = true
		if layout == 5 and local_x == 2 and local_z > 0 and local_z < ROOM_SIZE - 1:
			wall_west = local_z != gate_a
		if layout == 6 and local_z == 4 and local_x > 0 and local_x < ROOM_SIZE - 1:
			wall_north = local_x != gate_b
		if layout == 7:
			if local_x == 2 and local_z != gate_a:
				wall_west = true
			if local_x == 4 and local_z != gate_b:
				wall_west = true
		if layout == 8:
			if local_z == 2 and local_x != gate_a:
				wall_north = true
			if local_z == 4 and local_x != gate_b:
				wall_north = true
		if layout == 9:
			if local_x == 2 and local_z >= 1 and local_z <= 4 and local_z != gate_a:
				wall_west = true
			if local_z == 4 and local_x >= 2 and local_x <= 4 and local_x != gate_b:
				wall_north = true

	if wall_west and wall_north:
		return CORNER
	if wall_west:
		return WALL_NEG_X
	if wall_north:
		return WALL_NEG_Z
	return NOWALL

func _boundary_merged(room_x: int, room_z: int, salt: int) -> bool:
	return _cell_hash(room_x, room_z, salt) % 6 == 0

func _add_room_fixture(root: Node3D, room: Vector2i, local_x: int, local_z: int, biome: int) -> void:
	var fixture_cell: bool = (local_x == 1 or local_x == 4) and (local_z == 1 or local_z == 4)
	if not fixture_cell:
		return
	var skip_roll: int = _cell_hash(room.x * 17 + local_x, room.y * 17 + local_z, 307)
	if skip_roll % 6 == 0:
		return
	var fixture: Node3D = LIGHT.instantiate()
	var fixture_roll: int = _cell_hash(room.x, room.y, 313)
	fixture.rotation.y = float((fixture_roll + local_x + local_z) & 1) * PI * 0.5
	var spot: SpotLight3D = fixture.get_node_or_null("SpotLight3D") as SpotLight3D
	if spot != null:
		if biome == BIOME_POOL:
			spot.light_color = Color(0.72, 0.94, 0.96, 1.0)
			spot.light_energy = 1.25
		elif biome == BIOME_SERVICE:
			spot.light_color = Color(0.72, 0.78, 0.69, 1.0)
			spot.light_energy = 0.92
		else:
			spot.light_color = Color(1.0, 0.94, 0.68, 1.0)
			spot.light_energy = 1.18
	root.add_child(fixture)

func _add_room_feature(root: Node3D, room: Vector2i, biome: int) -> void:
	var room_center := Vector3((ROOM_SIZE - 1) * CELL * 0.5, 0.0, (ROOM_SIZE - 1) * CELL * 0.5)
	var roll: int = _room_roll(room)
	var feature: Node3D

	if biome == BIOME_POOL:
		if roll % 6 == 0:
			feature = POOL_ATRIUM.instantiate()
		elif roll % 2 == 0:
			feature = POOL_ARCADE.instantiate()
		else:
			feature = POOL_ROOM.instantiate()
		feature.position = room_center
		feature.rotation.y = float((roll >> 3) % 4) * PI * 0.5
		root.add_child(feature)
		return

	if biome == BIOME_SERVICE:
		if roll % 6 == 0:
			feature = SERVICE_HUB.instantiate()
		elif roll % 2 == 0:
			feature = SERVICE_PIPE_GALLERY.instantiate()
		else:
			feature = SERVICE_ROOM.instantiate()
		feature.position = room_center
		feature.rotation.y = float((roll >> 4) % 4) * PI * 0.5
		root.add_child(feature)
		if roll % 9 == 3:
			_add_crt(root, room_center + Vector3(-6.2, 0.55, 6.0), roll)
		return

	if roll % 7 == 0:
		feature = YELLOW_RECEPTION.instantiate()
		feature.position = room_center
		feature.rotation.y = float((roll >> 5) % 4) * PI * 0.5
		root.add_child(feature)
	elif roll % 3 == 0:
		feature = YELLOW_OFFICE.instantiate()
		feature.position = room_center
		feature.rotation.y = float((roll >> 4) % 4) * PI * 0.5
		root.add_child(feature)
	elif roll % 11 == 1:
		_add_crt(root, room_center + Vector3(-5.2, 0.55, 4.6), roll)
	elif roll % 13 == 2:
		var camera_prop: Node3D = DSLR.instantiate()
		camera_prop.position = room_center + Vector3(3.8, 0.12, -4.0)
		camera_prop.rotation.y = float(roll % 4) * PI * 0.5
		camera_prop.scale = Vector3.ONE * 0.75
		root.add_child(camera_prop)

func _add_crt(root: Node3D, position: Vector3, roll: int) -> void:
	var crt: Node3D = CRT.instantiate()
	crt.position = position
	crt.rotation.y = float(roll % 4) * PI * 0.5
	crt.scale = Vector3.ONE * 1.15
	root.add_child(crt)

func _room_roll(room: Vector2i) -> int:
	return _cell_hash(room.x, room.y, 401)

func _is_landmark_room(room: Vector2i, biome: int) -> bool:
	var roll: int = _room_roll(room)
	if biome == BIOME_YELLOW:
		return roll % 7 == 0
	return roll % 6 == 0

func _room_descriptor(room: Vector2i, biome: int) -> String:
	var roll: int = _room_roll(room)
	if biome == BIOME_POOL:
		if roll % 6 == 0:
			return "ATRIUM"
		if roll % 2 == 0:
			return "WATER ARCADE"
		return "SHALLOW CHAMBERS"
	if biome == BIOME_SERVICE:
		if roll % 6 == 0:
			return "MACHINE HALL"
		if roll % 2 == 0:
			return "PIPE GALLERY"
		return "UTILITY ROOMS"
	if roll % 7 == 0:
		return "RECEPTION"
	if roll % 3 == 0:
		return "OFFICE REMAINS"
	var layout: int = _cell_hash(room.x, room.y, 211) % 10
	if layout <= 1:
		return "OPEN HALL"
	if layout == 4:
		return "CROSS HALL"
	if layout == 7 or layout == 8:
		return "LONG PASSAGES"
	return "YELLOW CHAMBERS"

func _apply_material_recursive(node: Node, material: Material) -> void:
	if node is CSGBox3D:
		var box := node as CSGBox3D
		box.material_override = material
	elif node is CSGCylinder3D:
		var cylinder := node as CSGCylinder3D
		cylinder.material_override = material
	for child in node.get_children():
		_apply_material_recursive(child, material)

func _room_for_cell(cell: Vector2i) -> Vector2i:
	return Vector2i(floori(float(cell.x) / float(ROOM_SIZE)), floori(float(cell.y) / float(ROOM_SIZE)))

func _region_for_cell(cell: Vector2i) -> Vector2i:
	return Vector2i(
		floori(float(cell.x + BIOME_HALF) / float(BIOME_CELLS)),
		floori(float(cell.y + BIOME_HALF) / float(BIOME_CELLS))
	)

func _biome_for_cell(cell: Vector2i) -> int:
	var region: Vector2i = _region_for_cell(cell)
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

func _biome_name(biome: int) -> String:
	if biome == BIOME_POOL:
		return "POOL ROOMS"
	if biome == BIOME_SERVICE:
		return "SERVICE LEVEL"
	return "LEVEL 0"

func _update_biome_visuals(force: bool) -> void:
	var player_cell := Vector2i(floori(player.global_position.x / CELL), floori(player.global_position.z / CELL))
	var next_biome: int = _biome_for_cell(player_cell)
	if not force and next_biome == current_biome:
		return
	current_biome = next_biome
	var environment: Environment = world_environment.environment
	if next_biome == BIOME_POOL:
		floor_mesh.material_override = POOL_TILE
		ceiling_mesh.material_override = POOL_PLASTER
		environment.background_color = Color(0.075, 0.16, 0.16, 1.0)
		environment.ambient_light_color = Color(0.60, 0.82, 0.80, 1.0)
		environment.ambient_light_energy = 0.72
		environment.fog_light_color = Color(0.38, 0.61, 0.59, 1.0)
		environment.fog_light_energy = 0.58
		environment.fog_density = 0.0085
		hum.volume_db = -28.0
		atmosphere.volume_db = -29.0
	elif next_biome == BIOME_SERVICE:
		floor_mesh.material_override = SERVICE_CONCRETE
		ceiling_mesh.material_override = SERVICE_CONCRETE
		environment.background_color = Color(0.035, 0.045, 0.04, 1.0)
		environment.ambient_light_color = Color(0.38, 0.43, 0.38, 1.0)
		environment.ambient_light_energy = 0.48
		environment.fog_light_color = Color(0.20, 0.24, 0.21, 1.0)
		environment.fog_light_energy = 0.48
		environment.fog_density = 0.013
		hum.volume_db = -35.0
		atmosphere.volume_db = -24.0
	else:
		floor_mesh.material_override = YELLOW_FLOOR
		ceiling_mesh.material_override = YELLOW_CEILING
		environment.background_color = Color(0.13, 0.12, 0.072, 1.0)
		environment.ambient_light_color = Color(0.76, 0.72, 0.49, 1.0)
		environment.ambient_light_energy = 0.67
		environment.fog_light_color = Color(0.50, 0.47, 0.29, 1.0)
		environment.fog_light_energy = 0.55
		environment.fog_density = 0.0095
		hum.volume_db = -18.0
		atmosphere.volume_db = -43.0

func _cleanup_far_tiles() -> void:
	if active_tiles.is_empty():
		return
	var keys: Array = active_tiles.keys()
	var checks: int = mini(70, keys.size())
	for i in range(checks):
		var idx: int = (cleanup_cursor + i) % keys.size()
		var cell: Vector2i = keys[idx]
		if maxi(abs(cell.x - center_cell.x), abs(cell.y - center_cell.y)) > UNLOAD_RADIUS:
			var node: Node = active_tiles[cell] as Node
			active_tiles.erase(cell)
			if is_instance_valid(node):
				node.queue_free()
	cleanup_cursor = (cleanup_cursor + checks) % maxi(1, active_tiles.size())

func _positive_mod(value: int, modulus: int) -> int:
	return ((value % modulus) + modulus) % modulus

func _cell_hash(x: int, z: int, salt: int) -> int:
	var n: int = x * 374761393 + z * 668265263 + WORLD_SEED + salt * 1442695041
	n = (n ^ (n >> 13)) * 1274126177
	n = n ^ (n >> 16)
	return absi(n)
