extends "res://arthur_mobile/world_stair_access.gd"

# Shared architectural stair layer. Placement remains the existing deterministic
# Backrooms placement logic; only the geometry, collision, and opening profile are
# derived here from one constrained stair specification.

const ARCH_TARGET_RISER := 0.170
const ARCH_MIN_RISER := 0.102
const ARCH_MAX_RISER := 0.178
const ARCH_MIN_TREAD := 0.279
const ARCH_MAX_TREAD := 0.320
const ARCH_COMFORT_SUM := 0.630
const ARCH_LANDING_DEPTH := 1.20
const ARCH_MIN_LANDING_DEPTH := 0.914
const ARCH_REQUIRED_HEADROOM := 2.032
const ARCH_OPENING_MARGIN := 0.22
const ARCH_OPENING_SIDE_CLEARANCE := 0.65
const ARCH_START_TREAD_CENTER := -0.55
const ARCH_TREAD_THICKNESS := 0.09
const ARCH_RISER_THICKNESS := 0.065
const ARCH_LANDING_THICKNESS := 0.18
const ARCH_RAIL_HEIGHT := 0.95

func _ready() -> void:
	_validate_architectural_stair_profile()
	super._ready()

func _arch_total_risers() -> int:
	var minimum_count: int = ceili(STOREY_HEIGHT / ARCH_MAX_RISER)
	var target_count: int = roundi(STOREY_HEIGHT / ARCH_TARGET_RISER)
	var count: int = maxi(minimum_count, target_count)
	if (count & 1) != 0:
		count += 1
	return count

func _arch_risers_per_flight() -> int:
	return _arch_total_risers() / 2

func _arch_flight_treads() -> int:
	return _arch_risers_per_flight() - 1

func _arch_rise() -> float:
	return STOREY_HEIGHT / float(_arch_total_risers())

func _arch_tread_depth() -> float:
	var comfort_tread: float = ARCH_COMFORT_SUM - 2.0 * _arch_rise()
	return clampf(comfort_tread, ARCH_MIN_TREAD, ARCH_MAX_TREAD)

func _arch_half_height() -> float:
	return _arch_rise() * float(_arch_risers_per_flight())

func _arch_ramp_start_distance() -> float:
	return ARCH_START_TREAD_CENTER - _arch_tread_depth() * 0.5

func _arch_mid_landing_start_distance() -> float:
	return ARCH_START_TREAD_CENTER + (float(_arch_flight_treads()) - 0.5) * _arch_tread_depth()

func _arch_mid_landing_end_distance() -> float:
	return _arch_mid_landing_start_distance() + ARCH_LANDING_DEPTH

func _arch_top_landing_start_distance() -> float:
	return _arch_mid_landing_end_distance() + float(_arch_flight_treads()) * _arch_tread_depth()

func _arch_top_landing_end_distance() -> float:
	return _arch_top_landing_start_distance() + ARCH_LANDING_DEPTH

func _arch_opening_start_distance() -> float:
	# Find the point on the first continuous ramp where the remaining clearance to
	# the underside of the ceiling reaches the required headroom, then open the
	# ceiling slightly before it. This ties the cut to the actual stair profile.
	var ceiling_bottom: float = CEILING_LOCAL_Y - CEILING_THICKNESS * 0.5
	var maximum_stair_height: float = clampf(
		ceiling_bottom - ARCH_REQUIRED_HEADROOM,
		0.0,
		_arch_half_height()
	)
	var first_flight_run: float = _arch_mid_landing_start_distance() - _arch_ramp_start_distance()
	var fraction: float = maximum_stair_height / _arch_half_height()
	return _arch_ramp_start_distance() + first_flight_run * fraction - ARCH_OPENING_MARGIN

func _arch_opening_end_distance() -> float:
	return _arch_top_landing_end_distance() + ARCH_OPENING_MARGIN

func _arch_opening_center_distance() -> float:
	return (_arch_opening_start_distance() + _arch_opening_end_distance()) * 0.5

func _arch_opening_length() -> float:
	return _arch_opening_end_distance() - _arch_opening_start_distance()

func _arch_opening_width() -> float:
	return STAIR_WIDTH + ARCH_OPENING_SIDE_CLEARANCE * 2.0

func _validate_architectural_stair_profile() -> void:
	var total_risers: int = _arch_total_risers()
	var risers_per_flight: int = _arch_risers_per_flight()
	var rise: float = _arch_rise()
	var tread: float = _arch_tread_depth()
	var half_height: float = _arch_half_height()
	var flight_run: float = float(_arch_flight_treads()) * tread
	var slope_degrees: float = rad_to_deg(atan(half_height / flight_run))

	assert(total_risers == risers_per_flight * 2, "STAIR PROFILE FAILURE: flights do not close the storey")
	assert(absf(rise * float(total_risers) - STOREY_HEIGHT) < 0.001, "STAIR PROFILE FAILURE: total rise does not equal storey height")
	assert(rise >= ARCH_MIN_RISER and rise <= ARCH_MAX_RISER, "STAIR PROFILE FAILURE: riser outside architectural range")
	assert(tread >= ARCH_MIN_TREAD and tread <= ARCH_MAX_TREAD, "STAIR PROFILE FAILURE: tread outside architectural range")
	assert(ARCH_LANDING_DEPTH >= ARCH_MIN_LANDING_DEPTH, "STAIR PROFILE FAILURE: landing too short")
	assert(half_height < 3.70, "STAIR PROFILE FAILURE: flight rises too far without a landing")
	assert(slope_degrees >= 30.0 and slope_degrees <= 50.0, "STAIR PROFILE FAILURE: stair slope outside normal range")
	assert(_arch_opening_start_distance() < _arch_mid_landing_start_distance(), "STAIR PROFILE FAILURE: headroom opening starts too late")
	assert(_arch_opening_end_distance() > _arch_top_landing_end_distance(), "STAIR PROFILE FAILURE: opening does not protect upper arrival")
	assert(_arch_top_landing_end_distance() < CELL * 3.0 - 0.25, "STAIR PROFILE FAILURE: stair no longer fits the reserved three-cell corridor")

func _spawn_stair(stair: Dictionary, cuts_current_floor: bool) -> void:
	var lower_level: int = int(stair.get("lower_level", current_level))
	var start: Vector2i = stair.get("start", Vector2i.ZERO) as Vector2i
	var direction_2d: Vector2i = stair.get("direction", Vector2i(1, 0)) as Vector2i

	var stair_root := Node3D.new()
	stair_root.name = "stair_%d_%+d_%d" % [start.x, lower_level, start.y]
	stair_root.position = Vector3(
		float(start.x) * CELL,
		float(lower_level) * STOREY_HEIGHT,
		float(start.y) * CELL
	)
	connector_root.add_child(stair_root)
	_build_stair_run(stair_root, direction_2d)

	var direction := Vector3(float(direction_2d.x), 0.0, float(direction_2d.y)).normalized()
	var cut_world := Vector3(float(start.x) * CELL, 0.0, float(start.y) * CELL)
	cut_world += direction * _arch_opening_center_distance()

	if cuts_current_floor:
		_add_floor_cut(cut_world, direction_2d)
	else:
		_add_ceiling_cut(cut_world, direction_2d)

func _make_cut(direction: Vector2i, height: float) -> CSGBox3D:
	var cut := CSGBox3D.new()
	cut.operation = CSGShape3D.OPERATION_SUBTRACTION
	if direction.x != 0:
		cut.size = Vector3(_arch_opening_length(), height, _arch_opening_width())
	else:
		cut.size = Vector3(_arch_opening_width(), height, _arch_opening_length())
	cut.use_collision = false
	return cut

func _build_stair_run(root: Node3D, direction_2d: Vector2i) -> void:
	_ensure_stair_materials()
	var direction := Vector3(float(direction_2d.x), 0.0, float(direction_2d.y)).normalized()
	var side := Vector3(-direction.z, 0.0, direction.x)
	var yaw: float = PI * 0.5 if direction_2d.x != 0 else 0.0
	var rise: float = _arch_rise()
	var tread: float = _arch_tread_depth()
	var half_height: float = _arch_half_height()
	var flight_treads: int = _arch_flight_treads()

	var ramp1_start := direction * _arch_ramp_start_distance()
	ramp1_start.y = 0.0
	var mid_landing_start := direction * _arch_mid_landing_start_distance()
	mid_landing_start.y = half_height
	var mid_landing_end := direction * _arch_mid_landing_end_distance()
	mid_landing_end.y = half_height
	var top_landing_start := direction * _arch_top_landing_start_distance()
	top_landing_start.y = STOREY_HEIGHT
	var top_landing_end := direction * _arch_top_landing_end_distance()
	top_landing_end.y = STOREY_HEIGHT

	# Continuous v0.14 box ramps are the only walking collision on the flights.
	# Visible treads and risers are deliberately non-colliding.
	_add_stair_collision_ramp(
		root,
		ramp1_start,
		mid_landing_start,
		STAIR_WIDTH - STAIR_COLLISION_INSET * 2.0,
		STAIR_COLLISION_THICKNESS
	)
	_add_stair_collision_ramp(
		root,
		mid_landing_end,
		top_landing_start,
		STAIR_WIDTH - STAIR_COLLISION_INSET * 2.0,
		STAIR_COLLISION_THICKNESS
	)

	_add_sloped_stair_slab(
		root,
		ramp1_start - Vector3.UP * 0.14,
		mid_landing_start - Vector3.UP * 0.14,
		STAIR_WIDTH * 0.94,
		0.10,
		stair_riser_material
	)
	_add_sloped_stair_slab(
		root,
		mid_landing_end - Vector3.UP * 0.14,
		top_landing_start - Vector3.UP * 0.14,
		STAIR_WIDTH * 0.94,
		0.10,
		stair_riser_material
	)

	# First flight. The intermediate landing is the thirteenth step surface.
	for i in range(flight_treads):
		var top_y: float = rise * float(i + 1)
		var along := direction * (ARCH_START_TREAD_CENTER + float(i) * tread)
		_add_stair_mesh_box(
			root,
			along + Vector3.UP * (top_y - ARCH_TREAD_THICKNESS * 0.5),
			Vector3(STAIR_WIDTH, ARCH_TREAD_THICKNESS, tread + 0.018),
			stair_tread_material,
			yaw
		)
		var riser_position := along - direction * (tread * 0.5)
		riser_position.y = top_y - rise * 0.5
		_add_stair_mesh_box(
			root,
			riser_position,
			Vector3(STAIR_WIDTH, rise, ARCH_RISER_THICKNESS),
			stair_riser_material,
			yaw
		)

	var final_riser_1 := direction * _arch_mid_landing_start_distance()
	final_riser_1.y = half_height - rise * 0.5
	_add_stair_mesh_box(root, final_riser_1, Vector3(STAIR_WIDTH, rise, ARCH_RISER_THICKNESS), stair_riser_material, yaw)

	var mid_landing_center := direction * ((_arch_mid_landing_start_distance() + _arch_mid_landing_end_distance()) * 0.5)
	mid_landing_center.y = half_height - ARCH_LANDING_THICKNESS * 0.5
	var mid_landing_size := Vector3(STAIR_WIDTH + 0.28, ARCH_LANDING_THICKNESS, ARCH_LANDING_DEPTH)
	_add_stair_mesh_box(root, mid_landing_center, mid_landing_size, stair_tread_material, yaw)
	_add_stair_collision_box(root, mid_landing_center, mid_landing_size, yaw)

	# Second flight begins flush with the far edge of the intermediate landing.
	for i in range(flight_treads):
		var top_y: float = half_height + rise * float(i + 1)
		var along_distance: float = _arch_mid_landing_end_distance() + (float(i) + 0.5) * tread
		var along := direction * along_distance
		_add_stair_mesh_box(
			root,
			along + Vector3.UP * (top_y - ARCH_TREAD_THICKNESS * 0.5),
			Vector3(STAIR_WIDTH, ARCH_TREAD_THICKNESS, tread + 0.018),
			stair_tread_material,
			yaw
		)
		var riser_position := along - direction * (tread * 0.5)
		riser_position.y = top_y - rise * 0.5
		_add_stair_mesh_box(
			root,
			riser_position,
			Vector3(STAIR_WIDTH, rise, ARCH_RISER_THICKNESS),
			stair_riser_material,
			yaw
		)

	var final_riser_2 := direction * _arch_top_landing_start_distance()
	final_riser_2.y = STOREY_HEIGHT - rise * 0.5
	_add_stair_mesh_box(root, final_riser_2, Vector3(STAIR_WIDTH, rise, ARCH_RISER_THICKNESS), stair_riser_material, yaw)

	var top_landing_center := direction * ((_arch_top_landing_start_distance() + _arch_top_landing_end_distance()) * 0.5)
	top_landing_center.y = STOREY_HEIGHT - ARCH_LANDING_THICKNESS * 0.5
	var top_landing_size := Vector3(STAIR_WIDTH + 0.62, ARCH_LANDING_THICKNESS, ARCH_LANDING_DEPTH)
	_add_stair_mesh_box(root, top_landing_center, top_landing_size, stair_tread_material, yaw)
	_add_stair_collision_box(root, top_landing_center, top_landing_size, yaw)

	# Rails and balusters follow both slopes and continue across both landings.
	for sign_value: float in [-1.0, 1.0]:
		var lateral := side * ((STAIR_WIDTH * 0.5 + 0.075) * sign_value)
		var rail1_a := ramp1_start + lateral + Vector3.UP * ARCH_RAIL_HEIGHT
		var rail1_b := mid_landing_start + lateral + Vector3.UP * ARCH_RAIL_HEIGHT
		_add_stair_beam_between(root, rail1_a, rail1_b, 0.07, stair_rail_material)

		var mid_rail_a := mid_landing_start + lateral + Vector3.UP * ARCH_RAIL_HEIGHT
		var mid_rail_b := mid_landing_end + lateral + Vector3.UP * ARCH_RAIL_HEIGHT
		_add_stair_beam_between(root, mid_rail_a, mid_rail_b, 0.07, stair_rail_material)

		var rail2_a := mid_landing_end + lateral + Vector3.UP * ARCH_RAIL_HEIGHT
		var rail2_b := top_landing_start + lateral + Vector3.UP * ARCH_RAIL_HEIGHT
		_add_stair_beam_between(root, rail2_a, rail2_b, 0.07, stair_rail_material)

		var top_rail_a := top_landing_start + lateral + Vector3.UP * ARCH_RAIL_HEIGHT
		var top_rail_b := top_landing_end + lateral + Vector3.UP * ARCH_RAIL_HEIGHT
		_add_stair_beam_between(root, top_rail_a, top_rail_b, 0.07, stair_rail_material)

		for post_i in range(5):
			var t: float = float(post_i) / 4.0
			var post1 := ramp1_start.lerp(mid_landing_start, t) + lateral
			_add_stair_mesh_box(
				root,
				post1 + Vector3.UP * (ARCH_RAIL_HEIGHT * 0.5),
				Vector3(0.065, ARCH_RAIL_HEIGHT, 0.065),
				stair_rail_material,
				0.0
			)
			var post2 := mid_landing_end.lerp(top_landing_start, t) + lateral
			_add_stair_mesh_box(
				root,
				post2 + Vector3.UP * (ARCH_RAIL_HEIGHT * 0.5),
				Vector3(0.065, ARCH_RAIL_HEIGHT, 0.065),
				stair_rail_material,
				0.0
			)

	var opening_center := direction * _arch_opening_center_distance()
	_add_architectural_opening_trim(root, opening_center, direction, side, yaw)
	_add_stairwell_light(root, opening_center - direction * 0.30)

func _add_architectural_opening_trim(
	root: Node3D,
	center: Vector3,
	direction: Vector3,
	side: Vector3,
	yaw: float
) -> void:
	var opening_width: float = _arch_opening_width()
	var opening_length: float = _arch_opening_length()
	var half_width: float = opening_width * 0.5
	var half_length: float = opening_length * 0.5
	var trim_y: float = STOREY_HEIGHT + 0.035

	for sign_value: float in [-1.0, 1.0]:
		var side_center := center + side * ((half_width + 0.10) * sign_value)
		side_center.y = trim_y
		_add_stair_mesh_box(
			root,
			side_center,
			Vector3(0.18, 0.13, opening_length + 0.34),
			stair_tread_material,
			yaw
		)

	for sign_value: float in [-1.0, 1.0]:
		var end_center := center + direction * ((half_length + 0.10) * sign_value)
		end_center.y = trim_y
		_add_stair_mesh_box(
			root,
			end_center,
			Vector3(opening_width + 0.36, 0.13, 0.18),
			stair_tread_material,
			yaw
		)

	for sign_value: float in [-1.0, 1.0]:
		var lateral := side * ((half_width + 0.02) * sign_value)
		var guard_a := center - direction * half_length + lateral + Vector3.UP * (STOREY_HEIGHT + ARCH_RAIL_HEIGHT)
		var guard_b := center + direction * half_length + lateral + Vector3.UP * (STOREY_HEIGHT + ARCH_RAIL_HEIGHT)
		_add_stair_beam_between(root, guard_a, guard_b, 0.07, stair_rail_material)
		for t: float in [0.0, 0.5, 1.0]:
			var base := (center - direction * half_length).lerp(center + direction * half_length, t) + lateral
			base.y = STOREY_HEIGHT
			_add_stair_mesh_box(
				root,
				base + Vector3.UP * 0.46,
				Vector3(0.065, 0.92, 0.065),
				stair_rail_material,
				0.0
			)