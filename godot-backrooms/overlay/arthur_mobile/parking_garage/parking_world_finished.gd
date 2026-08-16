extends "res://arthur_mobile/parking_garage/parking_world.gd"

# Final environment layer for the parking branch. The base script still owns the
# proven streaming, storey switching, collision helpers, and Arthur integration.
# This layer makes the generated space read as one garage instead of unrelated
# tiles by moving decisions up to district scale and adding authored landmarks.

const DISTRICT_CELLS: int = 8
const DISTRICT_PUBLIC: int = 0
const DISTRICT_LONG_TERM: int = 1
const DISTRICT_SERVICE: int = 2
const DISTRICT_TRANSIT: int = 3
const DISTRICT_ABANDONED: int = 4
const DISTRICT_RESERVED: int = 5

var accent_blue: StandardMaterial3D
var accent_green: StandardMaterial3D
var accent_orange: StandardMaterial3D
var accent_red: StandardMaterial3D
var accent_cyan: StandardMaterial3D
var accent_violet: StandardMaterial3D
var sign_dark: StandardMaterial3D
var painted_white: StandardMaterial3D
var rubber_mat: StandardMaterial3D
var duct_mat: StandardMaterial3D
var screen_mat: StandardMaterial3D
var warm_fixture_mat: StandardMaterial3D
var cool_fixture_mat: StandardMaterial3D

func _ready() -> void:
	super._ready()
	title_label.text = "ARTHUR // INFINITE PARKING"
	hum.volume_db = -18.0
	atmosphere.volume_db = -38.0

func _make_materials() -> void:
	super._make_materials()
	accent_blue = _mat(Color(0.11, 0.32, 0.48), 0.68)
	accent_green = _mat(Color(0.12, 0.39, 0.29), 0.70)
	accent_orange = _mat(Color(0.69, 0.33, 0.08), 0.72)
	accent_red = _mat(Color(0.52, 0.09, 0.08), 0.74)
	accent_cyan = _mat(Color(0.10, 0.42, 0.45), 0.66)
	accent_violet = _mat(Color(0.31, 0.20, 0.43), 0.72)
	sign_dark = _mat(Color(0.035, 0.047, 0.052), 0.42)
	painted_white = _mat(Color(0.78, 0.80, 0.76), 0.82)
	rubber_mat = _mat(Color(0.055, 0.058, 0.057), 0.98)
	duct_mat = _mat(Color(0.31, 0.34, 0.34), 0.58)
	duct_mat.metallic = 0.25
	screen_mat = _emissive(Color(0.31, 0.84, 0.75), 1.85)
	warm_fixture_mat = _emissive(Color(0.94, 0.76, 0.49), 1.42)
	cool_fixture_mat = _emissive(Color(0.73, 0.88, 0.91), 1.45)

func _configure_environment() -> void:
	super._configure_environment()
	if world_environment.environment == null:
		return
	var environment: Environment = world_environment.environment
	environment.background_color = Color(0.027, 0.032, 0.033, 1.0)
	environment.ambient_light_color = Color(0.56, 0.60, 0.57, 1.0)
	environment.ambient_light_energy = 0.34
	environment.fog_light_color = Color(0.31, 0.36, 0.34, 1.0)
	environment.fog_light_energy = 0.38
	environment.fog_density = 0.0036

func _build_some_cells() -> void:
	# Two or three cells per frame is less spiky on mobile than the original four.
	var budget: int = 2
	if player.velocity.length_squared() < 3.0:
		budget = 3
	var count: int = mini(budget, build_queue.size())
	for _i: int in range(count):
		var cell: Vector2i = build_queue.pop_front()
		if not active_cells.has(cell):
			_add_cell(cell)

func _district_of(cell: Vector2i) -> Vector2i:
	return Vector2i(
		floori(float(cell.x) / float(DISTRICT_CELLS)),
		floori(float(cell.y) / float(DISTRICT_CELLS))
	)

func _district_local(cell: Vector2i) -> Vector2i:
	var district: Vector2i = _district_of(cell)
	return cell - district * DISTRICT_CELLS

func _district_type(cell: Vector2i, level: int) -> int:
	var district: Vector2i = _district_of(cell)
	if district == Vector2i.ZERO and level == 0:
		return DISTRICT_PUBLIC
	return posmod(_hash3(district.x, district.y, level * 401 + 14011), 6)

func _district_lane_along_x(cell: Vector2i, level: int) -> bool:
	var district: Vector2i = _district_of(cell)
	return posmod(_hash3(district.x, district.y, level * 67 + 14107), 2) == 0

func _lane_along_x(cell: Vector2i, level: int) -> bool:
	return _district_lane_along_x(cell, level)

func _is_ramp_cell(cell: Vector2i, lower_level: int) -> bool:
	var district: Vector2i = _district_of(cell)
	var local_x: int = 2 + posmod(_hash3(district.x, district.y, lower_level * 109 + 14221), 4)
	var local_z: int = 2 + posmod(_hash3(district.y, district.x, lower_level * 137 + 14243), 4)
	var target: Vector2i = district * DISTRICT_CELLS + Vector2i(local_x, local_z)
	return cell == target

func _ramp_along_x(cell: Vector2i, lower_level: int) -> bool:
	return _district_lane_along_x(cell, lower_level)

func _cell_feature(cell: Vector2i, level: int) -> int:
	var local: Vector2i = _district_local(cell)
	var kind: int = _district_type(cell, level)
	var roll: int = posmod(_hash3(cell.x, cell.y, level * 79 + 14303), 100)

	if level == 0 and cell == Vector2i.ZERO:
		return 4
	if local == Vector2i(1, 1):
		return 4
	if local == Vector2i(6, 5):
		return 0
	if local == Vector2i(3, 6) and kind == DISTRICT_SERVICE:
		return 1

	match kind:
		DISTRICT_PUBLIC:
			if roll < 12:
				return 2
			if roll < 18:
				return 4
		DISTRICT_LONG_TERM:
			if roll < 58:
				return 2
			if roll < 68:
				return 3
		DISTRICT_SERVICE:
			if roll < 30:
				return 1
			if roll < 48:
				return 3
			if roll < 60:
				return 4
		DISTRICT_TRANSIT:
			if roll < 52:
				return 4
			if roll < 61:
				return 0
		DISTRICT_ABANDONED:
			if roll < 55:
				return 3
			if roll < 76:
				return 4
		DISTRICT_RESERVED:
			if roll < 18:
				return 2
			if roll < 44:
				return 4
	return 5

func _add_cell(cell: Vector2i) -> void:
	super._add_cell(cell)
	if not active_cells.has(cell):
		return
	var root: Node3D = active_cells[cell] as Node3D
	var lane_along_x: bool = _lane_along_x(cell, current_level)
	_build_finished_details(root, cell, lane_along_x)

func _build_structure(root: Node3D, cell: Vector2i, lane_along_x: bool) -> void:
	super._build_structure(root, cell, lane_along_x)
	var accent: Material = _district_accent_material(cell, current_level)
	for x: float in [-5.28, 5.28]:
		for z: float in [-5.28, 5.28]:
			_visual_box(root, Vector3(x, 2.18, z), Vector3(0.59, 0.30, 0.59), accent)

	var utility_seed: int = posmod(_hash3(cell.x, cell.y, current_level * 181 + 14419), 10)
	if utility_seed <= 2:
		var side: float = -1.0 if utility_seed % 2 == 0 else 1.0
		_visual_box(root, _lane_pos(0.0, 3.76, side * 4.70, lane_along_x), _lane_size(8.8, 0.38, 0.58, lane_along_x), duct_mat)
		_visual_box(root, _lane_pos(0.0, 3.48, side * 5.06, lane_along_x), _lane_size(9.5, 0.12, 0.12, lane_along_x), accent)

func _build_markings(root: Node3D, lane_along_x: bool) -> void:
	super._build_markings(root, lane_along_x)
	_build_floor_arrow(root, lane_along_x)

func _build_floor_arrow(root: Node3D, lane_along_x: bool) -> void:
	var stem: MeshInstance3D = _visual_box(root, _lane_pos(0.0, 0.034, 0.0, lane_along_x), _lane_size(1.55, 0.026, 0.16, lane_along_x), line_white)
	var left_head: MeshInstance3D = _visual_box(root, _lane_pos(0.70, 0.036, -0.27, lane_along_x), _lane_size(0.72, 0.026, 0.13, lane_along_x), line_white)
	var right_head: MeshInstance3D = _visual_box(root, _lane_pos(0.70, 0.036, 0.27, lane_along_x), _lane_size(0.72, 0.026, 0.13, lane_along_x), line_white)
	if lane_along_x:
		left_head.rotation.y = -0.62
		right_head.rotation.y = 0.62
	else:
		left_head.rotation.y = 0.62
		right_head.rotation.y = -0.62
	stem.visible = true

func _build_lighting(root: Node3D, cell: Vector2i, lane_along_x: bool) -> void:
	var kind: int = _district_type(cell, current_level)
	var seed: int = posmod(_hash3(cell.x, cell.y, current_level * 97 + 14503), 100)
	var fixture_material: Material = fixture_mat
	var light_color: Color = Color(0.82, 0.88, 0.80)
	var light_energy: float = 0.82

	if kind == DISTRICT_SERVICE:
		fixture_material = warm_fixture_mat
		light_color = Color(0.93, 0.72, 0.45)
	elif kind == DISTRICT_RESERVED:
		fixture_material = cool_fixture_mat
		light_color = Color(0.66, 0.85, 0.89)
	elif kind == DISTRICT_ABANDONED and seed < 44:
		_visual_box(root, _lane_pos(0.0, STOREY_HEIGHT - 0.30, 0.0, lane_along_x), _lane_size(1.1, 0.10, 0.20, lane_along_x), emergency_mat)
		if seed < 12:
			_add_omni(root, Vector3(0, STOREY_HEIGHT - 0.76, 0), Color(0.88, 0.12, 0.08), 0.70, 8.0)
		return

	for forward: float in [-3.15, 3.15]:
		_visual_box(root, _lane_pos(forward, STOREY_HEIGHT - 0.30, 0.0, lane_along_x), _lane_size(2.55, 0.09, 0.21, lane_along_x), fixture_material)

	if seed % 3 == 0:
		_add_omni(root, Vector3(0, STOREY_HEIGHT - 0.82, 0), light_color, light_energy, 11.5)

func _build_finished_details(root: Node3D, cell: Vector2i, lane_along_x: bool) -> void:
	var local: Vector2i = _district_local(cell)
	var kind: int = _district_type(cell, current_level)

	if current_level == 0 and cell == Vector2i.ZERO:
		_build_arrival_hub(root, lane_along_x)
	elif local == Vector2i(1, 1):
		_build_vertical_core(root, cell, lane_along_x)
	elif kind == DISTRICT_SERVICE and local == Vector2i(3, 6):
		_build_maintenance_room(root, cell, lane_along_x)
	elif kind == DISTRICT_ABANDONED and local == Vector2i(6, 6):
		_build_false_exit(root, cell, lane_along_x)
	elif kind == DISTRICT_RESERVED and local == Vector2i(2, 5):
		_build_security_island(root, cell, lane_along_x)
	elif kind == DISTRICT_LONG_TERM and local == Vector2i(5, 1):
		_build_storage_cage(root, cell, lane_along_x)
	elif kind == DISTRICT_TRANSIT and local == Vector2i(4, 4):
		_build_pay_bank(root, cell, lane_along_x)

	if kind == DISTRICT_SERVICE and posmod(_hash3(cell.x, cell.y, current_level + 14621), 5) == 0:
		_build_pipe_run(root, cell, lane_along_x)
	elif kind == DISTRICT_TRANSIT and posmod(_hash3(cell.x, cell.y, current_level + 14627), 6) == 0:
		_build_bollard_row(root, lane_along_x)
	elif kind == DISTRICT_ABANDONED and posmod(_hash3(cell.x, cell.y, current_level + 14633), 7) == 0:
		_build_broken_barrier(root, lane_along_x)

	if _is_ramp_cell(cell, current_level) or _is_ramp_cell(cell, current_level - 1):
		_build_ramp_sign(root, cell, lane_along_x)
	elif local == Vector2i.ZERO or posmod(_hash3(cell.x, cell.y, current_level + 14639), 17) == 0:
		_add_overhead_sign(root, _zone_sign_text(cell, current_level), lane_along_x, _district_accent_color(cell, current_level))

func _build_arrival_hub(root: Node3D, lane_along_x: bool) -> void:
	_add_overhead_sign(root, "CENTRAL  /  LEVEL 0", lane_along_x, Color(0.35, 0.84, 0.77))
	for forward: float in [-1.75, 0.0, 1.75]:
		var kiosk_pos: Vector3 = _lane_pos(forward, 0.62, 4.65, lane_along_x)
		_solid_box(root, kiosk_pos, _lane_size(0.75, 1.24, 0.48, lane_along_x), sign_dark, 1)
		_visual_box(root, kiosk_pos + Vector3(0, 0.24, 0), _lane_size(0.42, 0.34, 0.03, lane_along_x), screen_mat)
	for forward: float in [-3.8, -2.8, 2.8, 3.8]:
		_visual_box(root, _lane_pos(forward, 0.38, 3.55, lane_along_x), _lane_size(0.18, 0.76, 0.18, lane_along_x), accent_cyan)
	for forward: float in [-4.0, -2.0, 0.0, 2.0, 4.0]:
		_visual_box(root, _lane_pos(forward, 0.040, 1.15, lane_along_x), _lane_size(0.72, 0.022, 1.75, lane_along_x), painted_white)

func _build_vertical_core(root: Node3D, cell: Vector2i, lane_along_x: bool) -> void:
	var side: float = -1.0 if posmod(_hash3(cell.x, cell.y, current_level + 14713), 2) == 0 else 1.0
	var accent: Material = _district_accent_material(cell, current_level)
	_solid_box(root, _lane_pos(0.0, 1.50, side * 5.62, lane_along_x), _lane_size(5.30, 3.00, 0.24, lane_along_x), concrete_dark, 1)
	for forward: float in [-2.52, 2.52]:
		_solid_box(root, _lane_pos(forward, 1.50, side * 4.47, lane_along_x), _lane_size(0.24, 3.00, 2.30, lane_along_x), concrete_dark, 1)
	for forward: float in [-1.95, 1.95]:
		_solid_box(root, _lane_pos(forward, 1.50, side * 3.34, lane_along_x), _lane_size(1.15, 3.00, 0.20, lane_along_x), concrete_dark, 1)
	for forward: float in [-0.78, 0.78]:
		_visual_box(root, _lane_pos(forward, 1.18, side * 5.47, lane_along_x), _lane_size(1.24, 2.22, 0.055, lane_along_x), metal_mat)
		_visual_box(root, _lane_pos(forward, 2.43, side * 5.44, lane_along_x), _lane_size(1.24, 0.10, 0.06, lane_along_x), accent)
	_visual_box(root, _lane_pos(0.0, 1.24, side * 5.35, lane_along_x), _lane_size(0.12, 0.30, 0.05, lane_along_x), screen_mat)
	_add_side_label(root, _lane_pos(0.0, 2.72, side * 3.21, lane_along_x), "LIFT  /  STAIRS", lane_along_x, side, _district_accent_color(cell, current_level))

func _build_maintenance_room(root: Node3D, cell: Vector2i, lane_along_x: bool) -> void:
	var side: float = 1.0
	_solid_box(root, _lane_pos(0.0, 1.45, side * 5.60, lane_along_x), _lane_size(6.2, 2.90, 0.22, lane_along_x), concrete_dark, 1)
	for forward: float in [-2.95, 2.95]:
		_solid_box(root, _lane_pos(forward, 1.45, side * 4.48, lane_along_x), _lane_size(0.22, 2.90, 2.25, lane_along_x), concrete_dark, 1)
	for forward: float in [-2.10, 2.10]:
		_solid_box(root, _lane_pos(forward, 1.45, side * 3.38, lane_along_x), _lane_size(1.55, 2.90, 0.18, lane_along_x), concrete_dark, 1)
	var bench_pos: Vector3 = _lane_pos(-1.25, 0.58, side * 5.05, lane_along_x)
	_solid_box(root, bench_pos, _lane_size(2.3, 0.12, 0.72, lane_along_x), metal_mat, 1)
	for forward: float in [-2.1, -0.7, 0.7, 2.1]:
		_visual_box(root, _lane_pos(forward, 2.42, side * 5.42, lane_along_x), _lane_size(0.11, 0.11, 0.08, lane_along_x), accent_orange)
	_psychic_box(root, _lane_pos(1.45, 0.28, side * 4.82, lane_along_x), Vector3(0.55, 0.55, 0.55), metal_mat, 16.0)
	_add_side_label(root, _lane_pos(0.0, 2.66, side * 3.25, lane_along_x), "MAINTENANCE  M-%02d" % posmod(cell.x * 3 + cell.y, 97), lane_along_x, side, Color(0.92, 0.55, 0.20))

func _build_false_exit(root: Node3D, cell: Vector2i, lane_along_x: bool) -> void:
	var side: float = -1.0
	_solid_box(root, _lane_pos(0.0, 1.55, side * 5.58, lane_along_x), _lane_size(5.5, 3.10, 0.24, lane_along_x), concrete_dark, 1)
	_visual_box(root, _lane_pos(0.0, 1.16, side * 5.42, lane_along_x), _lane_size(1.55, 2.28, 0.06, lane_along_x), rubber_mat)
	_visual_box(root, _lane_pos(0.0, 2.55, side * 5.38, lane_along_x), _lane_size(2.45, 0.42, 0.07, lane_along_x), accent_red)
	_add_side_label(root, _lane_pos(0.0, 2.57, side * 5.30, lane_along_x), "EXIT", lane_along_x, side, Color(1.0, 0.32, 0.25))
	var wrong_level: int = current_level + (1 if posmod(_hash3(cell.x, cell.y, current_level + 14779), 2) == 0 else -1)
	_add_side_label(root, _lane_pos(0.0, 1.93, side * 5.29, lane_along_x), "LEVEL %+d", lane_along_x, side, Color(0.58, 0.62, 0.58))
	# Deliberately contradictory lower sign. This is environmental wrongness, not a portal.
	var small: Label3D = _make_label("LEVEL %+d" % wrong_level, Color(0.36, 0.40, 0.37), 30)
	small.position = _lane_pos(0.0, 0.52, side * 5.27, lane_along_x)
	_orient_side_label(small, lane_along_x, side)
	root.add_child(small)

func _build_security_island(root: Node3D, cell: Vector2i, lane_along_x: bool) -> void:
	var side: float = 1.0
	var center: Vector3 = _lane_pos(0.0, 0.95, side * 4.65, lane_along_x)
	_solid_box(root, center, _lane_size(3.20, 1.90, 1.85, lane_along_x), sign_dark, 1)
	_visual_box(root, center + Vector3(0, 0.30, 0), _lane_size(2.78, 0.72, 1.90, lane_along_x), glass_mat)
	_visual_box(root, _lane_pos(0.0, 1.82, side * 4.65, lane_along_x), _lane_size(3.25, 0.12, 1.90, lane_along_x), accent_cyan)
	_add_side_label(root, _lane_pos(0.0, 2.24, side * 3.68, lane_along_x), "RESERVED  /  SECURITY", lane_along_x, side, Color(0.42, 0.88, 0.88))

func _build_storage_cage(root: Node3D, cell: Vector2i, lane_along_x: bool) -> void:
	var side: float = -1.0
	for forward: float in [-2.6, -1.3, 0.0, 1.3, 2.6]:
		_visual_box(root, _lane_pos(forward, 1.35, side * 3.56, lane_along_x), _lane_size(0.055, 2.70, 0.055, lane_along_x), metal_mat)
	_visual_box(root, _lane_pos(0.0, 2.70, side * 3.56, lane_along_x), _lane_size(5.30, 0.07, 0.07, lane_along_x), metal_mat)
	_visual_box(root, _lane_pos(0.0, 0.16, side * 3.56, lane_along_x), _lane_size(5.30, 0.07, 0.07, lane_along_x), metal_mat)
	_add_side_label(root, _lane_pos(0.0, 2.35, side * 3.48, lane_along_x), "LONG TERM  %02d", lane_along_x, side, Color(0.70, 0.77, 0.69))

func _build_pay_bank(root: Node3D, cell: Vector2i, lane_along_x: bool) -> void:
	var side: float = 1.0
	for forward: float in [-2.4, -0.8, 0.8, 2.4]:
		var pos: Vector3 = _lane_pos(forward, 0.64, side * 4.70, lane_along_x)
		_solid_box(root, pos, _lane_size(0.70, 1.28, 0.48, lane_along_x), sign_dark, 1)
		_visual_box(root, pos + Vector3(0, 0.24, 0), _lane_size(0.42, 0.31, 0.03, lane_along_x), screen_mat)
	_add_side_label(root, _lane_pos(0.0, 2.05, side * 4.34, lane_along_x), "PAY  /  VALIDATE", lane_along_x, side, Color(0.46, 0.91, 0.83))

func _build_pipe_run(root: Node3D, cell: Vector2i, lane_along_x: bool) -> void:
	var accent: Material = _district_accent_material(cell, current_level)
	for side: float in [4.62, 4.90]:
		_visual_box(root, _lane_pos(0.0, 3.58, side, lane_along_x), _lane_size(10.2, 0.10, 0.10, lane_along_x), accent)
	for forward: float in [-4.3, 0.0, 4.3]:
		_visual_box(root, _lane_pos(forward, 3.33, 4.76, lane_along_x), _lane_size(0.08, 0.58, 0.08, lane_along_x), metal_mat)

func _build_bollard_row(root: Node3D, lane_along_x: bool) -> void:
	for forward: float in [-3.0, -1.5, 0.0, 1.5, 3.0]:
		_visual_box(root, _lane_pos(forward, 0.42, 3.18, lane_along_x), _lane_size(0.16, 0.84, 0.16, lane_along_x), accent_cyan)

func _build_broken_barrier(root: Node3D, lane_along_x: bool) -> void:
	for side: float in [-1.0, 1.0]:
		_visual_box(root, _lane_pos(-1.9, 0.46, side * 3.45, lane_along_x), _lane_size(0.16, 0.92, 0.16, lane_along_x), concrete_dark)
	var rail: MeshInstance3D = _visual_box(root, _lane_pos(0.0, 0.72, 3.45, lane_along_x), _lane_size(3.75, 0.14, 0.16, lane_along_x), line_red)
	rail.rotation.y = 0.13 if lane_along_x else -0.13
	_psychic_box(root, _lane_pos(2.2, 0.19, 3.12, lane_along_x), Vector3(0.34, 0.38, 0.34), concrete_dark, 5.0)

func _build_ramp_sign(root: Node3D, cell: Vector2i, lane_along_x: bool) -> void:
	var is_up: bool = _is_ramp_cell(cell, current_level)
	var target_level: int = current_level + (1 if is_up else -1)
	_add_overhead_sign(root, "RAMP  /  LEVEL %+d" % target_level, lane_along_x, Color(0.95, 0.69, 0.20))
	for side: float in [-1.0, 1.0]:
		_visual_box(root, _lane_pos(0.0, 0.038, side * 2.72, lane_along_x), _lane_size(8.8, 0.024, 0.13, lane_along_x), line_yellow)

func _spawn_car(root: Node3D, position: Vector3, yaw: float, seed: int) -> void:
	var car: RigidBody3D = GarageCarScript.new() as RigidBody3D
	car.position = position
	car.rotation.y = yaw + (PI if posmod(seed, 2) == 0 else 0.0)
	car.set("body_color", _car_color(seed))
	car.set("appearance_seed", seed)
	root.add_child(car)

func _district_name(cell: Vector2i, level: int) -> String:
	if _district_of(cell) == Vector2i.ZERO and level == 0:
		return "CENTRAL ARRIVAL"
	match _district_type(cell, level):
		DISTRICT_PUBLIC:
			return "PUBLIC DECK"
		DISTRICT_LONG_TERM:
			return "LONG TERM"
		DISTRICT_SERVICE:
			return "SERVICE RING"
		DISTRICT_TRANSIT:
			return "TRANSIT DECK"
		DISTRICT_ABANDONED:
			return "CLOSED SECTION"
		_:
			return "RESERVED DECK"

func _zone_code(cell: Vector2i, level: int) -> String:
	match _district_type(cell, level):
		DISTRICT_PUBLIC:
			return "A"
		DISTRICT_LONG_TERM:
			return "L"
		DISTRICT_SERVICE:
			return "M"
		DISTRICT_TRANSIT:
			return "T"
		DISTRICT_ABANDONED:
			return "X"
		_:
			return "R"

func _zone_sign_text(cell: Vector2i, level: int) -> String:
	return "%s  /  %s  /  %+d" % [_zone_code(cell, level), _district_name(cell, level), level]

func _descriptor(cell: Vector2i) -> String:
	var local: Vector2i = _district_local(cell)
	if _is_ramp_cell(cell, current_level) or _is_ramp_cell(cell, current_level - 1):
		return "RAMP INTERCHANGE"
	if current_level == 0 and cell == Vector2i.ZERO:
		return "CENTRAL ARRIVAL"
	if local == Vector2i(1, 1):
		return "LIFT / STAIR CORE"
	var kind: int = _district_type(cell, current_level)
	if kind == DISTRICT_SERVICE and local == Vector2i(3, 6):
		return "MAINTENANCE BAY"
	if kind == DISTRICT_ABANDONED and local == Vector2i(6, 6):
		return "SEALED EXIT"
	if kind == DISTRICT_RESERVED and local == Vector2i(2, 5):
		return "SECURITY ISLAND"
	return _district_name(cell, current_level)

func _update_hud() -> void:
	var cell: Vector2i = _cell_from_position(player.global_position)
	var mode: String = "ON FOOT"
	if player.has_method("is_in_vehicle") and bool(player.call("is_in_vehicle")):
		mode = "DRIVING"
	var local: Vector2i = _district_local(cell)
	coords_label.text = "PARKING  //  %s  //  LEVEL %+d  //  %s  //  BAY %s-%02d%02d" % [
		mode,
		current_level,
		_descriptor(cell),
		_zone_code(cell, current_level),
		local.x + 1,
		local.y + 1
	]

func _district_accent_material(cell: Vector2i, level: int) -> Material:
	match _district_type(cell, level):
		DISTRICT_PUBLIC:
			return accent_blue
		DISTRICT_LONG_TERM:
			return accent_green
		DISTRICT_SERVICE:
			return accent_orange
		DISTRICT_TRANSIT:
			return accent_cyan
		DISTRICT_ABANDONED:
			return accent_red
		_:
			return accent_violet

func _district_accent_color(cell: Vector2i, level: int) -> Color:
	match _district_type(cell, level):
		DISTRICT_PUBLIC:
			return Color(0.34, 0.67, 0.86)
		DISTRICT_LONG_TERM:
			return Color(0.38, 0.72, 0.48)
		DISTRICT_SERVICE:
			return Color(0.95, 0.55, 0.20)
		DISTRICT_TRANSIT:
			return Color(0.39, 0.83, 0.84)
		DISTRICT_ABANDONED:
			return Color(0.91, 0.24, 0.18)
		_:
			return Color(0.63, 0.48, 0.78)

func _lane_pos(forward: float, y: float, side: float, lane_along_x: bool) -> Vector3:
	return Vector3(forward, y, side) if lane_along_x else Vector3(side, y, forward)

func _lane_size(forward: float, y: float, side: float, lane_along_x: bool) -> Vector3:
	return Vector3(forward, y, side) if lane_along_x else Vector3(side, y, forward)

func _add_overhead_sign(root: Node3D, text: String, lane_along_x: bool, color: Color) -> void:
	var board_size: Vector3 = Vector3(0.07, 0.68, 3.60) if lane_along_x else Vector3(3.60, 0.68, 0.07)
	_visual_box(root, Vector3(0, 3.18, 0), board_size, sign_dark)
	if lane_along_x:
		var front: Label3D = _make_label(text, color, 38)
		front.position = Vector3(0.045, 3.18, 0)
		front.rotation.y = PI * 0.5
		root.add_child(front)
		var back: Label3D = _make_label(text, color, 38)
		back.position = Vector3(-0.045, 3.18, 0)
		back.rotation.y = -PI * 0.5
		root.add_child(back)
	else:
		var front_z: Label3D = _make_label(text, color, 38)
		front_z.position = Vector3(0, 3.18, 0.045)
		root.add_child(front_z)
		var back_z: Label3D = _make_label(text, color, 38)
		back_z.position = Vector3(0, 3.18, -0.045)
		back_z.rotation.y = PI
		root.add_child(back_z)

func _add_side_label(root: Node3D, position: Vector3, text: String, lane_along_x: bool, side: float, color: Color) -> void:
	var label: Label3D = _make_label(text, color, 36)
	label.position = position
	_orient_side_label(label, lane_along_x, side)
	root.add_child(label)

func _orient_side_label(label: Label3D, lane_along_x: bool, side: float) -> void:
	if lane_along_x:
		label.rotation.y = PI if side > 0.0 else 0.0
	else:
		label.rotation.y = -PI * 0.5 if side > 0.0 else PI * 0.5

func _make_label(text: String, color: Color, font_size_value: int) -> Label3D:
	var label: Label3D = Label3D.new()
	label.text = text
	label.font_size = font_size_value
	label.pixel_size = 0.0065
	label.modulate = color
	label.outline_size = 5
	return label
