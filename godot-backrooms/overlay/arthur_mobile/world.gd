extends Node3D

const CELL := 4.0
const ROOM_SIZE := 6
const ROOM_HALF := 3
const ZONE_ROOMS := 8
const ZONE_HALF := 4
const TRANSITION_ROOMS := 2.6
const LOAD_RADIUS := 11
const UNLOAD_RADIUS := 14
const ADD_PER_FRAME := 18
const WORLD_SEED := 0x41A7F29D

const SIDE_EAST := 0
const SIDE_WEST := 1
const SIDE_SOUTH := 2
const SIDE_NORTH := 3

const EDGE_OPEN := 0
const EDGE_DOOR := 1
const EDGE_SOLID := 2

const PARTITION_NONE := 0
const PARTITION_X := 1
const PARTITION_Z := 2
const PARTITION_CROSS := 3

const WALL_NEG_X: PackedScene = preload("res://procedural/backrooms/wallnegativex.tscn")
const WALL_NEG_Z: PackedScene = preload("res://procedural/backrooms/wallnegativez.tscn")
const DOOR_X: PackedScene = preload("res://arthur_mobile/doorway_x.tscn")
const DOOR_Z: PackedScene = preload("res://arthur_mobile/doorway_z.tscn")
const LIGHT: PackedScene = preload("res://arthur_mobile/light.tscn")
const CRT: PackedScene = preload("res://assets/models/crt/crttv_2.scn")

const YELLOW_OFFICE: PackedScene = preload("res://arthur_mobile/yellow_office_remains.tscn")
const YELLOW_RECEPTION: PackedScene = preload("res://arthur_mobile/landmark_yellow_reception.tscn")
const POOL_SHELL: PackedScene = preload("res://arthur_mobile/pool_shell.tscn")
const POOL_ROOM: PackedScene = preload("res://arthur_mobile/pool_room.tscn")
const POOL_ARCADE: PackedScene = preload("res://arthur_mobile/pool_arcade.tscn")
const POOL_ATRIUM: PackedScene = preload("res://arthur_mobile/landmark_pool_atrium.tscn")
const SERVICE_SHELL: PackedScene = preload("res://arthur_mobile/service_shell.tscn")
const SERVICE_ROOM: PackedScene = preload("res://arthur_mobile/service_room.tscn")
const SERVICE_PIPE_GALLERY: PackedScene = preload("res://arthur_mobile/service_pipe_gallery.tscn")
const SERVICE_HUB: PackedScene = preload("res://arthur_mobile/landmark_service_hub.tscn")

const TRANSITION_YELLOW_POOL: PackedScene = preload("res://arthur_mobile/transition_yellow_pool.tscn")
const TRANSITION_YELLOW_SERVICE: PackedScene = preload("res://arthur_mobile/transition_yellow_service.tscn")
const TRANSITION_POOL_SERVICE: PackedScene = preload("res://arthur_mobile/transition_pool_service.tscn")

const YELLOW_WALL: Material = preload("res://procedural/assets/wall.tres")
const YELLOW_FLOOR: Material = preload("res://procedural/assets/floor.tres")
const YELLOW_CEILING: Material = preload("res://arthur_mobile/materials/yellow_ceiling.tres")
const POOL_TILE: Material = preload("res://arthur_mobile/materials/pool_tiles.tres")
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

func _ready() -> void:
	if OS.has_feature("mobile"):
		DisplayServer.screen_set_orientation(DisplayServer.SCREEN_LANDSCAPE)
	floor_mesh.material_override = YELLOW_FLOOR
	ceiling_mesh.material_override = YELLOW_CEILING
	_update_center(true)
	_update_atmosphere(1.0)

func _process(delta: float) -> void:
	var snapped_x: float = snappedf(player.global_position.x, CELL)
	var snapped_z: float = snappedf(player.global_position.z, CELL)
	floor_mesh.global_position.x = snapped_x
	floor_mesh.global_position.z = snapped_z
	ceiling_mesh.global_position.x = snapped_x
	ceiling_mesh.global_position.z = snapped_z

	_update_center(false)
	_build_some_tiles()
	_cleanup_far_tiles()
	_update_atmosphere(delta)

	if not hum.playing:
		hum.play()
	if not atmosphere.playing:
		atmosphere.play()

	var player_cell := Vector2i(floori(player.global_position.x / CELL), floori(player.global_position.z / CELL))
	var room: Vector2i = _room_for_cell(player_cell)
	var sample: Dictionary = _biome_sample_for_room(room)
	coords_label.text = "%s  //  %s  //  %d, %d" % [
		_sample_name(sample),
		_room_descriptor(room, sample),
		int(player.global_position.x),
		int(player.global_position.z)
	]

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

	var room: Vector2i = _room_for_cell(cell)
	var local_x: int = _positive_mod(cell.x, ROOM_SIZE)
	var local_z: int = _positive_mod(cell.y, ROOM_SIZE)
	var sample: Dictionary = _biome_sample_for_room(room)
	var wall_material: Material = _wall_material_for_biome(int(sample["primary"]))

	_add_room_shell_walls(root, room, local_x, local_z, wall_material)
	_add_internal_partitions(root, room, local_x, local_z, wall_material)
	_add_room_fixture(root, room, local_x, local_z, sample)

	if local_x == 0 and local_z == 0:
		_add_room_feature(root, room, sample)

	tiles.add_child(root)
	active_tiles[cell] = root

func _add_room_shell_walls(root: Node3D, room: Vector2i, local_x: int, local_z: int, material: Material) -> void:
	if local_x == 0:
		var west_room := room + Vector2i(-1, 0)
		var west_kind: int = _boundary_kind(room, west_room)
		if west_kind == EDGE_SOLID:
			_add_arch_piece(root, WALL_NEG_X, material)
		elif west_kind == EDGE_DOOR:
			var west_slot: int = _boundary_door_slot(room, west_room, true)
			if local_z == west_slot:
				_add_arch_piece(root, DOOR_X, material)
			else:
				_add_arch_piece(root, WALL_NEG_X, material)

	if local_z == 0:
		var north_room := room + Vector2i(0, -1)
		var north_kind: int = _boundary_kind(room, north_room)
		if north_kind == EDGE_SOLID:
			_add_arch_piece(root, WALL_NEG_Z, material)
		elif north_kind == EDGE_DOOR:
			var north_slot: int = _boundary_door_slot(room, north_room, false)
			if local_x == north_slot:
				_add_arch_piece(root, DOOR_Z, material)
			else:
				_add_arch_piece(root, WALL_NEG_Z, material)

func _add_internal_partitions(root: Node3D, room: Vector2i, local_x: int, local_z: int, material: Material) -> void:
	var mode: int = _partition_mode(room)
	if mode == PARTITION_NONE:
		return

	var gate_x: int = 2 + (_cell_hash(room.x, room.y, 1201) % 2)
	var gate_z: int = 2 + (_cell_hash(room.x, room.y, 1213) % 2)

	if (mode == PARTITION_X or mode == PARTITION_CROSS) and local_x == ROOM_HALF:
		if local_z == gate_x:
			_add_arch_piece(root, DOOR_X, material)
		else:
			_add_arch_piece(root, WALL_NEG_X, material)

	if (mode == PARTITION_Z or mode == PARTITION_CROSS) and local_z == ROOM_HALF:
		if local_x == gate_z:
			_add_arch_piece(root, DOOR_Z, material)
		else:
			_add_arch_piece(root, WALL_NEG_Z, material)

func _add_arch_piece(root: Node3D, scene: PackedScene, material: Material) -> void:
	var piece: Node = scene.instantiate()
	_apply_material_recursive(piece, material)
	root.add_child(piece)

func _boundary_kind(room: Vector2i, neighbor: Vector2i) -> int:
	var zone_a: Vector2i = _zone_for_room(room)
	var zone_b: Vector2i = _zone_for_room(neighbor)

	if zone_a != zone_b:
		return EDGE_DOOR if _is_zone_gateway(room, neighbor, zone_a, zone_b) else EDGE_SOLID

	if _room_is_hall(room) and _room_is_hall(neighbor):
		return EDGE_OPEN

	return EDGE_DOOR

func _is_zone_gateway(room: Vector2i, neighbor: Vector2i, zone_a: Vector2i, _zone_b: Vector2i) -> bool:
	var local: Vector2i = _local_room_in_zone(room, zone_a)
	if room.x != neighbor.x:
		return local.y == 2 or local.y == 5
	return local.x == 2 or local.x == 5

func _boundary_door_slot(room: Vector2i, neighbor: Vector2i, x_wall: bool) -> int:
	var min_x: int = mini(room.x, neighbor.x)
	var min_z: int = mini(room.y, neighbor.y)
	var salt: int = 1301 if x_wall else 1319
	return 2 + (_cell_hash(min_x, min_z, salt) % 2)

func _partition_mode(room: Vector2i) -> int:
	if room == Vector2i.ZERO or _is_landmark_room(room) or _room_is_hall(room):
		return PARTITION_NONE

	var sample: Dictionary = _biome_sample_for_room(room)
	if float(sample["weight"]) > 0.10:
		return PARTITION_NONE

	var zone: Vector2i = _zone_for_room(room)
	var local: Vector2i = _local_room_in_zone(room, zone)
	var pattern: int = _zone_pattern(zone)

	if pattern == 0:
		if abs(local.y - 3) == 1:
			return PARTITION_X
		return PARTITION_CROSS
	if pattern == 1:
		if abs(local.x - 3) == 1:
			return PARTITION_Z
		return PARTITION_CROSS
	if pattern == 2:
		if (local.x == 2 or local.x == 5) and (local.y == 3 or local.y == 4):
			return PARTITION_Z
		if (local.y == 2 or local.y == 5) and (local.x == 3 or local.x == 4):
			return PARTITION_X
		return PARTITION_CROSS

	return PARTITION_CROSS

func _room_is_hall(room: Vector2i) -> bool:
	var zone: Vector2i = _zone_for_room(room)
	var local: Vector2i = _local_room_in_zone(room, zone)
	var pattern: int = _zone_pattern(zone)

	if pattern == 0:
		return local.y == 3
	if pattern == 1:
		return local.x == 3
	if pattern == 2:
		return (local.x == 3 or local.x == 4) and (local.y == 3 or local.y == 4)
	return local.x == 3 or local.y == 3

func _room_is_adjacent_to_hall(room: Vector2i) -> bool:
	if _room_is_hall(room):
		return false
	return (
		_room_is_hall(room + Vector2i(1, 0))
		or _room_is_hall(room + Vector2i(-1, 0))
		or _room_is_hall(room + Vector2i(0, 1))
		or _room_is_hall(room + Vector2i(0, -1))
	)

func _zone_pattern(zone: Vector2i) -> int:
	var biome: int = _zone_biome(zone)
	if zone == Vector2i.ZERO:
		return 3
	if biome == BIOME_POOL:
		return 2 if ((zone.x + zone.y) & 1) == 0 else 3
	if biome == BIOME_SERVICE:
		return 0 if (zone.x & 1) == 0 else 1
	return (absi(zone.x) + absi(zone.y)) % 4

func _add_room_fixture(root: Node3D, room: Vector2i, local_x: int, local_z: int, sample: Dictionary) -> void:
	var hall: bool = _room_is_hall(room)
	var fixture_cell := false

	if hall:
		fixture_cell = (local_x == 1 or local_x == 4) and (local_z == 1 or local_z == 4)
	else:
		fixture_cell = (local_x == 2 and local_z == 2)
		if _room_is_adjacent_to_hall(room):
			fixture_cell = fixture_cell or (local_x == 4 and local_z == 4)

	if not fixture_cell:
		return

	var fixture: Node3D = LIGHT.instantiate()
	var pattern: int = _zone_pattern(_zone_for_room(room))
	fixture.rotation.y = float((pattern + local_x + local_z) & 1) * PI * 0.5

	var spot: SpotLight3D = fixture.get_node_or_null("SpotLight3D") as SpotLight3D
	if spot != null:
		var primary: int = int(sample["primary"])
		var secondary: int = int(sample["secondary"])
		var weight: float = float(sample["weight"])
		spot.light_color = _biome_light_color(primary).lerp(_biome_light_color(secondary), weight)
		spot.light_energy = lerpf(_biome_light_energy(primary), _biome_light_energy(secondary), weight)

	root.add_child(fixture)

func _add_room_feature(root: Node3D, room: Vector2i, sample: Dictionary) -> void:
	if room == Vector2i.ZERO:
		return

	var room_center := Vector3((ROOM_SIZE - 1) * CELL * 0.5, 0.0, (ROOM_SIZE - 1) * CELL * 0.5)
	var primary: int = int(sample["primary"])
	var weight: float = float(sample["weight"])
	var local: Vector2i = _local_room_in_zone(room, _zone_for_room(room))

	if weight > 0.08:
		_add_primary_shell(root, room_center, primary)
		var transition_scene: PackedScene = _transition_scene_for_pair(primary, int(sample["secondary"]))
		if transition_scene != null:
			var transition: Node3D = transition_scene.instantiate()
			transition.position = room_center
			transition.rotation.y = _transition_rotation(sample)
			root.add_child(transition)
		return

	if _is_landmark_room(room):
		_add_landmark(root, room_center, primary)
		return

	if primary == BIOME_POOL:
		if _room_is_hall(room):
			_add_primary_shell(root, room_center, primary)
			if ((local.x + local.y) & 1) == 0:
				_add_feature(root, POOL_ARCADE, room_center, _structural_rotation(room))
		elif _room_is_adjacent_to_hall(room):
			_add_feature(root, POOL_ROOM, room_center, _structural_rotation(room))
		else:
			_add_primary_shell(root, room_center, primary)
		return

	if primary == BIOME_SERVICE:
		if _room_is_hall(room):
			_add_primary_shell(root, room_center, primary)
			if ((local.x + local.y) & 1) == 0:
				_add_feature(root, SERVICE_PIPE_GALLERY, room_center, _structural_rotation(room))
		elif _room_is_adjacent_to_hall(room):
			_add_feature(root, SERVICE_ROOM, room_center, _structural_rotation(room))
		else:
			_add_primary_shell(root, room_center, primary)
		return

	if _room_is_adjacent_to_hall(room):
		if ((local.x + local.y) & 1) == 0:
			_add_feature(root, YELLOW_OFFICE, room_center, _structural_rotation(room))
	elif not _room_is_hall(room) and local.x == 1 and local.y == 1:
		_add_crt(root, room_center + Vector3(-4.8, 0.55, 4.5), 0)

func _add_primary_shell(root: Node3D, center: Vector3, biome: int) -> void:
	var shell_scene: PackedScene
	if biome == BIOME_POOL:
		shell_scene = POOL_SHELL
	elif biome == BIOME_SERVICE:
		shell_scene = SERVICE_SHELL
	else:
		return
	var shell: Node3D = shell_scene.instantiate()
	shell.position = center
	root.add_child(shell)

func _add_feature(root: Node3D, scene: PackedScene, center: Vector3, rotation_y: float) -> void:
	var feature: Node3D = scene.instantiate()
	feature.position = center
	feature.rotation.y = rotation_y
	root.add_child(feature)

func _add_landmark(root: Node3D, center: Vector3, biome: int) -> void:
	if biome == BIOME_POOL:
		_add_primary_shell(root, center, biome)
		_add_feature(root, POOL_ATRIUM, center, 0.0)
	elif biome == BIOME_SERVICE:
		_add_primary_shell(root, center, biome)
		_add_feature(root, SERVICE_HUB, center, 0.0)
	else:
		_add_feature(root, YELLOW_RECEPTION, center, 0.0)

func _transition_scene_for_pair(a: int, b: int) -> PackedScene:
	if (a == BIOME_YELLOW and b == BIOME_POOL) or (a == BIOME_POOL and b == BIOME_YELLOW):
		return TRANSITION_YELLOW_POOL
	if (a == BIOME_YELLOW and b == BIOME_SERVICE) or (a == BIOME_SERVICE and b == BIOME_YELLOW):
		return TRANSITION_YELLOW_SERVICE
	return TRANSITION_POOL_SERVICE

func _transition_rotation(sample: Dictionary) -> float:
	var primary: int = int(sample["primary"])
	var secondary: int = int(sample["secondary"])
	var edge: int = int(sample["edge"])
	var positive_biome: int = BIOME_POOL

	if primary == BIOME_SERVICE or secondary == BIOME_SERVICE:
		positive_biome = BIOME_SERVICE

	var direction: int = edge
	if primary == positive_biome:
		direction = _opposite_side(edge)
	return _rotation_for_side(direction)

func _rotation_for_side(side: int) -> float:
	if side == SIDE_WEST:
		return PI
	if side == SIDE_SOUTH:
		return -PI * 0.5
	if side == SIDE_NORTH:
		return PI * 0.5
	return 0.0

func _opposite_side(side: int) -> int:
	if side == SIDE_EAST:
		return SIDE_WEST
	if side == SIDE_WEST:
		return SIDE_EAST
	if side == SIDE_SOUTH:
		return SIDE_NORTH
	return SIDE_SOUTH

func _structural_rotation(room: Vector2i) -> float:
	var zone: Vector2i = _zone_for_room(room)
	var pattern: int = _zone_pattern(zone)
	if pattern == 1:
		return PI * 0.5
	if pattern == 2:
		var local: Vector2i = _local_room_in_zone(room, zone)
		return float((local.x + local.y) & 1) * PI * 0.5
	return 0.0

func _add_crt(root: Node3D, position: Vector3, quarter_turns: int) -> void:
	var crt: Node3D = CRT.instantiate()
	crt.position = position
	crt.rotation.y = float(quarter_turns % 4) * PI * 0.5
	crt.scale = Vector3.ONE * 1.15
	root.add_child(crt)

func _landmark_local(zone: Vector2i) -> Vector2i:
	var pattern: int = _zone_pattern(zone)
	if pattern == 0:
		return Vector2i(4, 3)
	if pattern == 1:
		return Vector2i(3, 4)
	return Vector2i(3, 3)

func _is_landmark_room(room: Vector2i) -> bool:
	var zone: Vector2i = _zone_for_room(room)
	return _local_room_in_zone(room, zone) == _landmark_local(zone)

func is_landmark_room(room: Vector2i) -> bool:
	return _is_landmark_room(room)

func get_landmark_name_for_room(room: Vector2i) -> String:
	if not _is_landmark_room(room):
		return ""
	var biome: int = _zone_biome(_zone_for_room(room))
	if biome == BIOME_POOL:
		return "ATRIUM"
	if biome == BIOME_SERVICE:
		return "MACHINE HALL"
	return "RECEPTION"

func _room_descriptor(room: Vector2i, sample: Dictionary) -> String:
	var weight: float = float(sample["weight"])
	if weight > 0.08:
		return "TRANSITION ROOMS"

	if _is_landmark_room(room):
		return get_landmark_name_for_room(room)

	var zone: Vector2i = _zone_for_room(room)
	var pattern: int = _zone_pattern(zone)
	if _room_is_hall(room):
		if pattern == 0:
			return "EAST-WEST SPINE"
		if pattern == 1:
			return "NORTH-SOUTH SPINE"
		if pattern == 2:
			return "COURTYARD HALL"
		return "CROSS HALL"

	if _room_is_adjacent_to_hall(room):
		return "SIDE ROOMS"
	return "INNER CHAMBERS"

func _sample_name(sample: Dictionary) -> String:
	var primary: int = int(sample["primary"])
	var secondary: int = int(sample["secondary"])
	var weight: float = float(sample["weight"])
	if weight > 0.08 and primary != secondary:
		return "%s > %s" % [_biome_name(primary), _biome_name(secondary)]
	return _biome_name(primary)

func _apply_material_recursive(node: Node, material: Material) -> void:
	if node is CSGBox3D:
		var box := node as CSGBox3D
		box.material_override = material
	elif node is CSGCylinder3D:
		var cylinder := node as CSGCylinder3D
		cylinder.material_override = material
	for child in node.get_children():
		_apply_material_recursive(child, material)

func _wall_material_for_biome(biome: int) -> Material:
	if biome == BIOME_POOL:
		return POOL_TILE
	if biome == BIOME_SERVICE:
		return SERVICE_CONCRETE
	return YELLOW_WALL

func _room_for_cell(cell: Vector2i) -> Vector2i:
	return Vector2i(
		floori(float(cell.x) / float(ROOM_SIZE)),
		floori(float(cell.y) / float(ROOM_SIZE))
	)

func _zone_for_room(room: Vector2i) -> Vector2i:
	return Vector2i(
		floori(float(room.x + ZONE_HALF) / float(ZONE_ROOMS)),
		floori(float(room.y + ZONE_HALF) / float(ZONE_ROOMS))
	)

func _zone_origin_room(zone: Vector2i) -> Vector2i:
	return Vector2i(
		zone.x * ZONE_ROOMS - ZONE_HALF,
		zone.y * ZONE_ROOMS - ZONE_HALF
	)

func _local_room_in_zone(room: Vector2i, zone: Vector2i) -> Vector2i:
	return room - _zone_origin_room(zone)

func _zone_biome(zone: Vector2i) -> int:
	if zone == Vector2i.ZERO:
		return BIOME_YELLOW

	var x: float = float(zone.x)
	var z: float = float(zone.y)
	var field: float = (
		sin(x * 0.48)
		+ 0.82 * cos(z * 0.43)
		+ 0.58 * sin((x + z) * 0.21)
		+ 0.33 * cos((x - z) * 0.31)
	)

	if field > 0.90:
		return BIOME_POOL
	if field < -0.45:
		return BIOME_SERVICE
	return BIOME_YELLOW

func _biome_sample_for_room(room: Vector2i) -> Dictionary:
	return _biome_sample_at_room_coords(float(room.x) + 0.5, float(room.y) + 0.5)

func _biome_sample_at_world(position: Vector3) -> Dictionary:
	var room_x: float = (position.x + CELL * 0.5) / (CELL * ROOM_SIZE)
	var room_z: float = (position.z + CELL * 0.5) / (CELL * ROOM_SIZE)
	return _biome_sample_at_room_coords(room_x, room_z)

func _biome_sample_at_room_coords(room_x: float, room_z: float) -> Dictionary:
	var zone := Vector2i(
		floori((room_x + float(ZONE_HALF)) / float(ZONE_ROOMS)),
		floori((room_z + float(ZONE_HALF)) / float(ZONE_ROOMS))
	)
	var origin: Vector2i = _zone_origin_room(zone)
	var local_x: float = room_x - float(origin.x)
	var local_z: float = room_z - float(origin.y)
	var primary: int = _zone_biome(zone)
	var secondary: int = primary
	var edge := SIDE_EAST
	var best_weight := 0.0

	var west_biome: int = _zone_biome(zone + Vector2i(-1, 0))
	var candidate: float = _transition_weight(local_x)
	if west_biome != primary and candidate > best_weight:
		best_weight = candidate
		secondary = west_biome
		edge = SIDE_WEST

	var east_biome: int = _zone_biome(zone + Vector2i(1, 0))
	candidate = _transition_weight(float(ZONE_ROOMS) - local_x)
	if east_biome != primary and candidate > best_weight:
		best_weight = candidate
		secondary = east_biome
		edge = SIDE_EAST

	var north_biome: int = _zone_biome(zone + Vector2i(0, -1))
	candidate = _transition_weight(local_z)
	if north_biome != primary and candidate > best_weight:
		best_weight = candidate
		secondary = north_biome
		edge = SIDE_NORTH

	var south_biome: int = _zone_biome(zone + Vector2i(0, 1))
	candidate = _transition_weight(float(ZONE_ROOMS) - local_z)
	if south_biome != primary and candidate > best_weight:
		best_weight = candidate
		secondary = south_biome
		edge = SIDE_SOUTH

	return {
		"primary": primary,
		"secondary": secondary,
		"weight": best_weight,
		"edge": edge,
		"zone": zone
	}

func _transition_weight(distance_rooms: float) -> float:
	var normalized: float = 1.0 - clampf(distance_rooms / TRANSITION_ROOMS, 0.0, 1.0)
	var smooth: float = normalized * normalized * (3.0 - 2.0 * normalized)
	return smooth * 0.5

func _update_atmosphere(delta: float) -> void:
	var sample: Dictionary = _biome_sample_at_world(player.global_position)
	var primary: int = int(sample["primary"])
	var secondary: int = int(sample["secondary"])
	var weight: float = float(sample["weight"])
	var response: float = clampf(delta * 1.25, 0.0, 1.0)

	var target_background: Color = _biome_background(primary).lerp(_biome_background(secondary), weight)
	var target_ambient: Color = _biome_ambient(primary).lerp(_biome_ambient(secondary), weight)
	var target_fog: Color = _biome_fog(primary).lerp(_biome_fog(secondary), weight)
	var target_ambient_energy: float = lerpf(_biome_ambient_energy(primary), _biome_ambient_energy(secondary), weight)
	var target_fog_energy: float = lerpf(_biome_fog_energy(primary), _biome_fog_energy(secondary), weight)
	var target_fog_density: float = lerpf(_biome_fog_density(primary), _biome_fog_density(secondary), weight)
	var target_hum: float = lerpf(_biome_hum_db(primary), _biome_hum_db(secondary), weight)
	var target_atmosphere: float = lerpf(_biome_atmosphere_db(primary), _biome_atmosphere_db(secondary), weight)

	var environment: Environment = world_environment.environment
	environment.background_color = environment.background_color.lerp(target_background, response)
	environment.ambient_light_color = environment.ambient_light_color.lerp(target_ambient, response)
	environment.ambient_light_energy = lerpf(environment.ambient_light_energy, target_ambient_energy, response)
	environment.fog_light_color = environment.fog_light_color.lerp(target_fog, response)
	environment.fog_light_energy = lerpf(environment.fog_light_energy, target_fog_energy, response)
	environment.fog_density = lerpf(environment.fog_density, target_fog_density, response)
	hum.volume_db = lerpf(hum.volume_db, target_hum, response)
	atmosphere.volume_db = lerpf(atmosphere.volume_db, target_atmosphere, response)

func _biome_background(biome: int) -> Color:
	if biome == BIOME_POOL:
		return Color(0.075, 0.16, 0.16, 1.0)
	if biome == BIOME_SERVICE:
		return Color(0.035, 0.045, 0.04, 1.0)
	return Color(0.13, 0.12, 0.072, 1.0)

func _biome_ambient(biome: int) -> Color:
	if biome == BIOME_POOL:
		return Color(0.60, 0.82, 0.80, 1.0)
	if biome == BIOME_SERVICE:
		return Color(0.38, 0.43, 0.38, 1.0)
	return Color(0.76, 0.72, 0.49, 1.0)

func _biome_fog(biome: int) -> Color:
	if biome == BIOME_POOL:
		return Color(0.38, 0.61, 0.59, 1.0)
	if biome == BIOME_SERVICE:
		return Color(0.20, 0.24, 0.21, 1.0)
	return Color(0.50, 0.47, 0.29, 1.0)

func _biome_light_color(biome: int) -> Color:
	if biome == BIOME_POOL:
		return Color(0.72, 0.94, 0.96, 1.0)
	if biome == BIOME_SERVICE:
		return Color(0.72, 0.78, 0.69, 1.0)
	return Color(1.0, 0.94, 0.68, 1.0)

func _biome_light_energy(biome: int) -> float:
	if biome == BIOME_POOL:
		return 1.22
	if biome == BIOME_SERVICE:
		return 0.92
	return 1.16

func _biome_ambient_energy(biome: int) -> float:
	if biome == BIOME_POOL:
		return 0.72
	if biome == BIOME_SERVICE:
		return 0.48
	return 0.67

func _biome_fog_energy(biome: int) -> float:
	if biome == BIOME_POOL:
		return 0.58
	if biome == BIOME_SERVICE:
		return 0.48
	return 0.55

func _biome_fog_density(biome: int) -> float:
	if biome == BIOME_POOL:
		return 0.0085
	if biome == BIOME_SERVICE:
		return 0.013
	return 0.0095

func _biome_hum_db(biome: int) -> float:
	if biome == BIOME_POOL:
		return -28.0
	if biome == BIOME_SERVICE:
		return -35.0
	return -18.0

func _biome_atmosphere_db(biome: int) -> float:
	if biome == BIOME_POOL:
		return -29.0
	if biome == BIOME_SERVICE:
		return -24.0
	return -43.0

func _biome_name(biome: int) -> String:
	if biome == BIOME_POOL:
		return "POOL ROOMS"
	if biome == BIOME_SERVICE:
		return "SERVICE LEVEL"
	return "LEVEL 0"

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
