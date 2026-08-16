extends "res://arthur_mobile/parking_garage/parking_world_finished.gd"

# Small final layer for discovery-facing APIs and intentionally authored signage.
# Kept separate so the larger finished generator remains easy to audit.

func parking_district_name_at(world_position: Vector3) -> String:
	var cell: Vector2i = _cell_from_position(world_position)
	return _district_name(cell, current_level)

func parking_landmark_name_at(world_position: Vector3) -> String:
	var cell: Vector2i = _cell_from_position(world_position)
	var local: Vector2i = _district_local(cell)
	var kind: int = _district_type(cell, current_level)
	if _is_ramp_cell(cell, current_level) or _is_ramp_cell(cell, current_level - 1):
		return "RAMP INTERCHANGE"
	if current_level == 0 and cell == Vector2i.ZERO:
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
