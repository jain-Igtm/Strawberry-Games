extends "res://arthur_mobile/world_v14_stable_stairs.gd"

# v0.15: one constrained architectural profile drives every part of the stair.
# The procedural world still decides WHERE stairs exist. This file only decides
# HOW each selected stair is built.
#
# The current 4.4 m storey is intentionally split into two straight flights with
# a real intermediate landing. Step dimensions are solved from the floor-to-floor
# height, then the visible stair, traversal ramps, landings, rails, and slab cuts
# are all derived from that same profile so they cannot drift apart.

const ARCH_TARGET_RISER := 0.170
const ARCH_MAX_RISER := 0.178
const ARCH_MIN_TREAD := 0.279
const ARCH_MAX_TREAD := 0.320
const ARCH_MIN_LANDING := 0.914
const ARCH_LANDING_DEPTH := 1.20
const ARCH_HEADROOM := 2.032
const ARCH_CEILING_HALF_THICKNESS := 0.11
const ARCH_TREAD_THICKNESS := 0.09
const ARCH_RISER_THICKNESS := 0.065
const ARCH_COLLISION_THICKNESS := 0.18
const ARCH_RAIL_HEIGHT := 0.95
const ARCH_RAIL_OFFSET := 0.075
const ARCH_OPENING_SIDE_CLEARANCE := 0.30
const ARCH_OPENING_END_CLEARANCE := 0.22
const ARCH_FIRST_TREAD_CENTER := -0.55

func _ready() -> void:
	_validate_architectural_stair_profile()
	super._ready()

func _solve_architectural_stair_profile() -> Dictionary:
	# Pick an even riser count close to a 170 mm target while never exceeding the
	# hard 178 mm cap. Even count keeps the two flights visually balanced.
	var minimum_risers: int = ceili(STOREY_HEIGHT / ARCH_MAX_RISER)
	var total_risers: int = maxi(minimum_risers, roundi(STOREY_HEIGHT / ARCH_TARGET_RISER))
	if total_risers % 2 != 0:
		total_risers += 1
	while STOREY_HEIGHT / float(total_risers) > ARCH_MAX_RISER:
		total_risers += 2

	var first_flight_risers: int = total_risers / 2
	var second_flight_risers: int = total_risers - first_flight_risers
	var riser: float = STOREY_HEIGHT / float(total_risers)

	# Use a comfortable proportional tread, then clamp it to the architectural
	# envelope. With the current 4.4 m storey this resolves to about 292 mm.
	var tread: float = clampf(0.630 - 2.0 * riser, ARCH_MIN_TREAD, ARCH_MAX_TREAD)
	var first_treads: int = first_flight_risers - 1
	var second_treads: int = second_flight_risers - 1
	var first_run: float = float(first_treads) * tread
	var second_run: float = float(second_treads) * tread
	var landing_depth: float = maxf(ARCH_MIN_LANDING, ARCH_LANDING_DEPTH)

	var first_start: float = ARCH_FIRST_TREAD_CENTER - tread * 0.5
	var landing_start: float = first_start + first_run
	var landing_end: float = landing_start + landing_depth
	var second_end: float = landing_end + second_run
	var top_landing_end: float = second_end + landing_depth
	var landing_y: float = riser * float(first_flight_risers)

	# Start the opening before the sloped walking line would violate required
	# headroom under the lower-storey ceiling. Also force it to begin before the
	# intermediate landing so the upper flight can never run into the slab when
	# storey streaming switches the broad floor plane.
	var ceiling_underside: float = CEILING_LOCAL_Y - ARCH_CEILING_HALF_THICKNESS
	var highest_walk_y_under_ceiling: float = ceiling_underside - ARCH_HEADROOM
	var headroom_ratio: float = clampf(highest_walk_y_under_ceiling / landing_y, 0.0, 1.0)
	var headroom_start: float = first_start + first_run * headroom_ratio
	var opening_start: float = minf(
		headroom_start - ARCH_OPENING_END_CLEARANCE,
		landing_start - 0.35
	)
	var opening_end: float = top_landing_end + ARCH_OPENING_END_CLEARANCE

	return {
		"total_risers": total_risers,
		"first_flight_risers": first_flight_risers,
		"second_flight_risers": second_flight_risers,
		"first_treads": first_treads,
		"second_treads": second_treads,
		"riser": riser,
		"tread": tread,
		"first_start": first_start,
		"first_run": first_run,
		"landing_start": landing_start,
		"landing_end": landing_end,
		"landing_depth": landing_depth,
		"landing_y": landing_y,
		"second_start": landing_end,
		"second_run": second_run,
		"second_end": second_end,
		"top_landing_end": top_landing_end,
		"opening_start": opening_start,
		"opening_end": opening_end,
		"opening_length": opening_end - opening_start,
		"opening_width": STAIR_WIDTH + ARCH_OPENING_SIDE_CLEARANCE * 2.0
	}

func _validate_architectural_stair_profile() -> void:
	var p := _solve_architectural_stair_profile()
	var riser: float = float(p["riser"])
	var tread: float = float(p["tread"])
	var total_risers: int = int(p["total_risers"])
	var first_flight_risers: int = int(p["first_flight_risers"])
	var second_flight_risers: int = int(p["second_flight_risers"])
	var first_run: float = float(p["first_run"])
	var second_run: float = float(p["second_run"])
	var landing_y: float = float(p["landing_y"])
	var first_angle: float = rad_to_deg(atan(landing_y / first_run))
	var second_angle: float = rad_to_deg(atan((STOREY_HEIGHT - landing_y) / second_run))

	assert(absf(riser * float(total_risers) - STOREY_HEIGHT) < 0.001, "Stair risers must close exactly on the next floor")
	assert(riser <= ARCH_MAX_RISER + 0.0001, "Stair riser exceeds architectural cap")
	assert(tread >= ARCH_MIN_TREAD - 0.0001, "Stair tread is too shallow")
	assert(float(p["landing_depth"]) >= ARCH_MIN_LANDING, "Intermediate landing is too short")
	assert(first_flight_risers > 1 and second_flight_risers > 1, "Both stair flights must contain real steps")
	assert(first_angle >= 30.0 and first_angle <= 45.0, "First flight slope is outside normal stair geometry")
	assert(second_angle >= 30.0 and second_angle <= 45.0, "Second flight slope is outside normal stair geometry")
	assert(float(p["opening_start"]) < float(p["landing_start"]), "Stair opening must begin before the intermediate landing")
	assert(float(p["opening_end"]) > float(p["second_end"]), "Stair opening must include the upper arrival")
	assert(float(p["top_landing_end"]) < CELL * 3.0 - 0.25, "Architectural stair no longer fits the three-cell procedural corridor reservation")

func _spawn_stair(stair: Dictionary, cuts_current_floor: bool) -> void:
	var lower_level: int = int(stair.get("lower_level", current_level))
	var start: Vector2i = stair.get("start", Vector2i.ZERO) as Vector2i
	var direction_2d: Vector2i = stair.get("direction", Vector2i(1, 0)) as Vector2i
	var direction := Vector3(float(direction_2d.x), 0.0, float(direction_2d.y)).normalized()
	var p := _solve_architectural_stair_profile()

	var stair_root := Node3D.new()
	stair_root.name = "stair_%d_%+d_%d" % [start.x, lower_level, start.y]
	stair_root.position = Vector3(
		float(start.x) * CELL,
		float(lower_level) * STOREY_HEIGHT,
		float(start.y) * CELL
	)
	connector_root.add_child(stair_root)
	_build_stair_run(stair_root, direction_2d)

	# The floor and ceiling holes use the exact same solved opening as the stair.
	var opening_center_distance: float = (
		float(p["opening_start"]) + float(p["opening_end"])
	) * 0.5
	var cut_world := Vector3(float(start.x) * CELL, 0.0, float(start.y) * CELL)
	cut_world += direction * opening_center_distance

	if cuts_current_floor:
		_add_floor_cut(cut_world, direction_2d)
	else:
		_add_ceiling_cut(cut_world, direction_2d)

func _make_cut(direction: Vector2i, height: float) -> CSGBox3D:
	var p := _solve_architectural_stair_profile()
	var cut := CSGBox3D.new()
	cut.operation = CSGShape3D.OPERATION_SUBTRACTION
	var opening_length: float = float(p["opening_length"])
	var opening_width: float = float(p["opening_width"])
	if direction.x != 0:
		cut.size = Vector3(opening_length, height, opening_width)
	else:
		cut.size = Vector3(opening_width, height, opening_length)
	cut.use_collision = false
	return cut

func _build_stair_run(root: Node3D, direction_2d: Vector2i) -> void:
	_ensure_stair_materials()
	var p := _solve_architectural_stair_profile()
	var direction := Vector3(float(direction_2d.x), 0.0, float(direction_2d.y)).normalized()
	var side := Vector3(-direction.z, 0.0, direction.x)
	var yaw: float = PI * 0.5 if direction_2d.x != 0 else 0.0
	var riser: float = float(p["riser"])
	var tread: float = float(p["tread"])
	var landing_y: float = float(p["landing_y"])
	var first_start: float = float(p["first_start"])
	var landing_start: float = float(p["landing_start"])
	var landing_end: float = float(p["landing_end"])
	var second_end: float = float(p["second_end"])
	var top_landing_end: float = float(p["top_landing_end"])

	# Two exact convex traversal ramps plus flat landing colliders. The visible
	# stair has no collision, so CharacterBody3D never has to step over riser walls.
	_add_architectural_collision_ramp(
		root,
		direction * first_start,
		direction * landing_start + Vector3.UP * landing_y,
		STAIR_WIDTH - 0.10,
		ARCH_COLLISION_THICKNESS
	)
	_add_architectural_landing(root, direction, yaw, landing_start, landing_end, landing_y)
	_add_architectural_collision_ramp(
		root,
		direction * landing_end + Vector3.UP * landing_y,
		direction * second_end + Vector3.UP * STOREY_HEIGHT,
		STAIR_WIDTH - 0.10,
		ARCH_COLLISION_THICKNESS
	)
	_add_architectural_landing(root, direction, yaw, second_end, top_landing_end, STOREY_HEIGHT)

	# Closed, uniform first flight.
	_add_architectural_flight_visuals(
		root,
		direction,
		yaw,
		first_start,
		0.0,
		int(p["first_flight_risers"]),
		int(p["first_treads"]),
		riser,
		tread,
		landing_y
	)

	# Closed, uniform second flight.
	_add_architectural_flight_visuals(
		root,
		direction,
		yaw,
		landing_end,
		landing_y,
		int(p["second_flight_risers"]),
		int(p["second_treads"]),
		riser,
		tread,
		STOREY_HEIGHT
	)

	# Thin continuous soffits make each flight read as constructed architecture
	# rather than independent floating boxes.
	_add_sloped_stair_slab(
		root,
		direction * first_start + Vector3.UP * -0.13,
		direction * landing_start + Vector3.UP * (landing_y - 0.13),
		STAIR_WIDTH * 0.94,
		0.16,
		stair_riser_material
	)
	_add_sloped_stair_slab(
		root,
		direction * landing_end + Vector3.UP * (landing_y - 0.13),
		direction * second_end + Vector3.UP * (STOREY_HEIGHT - 0.13),
		STAIR_WIDTH * 0.94,
		0.16,
		stair_riser_material
	)

	_add_architectural_flight_rails(root, direction, side, first_start, landing_start, 0.0, landing_y, int(p["first_flight_risers"]))
	_add_architectural_landing_rails(root, direction, side, landing_start, landing_end, landing_y)
	_add_architectural_flight_rails(root, direction, side, landing_end, second_end, landing_y, STOREY_HEIGHT, int(p["second_flight_risers"]))
	_add_architectural_landing_rails(root, direction, side, second_end, top_landing_end, STOREY_HEIGHT)
	_add_architectural_opening_trim(root, direction, side, yaw, p)
	_add_stairwell_light(root, direction * ((float(p["opening_start"]) + float(p["opening_end"])) * 0.5))

func _add_architectural_flight_visuals(
	root: Node3D,
	direction: Vector3,
	yaw: float,
	flight_start: float,
	base_y: float,
	flight_risers: int,
	tread_count: int,
	riser: float,
	tread: float,
	arrival_y: float
) -> void:
	for i in range(tread_count):
		var top_y: float = base_y + riser * float(i + 1)
		var center_distance: float = flight_start + tread * (float(i) + 0.5)
		var along := direction * center_distance
		_add_stair_mesh_box(
			root,
			along + Vector3.UP * (top_y - ARCH_TREAD_THICKNESS * 0.5),
			Vector3(STAIR_WIDTH, ARCH_TREAD_THICKNESS, tread + 0.018),
			stair_tread_material,
			yaw
		)
		var riser_distance: float = flight_start + tread * float(i)
		_add_stair_mesh_box(
			root,
			direction * riser_distance + Vector3.UP * (top_y - riser * 0.5),
			Vector3(STAIR_WIDTH, riser, ARCH_RISER_THICKNESS),
			stair_riser_material,
			yaw
		)

	# The arrival landing is the final tread, so close the last rise explicitly.
	var final_riser_y: float = arrival_y - riser * 0.5
	var flight_run: float = float(tread_count) * tread
	_add_stair_mesh_box(
		root,
		direction * (flight_start + flight_run) + Vector3.UP * final_riser_y,
		Vector3(STAIR_WIDTH, riser, ARCH_RISER_THICKNESS),
		stair_riser_material,
		yaw
	)

func _add_architectural_landing(
	root: Node3D,
	direction: Vector3,
	yaw: float,
	start_distance: float,
	end_distance: float,
	top_y: float
) -> void:
	var depth: float = end_distance - start_distance
	var center_distance: float = (start_distance + end_distance) * 0.5
	var position := direction * center_distance + Vector3.UP * (top_y - ARCH_COLLISION_THICKNESS * 0.5)
	var size := Vector3(STAIR_WIDTH, ARCH_COLLISION_THICKNESS, depth)
	_add_stair_mesh_box(root, position, size, stair_tread_material, yaw)
	_add_stair_collision_box(root, position, size, yaw)

func _add_architectural_collision_ramp(
	root: Node3D,
	top_start: Vector3,
	top_end: Vector3,
	width: float,
	thickness: float
) -> void:
	var delta := top_end - top_start
	var horizontal := Vector3(delta.x, 0.0, delta.z)
	if horizontal.length_squared() <= 0.0001 or delta.length_squared() <= 0.0001:
		return
	horizontal = horizontal.normalized()
	var side := Vector3(-horizontal.z, 0.0, horizontal.x)
	var half_width: float = width * 0.5
	var down := Vector3.DOWN * thickness

	var a_left := top_start - side * half_width
	var a_right := top_start + side * half_width
	var b_left := top_end - side * half_width
	var b_right := top_end + side * half_width

	var shape := ConvexPolygonShape3D.new()
	shape.points = PackedVector3Array([
		a_left,
		a_right,
		b_left,
		b_right,
		a_left + down,
		a_right + down,
		b_left + down,
		b_right + down
	])

	var body := StaticBody3D.new()
	body.name = "ArchitecturalStairRamp"
	body.collision_layer = 3
	body.collision_mask = 3
	var shape_node := CollisionShape3D.new()
	shape_node.shape = shape
	body.add_child(shape_node)
	root.add_child(body)

func _add_architectural_flight_rails(
	root: Node3D,
	direction: Vector3,
	side: Vector3,
	start_distance: float,
	end_distance: float,
	start_y: float,
	end_y: float,
	riser_count: int
) -> void:
	for sign_value in [-1.0, 1.0]:
		var lateral := side * ((STAIR_WIDTH * 0.5 + ARCH_RAIL_OFFSET) * sign_value)
		var rail_a := direction * start_distance + lateral + Vector3.UP * (start_y + ARCH_RAIL_HEIGHT)
		var rail_b := direction * end_distance + lateral + Vector3.UP * (end_y + ARCH_RAIL_HEIGHT)
		_add_stair_beam_between(root, rail_a, rail_b, 0.070, stair_rail_material)

		for post_i in range(0, riser_count + 1, 3):
			var t: float = clampf(float(post_i) / float(riser_count), 0.0, 1.0)
			var base := direction * lerpf(start_distance, end_distance, t) + lateral
			base.y = lerpf(start_y, end_y, t)
			_add_stair_mesh_box(
				root,
				base + Vector3.UP * 0.46,
				Vector3(0.065, 0.92, 0.065),
				stair_rail_material,
				0.0
			)

func _add_architectural_landing_rails(
	root: Node3D,
	direction: Vector3,
	side: Vector3,
	start_distance: float,
	end_distance: float,
	landing_y: float
) -> void:
	for sign_value in [-1.0, 1.0]:
		var lateral := side * ((STAIR_WIDTH * 0.5 + ARCH_RAIL_OFFSET) * sign_value)
		var rail_a := direction * start_distance + lateral + Vector3.UP * (landing_y + ARCH_RAIL_HEIGHT)
		var rail_b := direction * end_distance + lateral + Vector3.UP * (landing_y + ARCH_RAIL_HEIGHT)
		_add_stair_beam_between(root, rail_a, rail_b, 0.070, stair_rail_material)
		for distance_value in [start_distance, end_distance]:
			var base := direction * float(distance_value) + lateral + Vector3.UP * landing_y
			_add_stair_mesh_box(
				root,
				base + Vector3.UP * 0.46,
				Vector3(0.065, 0.92, 0.065),
				stair_rail_material,
				0.0
			)

func _add_architectural_opening_trim(
	root: Node3D,
	direction: Vector3,
	side: Vector3,
	yaw: float,
	p: Dictionary
) -> void:
	var opening_start: float = float(p["opening_start"])
	var opening_end: float = float(p["opening_end"])
	var opening_length: float = opening_end - opening_start
	var opening_width: float = float(p["opening_width"])
	var center_distance: float = (opening_start + opening_end) * 0.5
	var center := direction * center_distance
	var trim_y: float = STOREY_HEIGHT + 0.035

	# Side coping follows the exact generated slab opening. No transverse bar is
	# placed across the arrival path.
	for sign_value in [-1.0, 1.0]:
		var lateral := side * ((opening_width * 0.5 + 0.09) * sign_value)
		var side_center := center + lateral + Vector3.UP * trim_y
		_add_stair_mesh_box(
			root,
			side_center,
			Vector3(0.18, 0.13, opening_length + 0.18),
			stair_tread_material,
			yaw
		)
