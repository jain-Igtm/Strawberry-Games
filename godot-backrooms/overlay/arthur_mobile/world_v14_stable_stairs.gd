extends "res://arthur_mobile/world_v13_final.gd"

# v0.14: stairs are visual steps over one continuous collision ramp.
# CharacterBody3D does not perform automatic step-up logic for discrete risers,
# so the player should never collide with the visible tread/riser stack itself.
const STAIR_COLLISION_THICKNESS := 0.18
const STAIR_COLLISION_INSET := 0.06

func _build_stair_run(root: Node3D, direction_2d: Vector2i) -> void:
	_ensure_stair_materials()
	var direction: Vector3 = Vector3(float(direction_2d.x), 0.0, float(direction_2d.y)).normalized()
	var side: Vector3 = Vector3(-direction.z, 0.0, direction.x)
	var yaw: float = PI * 0.5 if direction_2d.x != 0 else 0.0
	var rise: float = STOREY_HEIGHT / float(STAIR_STEPS)
	var start_offset: Vector3 = -direction * 0.55
	var total_run: float = float(STAIR_STEPS - 1) * STAIR_RUN

	# The collision surface begins flush with the lower floor and ends flush with
	# the upper landing. Its top surface follows the midpoint of the visible treads,
	# so the visual/collision discrepancy never exceeds half one riser.
	var ramp_top_start: Vector3 = start_offset - direction * (STAIR_RUN * 0.5)
	var ramp_top_end: Vector3 = start_offset + direction * (total_run + STAIR_RUN * 0.5)
	ramp_top_start.y = 0.0
	ramp_top_end.y = STOREY_HEIGHT
	_add_stair_collision_ramp(
		root,
		ramp_top_start,
		ramp_top_end,
		STAIR_WIDTH - STAIR_COLLISION_INSET * 2.0,
		STAIR_COLLISION_THICKNESS
	)

	# Visual stairs only. These never participate in character collision, which
	# prevents each riser from becoming a tiny wall for move_and_slide().
	for i in range(STAIR_STEPS):
		var top_y: float = rise * float(i + 1)
		var along: Vector3 = start_offset + direction * (float(i) * STAIR_RUN)
		_add_stair_mesh_box(
			root,
			along + Vector3.UP * (top_y - 0.045),
			Vector3(STAIR_WIDTH, 0.09, STAIR_RUN + 0.025),
			stair_tread_material,
			yaw
		)
		var riser_position: Vector3 = along - direction * (STAIR_RUN * 0.5) + Vector3.UP * (top_y - rise * 0.5)
		_add_stair_mesh_box(
			root,
			riser_position,
			Vector3(STAIR_WIDTH, rise, 0.065),
			stair_riser_material,
			yaw
		)

	var landing_position: Vector3 = start_offset + direction * (total_run + 0.72)
	landing_position.y = STOREY_HEIGHT - 0.09
	_add_stair_mesh_box(root, landing_position, Vector3(STAIR_WIDTH + 0.72, 0.18, 1.70), stair_tread_material, yaw)
	_add_stair_collision_box(root, landing_position, Vector3(STAIR_WIDTH + 0.72, 0.18, 1.70), yaw)

	for sign_value in [-1.0, 1.0]:
		var lateral: Vector3 = side * ((STAIR_WIDTH * 0.5 + 0.075) * float(sign_value))
		var rail_a: Vector3 = start_offset + lateral + Vector3.UP * (rise + 0.95)
		var rail_b: Vector3 = start_offset + direction * total_run + lateral + Vector3.UP * (STOREY_HEIGHT + 0.95)
		_add_stair_beam_between(root, rail_a, rail_b, 0.070, stair_rail_material)
		for post_i in range(0, STAIR_STEPS, 4):
			var base_y: float = rise * float(post_i + 1)
			var base: Vector3 = start_offset + direction * (float(post_i) * STAIR_RUN) + lateral
			base.y = base_y
			_add_stair_mesh_box(root, base + Vector3.UP * 0.46, Vector3(0.065, 0.92, 0.065), stair_rail_material, 0.0)

	var opening_center: Vector3 = direction * (total_run - 1.15)
	_add_stair_opening_trim(root, opening_center, direction, side, yaw)
	_add_stairwell_light(root, opening_center - direction * 0.30)

func _add_stair_collision_ramp(root: Node3D, top_start: Vector3, top_end: Vector3, width: float, thickness: float) -> void:
	var delta: Vector3 = top_end - top_start
	if delta.length() <= 0.01:
		return

	# Build an orthonormal basis whose local Z axis follows the ramp and whose
	# local Y axis points away from the walking surface. The box is shifted half
	# its thickness below the top line, making the requested endpoints the actual
	# collision surface instead of the box centerline.
	var z_axis: Vector3 = delta.normalized()
	var horizontal: Vector3 = Vector3(delta.x, 0.0, delta.z).normalized()
	var x_axis: Vector3 = Vector3(horizontal.z, 0.0, -horizontal.x)
	var y_axis: Vector3 = z_axis.cross(x_axis).normalized()
	if y_axis.y < 0.0:
		x_axis = -x_axis
		y_axis = z_axis.cross(x_axis).normalized()

	var body := StaticBody3D.new()
	body.name = "StairCollisionRamp"
	body.collision_layer = 3
	body.collision_mask = 3
	body.basis = Basis(x_axis, y_axis, z_axis)
	body.position = (top_start + top_end) * 0.5 - y_axis * (thickness * 0.5)

	var shape_node := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(width, thickness, delta.length())
	shape_node.shape = shape
	body.add_child(shape_node)
	root.add_child(body)
