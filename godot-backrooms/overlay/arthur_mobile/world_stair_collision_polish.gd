extends "res://arthur_mobile/world_stair_architectural_shared.gd"

# Collision-only polish layered over the already-green architectural stair build.
# Decorative stair/rail meshes remain non-colliding. These continuous invisible
# guide planes keep the player capsule away from the exposed side faces of the
# hidden ramp/landing boxes and from the open stairwell edge upstairs.

const ARCH_SIDE_GUIDE_THICKNESS := 0.10
const ARCH_SIDE_GUIDE_INSET := 0.02
const ARCH_SIDE_GUIDE_ENDPOINT_OVERLAP := 0.20
const ARCH_SIDE_GUIDE_BELOW := 0.30
const ARCH_SIDE_GUIDE_ABOVE := 2.05

const ARCH_OPENING_GUIDE_THICKNESS := 0.12
const ARCH_OPENING_GUIDE_INSET := 0.02
const ARCH_OPENING_GUIDE_BELOW := 0.22
const ARCH_OPENING_GUIDE_ABOVE := 2.05

func _build_stair_run(root: Node3D, direction_2d: Vector2i) -> void:
	super._build_stair_run(root, direction_2d)

	var direction := Vector3(float(direction_2d.x), 0.0, float(direction_2d.y)).normalized()
	var side := Vector3(-direction.z, 0.0, direction.x)
	var yaw: float = PI * 0.5 if direction_2d.x != 0 else 0.0
	var half_height: float = _arch_half_height()

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

	var stair_inner_half_width: float = STAIR_WIDTH * 0.5 - ARCH_SIDE_GUIDE_INSET
	for sign_value: float in [-1.0, 1.0]:
		_add_stair_vertical_guide(
			root,
			ramp1_start,
			mid_landing_start,
			side,
			sign_value,
			stair_inner_half_width,
			ARCH_SIDE_GUIDE_THICKNESS,
			ARCH_SIDE_GUIDE_BELOW,
			ARCH_SIDE_GUIDE_ABOVE,
			yaw,
			"Flight1Guide"
		)
		_add_stair_vertical_guide(
			root,
			mid_landing_start,
			mid_landing_end,
			side,
			sign_value,
			stair_inner_half_width,
			ARCH_SIDE_GUIDE_THICKNESS,
			ARCH_SIDE_GUIDE_BELOW,
			ARCH_SIDE_GUIDE_ABOVE,
			yaw,
			"MidLandingGuide"
		)
		_add_stair_vertical_guide(
			root,
			mid_landing_end,
			top_landing_start,
			side,
			sign_value,
			stair_inner_half_width,
			ARCH_SIDE_GUIDE_THICKNESS,
			ARCH_SIDE_GUIDE_BELOW,
			ARCH_SIDE_GUIDE_ABOVE,
			yaw,
			"Flight2Guide"
		)
		_add_stair_vertical_guide(
			root,
			top_landing_start,
			top_landing_end,
			side,
			sign_value,
			stair_inner_half_width,
			ARCH_SIDE_GUIDE_THICKNESS,
			ARCH_SIDE_GUIDE_BELOW,
			ARCH_SIDE_GUIDE_ABOVE,
			yaw,
			"TopLandingGuide"
		)

	# The visual guard rails around the upper opening intentionally have no detailed
	# collision. A single smooth wall behind each rail prevents falling/wedging into
	# the side of the stairwell without introducing post-by-post snag points.
	var opening_center := direction * _arch_opening_center_distance()
	opening_center.y = STOREY_HEIGHT
	var opening_half_length: float = _arch_opening_length() * 0.5
	var opening_a := opening_center - direction * opening_half_length
	var opening_b := opening_center + direction * opening_half_length
	var opening_inner_half_width: float = _arch_opening_width() * 0.5 - ARCH_OPENING_GUIDE_INSET
	for sign_value: float in [-1.0, 1.0]:
		_add_stair_vertical_guide(
			root,
			opening_a,
			opening_b,
			side,
			sign_value,
			opening_inner_half_width,
			ARCH_OPENING_GUIDE_THICKNESS,
			ARCH_OPENING_GUIDE_BELOW,
			ARCH_OPENING_GUIDE_ABOVE,
			yaw,
			"OpeningGuardGuide"
		)

	if DisplayServer.get_name().to_lower() == "headless":
		var guide_count := 0
		for child in root.get_children():
			if child is StaticBody3D and bool(child.get_meta("stair_side_guide", false)):
				guide_count += 1
		assert(guide_count == 10, "STAIR COLLISION FAILURE: expected ten continuous side guides")

func _add_stair_vertical_guide(
	root: Node3D,
	a: Vector3,
	b: Vector3,
	side: Vector3,
	sign_value: float,
	inner_half_width: float,
	thickness: float,
	below: float,
	above: float,
	yaw: float,
	label: String
) -> void:
	var horizontal_delta := Vector3(b.x - a.x, 0.0, b.z - a.z)
	var run_length: float = horizontal_delta.length()
	if run_length <= 0.01:
		return

	var bottom_y: float = minf(a.y, b.y) - below
	var top_y: float = maxf(a.y, b.y) + above
	var guide_height: float = top_y - bottom_y
	var lateral_offset: float = inner_half_width + thickness * 0.5

	var body := StaticBody3D.new()
	body.name = "%s_%s" % [label, "L" if sign_value < 0.0 else "R"]
	body.position = Vector3(
		(a.x + b.x) * 0.5,
		(bottom_y + top_y) * 0.5,
		(a.z + b.z) * 0.5
	) + side * (lateral_offset * sign_value)
	body.rotation.y = yaw
	body.collision_layer = 3
	body.collision_mask = 3
	body.set_meta("stair_side_guide", true)

	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(
		thickness,
		guide_height,
		run_length + ARCH_SIDE_GUIDE_ENDPOINT_OVERLAP * 2.0
	)
	collision.shape = shape
	body.add_child(collision)
	root.add_child(body)
