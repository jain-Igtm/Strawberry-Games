extends "res://arthur_mobile/parking_garage/parking_world_finished.gd"

# Small final layer for discovery-facing APIs and intentionally authored signage.
# Kept separate so the larger finished generator remains easy to audit.

func _process(delta: float) -> void:
	super._process(delta)
	var cell: Vector2i = _cell_from_position(player.global_position)
	var kind: int = _district_type(cell, current_level)
	var target_hum: float = -18.0
	var target_atmosphere: float = -38.0
	match kind:
		DISTRICT_SERVICE:
			target_hum = -14.5
			target_atmosphere = -40.0
		DISTRICT_ABANDONED:
			target_hum = -27.0
			target_atmosphere = -34.0
		DISTRICT_TRANSIT:
			target_hum = -20.0
			target_atmosphere = -36.0
		DISTRICT_RESERVED:
			target_hum = -21.5
			target_atmosphere = -40.0
	hum.volume_db = lerpf(hum.volume_db, target_hum, clampf(delta * 1.35, 0.0, 1.0))
	atmosphere.volume_db = lerpf(atmosphere.volume_db, target_atmosphere, clampf(delta * 1.10, 0.0, 1.0))

func _cell_feature(cell: Vector2i, level: int) -> int:
	var local: Vector2i = _district_local(cell)
	var kind: int = _district_type(cell, level)
	if level == 0 and cell in [Vector2i(0, 0), Vector2i(1, 0), Vector2i(0, 1), Vector2i(1, 1)]:
		return 4
	if local == Vector2i(1, 1):
		return 4
	if kind == DISTRICT_SERVICE and local == Vector2i(3, 6):
		return 4
	if kind == DISTRICT_ABANDONED and local == Vector2i(6, 6):
		return 4
	if kind == DISTRICT_RESERVED and local == Vector2i(2, 5):
		return 4
	if kind == DISTRICT_TRANSIT and local == Vector2i(4, 4):
		return 4
	if kind == DISTRICT_LONG_TERM and local == Vector2i(5, 1):
		return 2
	return super._cell_feature(cell, level)

func _build_finished_details(root: Node3D, cell: Vector2i, lane_along_x: bool) -> void:
	super._build_finished_details(root, cell, lane_along_x)
	if current_level != 0:
		return
	if cell == Vector2i(1, 0):
		_build_central_gate(root, lane_along_x)
	elif cell == Vector2i(0, 1):
		_build_central_office(root, lane_along_x)

func _build_central_gate(root: Node3D, lane_along_x: bool) -> void:
	_add_overhead_sign(root, "LEVELS  /  RAMP ACCESS", lane_along_x, Color(0.42, 0.88, 0.84))
	for side: float in [-1.0, 1.0]:
		_solid_box(root, _lane_pos(-2.85, 0.50, side * 2.10, lane_along_x), _lane_size(0.28, 1.00, 0.28, lane_along_x), sign_dark, 1)
		var arm: MeshInstance3D = _visual_box(root, _lane_pos(-1.65, 0.92, side * 2.10, lane_along_x), _lane_size(2.30, 0.12, 0.14, lane_along_x), painted_white)
		if lane_along_x:
			arm.rotation.z = -0.10 * side
		else:
			arm.rotation.x = 0.10 * side
	for forward: float in [-4.0, -2.0, 0.0, 2.0, 4.0]:
		_visual_box(root, _lane_pos(forward, 0.038, 0.0, lane_along_x), _lane_size(0.70, 0.022, 0.16, lane_along_x), accent_cyan)

func _build_central_office(root: Node3D, lane_along_x: bool) -> void:
	var side: float = 1.0
	var center: Vector3 = _lane_pos(0.0, 1.10, side * 4.62, lane_along_x)
	_solid_box(root, center, _lane_size(5.15, 2.20, 1.82, lane_along_x), sign_dark, 1)
	_visual_box(root, center + Vector3(0, 0.26, 0), _lane_size(4.72, 0.82, 1.86, lane_along_x), glass_mat)
	_visual_box(root, _lane_pos(0.0, 2.10, side * 4.62, lane_along_x), _lane_size(5.18, 0.12, 1.86, lane_along_x), accent_cyan)
	_add_side_label(root, _lane_pos(0.0, 2.50, side * 3.66, lane_along_x), "PARKING SERVICES", lane_along_x, side, Color(0.48, 0.90, 0.84))
	for forward: float in [-1.55, 0.0, 1.55]:
		var terminal: Vector3 = _lane_pos(forward, 0.53, side * 3.45, lane_along_x)
		_solid_box(root, terminal, _lane_size(0.56, 1.06, 0.38, lane_along_x), concrete_dark, 1)
		_visual_box(root, terminal + Vector3(0, 0.18, 0), _lane_size(0.34, 0.28, 0.03, lane_along_x), screen_mat)

func parking_district_name_at(world_position: Vector3) -> String:
	var cell: Vector2i = _cell_from_position(world_position)
	return _district_name(cell, current_level)

func parking_landmark_name_at(world_position: Vector3) -> String:
	var cell: Vector2i = _cell_from_position(world_position)
	var local: Vector2i = _district_local(cell)
	var kind: int = _district_type(cell, current_level)
	if _is_ramp_cell(cell, current_level) or _is_ramp_cell(cell, current_level - 1):
		return "RAMP INTERCHANGE"
	if current_level == 0 and cell in [Vector2i(0, 0), Vector2i(1, 0), Vector2i(0, 1)]:
		return ""
	if local == Vector2i(1, 1):
		return "LIFT / STAIR CORE"
	if kind == DISTRICT_SERVICE and local == Vector2i(3, 6):
		return "MAINTENANCE BAY"
	if kind == DISTRICT_ABANDONED and local == Vector2i(6, 6):
		return "SEALED EXIT"
	if kind == DISTRICT_RESERVED and local == Vector2i(2, 5):
		return "SECURITY ISLAND"
	if kind == DISTRICT_LONG_TERM and local == Vector2i(5, 1):
		return "LONG-TERM CAGE"
	if kind == DISTRICT_TRANSIT and local == Vector2i(4, 4):
		return "PAYMENT BANK"
	return ""

func _descriptor(cell: Vector2i) -> String:
	var local: Vector2i = _district_local(cell)
	var kind: int = _district_type(cell, current_level)
	if _is_ramp_cell(cell, current_level) or _is_ramp_cell(cell, current_level - 1):
		return "RAMP INTERCHANGE"
	if current_level == 0 and cell in [Vector2i(0, 0), Vector2i(1, 0), Vector2i(0, 1)]:
		return "CENTRAL ARRIVAL"
	if local == Vector2i(1, 1):
		return "LIFT / STAIR CORE"
	if kind == DISTRICT_SERVICE and local == Vector2i(3, 6):
		return "MAINTENANCE BAY"
	if kind == DISTRICT_ABANDONED and local == Vector2i(6, 6):
		return "SEALED EXIT"
	if kind == DISTRICT_RESERVED and local == Vector2i(2, 5):
		return "SECURITY ISLAND"
	if kind == DISTRICT_LONG_TERM and local == Vector2i(5, 1):
		return "LONG-TERM CAGE"
	if kind == DISTRICT_TRANSIT and local == Vector2i(4, 4):
		return "PAYMENT BANK"
	return _district_name(cell, current_level)

func _build_false_exit(root: Node3D, cell: Vector2i, lane_along_x: bool) -> void:
	var side: float = -1.0
	_solid_box(root, _lane_pos(0.0, 1.55, side * 5.58, lane_along_x), _lane_size(5.5, 3.10, 0.24, lane_along_x), concrete_dark, 1)
	_visual_box(root, _lane_pos(0.0, 1.16, side * 5.42, lane_along_x), _lane_size(1.55, 2.28, 0.06, lane_along_x), rubber_mat)
	_visual_box(root, _lane_pos(0.0, 2.55, side * 5.38, lane_along_x), _lane_size(2.45, 0.42, 0.07, lane_along_x), accent_red)
	_add_side_label(root, _lane_pos(0.0, 2.57, side * 5.30, lane_along_x), "EXIT", lane_along_x, side, Color(1.0, 0.32, 0.25))
	_add_side_label(root, _lane_pos(0.0, 1.93, side * 5.29, lane_along_x), "LEVEL %+d" % current_level, lane_along_x, side, Color(0.58, 0.62, 0.58))
	var wrong_level: int = current_level + (1 if posmod(_hash3(cell.x, cell.y, current_level + 14779), 2) == 0 else -1)
	var small: Label3D = _make_label("LEVEL %+d" % wrong_level, Color(0.36, 0.40, 0.37), 30)
	small.position = _lane_pos(0.0, 0.52, side * 5.27, lane_along_x)
	_orient_side_label(small, lane_along_x, side)
	root.add_child(small)

func _build_storage_cage(root: Node3D, cell: Vector2i, lane_along_x: bool) -> void:
	var side: float = -1.0
	for forward: float in [-2.6, -1.3, 0.0, 1.3, 2.6]:
		_visual_box(root, _lane_pos(forward, 1.35, side * 3.56, lane_along_x), _lane_size(0.055, 2.70, 0.055, lane_along_x), metal_mat)
	_visual_box(root, _lane_pos(0.0, 2.70, side * 3.56, lane_along_x), _lane_size(5.30, 0.07, 0.07, lane_along_x), metal_mat)
	_visual_box(root, _lane_pos(0.0, 0.16, side * 3.56, lane_along_x), _lane_size(5.30, 0.07, 0.07, lane_along_x), metal_mat)
	var cage_id: int = posmod(_hash3(cell.x, cell.y, current_level + 15101), 90) + 10
	_add_side_label(root, _lane_pos(0.0, 2.35, side * 3.48, lane_along_x), "LONG TERM  %02d" % cage_id, lane_along_x, side, Color(0.70, 0.77, 0.69))
