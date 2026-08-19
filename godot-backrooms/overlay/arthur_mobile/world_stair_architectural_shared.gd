extends "res://arthur_mobile/world_v14_stable_stairs.gd"

# Shared production-safe architectural stair layer.
# The v0.14 world lineage remains intact. This script combines the segmented
# floor/ceiling opening system with constrained stair geometry directly, avoiding
# an extra GDScript inheritance seam while leaving procedural placement unchanged.

const SURFACE_SPAN := 120.0
const FLOOR_THICKNESS := 1.0
const CEILING_THICKNESS := 0.22
const OPENING_PADDING := 0.48
const MIN_STRIP := 0.08

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

var segmented_floor: Node3D
var segmented_ceiling: Node3D
var surface_signature := ""

func _ready() -> void:
	_validate_architectural_stair_profile()
	super._ready()
	segmented_floor = Node3D.new()
	segmented_floor.name = "SegmentedYellowFloor"
	add_child(segmented_floor)
	segmented_ceiling = Node3D.new()
	segmented_ceiling.name = "SegmentedYellowCeiling"
	add_child(segmented_ceiling)
	_disable_legacy_surfaces()
	_rebuild_segmented_surfaces(true)
	if DisplayServer.get_name().to_lower() == "headless":
		_headless_stair_access_smoke()

func _process(delta: float) -> void:
	super._process(delta)
	_disable_legacy_surfaces()
	_rebuild_segmented_surfaces(false)

func _disable_legacy_surfaces() -> void:
	floor_mesh.visible = false
	floor_mesh.use_collision = false
	floor_mesh.collision_layer = 0
	floor_mesh.collision_mask = 0
	ceiling_mesh.visible = false
	ceiling_mesh.use_collision = false
	ceiling_mesh.collision_layer = 0
	ceiling_mesh.collision_mask = 0

func _rebuild_segmented_surfaces(force: bool) -> void:
	if segmented_floor == null or segmented_ceiling == null:
		return
	var world_cell := Vector2i(
		floori(player.global_position.x / CELL),
		floori(player.global_position.z / CELL)
	)
	var source_cell: Vector2i = _virtual_cell(world_cell, current_level)
	var sample: Dictionary = _biome_sample_for_cell(source_cell)
	var yellow_active: bool = int(sample["primary"]) == BIOME_YELLOW
	segmented_floor.visible = yellow_active
	segmented_ceiling.visible = yellow_active
	_set_segmented_collision_enabled(segmented_floor, yellow_active)
	_set_segmented_collision_enabled(segmented_ceiling, yellow_active)
	if not yellow_active:
		surface_signature = "non-yellow:%d" % current_level
		return

	var next_signature: String = _make_surface_signature()
	if not force and next_signature == surface_signature:
		return
	surface_signature = next_signature
	_clear_segmented_surface(segmented_floor)
	_clear_segmented_surface(segmented_ceiling)

	var base_y: float = float(current_level) * STOREY_HEIGHT
	_build_segmented_surface(
		segmented_floor,
		floor_mesh.global_position.x,
		floor_mesh.global_position.z,
		base_y + FLOOR_LOCAL_Y,
		FLOOR_THICKNESS,
		YELLOW_FLOOR,
		floor_cutouts
	)
	_build_segmented_surface(
		segmented_ceiling,
		ceiling_mesh.global_position.x,
		ceiling_mesh.global_position.z,
		base_y + CEILING_LOCAL_Y,
		CEILING_THICKNESS,
		YELLOW_CEILING,
		ceiling_cutouts
	)

func _make_surface_signature() -> String:
	var text := "%d:%0.2f:%0.2f" % [
		current_level,
		floor_mesh.global_position.x,
		floor_mesh.global_position.z
	]
	for cut in floor_cutouts:
		if is_instance_valid(cut):
			text += ":F:%0.2f:%0.2f:%0.2f:%0.2f" % [
				float(cut.get_meta("world_x", 0.0)),
				float(cut.get_meta("world_z", 0.0)),
				cut.size.x,
				cut.size.z
			]
	for cut in ceiling_cutouts:
		if is_instance_valid(cut):
			text += ":C:%0.2f:%0.2f:%0.2f:%0.2f" % [
				float(cut.get_meta("world_x", 0.0)),
				float(cut.get_meta("world_z", 0.0)),
				cut.size.x,
				cut.size.z
			]
	return text

func _build_segmented_surface(
	root: Node3D,
	center_x: float,
	center_z: float,
	y: float,
	thickness: float,
	material: Material,
	cuts: Array[CSGBox3D]
) -> void:
	var regions: Array[Rect2] = [
		Rect2(
			center_x - SURFACE_SPAN * 0.5,
			center_z - SURFACE_SPAN * 0.5,
			SURFACE_SPAN,
			SURFACE_SPAN
		)
	]
	for cut in cuts:
		if not is_instance_valid(cut):
			continue
		var world_x: float = float(cut.get_meta("world_x", cut.global_position.x))
		var world_z: float = float(cut.get_meta("world_z", cut.global_position.z))
		var width: float = cut.size.x + OPENING_PADDING * 2.0
		var depth: float = cut.size.z + OPENING_PADDING * 2.0
		var hole := Rect2(world_x - width * 0.5, world_z - depth * 0.5, width, depth)
		var next_regions: Array[Rect2] = []
		for region in regions:
			_split_segmented_region(region, hole, next_regions)
		regions = next_regions

	for region in regions:
		if region.size.x >= MIN_STRIP and region.size.y >= MIN_STRIP:
			_add_segmented_surface_rect(root, region, y, thickness, material)

func _split_segmented_region(region: Rect2, hole: Rect2, output: Array[Rect2]) -> void:
	var overlap: Rect2 = region.intersection(hole)
	if overlap.size.x <= 0.001 or overlap.size.y <= 0.001:
		output.append(region)
		return

	var left: float = region.position.x
	var right: float = region.end.x
	var top: float = region.position.y
	var bottom: float = region.end.y
	var hole_left: float = overlap.position.x
	var hole_right: float = overlap.end.x
	var hole_top: float = overlap.position.y
	var hole_bottom: float = overlap.end.y

	if hole_left - left >= MIN_STRIP:
		output.append(Rect2(left, top, hole_left - left, region.size.y))
	if right - hole_right >= MIN_STRIP:
		output.append(Rect2(hole_right, top, right - hole_right, region.size.y))
	if hole_top - top >= MIN_STRIP:
		output.append(Rect2(hole_left, top, hole_right - hole_left, hole_top - top))
	if bottom - hole_bottom >= MIN_STRIP:
		output.append(Rect2(hole_left, hole_bottom, hole_right - hole_left, bottom - hole_bottom))

func _add_segmented_surface_rect(root: Node3D, rect: Rect2, y: float, thickness: float, material: Material) -> void:
	var center := Vector3(
		rect.position.x + rect.size.x * 0.5,
		y,
		rect.position.y + rect.size.y * 0.5
	)
	var size := Vector3(rect.size.x, thickness, rect.size.y)

	var visual := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = material
	visual.mesh = mesh
	visual.position = center
	visual.set_meta("surface_rect", rect)
	root.add_child(visual)

	var body := StaticBody3D.new()
	body.position = center
	body.collision_layer = 3
	body.collision_mask = 3
	body.set_meta("surface_rect", rect)
	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collision.shape = shape
	body.add_child(collision)
	root.add_child(body)

func _set_segmented_collision_enabled(root: Node3D, enabled: bool) -> void:
	for child in root.get_children():
		if child is StaticBody3D:
			var body := child as StaticBody3D
			body.collision_layer = 3 if enabled else 0
			body.collision_mask = 3 if enabled else 0

func _clear_segmented_surface(root: Node3D) -> void:
	for child in root.get_children():
		root.remove_child(child)
		child.queue_free()

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
	cut.calculate_tangents = false
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
	_add_stair_mesh_box(
		root,
		final_riser_1,
		Vector3(STAIR_WIDTH, rise, ARCH_RISER_THICKNESS),
		stair_riser_material,
		yaw
	)

	var mid_landing_center := direction * (
		(_arch_mid_landing_start_distance() + _arch_mid_landing_end_distance()) * 0.5
	)
	mid_landing_center.y = half_height - ARCH_LANDING_THICKNESS * 0.5
	var mid_landing_size := Vector3(
		STAIR_WIDTH + 0.28,
		ARCH_LANDING_THICKNESS,
		ARCH_LANDING_DEPTH
	)
	_add_stair_mesh_box(root, mid_landing_center, mid_landing_size, stair_tread_material, yaw)
	_add_stair_collision_box(root, mid_landing_center, mid_landing_size, yaw)

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
	_add_stair_mesh_box(
		root,
		final_riser_2,
		Vector3(STAIR_WIDTH, rise, ARCH_RISER_THICKNESS),
		stair_riser_material,
		yaw
	)

	var top_landing_center := direction * (
		(_arch_top_landing_start_distance() + _arch_top_landing_end_distance()) * 0.5
	)
	top_landing_center.y = STOREY_HEIGHT - ARCH_LANDING_THICKNESS * 0.5
	var top_landing_size := Vector3(
		STAIR_WIDTH + 0.62,
		ARCH_LANDING_THICKNESS,
		ARCH_LANDING_DEPTH
	)
	_add_stair_mesh_box(root, top_landing_center, top_landing_size, stair_tread_material, yaw)
	_add_stair_collision_box(root, top_landing_center, top_landing_size, yaw)

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
		for guard_t in [0.0, 0.5, 1.0]:
			var base := (
				(center - direction * half_length).lerp(
					center + direction * half_length,
					float(guard_t)
				)
				+ lateral
			)
			base.y = STOREY_HEIGHT
			_add_stair_mesh_box(
				root,
				base + Vector3.UP * 0.46,
				Vector3(0.065, 0.92, 0.065),
				stair_rail_material,
				0.0
			)

func _headless_stair_access_smoke() -> void:
	# v13_final already constructs both orientations through dynamic dispatch.
	# Here we independently prove that the segmented floor/ceiling algorithm uses
	# the exact architectural opening returned by this script's _make_cut().
	var fake_cut: CSGBox3D = _make_cut(Vector2i(1, 0), 2.0)
	fake_cut.set_meta("world_x", 0.0)
	fake_cut.set_meta("world_z", 0.0)
	var fake_cuts: Array[CSGBox3D] = [fake_cut]
	var probe := Node3D.new()
	add_child(probe)
	_build_segmented_surface(
		probe,
		0.0,
		0.0,
		-0.5,
		FLOOR_THICKNESS,
		YELLOW_FLOOR,
		fake_cuts
	)

	var hole := Rect2(
		-(fake_cut.size.x + OPENING_PADDING * 2.0) * 0.5,
		-(fake_cut.size.z + OPENING_PADDING * 2.0) * 0.5,
		fake_cut.size.x + OPENING_PADDING * 2.0,
		fake_cut.size.z + OPENING_PADDING * 2.0
	)
	for child in probe.get_children():
		if not child.has_meta("surface_rect"):
			continue
		var rect: Rect2 = child.get_meta("surface_rect")
		var overlap := rect.intersection(hole)
		assert(
			overlap.size.x <= 0.001 or overlap.size.y <= 0.001,
			"STAIR ACCESS FAILURE: segmented surface still spans architectural opening"
		)

	probe.queue_free()
	fake_cut.queue_free()
