extends Node3D

const CELL := 4.0
const ROOM_SIZE := 6
const ZONE_ROOMS := 8
const ZONE_HALF := 4
const TRANSITION_ROOMS := 2.6
const PLAN_BLOCK_CELLS := 12
const LOAD_RADIUS := 11
const UNLOAD_RADIUS := 14
const ADD_PER_FRAME := 18
const WORLD_SEED := 0x41A7F29D

const EDGE_OPEN := 0
const EDGE_DOOR := 1
const EDGE_SOLID := 2

const SIDE_EAST := 0
const SIDE_WEST := 1
const SIDE_SOUTH := 2
const SIDE_NORTH := 3

const YellowPlanScript = preload("res://arthur_mobile/yellow_plan.gd")
const YellowDecorScript = preload("res://arthur_mobile/yellow_decor.gd")

const WALL_NEG_X: PackedScene = preload("res://procedural/backrooms/wallnegativex.tscn")
const WALL_NEG_Z: PackedScene = preload("res://procedural/backrooms/wallnegativez.tscn")
const DOOR_X: PackedScene = preload("res://arthur_mobile/doorway_x.tscn")
const DOOR_Z: PackedScene = preload("res://arthur_mobile/doorway_z.tscn")
const LIGHT: PackedScene = preload("res://arthur_mobile/light.tscn")
const CRT: PackedScene = preload("res://assets/models/crt/crttv_2.scn")

const POOL_SHELL: PackedScene = preload("res://arthur_mobile/pool_shell.tscn")
const POOL_ROOM: PackedScene = preload("res://arthur_mobile/pool_room.tscn")
const POOL_ARCADE: PackedScene = preload("res://arthur_mobile/pool_arcade.tscn")
const POOL_ATRIUM: PackedScene = preload("res://arthur_mobile/landmark_pool_atrium.tscn")
const SERVICE_SHELL: PackedScene = preload("res://arthur_mobile/service_shell.tscn")
const SERVICE_DECOR_SMALL: PackedScene = preload("res://arthur_mobile/service_decor_small.tscn")

const TRANSITION_YELLOW_POOL_SMALL: PackedScene = preload("res://arthur_mobile/transition_yellow_pool_small.tscn")
const TRANSITION_YELLOW_SERVICE_SMALL: PackedScene = preload("res://arthur_mobile/transition_yellow_service_small.tscn")
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

var yellow_plan: RefCounted
var yellow_decor: RefCounted
var active_tiles: Dictionary = {}
var build_queue: Array[Vector2i] = []
var center_cell := Vector2i(999999, 999999)
var cleanup_cursor := 0

func _ready() -> void:
	yellow_plan = YellowPlanScript.new()
	yellow_decor = YellowDecorScript.new()
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
	var sample: Dictionary = _biome_sample_for_cell(player_cell)
	coords_label.text = "%s  //  %s  //  %d, %d" % [
		_sample_name(sample),
		_location_descriptor(player_cell, sample),
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

	var sample: Dictionary = _biome_sample_for_cell(cell)
	var primary: int = int(sample["primary"])
	var wall_material: Material = _wall_material_for_biome(primary)

	_add_topology(root, cell, wall_material)
	_add_light_for_cell(root, cell, sample)

	if primary == BIOME_YELLOW:
		_add_yellow_content(root, cell, sample)
	elif primary == BIOME_SERVICE:
		_add_service_content(root, cell, sample)
	else:
		_add_pool_content(root, cell, sample)

	tiles.add_child(root)
	active_tiles[cell] = root

func _add_topology(root: Node3D, cell: Vector2i, material: Material) -> void:
	var west := cell + Vector2i(-1, 0)
	var north := cell + Vector2i(0, -1)
	_add_edge_piece(root, _topology_edge(cell, west), true, material)
	_add_edge_piece(root, _topology_edge(cell, north), false, material)

func _topology_edge(a: Vector2i, b: Vector2i) -> int:
	var biome_a: int = int(_biome_sample_for_cell(a)["primary"])
	var biome_b: int = int(_biome_sample_for_cell(b)["primary"])
	var plan_edge: int = int(yellow_plan.call("edge_kind", a, b))

	if biome_a == BIOME_POOL and biome_b == BIOME_POOL:
		var block_a: Vector2i = _plan_block_for_cell(a)
		var block_b: Vector2i = _plan_block_for_cell(b)
		if block_a == block_b and _pool_block_is_open(block_a):
			return EDGE_OPEN
		return plan_edge

	if biome_a == BIOME_POOL or biome_b == BIOME_POOL:
		return EDGE_DOOR if plan_edge == EDGE_OPEN else EDGE_SOLID

	return plan_edge

func _add_edge_piece(root: Node3D, kind: int, x_wall: bool, material: Material) -> void:
	if kind == EDGE_OPEN:
		return
	var scene: PackedScene
	if kind == EDGE_DOOR:
		scene = DOOR_X if x_wall else DOOR_Z
	else:
		scene = WALL_NEG_X if x_wall else WALL_NEG_Z
	var piece: Node = scene.instantiate()
	_apply_material_recursive(piece, material)
	root.add_child(piece)

func _add_light_for_cell(root: Node3D, cell: Vector2i, sample: Dictionary) -> void:
	var primary: int = int(sample["primary"])
	var place := false
	if primary == BIOME_POOL and _pool_block_is_open(_plan_block_for_cell(cell)):
		place = ((cell.x & 1) == 0 and (cell.y & 1) == 0)
	elif bool(yellow_plan.call("is_corridor", cell)):
		place = _hash(cell.x, cell.y, 4101) % 3 == 0
	elif bool(yellow_plan.call("is_room_anchor", cell)):
		var info: Dictionary = yellow_plan.call("room_info", cell) as Dictionary
		place = int(info.get("width", 1)) * int(info.get("height", 1)) >= 2

	if not place:
		return

	var fixture: Node3D = LIGHT.instantiate()
	fixture.rotation.y = float(_hash(cell.x, cell.y, 4111) & 1) * PI * 0.5
	var spot: SpotLight3D = fixture.get_node_or_null("SpotLight3D") as SpotLight3D
	if spot != null:
		var secondary: int = int(sample["secondary"])
		var weight: float = float(sample["weight"])
		spot.light_color = _biome_light_color(primary).lerp(_biome_light_color(secondary), weight)
		spot.light_energy = lerpf(_biome_light_energy(primary), _biome_light_energy(secondary), weight)
	root.add_child(fixture)

func _add_yellow_content(root: Node3D, cell: Vector2i, sample: Dictionary) -> void:
	if bool(yellow_plan.call("is_corridor", cell)):
		var width: int = int(yellow_plan.call("corridor_width_for_cell", cell))
		yellow_decor.call("decorate_corridor", root, cell, width)
		return

	if not bool(yellow_plan.call("is_room_anchor", cell)):
		return

	var info: Dictionary = yellow_plan.call("room_info", cell) as Dictionary
	yellow_decor.call("decorate_room", root, info, float(sample["weight"]), int(sample["secondary"]))
	_add_small_transition_detail(root, sample)

	if _hash(cell.x, cell.y, 4201) % 29 == 0:
		_add_crt(root, Vector3(0.7, 0.55, -0.8), _hash(cell.x, cell.y, 4207) % 4)

func _add_service_content(root: Node3D, cell: Vector2i, sample: Dictionary) -> void:
	var room: Vector2i = _room_for_cell(cell)
	var local_x: int = _positive_mod(cell.x, ROOM_SIZE)
	var local_z: int = _positive_mod(cell.y, ROOM_SIZE)
	if local_x == 0 and local_z == 0:
		_add_primary_shell(root, _macro_room_center(), BIOME_SERVICE)
		_add_large_transition_detail(root, sample, _macro_room_center())

	if bool(yellow_plan.call("is_room_anchor", cell)):
		var info: Dictionary = yellow_plan.call("room_info", cell) as Dictionary
		var width: int = int(info.get("width", 1))
		var height: int = int(info.get("height", 1))
		if width >= 2 and height >= 2 and _hash(cell.x, cell.y, 4301) % 3 != 0:
			var feature: Node3D = SERVICE_DECOR_SMALL.instantiate()
			feature.rotation.y = float(_hash(cell.x, cell.y, 4311) % 4) * PI * 0.5
			root.add_child(feature)

func _add_pool_content(root: Node3D, cell: Vector2i, sample: Dictionary) -> void:
	var room: Vector2i = _room_for_cell(cell)
	var local_x: int = _positive_mod(cell.x, ROOM_SIZE)
	var local_z: int = _positive_mod(cell.y, ROOM_SIZE)
	if local_x != 0 or local_z != 0:
		return

	var center: Vector3 = _macro_room_center()
	_add_primary_shell(root, center, BIOME_POOL)
	_add_large_transition_detail(root, sample, center)

	var block: Vector2i = _plan_block_for_cell(cell)
	var roll: int = _hash(room.x, room.y, 4401)
	if _pool_block_is_open(block):
		if _is_pool_landmark_room(room):
			_add_feature(root, POOL_ATRIUM, center, 0.0)
		elif roll % 3 == 0:
			_add_feature(root, POOL_ARCADE, center, float(roll & 1) * PI * 0.5)
		elif roll % 5 == 0:
			_add_feature(root, POOL_ROOM, center, float((roll >> 2) & 1) * PI * 0.5)
	else:
		if roll % 2 == 0:
			_add_feature(root, POOL_ROOM, center, float(roll & 1) * PI * 0.5)
		elif roll % 5 == 0:
			_add_feature(root, POOL_ARCADE, center, float((roll >> 2) & 1) * PI * 0.5)

func _add_primary_shell(root: Node3D, center: Vector3, biome: int) -> void:
	var shell_scene: PackedScene = POOL_SHELL if biome == BIOME_POOL else SERVICE_SHELL
	var shell: Node3D = shell_scene.instantiate()
	shell.position = center
	root.add_child(shell)

func _add_feature(root: Node3D, scene: PackedScene, center: Vector3, rotation_y: float) -> void:
	var feature: Node3D = scene.instantiate()
	feature.position = center
	feature.rotation.y = rotation_y
	root.add_child(feature)

func _add_small_transition_detail(root: Node3D, sample: Dictionary) -> void:
	var weight: float = float(sample["weight"])
	if weight < 0.12:
		return
	var secondary: int = int(sample["secondary"])
	var detail_scene: PackedScene
	if secondary == BIOME_POOL:
		detail_scene = TRANSITION_YELLOW_POOL_SMALL
	elif secondary == BIOME_SERVICE:
		detail_scene = TRANSITION_YELLOW_SERVICE_SMALL
	else:
		return
	var detail: Node3D = detail_scene.instantiate()
	detail.rotation.y = _transition_rotation(sample)
	detail.scale = Vector3.ONE * lerpf(0.72, 1.0, clampf(weight * 2.0, 0.0, 1.0))
	root.add_child(detail)

func _add_large_transition_detail(root: Node3D, sample: Dictionary, center: Vector3) -> void:
	var weight: float = float(sample["weight"])
	if weight < 0.14:
		return
	var primary: int = int(sample["primary"])
	var secondary: int = int(sample["secondary"])
	if primary == secondary:
		return
	var transition_scene: PackedScene
	if (primary == BIOME_YELLOW and secondary == BIOME_POOL) or (primary == BIOME_POOL and secondary == BIOME_YELLOW):
		transition_scene = TRANSITION_YELLOW_POOL
	elif (primary == BIOME_YELLOW and secondary == BIOME_SERVICE) or (primary == BIOME_SERVICE and secondary == BIOME_YELLOW):
		transition_scene = TRANSITION_YELLOW_SERVICE
	else:
		transition_scene = TRANSITION_POOL_SERVICE
	var transition: Node3D = transition_scene.instantiate()
	transition.position = center
	transition.rotation.y = _transition_rotation(sample)
	transition.scale = Vector3.ONE * lerpf(0.72, 1.0, clampf(weight * 2.0, 0.0, 1.0))
	root.add_child(transition)

func _macro_room_center() -> Vector3:
	return Vector3((ROOM_SIZE - 1) * CELL * 0.5, 0.0, (ROOM_SIZE - 1) * CELL * 0.5)

func _pool_block_is_open(block: Vector2i) -> bool:
	return _hash(block.x, block.y, 4501) % 5 < 2

func _plan_block_for_cell(cell: Vector2i) -> Vector2i:
	return Vector2i(
		floori(float(cell.x) / float(PLAN_BLOCK_CELLS)),
		floori(float(cell.y) / float(PLAN_BLOCK_CELLS))
	)

func _is_pool_landmark_room(room: Vector2i) -> bool:
	var block_cell := Vector2i(room.x * ROOM_SIZE, room.y * ROOM_SIZE)
	var block: Vector2i = _plan_block_for_cell(block_cell)
	if not _pool_block_is_open(block):
		return false
	var local_macro_x: int = _positive_mod(room.x, 2)
	var local_macro_z: int = _positive_mod(room.y, 2)
	return local_macro_x == 0 and local_macro_z == 0 and _hash(block.x, block.y, 4513) % 3 == 0

func is_landmark_room(room: Vector2i) -> bool:
	var cell := Vector2i(room.x * ROOM_SIZE, room.y * ROOM_SIZE)
	var biome: int = int(_biome_sample_for_cell(cell)["primary"])
	return biome == BIOME_POOL and _is_pool_landmark_room(room)

func get_landmark_name_for_room(room: Vector2i) -> String:
	return "ATRIUM" if is_landmark_room(room) else ""

func _location_descriptor(cell: Vector2i, sample: Dictionary) -> String:
	var primary: int = int(sample["primary"])
	if primary == BIOME_POOL:
		var block: Vector2i = _plan_block_for_cell(cell)
		if _pool_block_is_open(block):
			return "OPEN POOL HALL"
		return "TILED HALL" if bool(yellow_plan.call("is_corridor", cell)) else "TILED CHAMBER"

	if bool(yellow_plan.call("is_corridor", cell)):
		var width: int = int(yellow_plan.call("corridor_width_for_cell", cell))
		return "WIDE HALLWAY" if width > 1 else "HALLWAY"

	if primary == BIOME_SERVICE:
		return "UTILITY ROOM"
	var info: Dictionary = yellow_plan.call("room_info", cell) as Dictionary
	return str(yellow_decor.call("room_name", info))

func _wall_material_for_biome(biome: int) -> Material:
	if biome == BIOME_POOL:
		return POOL_TILE
	if biome == BIOME_SERVICE:
		return SERVICE_CONCRETE
	return YELLOW_WALL

func _apply_material_recursive(node: Node, material: Material) -> void:
	if node is CSGBox3D:
		var box := node as CSGBox3D
		box.material_override = material
	elif node is CSGCylinder3D:
		var cylinder := node as CSGCylinder3D
		cylinder.material_override = material
	for child in node.get_children():
		_apply_material_recursive(child, material)

func _add_crt(root: Node3D, position: Vector3, quarter_turns: int) -> void:
	var crt: Node3D = CRT.instantiate()
	crt.position = position
	crt.rotation.y = float(quarter_turns % 4) * PI * 0.5
	crt.scale = Vector3.ONE * 1.08
	root.add_child(crt)

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
	return Vector2i(zone.x * ZONE_ROOMS - ZONE_HALF, zone.y * ZONE_ROOMS - ZONE_HALF)

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

func _biome_sample_for_cell(cell: Vector2i) -> Dictionary:
	var room: Vector2i = _room_for_cell(cell)
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

func _transition_rotation(sample: Dictionary) -> float:
	var edge: int = int(sample["edge"])
	if edge == SIDE_WEST:
		return PI
	if edge == SIDE_SOUTH:
		return -PI * 0.5
	if edge == SIDE_NORTH:
		return PI * 0.5
	return 0.0

func _update_atmosphere(delta: float) -> void:
	var sample: Dictionary = _biome_sample_at_world(player.global_position)
	var primary: int = int(sample["primary"])
	var secondary: int = int(sample["secondary"])
	var weight: float = float(sample["weight"])
	var response: float = clampf(delta * 1.05, 0.0, 1.0)

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
	return Color(0.115, 0.105, 0.064, 1.0)

func _biome_ambient(biome: int) -> Color:
	if biome == BIOME_POOL:
		return Color(0.60, 0.82, 0.80, 1.0)
	if biome == BIOME_SERVICE:
		return Color(0.38, 0.43, 0.38, 1.0)
	return Color(0.80, 0.75, 0.52, 1.0)

func _biome_fog(biome: int) -> Color:
	if biome == BIOME_POOL:
		return Color(0.38, 0.61, 0.59, 1.0)
	if biome == BIOME_SERVICE:
		return Color(0.20, 0.24, 0.21, 1.0)
	return Color(0.48, 0.45, 0.29, 1.0)

func _biome_light_color(biome: int) -> Color:
	if biome == BIOME_POOL:
		return Color(0.72, 0.94, 0.96, 1.0)
	if biome == BIOME_SERVICE:
		return Color(0.72, 0.78, 0.69, 1.0)
	return Color(1.0, 0.95, 0.72, 1.0)

func _biome_light_energy(biome: int) -> float:
	if biome == BIOME_POOL:
		return 1.22
	if biome == BIOME_SERVICE:
		return 0.92
	return 1.24

func _biome_ambient_energy(biome: int) -> float:
	if biome == BIOME_POOL:
		return 0.72
	if biome == BIOME_SERVICE:
		return 0.48
	return 0.73

func _biome_fog_energy(biome: int) -> float:
	if biome == BIOME_POOL:
		return 0.58
	if biome == BIOME_SERVICE:
		return 0.48
	return 0.53

func _biome_fog_density(biome: int) -> float:
	if biome == BIOME_POOL:
		return 0.0085
	if biome == BIOME_SERVICE:
		return 0.013
	return 0.0068

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

func _sample_name(sample: Dictionary) -> String:
	var primary: int = int(sample["primary"])
	var secondary: int = int(sample["secondary"])
	var weight: float = float(sample["weight"])
	if weight > 0.10 and primary != secondary:
		return "%s > %s" % [_biome_name(primary), _biome_name(secondary)]
	return _biome_name(primary)

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

func _hash(x: int, z: int, salt: int) -> int:
	var n: int = x * 374761393 + z * 668265263 + WORLD_SEED + salt * 1442695041
	n = (n ^ (n >> 13)) * 1274126177
	n = n ^ (n >> 16)
	return absi(n)
