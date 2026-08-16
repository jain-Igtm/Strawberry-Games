extends Node3D

const GarageCarScript = preload("res://arthur_mobile/parking_garage/garage_car.gd")

const CELL: float = 12.0
const STOREY_HEIGHT: float = 4.4
const STREAM_RADIUS: int = 2
const CLEANUP_RADIUS: int = 3
const BUILD_BUDGET: int = 4
const RAMP_BLOCK_CELLS: int = 6
const RAMP_RUN: float = 10.25
const RAMP_WIDTH: float = 5.25

@onready var player: CharacterBody3D = $Player
@onready var tiles: Node3D = $Tiles
@onready var legacy_floor: CSGBox3D = $Floor
@onready var legacy_ceiling: CSGBox3D = $Ceiling
@onready var world_environment: WorldEnvironment = $WorldEnvironment
@onready var coords_label: Label = $UI/Overlay/Coords
@onready var title_label: Label = $UI/Overlay/InfoPanel/VBox/Title
@onready var hum: AudioStreamPlayer = $Hum
@onready var atmosphere: AudioStreamPlayer = $Atmosphere

var current_level: int = 0
var center_cell: Vector2i = Vector2i(999999, 999999)
var active_cells: Dictionary = {}
var build_queue: Array[Vector2i] = []

var concrete_floor: StandardMaterial3D
var concrete_ceiling: StandardMaterial3D
var concrete_column: StandardMaterial3D
var concrete_dark: StandardMaterial3D
var line_white: StandardMaterial3D
var line_yellow: StandardMaterial3D
var line_red: StandardMaterial3D
var fixture_mat: StandardMaterial3D
var emergency_mat: StandardMaterial3D
var glass_mat: StandardMaterial3D
var metal_mat: StandardMaterial3D
var oil_mat: StandardMaterial3D

func _ready() -> void:
	_make_materials()
	_configure_environment()
	_disable_legacy_planes()
	title_label.text = "ARTHUR // INFINITE PARKING"
	current_level = floori(player.global_position.y / STOREY_HEIGHT)
	var spawn_cell: Vector2i = _cell_from_position(player.global_position)
	_add_cell(spawn_cell)
	_update_center(true)

func _process(_delta: float) -> void:
	_maybe_switch_storey()
	_update_center(false)
	_build_some_cells()
	_cleanup_far_cells()
	_update_hud()
	if not hum.playing:
		hum.play()
	if not atmosphere.playing:
		atmosphere.play()

func _make_materials() -> void:
	concrete_floor = _mat(Color(0.31, 0.32, 0.31), 0.96)
	concrete_ceiling = _mat(Color(0.37, 0.38, 0.36), 0.94)
	concrete_column = _mat(Color(0.42, 0.43, 0.40), 0.91)
	concrete_dark = _mat(Color(0.17, 0.18, 0.18), 0.96)
	line_white = _mat(Color(0.82, 0.81, 0.70), 0.74)
	line_yellow = _mat(Color(0.82, 0.62, 0.12), 0.70)
	line_red = _mat(Color(0.60, 0.10, 0.075), 0.72)
	fixture_mat = _emissive(Color(0.86, 0.90, 0.80), 1.48)
	emergency_mat = _emissive(Color(0.88, 0.13, 0.065), 1.62)
	glass_mat = _mat(Color(0.045, 0.060, 0.065), 0.17)
	glass_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	glass_mat.albedo_color.a = 0.58
	metal_mat = _mat(Color(0.16, 0.17, 0.17), 0.61)
	metal_mat.metallic = 0.36
	oil_mat = _mat(Color(0.035, 0.032, 0.028), 0.22)

func _mat(color: Color, roughness_value: float) -> StandardMaterial3D:
	var material: StandardMaterial3D = StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness_value
	return material

func _emissive(color: Color, energy: float) -> StandardMaterial3D:
	var material: StandardMaterial3D = _mat(color, 0.40)
	material.emission_enabled = true
	material.emission = color
	material.emission_energy_multiplier = energy
	return material

func _configure_environment() -> void:
	if world_environment.environment == null:
		return
	var environment: Environment = world_environment.environment
	environment.background_color = Color(0.045, 0.048, 0.047, 1.0)
	environment.ambient_light_color = Color(0.67, 0.70, 0.64, 1.0)
	environment.ambient_light_energy = 0.43
	environment.fog_enabled = true
	environment.fog_light_color = Color(0.43, 0.47, 0.43, 1.0)
	environment.fog_light_energy = 0.48
	environment.fog_density = 0.0044

func _disable_legacy_planes() -> void:
	legacy_floor.visible = false
	legacy_floor.use_collision = false
	legacy_ceiling.visible = false
	legacy_ceiling.use_collision = false

func _cell_from_position(position: Vector3) -> Vector2i:
	return Vector2i(
		floori((position.x + CELL * 0.5) / CELL),
		floori((position.z + CELL * 0.5) / CELL)
	)

func _update_center(force: bool) -> void:
	var next_center: Vector2i = _cell_from_position(player.global_position)
	if not force and next_center == center_cell:
		return
	center_cell = next_center
	build_queue.clear()

	var pending: Array[Dictionary] = []
	for z: int in range(center_cell.y - STREAM_RADIUS, center_cell.y + STREAM_RADIUS + 1):
		for x: int in range(center_cell.x - STREAM_RADIUS, center_cell.x + STREAM_RADIUS + 1):
			var cell: Vector2i = Vector2i(x, z)
			if active_cells.has(cell):
				continue
			var delta: Vector2i = cell - center_cell
			pending.append({"cell": cell, "distance": delta.length_squared()})

	pending.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return int(a["distance"]) < int(b["distance"])
	)
	for item: Dictionary in pending:
		build_queue.append(item["cell"] as Vector2i)

func _build_some_cells() -> void:
	var count: int = mini(BUILD_BUDGET, build_queue.size())
	for _i: int in range(count):
		var cell: Vector2i = build_queue.pop_front()
		if not active_cells.has(cell):
			_add_cell(cell)

func _cleanup_far_cells() -> void:
	var remove_list: Array[Vector2i] = []
	for raw_key: Variant in active_cells.keys():
		var cell: Vector2i = raw_key as Vector2i
		if absi(cell.x - center_cell.x) > CLEANUP_RADIUS or absi(cell.y - center_cell.y) > CLEANUP_RADIUS:
			remove_list.append(cell)
	for cell: Vector2i in remove_list:
		var root: Node3D = active_cells[cell] as Node3D
		active_cells.erase(cell)
		if is_instance_valid(root):
			root.queue_free()

func _switch_storey(next_level: int) -> void:
	if next_level == current_level:
		return
	_preserve_active_vehicle()
	current_level = next_level
	for raw_root: Variant in active_cells.values():
		if raw_root is Node:
			var root: Node = raw_root as Node
			if is_instance_valid(root):
				root.queue_free()
	active_cells.clear()
	build_queue.clear()
	center_cell = Vector2i(999999, 999999)
	var cell: Vector2i = _cell_from_position(player.global_position)
	_add_cell(cell)
	_update_center(true)

func _preserve_active_vehicle() -> void:
	if not player.has_method("is_in_vehicle") or not bool(player.call("is_in_vehicle")):
		return
	if not player.has_method("get_hiding_vehicle"):
		return
	var vehicle: Node3D = player.call("get_hiding_vehicle") as Node3D
	if vehicle != null and is_instance_valid(vehicle) and vehicle.get_parent() != self:
		vehicle.reparent(self, true)

func _maybe_switch_storey() -> void:
	var base_y: float = float(current_level) * STOREY_HEIGHT
	if player.global_position.y > base_y + STOREY_HEIGHT - 0.04:
		_switch_storey(current_level + 1)
	elif player.global_position.y < base_y + 0.03:
		_switch_storey(current_level - 1)

func _add_cell(cell: Vector2i) -> void:
	if active_cells.has(cell):
		return
	var root: Node3D = Node3D.new()
	root.name = "garage_%d_%+d_%d" % [cell.x, current_level, cell.y]
	root.position = Vector3(float(cell.x) * CELL, float(current_level) * STOREY_HEIGHT, float(cell.y) * CELL)
	tiles.add_child(root)
	active_cells[cell] = root

	var ramp_up: bool = _is_ramp_cell(cell, current_level)
	var ramp_from_below: bool = _is_ramp_cell(cell, current_level - 1)
	var lane_along_x: bool = _lane_along_x(cell, current_level)

	if ramp_from_below:
		_build_open_deck(root, 0.0, lane_along_x, false)
	else:
		_solid_box(root, Vector3(0, -0.10, 0), Vector3(CELL + 0.08, 0.20, CELL + 0.08), concrete_floor, 1)

	if ramp_up:
		_build_open_deck(root, STOREY_HEIGHT, lane_along_x, true)
	else:
		_solid_box(root, Vector3(0, STOREY_HEIGHT - 0.13, 0), Vector3(CELL + 0.08, 0.20, CELL + 0.08), concrete_ceiling, 3)

	_build_structure(root, cell, lane_along_x)
	_build_markings(root, lane_along_x)

	if ramp_up:
		_build_ramp(root, 0.0, _ramp_along_x(cell, current_level))
	if ramp_from_below:
		_build_ramp(root, -STOREY_HEIGHT, _ramp_along_x(cell, current_level - 1))

	if not ramp_up and not ramp_from_below:
		var feature: int = _cell_feature(cell, current_level)
		match feature:
			0:
				_build_toll_cell(root, cell, lane_along_x)
			1:
				_build_service_cell(root, cell, lane_along_x)
			2:
				_spawn_parked_cars(root, cell, lane_along_x, 4)
			3:
				_build_abandoned_cell(root, cell, lane_along_x)
			4:
				pass
			_:
				var count: int = posmod(_hash3(cell.x, cell.y, current_level * 37 + 6101), 3)
				_spawn_parked_cars(root, cell, lane_along_x, count)
		_build_small_clutter(root, cell, lane_along_x)

	_build_lighting(root, cell, lane_along_x)

func _build_structure(root: Node3D, cell: Vector2i, lane_along_x: bool) -> void:
	for x: float in [-5.28, 5.28]:
		for z: float in [-5.28, 5.28]:
			_solid_box(root, Vector3(x, 1.88, z), Vector3(0.54, 3.76, 0.54), concrete_column, 1)

	var beam_size: Vector3 = Vector3(CELL, 0.32, 0.48) if lane_along_x else Vector3(0.48, 0.32, CELL)
	_solid_box(root, Vector3(0, STOREY_HEIGHT - 0.38, 0), beam_size, concrete_dark, 1)

	var band_seed: int = posmod(_hash3(cell.x, cell.y, current_level + 9001), 7)
	if band_seed == 0:
		var band_size: Vector3 = Vector3(0.58, 0.24, 0.59)
		for x: float in [-5.28, 5.28]:
			for z: float in [-5.28, 5.28]:
				_visual_box(root, Vector3(x, 2.26, z), band_size, line_yellow)

func _build_markings(root: Node3D, lane_along_x: bool) -> void:
	if lane_along_x:
		_visual_box(root, Vector3(0, 0.015, -2.65), Vector3(CELL - 0.55, 0.025, 0.075), line_yellow)
		_visual_box(root, Vector3(0, 0.015, 2.65), Vector3(CELL - 0.55, 0.025, 0.075), line_yellow)
		for x: float in [-4.0, 0.0, 4.0]:
			_visual_box(root, Vector3(x, 0.018, -4.35), Vector3(0.065, 0.028, 3.05), line_white)
			_visual_box(root, Vector3(x, 0.018, 4.35), Vector3(0.065, 0.028, 3.05), line_white)
	else:
		_visual_box(root, Vector3(-2.65, 0.015, 0), Vector3(0.075, 0.025, CELL - 0.55), line_yellow)
		_visual_box(root, Vector3(2.65, 0.015, 0), Vector3(0.075, 0.025, CELL - 0.55), line_yellow)
		for z: float in [-4.0, 0.0, 4.0]:
			_visual_box(root, Vector3(-4.35, 0.018, z), Vector3(3.05, 0.028, 0.065), line_white)
			_visual_box(root, Vector3(4.35, 0.018, z), Vector3(3.05, 0.028, 0.065), line_white)

func _build_lighting(root: Node3D, cell: Vector2i, lane_along_x: bool) -> void:
	var seed: int = posmod(_hash3(cell.x, cell.y, current_level * 71 + 7207), 100)
	if seed < 15:
		_visual_box(root, Vector3(0, STOREY_HEIGHT - 0.30, 0), Vector3(0.26, 0.12, 1.15), emergency_mat)
		if seed < 6:
			_add_omni(root, Vector3(0, STOREY_HEIGHT - 0.72, 0), Color(0.90, 0.16, 0.09), 0.78, 7.5)
		return

	var fixture_size: Vector3 = Vector3(3.6, 0.10, 0.24) if lane_along_x else Vector3(0.24, 0.10, 3.6)
	_visual_box(root, Vector3(0, STOREY_HEIGHT - 0.31, 0), fixture_size, fixture_mat)
	if seed % 3 == 0:
		_add_omni(root, Vector3(0, STOREY_HEIGHT - 0.78, 0), Color(0.86, 0.91, 0.81), 0.88, 11.0)

func _add_omni(root: Node3D, position: Vector3, color: Color, energy: float, range_m: float) -> void:
	var light: OmniLight3D = OmniLight3D.new()
	light.position = position
	light.light_color = color
	light.light_energy = energy
	light.omni_range = range_m
	light.shadow_enabled = false
	light.distance_fade_enabled = true
	light.distance_fade_begin = range_m + 5.0
	light.distance_fade_length = 8.0
	root.add_child(light)

func _spawn_parked_cars(root: Node3D, cell: Vector2i, lane_along_x: bool, requested_count: int) -> void:
	var positions: Array[Vector3] = []
	if lane_along_x:
		positions = [Vector3(-3.2, 0.02, -4.25), Vector3(3.1, 0.02, -4.25), Vector3(-3.0, 0.02, 4.25), Vector3(3.15, 0.02, 4.25)]
	else:
		positions = [Vector3(-4.25, 0.02, -3.2), Vector3(-4.25, 0.02, 3.1), Vector3(4.25, 0.02, -3.0), Vector3(4.25, 0.02, 3.15)]

	var count: int = mini(requested_count, positions.size())
	for index: int in range(count):
		var pick: int = posmod(_hash3(cell.x + index * 17, cell.y - index * 31, current_level * 43 + 8111), positions.size())
		var position: Vector3 = positions[pick]
		positions.remove_at(pick)
		var car_seed: int = _hash3(cell.x * 5 + index, cell.y * 7 - index, current_level + 8219)
		_spawn_car(root, position, PI * 0.5 if lane_along_x else 0.0, car_seed)

func _spawn_car(root: Node3D, position: Vector3, yaw: float, seed: int) -> void:
	var car: RigidBody3D = GarageCarScript.new() as RigidBody3D
	car.position = position
	car.rotation.y = yaw + (PI if posmod(seed, 2) == 0 else 0.0)
	car.set("body_color", _car_color(seed))
	root.add_child(car)

func _car_color(seed: int) -> Color:
	match posmod(seed, 8):
		0:
			return Color(0.19, 0.21, 0.22)
		1:
			return Color(0.55, 0.56, 0.52)
		2:
			return Color(0.33, 0.08, 0.065)
		3:
			return Color(0.08, 0.15, 0.23)
		4:
			return Color(0.20, 0.27, 0.15)
		5:
			return Color(0.52, 0.38, 0.10)
		6:
			return Color(0.10, 0.10, 0.11)
		_:
			return Color(0.72, 0.70, 0.60)

func _build_toll_cell(root: Node3D, cell: Vector2i, lane_along_x: bool) -> void:
	var side: float = -1.0 if posmod(_hash3(cell.x, cell.y, current_level + 8303), 2) == 0 else 1.0
	var booth_pos: Vector3 = Vector3(0, 1.15, side * 4.30) if lane_along_x else Vector3(side * 4.30, 1.15, 0)
	_solid_box(root, booth_pos, Vector3(2.25, 2.30, 2.25), concrete_dark, 1)
	var glass_pos: Vector3 = booth_pos + (Vector3(1.14, 0.24, 0) if not lane_along_x else Vector3(0, 0.24, 1.14) * -side)
	var glass_size: Vector3 = Vector3(0.08, 0.78, 1.45) if not lane_along_x else Vector3(1.45, 0.78, 0.08)
	_visual_box(root, glass_pos, glass_size, glass_mat)

	var stripe_pos: Vector3 = Vector3(0, 0.025, side * 2.80) if lane_along_x else Vector3(side * 2.80, 0.025, 0)
	var stripe_size: Vector3 = Vector3(CELL - 1.5, 0.03, 0.24) if lane_along_x else Vector3(0.24, 0.03, CELL - 1.5)
	_visual_box(root, stripe_pos, stripe_size, line_red)
	_add_omni(root, booth_pos + Vector3(0, 1.50, 0), Color(0.93, 0.68, 0.39), 0.60, 6.5)

func _build_service_cell(root: Node3D, cell: Vector2i, lane_along_x: bool) -> void:
	var corner_x: float = -3.95 if posmod(_hash3(cell.x, cell.y, current_level + 8401), 2) == 0 else 3.95
	var corner_z: float = -3.95 if posmod(_hash3(cell.x, cell.y, current_level + 8423), 2) == 0 else 3.95
	_solid_box(root, Vector3(corner_x, 1.35, corner_z), Vector3(2.55, 2.70, 2.55), concrete_dark, 1)
	for index: int in range(3):
		var offset: float = -0.70 + float(index) * 0.70
		if lane_along_x:
			_visual_box(root, Vector3(corner_x + offset, 2.18, corner_z - signf(corner_z) * 1.29), Vector3(0.08, 0.72, 0.06), metal_mat)
		else:
			_visual_box(root, Vector3(corner_x - signf(corner_x) * 1.29, 2.18, corner_z + offset), Vector3(0.06, 0.72, 0.08), metal_mat)
	_psychic_box(root, Vector3(-corner_x * 0.48, 0.28, -corner_z * 0.48), Vector3(0.55, 0.55, 0.55), metal_mat, 18.0)

func _build_abandoned_cell(root: Node3D, cell: Vector2i, lane_along_x: bool) -> void:
	var stain_offset: float = float(posmod(_hash3(cell.x, cell.y, current_level + 8513), 5)) - 2.0
	var stain_pos: Vector3 = Vector3(stain_offset, 0.026, 0) if lane_along_x else Vector3(0, 0.026, stain_offset)
	_visual_box(root, stain_pos, Vector3(2.8, 0.018, 1.35), oil_mat)
	for index: int in range(3):
		var local: float = -1.0 + float(index)
		var debris_pos: Vector3 = Vector3(local * 0.75, 0.20, 1.15) if lane_along_x else Vector3(1.15, 0.20, local * 0.75)
		_psychic_box(root, debris_pos, Vector3(0.35, 0.35, 0.35), concrete_dark, 5.0)

func _build_small_clutter(root: Node3D, cell: Vector2i, lane_along_x: bool) -> void:
	var seed: int = posmod(_hash3(cell.x, cell.y, current_level + 8617), 100)
	if seed > 23:
		return
	var position: Vector3 = Vector3(1.75, 0.17, -3.55) if lane_along_x else Vector3(-3.55, 0.17, 1.75)
	_psychic_box(root, position, Vector3(0.42, 0.34, 0.56), concrete_dark, 7.0)

func _psychic_box(root: Node3D, position: Vector3, size: Vector3, material: Material, mass_value: float) -> void:
	var body: RigidBody3D = RigidBody3D.new()
	body.position = position
	body.mass = mass_value
	body.collision_layer = 3
	body.collision_mask = 3
	body.add_to_group("psychic_prop")

	var mesh_instance: MeshInstance3D = MeshInstance3D.new()
	var mesh: BoxMesh = BoxMesh.new()
	mesh.size = size
	mesh_instance.mesh = mesh
	mesh_instance.material_override = material
	body.add_child(mesh_instance)

	var collision: CollisionShape3D = CollisionShape3D.new()
	var shape: BoxShape3D = BoxShape3D.new()
	shape.size = size
	collision.shape = shape
	body.add_child(collision)
	root.add_child(body)

func _build_open_deck(root: Node3D, deck_y: float, lane_along_x: bool, ceiling_deck: bool) -> void:
	var opening_width: float = RAMP_WIDTH + 0.55
	var strip: float = (CELL - opening_width) * 0.5
	var material: Material = concrete_ceiling if ceiling_deck else concrete_floor
	var layer: int = 3 if ceiling_deck else 1
	var y: float = deck_y - 0.13 if ceiling_deck else deck_y - 0.10
	if lane_along_x:
		_solid_box(root, Vector3(0, y, -(opening_width + strip) * 0.5), Vector3(CELL + 0.08, 0.20, strip + 0.06), material, layer)
		_solid_box(root, Vector3(0, y, (opening_width + strip) * 0.5), Vector3(CELL + 0.08, 0.20, strip + 0.06), material, layer)
	else:
		_solid_box(root, Vector3(-(opening_width + strip) * 0.5, y, 0), Vector3(strip + 0.06, 0.20, CELL + 0.08), material, layer)
		_solid_box(root, Vector3((opening_width + strip) * 0.5, y, 0), Vector3(strip + 0.06, 0.20, CELL + 0.08), material, layer)

func _build_ramp(root: Node3D, base_y: float, along_x: bool) -> void:
	var slope: float = atan2(STOREY_HEIGHT, RAMP_RUN)
	var length: float = sqrt(RAMP_RUN * RAMP_RUN + STOREY_HEIGHT * STOREY_HEIGHT)
	var ramp_size: Vector3 = Vector3(length, 0.34, RAMP_WIDTH) if along_x else Vector3(RAMP_WIDTH, 0.34, length)
	var ramp_position: Vector3 = Vector3(0, base_y + STOREY_HEIGHT * 0.5, 0)
	var ramp: StaticBody3D = _solid_box(root, ramp_position, ramp_size, concrete_floor, 1)
	if along_x:
		ramp.rotation.z = slope
	else:
		ramp.rotation.x = -slope

	for side: float in [-1.0, 1.0]:
		var rail_pos: Vector3
		var rail_size: Vector3
		if along_x:
			rail_pos = Vector3(0, base_y + STOREY_HEIGHT * 0.5 + 0.48, side * (RAMP_WIDTH * 0.5 + 0.08))
			rail_size = Vector3(length, 0.12, 0.12)
		else:
			rail_pos = Vector3(side * (RAMP_WIDTH * 0.5 + 0.08), base_y + STOREY_HEIGHT * 0.5 + 0.48, 0)
			rail_size = Vector3(0.12, 0.12, length)
		var rail: MeshInstance3D = _visual_box(root, rail_pos, rail_size, line_yellow)
		if along_x:
			rail.rotation.z = slope
		else:
			rail.rotation.x = -slope

func _is_ramp_cell(cell: Vector2i, lower_level: int) -> bool:
	var block_x: int = floori(float(cell.x) / float(RAMP_BLOCK_CELLS))
	var block_z: int = floori(float(cell.y) / float(RAMP_BLOCK_CELLS))
	var local_x: int = 1 + posmod(_hash3(block_x, block_z, lower_level * 131 + 9103), RAMP_BLOCK_CELLS - 2)
	var local_z: int = 1 + posmod(_hash3(block_z, block_x, lower_level * 173 + 9127), RAMP_BLOCK_CELLS - 2)
	var target: Vector2i = Vector2i(block_x * RAMP_BLOCK_CELLS + local_x, block_z * RAMP_BLOCK_CELLS + local_z)
	return cell == target

func _ramp_along_x(cell: Vector2i, lower_level: int) -> bool:
	return posmod(_hash3(cell.x, cell.y, lower_level * 193 + 9151), 2) == 0

func _lane_along_x(cell: Vector2i, level: int) -> bool:
	var block_x: int = floori(float(cell.x) / 3.0)
	var block_z: int = floori(float(cell.y) / 3.0)
	return posmod(_hash3(block_x, block_z, level * 47 + 9209), 2) == 0

func _cell_feature(cell: Vector2i, level: int) -> int:
	var roll: int = posmod(_hash3(cell.x, cell.y, level * 59 + 9301), 100)
	if roll < 3:
		return 0
	if roll < 8:
		return 1
	if roll < 13:
		return 2
	if roll < 18:
		return 3
	if roll < 23:
		return 4
	return 5

func _descriptor(cell: Vector2i) -> String:
	if _is_ramp_cell(cell, current_level) or _is_ramp_cell(cell, current_level - 1):
		return "RAMP INTERCHANGE"
	match _cell_feature(cell, current_level):
		0:
			return "ATTENDANT GATE"
		1:
			return "SERVICE CORE"
		2:
			return "DENSE PARKING"
		3:
			return "ABANDONED BAY"
		4:
			return "EMPTY DECK"
		_:
			return "PARKING AISLE"

func _update_hud() -> void:
	var cell: Vector2i = _cell_from_position(player.global_position)
	var mode: String = "ON FOOT"
	if player.has_method("is_in_vehicle") and bool(player.call("is_in_vehicle")):
		mode = "DRIVING"
	coords_label.text = "INFINITE PARKING  //  %s  //  LEVEL %+d  //  %s  //  %d, %d  //  y %.1f" % [
		mode,
		current_level,
		_descriptor(cell),
		int(player.global_position.x),
		int(player.global_position.z),
		player.global_position.y
	]

func _solid_box(root: Node3D, position: Vector3, size: Vector3, material: Material, layer: int) -> StaticBody3D:
	var body: StaticBody3D = StaticBody3D.new()
	body.position = position
	body.collision_layer = layer
	body.collision_mask = 3

	var mesh_instance: MeshInstance3D = MeshInstance3D.new()
	var mesh: BoxMesh = BoxMesh.new()
	mesh.size = size
	mesh_instance.mesh = mesh
	mesh_instance.material_override = material
	body.add_child(mesh_instance)

	var collision: CollisionShape3D = CollisionShape3D.new()
	var shape: BoxShape3D = BoxShape3D.new()
	shape.size = size
	collision.shape = shape
	body.add_child(collision)
	root.add_child(body)
	return body

func _visual_box(root: Node3D, position: Vector3, size: Vector3, material: Material) -> MeshInstance3D:
	var mesh_instance: MeshInstance3D = MeshInstance3D.new()
	var mesh: BoxMesh = BoxMesh.new()
	mesh.size = size
	mesh_instance.mesh = mesh
	mesh_instance.material_override = material
	mesh_instance.position = position
	root.add_child(mesh_instance)
	return mesh_instance

func _hash3(x: int, z: int, salt: int) -> int:
	var value: int = x * 374761393 + z * 668265263 + salt * 69069
	value = (value ^ (value >> 13)) * 1274126177
	return value ^ (value >> 16)