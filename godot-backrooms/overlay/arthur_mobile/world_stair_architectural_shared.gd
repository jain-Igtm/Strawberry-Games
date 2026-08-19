extends "res://arthur_mobile/world_stair_access.gd"

# Shared-agent stair integration.
# Keep world_stair_access.gd's segmented floor/ceiling system intact and replace
# only the stair geometry/collision profile with constrained architectural stairs.

const ARCH_TOTAL_RISERS := 26
const ARCH_RISERS_PER_FLIGHT := 13
const ARCH_FLIGHT_TREADS := 12
const ARCH_TREAD_DEPTH := 0.292
const ARCH_LANDING_DEPTH := 1.20
const ARCH_CUT_WIDTH := 3.10
const ARCH_CUT_LENGTH := 6.70
const ARCH_TREAD_THICKNESS := 0.09
const ARCH_RISER_THICKNESS := 0.065
const ARCH_LANDING_THICKNESS := 0.18
const ARCH_RAIL_HEIGHT := 0.95

func _ready() -> void:
	_validate_architectural_stair_profile()
	super._ready()

func _validate_architectural_stair_profile() -> void:
	var rise: float = STOREY_HEIGHT / float(ARCH_TOTAL_RISERS)
	var slope_degrees: float = rad_to_deg(atan(rise / ARCH_TREAD_DEPTH))
	var half_rise: float = rise * float(ARCH_RISERS_PER_FLIGHT)
	var occupied_run: float = (
		float(ARCH_FLIGHT_TREADS) * ARCH_TREAD_DEPTH * 2.0
		+ ARCH_LANDING_DEPTH
		+ ARCH_LANDING_DEPTH
	)
	assert(ARCH_TOTAL_RISERS == ARCH_RISERS_PER_FLIGHT * 2, "STAIR PROFILE FAILURE: flights do not close the storey")
	assert(absf(rise * float(ARCH_TOTAL_RISERS) - STOREY_HEIGHT) < 0.001, "STAIR PROFILE FAILURE: total rise does not equal storey height")
	assert(rise >= 0.102 and rise <= 0.178, "STAIR PROFILE FAILURE: riser outside architectural range")
	assert(ARCH_TREAD_DEPTH >= 0.279, "STAIR PROFILE FAILURE: tread too shallow")
	assert(ARCH_LANDING_DEPTH >= 0.914, "STAIR PROFILE FAILURE: landing too short")
	assert(half_rise < 3.70, "STAIR PROFILE FAILURE: flight rises too far without a landing")
	assert(slope_degrees >= 30.0 and slope_degrees <= 50.0, "STAIR PROFILE FAILURE: stair slope outside normal range")
	assert(occupied_run < CELL * 3.0, "STAIR PROFILE FAILURE: stair no longer fits the reserved three-cell corridor")

func _make_cut(direction: Vector2i, height: float) -> CSGBox3D:
	var cut := CSGBox3D.new()
	cut.operation = CSGShape3D.OPERATION_SUBTRACTION
	if direction.x != 0:
		cut.size = Vector3(ARCH_CUT_LENGTH, height, ARCH_CUT_WIDTH)
	else:
		cut.size = Vector3(ARCH_CUT_WIDTH, height, ARCH_CUT_LENGTH)
	cut.use_collision = false
	return cut

func _build_stair_run(root: Node3D, direction_2d: Vector2i) -> void:
	var direction := Vector3(float(direction_2d.x), 0.0, float(direction_2d.y))
	var side := Vector3(-direction.z, 0.0, direction.x)
	var yaw: float = PI * 0.5 if direction_2d.x != 0 else 0.0
	var rise: float = STOREY_HEIGHT / float(ARCH_TOTAL_RISERS)
	var half_height: float = rise * float(ARCH_RISERS_PER_FLIGHT)
	var start_offset := -direction * 0.55

	# First flight: twelve visible treads, thirteen equal risers. The landing is
	# the thirteenth step surface, so there is no fake extra tread at the transition.
	for i in range(ARCH_FLIGHT_TREADS):
		var top_y: float = rise * float(i + 1)
		var center := start_offset + direction * (float(i) * ARCH_TREAD_DEPTH)
		_add_stair_visual_box(
			root,
			center + Vector3.UP * (top_y - ARCH_TREAD_THICKNESS * 0.5),
			Vector3(STAIR_WIDTH, ARCH_TREAD_THICKNESS, ARCH_TREAD_DEPTH + 0.018),
			YELLOW_FLOOR,
			yaw
		)
		var riser_center := center - direction * (ARCH_TREAD_DEPTH * 0.5)
		riser_center.y = top_y - rise * 0.5
		_add_stair_visual_box(root, riser_center, Vector3(STAIR_WIDTH, rise, ARCH_RISER_THICKNESS), YELLOW_WALL, yaw)

	var mid_landing_start := start_offset + direction * (
		float(ARCH_FLIGHT_TREADS - 1) * ARCH_TREAD_DEPTH + ARCH_TREAD_DEPTH * 0.5
	)
	var final_riser_1 := mid_landing_start + Vector3.UP * (half_height - rise * 0.5)
	_add_stair_visual_box(root, final_riser_1, Vector3(STAIR_WIDTH, rise, ARCH_RISER_THICKNESS), YELLOW_WALL, yaw)

	var mid_landing_center := mid_landing_start + direction * (ARCH_LANDING_DEPTH * 0.5)
	mid_landing_center.y = half_height - ARCH_LANDING_THICKNESS * 0.5
	var landing_size := Vector3(STAIR_WIDTH + 0.28, ARCH_LANDING_THICKNESS, ARCH_LANDING_DEPTH)
	_add_stair_visual_box(root, mid_landing_center, landing_size, YELLOW_FLOOR, yaw)
	_add_stair_collision_box(root, mid_landing_center, landing_size, yaw)
	var mid_landing_end := mid_landing_start + direction * ARCH_LANDING_DEPTH

	# Second flight begins immediately after the landing and mirrors the first.
	var second_first_center := mid_landing_end + direction * (ARCH_TREAD_DEPTH * 0.5)
	for i in range(ARCH_FLIGHT_TREADS):
		var top_y: float = half_height + rise * float(i + 1)
		var center := second_first_center + direction * (float(i) * ARCH_TREAD_DEPTH)
		_add_stair_visual_box(
			root,
			center + Vector3.UP * (top_y - ARCH_TREAD_THICKNESS * 0.5),
			Vector3(STAIR_WIDTH, ARCH_TREAD_THICKNESS, ARCH_TREAD_DEPTH + 0.018),
			YELLOW_FLOOR,
			yaw
		)
		var riser_center := center - direction * (ARCH_TREAD_DEPTH * 0.5)
		riser_center.y = top_y - rise * 0.5
		_add_stair_visual_box(root, riser_center, Vector3(STAIR_WIDTH, rise, ARCH_RISER_THICKNESS), YELLOW_WALL, yaw)

	var top_landing_start := mid_landing_end + direction * (float(ARCH_FLIGHT_TREADS) * ARCH_TREAD_DEPTH)
	var final_riser_2 := top_landing_start + Vector3.UP * (STOREY_HEIGHT - rise * 0.5)
	_add_stair_visual_box(root, final_riser_2, Vector3(STAIR_WIDTH, rise, ARCH_RISER_THICKNESS), YELLOW_WALL, yaw)

	var top_landing_center := top_landing_start + direction * (ARCH_LANDING_DEPTH * 0.5)
	top_landing_center.y = STOREY_HEIGHT - ARCH_LANDING_THICKNESS * 0.5
	var top_landing_size := Vector3(STAIR_WIDTH + 0.62, ARCH_LANDING_THICKNESS, ARCH_LANDING_DEPTH)
	_add_stair_visual_box(root, top_landing_center, top_landing_size, YELLOW_FLOOR, yaw)
	_add_stair_collision_box(root, top_landing_center, top_landing_size, yaw)
	var top_landing_end := top_landing_start + direction * ARCH_LANDING_DEPTH

	# Collision is deliberately continuous rather than per-step. Two proven box
	# ramps plus flat landing colliders remove the snag/bounce failure mode while
	# the visible geometry remains actual steps.
	var ramp1_a := start_offset - direction * (ARCH_TREAD_DEPTH * 0.55) + Vector3.UP * 0.06
	var ramp1_b := mid_landing_start + direction * 0.04 + Vector3.UP * (half_height - 0.10)
	_add_stair_slope(root, ramp1_a, ramp1_b, STAIR_WIDTH * 0.90, 0.16, true, null)
	_add_stair_slope(root, ramp1_a - Vector3.UP * 0.14, ramp1_b - Vector3.UP * 0.14, STAIR_WIDTH * 0.94, 0.10, false, YELLOW_WALL)

	var ramp2_a := mid_landing_end - direction * 0.04 + Vector3.UP * (half_height + 0.06)
	var ramp2_b := top_landing_start + direction * 0.04 + Vector3.UP * (STOREY_HEIGHT - 0.10)
	_add_stair_slope(root, ramp2_a, ramp2_b, STAIR_WIDTH * 0.90, 0.16, true, null)
	_add_stair_slope(root, ramp2_a - Vector3.UP * 0.14, ramp2_b - Vector3.UP * 0.14, STAIR_WIDTH * 0.94, 0.10, false, YELLOW_WALL)

	# Rails follow each slope and remain horizontal across both landings.
	for sign_value: float in [-1.0, 1.0]:
		var lateral := side * ((STAIR_WIDTH * 0.5 + 0.075) * sign_value)
		var rail1_a := start_offset + lateral + Vector3.UP * (rise + ARCH_RAIL_HEIGHT)
		var rail1_b := mid_landing_start + lateral + Vector3.UP * (half_height + ARCH_RAIL_HEIGHT)
		_add_stair_slope(root, rail1_a, rail1_b, 0.07, 0.07, false, YELLOW_WALL)
		var mid_rail_a := mid_landing_start + lateral + Vector3.UP * (half_height + ARCH_RAIL_HEIGHT)
		var mid_rail_b := mid_landing_end + lateral + Vector3.UP * (half_height + ARCH_RAIL_HEIGHT)
		_add_stair_slope(root, mid_rail_a, mid_rail_b, 0.07, 0.07, false, YELLOW_WALL)
		var rail2_a := mid_landing_end + lateral + Vector3.UP * (half_height + ARCH_RAIL_HEIGHT)
		var rail2_b := top_landing_start + lateral + Vector3.UP * (STOREY_HEIGHT + ARCH_RAIL_HEIGHT)
		_add_stair_slope(root, rail2_a, rail2_b, 0.07, 0.07, false, YELLOW_WALL)
		var top_rail_a := top_landing_start + lateral + Vector3.UP * (STOREY_HEIGHT + ARCH_RAIL_HEIGHT)
		var top_rail_b := top_landing_end + lateral + Vector3.UP * (STOREY_HEIGHT + ARCH_RAIL_HEIGHT)
		_add_stair_slope(root, top_rail_a, top_rail_b, 0.07, 0.07, false, YELLOW_WALL)

		for post_i in range(4):
			var t: float = float(post_i) / 3.0
			var post1 := start_offset + direction * lerpf(0.0, (mid_landing_start - start_offset).length(), t) + lateral
			post1.y = lerpf(rise, half_height, t)
			_add_stair_visual_box(root, post1 + Vector3.UP * (ARCH_RAIL_HEIGHT * 0.5), Vector3(0.06, ARCH_RAIL_HEIGHT, 0.06), YELLOW_WALL, 0.0)
			var post2 := mid_landing_end + direction * lerpf(0.0, (top_landing_start - mid_landing_end).length(), t) + lateral
			post2.y = lerpf(half_height, STOREY_HEIGHT, t)
			_add_stair_visual_box(root, post2 + Vector3.UP * (ARCH_RAIL_HEIGHT * 0.5), Vector3(0.06, ARCH_RAIL_HEIGHT, 0.06), YELLOW_WALL, 0.0)
