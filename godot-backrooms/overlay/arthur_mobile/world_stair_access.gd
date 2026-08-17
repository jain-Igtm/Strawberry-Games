extends "res://arthur_mobile/world_v12.gd"

# Structural production baseline: the active yellow floor and ceiling are ordinary
# segmented meshes/colliders built around stair openings. The old giant moving CSG
# slabs stay disabled, so there is no surface that can accidentally cap a stair.

const SURFACE_SPAN := 120.0
const FLOOR_THICKNESS := 1.0
const CEILING_THICKNESS := 0.22
const OPENING_PADDING := 0.48
const MIN_STRIP := 0.08
const PROD_STAIR_CUT_WIDTH := 3.10
const PROD_STAIR_CUT_LENGTH := 5.10

var segmented_floor: Node3D
var segmented_ceiling: Node3D
var surface_signature := ""

func _ready() -> void:
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

func _make_cut(direction: Vector2i, height: float) -> CSGBox3D:
	var cut := CSGBox3D.new()
	cut.operation = CSGShape3D.OPERATION_SUBTRACTION
	if direction.x != 0:
		cut.size = Vector3(PROD_STAIR_CUT_LENGTH, height, PROD_STAIR_CUT_WIDTH)
	else:
		cut.size = Vector3(PROD_STAIR_CUT_WIDTH, height, PROD_STAIR_CUT_LENGTH)
	cut.use_collision = false
	return cut

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
	_set_collision_enabled(segmented_floor, yellow_active)
	_set_collision_enabled(segmented_ceiling, yellow_active)
	if not yellow_active:
		surface_signature = "non-yellow:%d" % current_level
		return

	var next_signature: String = _make_surface_signature()
	if not force and next_signature == surface_signature:
		return
	surface_signature = next_signature
	_clear_surface(segmented_floor)
	_clear_surface(segmented_ceiling)

	var base_y: float = float(current_level) * STOREY_HEIGHT
	_build_surface(
		segmented_floor,
		floor_mesh.global_position.x,
		floor_mesh.global_position.z,
		base_y + FLOOR_LOCAL_Y,
		FLOOR_THICKNESS,
		YELLOW_FLOOR,
		floor_cutouts
	)
	_build_surface(
		segmented_ceiling,
		ceiling_mesh.global_position.x,
		ceiling_mesh.global_position.z,
		base_y + CEILING_LOCAL_Y,
		CEILING_THICKNESS,
		YELLOW_CEILING,
		ceiling_cutouts
	)

func _make_surface_signature() -> String:
	var text := "%d:%0.2f:%0.2f" % [current_level, floor_mesh.global_position.x, floor_mesh.global_position.z]
	for cut in floor_cutouts:
		if is_instance_valid(cut):
			text += ":F:%0.2f:%0.2f:%0.2f:%0.2f" % [
				float(cut.get_meta("world_x", 0.0)), float(cut.get_meta("world_z", 0.0)), cut.size.x, cut.size.z
			]
	for cut in ceiling_cutouts:
		if is_instance_valid(cut):
			text += ":C:%0.2f:%0.2f:%0.2f:%0.2f" % [
				float(cut.get_meta("world_x", 0.0)), float(cut.get_meta("world_z", 0.0)), cut.size.x, cut.size.z
			]
	return text

func _build_surface(
	root: Node3D,
	center_x: float,
	center_z: float,
	y: float,
	thickness: float,
	material: Material,
	cuts: Array[CSGBox3D]
) -> void:
	var regions: Array[Rect2] = [Rect2(center_x - SURFACE_SPAN * 0.5, center_z - SURFACE_SPAN * 0.5, SURFACE_SPAN, SURFACE_SPAN)]
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
			_split_region(region, hole, next_regions)
		regions = next_regions

	for region in regions:
		if region.size.x >= MIN_STRIP and region.size.y >= MIN_STRIP:
			_add_surface_rect(root, region, y, thickness, material)

func _split_region(region: Rect2, hole: Rect2, output: Array[Rect2]) -> void:
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

func _add_surface_rect(root: Node3D, rect: Rect2, y: float, thickness: float, material: Material) -> void:
	var center := Vector3(rect.position.x + rect.size.x * 0.5, y, rect.position.y + rect.size.y * 0.5)
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

func _set_collision_enabled(root: Node3D, enabled: bool) -> void:
	for child in root.get_children():
		if child is StaticBody3D:
			var body := child as StaticBody3D
			body.collision_layer = 3 if enabled else 0
			body.collision_mask = 3 if enabled else 0

func _clear_surface(root: Node3D) -> void:
	for child in root.get_children():
		root.remove_child(child)
		child.queue_free()

func _build_stair_run(root: Node3D, direction_2d: Vector2i) -> void:
	var direction := Vector3(float(direction_2d.x), 0.0, float(direction_2d.y))
	var side := Vector3(-direction.z, 0.0, direction.x)
	var yaw: float = PI * 0.5 if direction_2d.x != 0 else 0.0
	var rise: float = STOREY_HEIGHT / float(STAIR_STEPS)
	var start_offset := -direction * 0.55
	var total_run: float = float(STAIR_STEPS - 1) * STAIR_RUN

	for i in range(STAIR_STEPS):
		var top_y: float = rise * float(i + 1)
		var along := start_offset + direction * (float(i) * STAIR_RUN)
		_add_stair_visual_box(root, along + Vector3.UP * (top_y - 0.045), Vector3(STAIR_WIDTH, 0.09, STAIR_RUN + 0.025), YELLOW_FLOOR, yaw)
		var riser := along - direction * (STAIR_RUN * 0.5) + Vector3.UP * (top_y - rise * 0.5)
		_add_stair_visual_box(root, riser, Vector3(STAIR_WIDTH, rise, 0.055), YELLOW_WALL, yaw)

	var ramp_a := start_offset - direction * 0.12 + Vector3.UP * 0.07
	var ramp_b := start_offset + direction * (total_run + 0.16) + Vector3.UP * (STOREY_HEIGHT - 0.20)
	_add_stair_slope(root, ramp_a, ramp_b, STAIR_WIDTH * 0.90, 0.16, true, null)
	_add_stair_slope(root, ramp_a - Vector3.UP * 0.14, ramp_b - Vector3.UP * 0.14, STAIR_WIDTH * 0.94, 0.10, false, YELLOW_WALL)

	var landing := start_offset + direction * (total_run + 0.72)
	landing.y = STOREY_HEIGHT - 0.09
	_add_stair_visual_box(root, landing, Vector3(STAIR_WIDTH + 0.62, 0.18, 1.72), YELLOW_FLOOR, yaw)
	_add_stair_collision_box(root, landing, Vector3(STAIR_WIDTH + 0.62, 0.18, 1.72), yaw)

	for sign_value: float in [-1.0, 1.0]:
		var lateral: Vector3 = side * ((STAIR_WIDTH * 0.5 + 0.075) * sign_value)
		var rail_a: Vector3 = start_offset + lateral + Vector3.UP * (rise + 0.94)
		var rail_b: Vector3 = start_offset + direction * total_run + lateral + Vector3.UP * (STOREY_HEIGHT + 0.94)
		_add_stair_slope(root, rail_a, rail_b, 0.07, 0.07, false, YELLOW_WALL)
		for post_i in range(0, STAIR_STEPS, 4):
			var base: Vector3 = start_offset + direction * (float(post_i) * STAIR_RUN) + lateral
			base.y = rise * float(post_i + 1)
			_add_stair_visual_box(root, base + Vector3.UP * 0.46, Vector3(0.06, 0.92, 0.06), YELLOW_WALL, 0.0)

func _add_stair_visual_box(root: Node3D, position: Vector3, size: Vector3, material: Material, yaw: float) -> void:
	var visual := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = material
	visual.mesh = mesh
	visual.position = position
	visual.rotation.y = yaw
	root.add_child(visual)

func _add_stair_collision_box(root: Node3D, position: Vector3, size: Vector3, yaw: float) -> void:
	var body := StaticBody3D.new()
	body.position = position
	body.rotation.y = yaw
	body.collision_layer = 3
	body.collision_mask = 3
	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collision.shape = shape
	body.add_child(collision)
	root.add_child(body)

func _add_stair_slope(root: Node3D, a: Vector3, b: Vector3, width: float, thickness: float, collision_only: bool, material: Material) -> void:
	var delta := b - a
	if delta.length() <= 0.01:
		return
	var pivot := Node3D.new()
	pivot.position = (a + b) * 0.5
	root.add_child(pivot)
	pivot.look_at(pivot.global_position + delta.normalized(), Vector3.UP)
	if collision_only:
		var body := StaticBody3D.new()
		body.collision_layer = 3
		body.collision_mask = 3
		var collision := CollisionShape3D.new()
		var shape := BoxShape3D.new()
		shape.size = Vector3(width, thickness, delta.length() + 0.20)
		collision.shape = shape
		body.add_child(collision)
		pivot.add_child(body)
	else:
		var visual := MeshInstance3D.new()
		var mesh := BoxMesh.new()
		mesh.size = Vector3(width, thickness, delta.length())
		mesh.material = material
		visual.mesh = mesh
		pivot.add_child(visual)

func _headless_stair_access_smoke() -> void:
	# This does not depend on random procedural placement. CI must always construct
	# both stair orientations and a synthetic opening, then prove no floor/ceiling
	# rectangle overlaps that opening.
	var stair_x := Node3D.new()
	stair_x.position = Vector3(0.0, 40.0, 60.0)
	tiles.add_child(stair_x)
	_build_stair_run(stair_x, Vector2i(1, 0))
	stair_x.queue_free()
	var stair_z := Node3D.new()
	stair_z.position = Vector3(20.0, 40.0, 60.0)
	tiles.add_child(stair_z)
	_build_stair_run(stair_z, Vector2i(0, 1))
	stair_z.queue_free()

	var fake_cut := CSGBox3D.new()
	fake_cut.size = Vector3(PROD_STAIR_CUT_LENGTH, 2.0, PROD_STAIR_CUT_WIDTH)
	fake_cut.set_meta("world_x", 0.0)
	fake_cut.set_meta("world_z", 0.0)
	var fake_cuts: Array[CSGBox3D] = [fake_cut]
	var probe := Node3D.new()
	add_child(probe)
	_build_surface(probe, 0.0, 0.0, -0.5, FLOOR_THICKNESS, YELLOW_FLOOR, fake_cuts)
	var hole := Rect2(
		-(PROD_STAIR_CUT_LENGTH + OPENING_PADDING * 2.0) * 0.5,
		-(PROD_STAIR_CUT_WIDTH + OPENING_PADDING * 2.0) * 0.5,
		PROD_STAIR_CUT_LENGTH + OPENING_PADDING * 2.0,
		PROD_STAIR_CUT_WIDTH + OPENING_PADDING * 2.0
	)
	for child in probe.get_children():
		if not child.has_meta("surface_rect"):
			continue
		var rect: Rect2 = child.get_meta("surface_rect")
		var overlap := rect.intersection(hole)
		assert(overlap.size.x <= 0.001 or overlap.size.y <= 0.001, "STAIR ACCESS FAILURE: floor still spans opening")
	probe.queue_free()
	fake_cut.queue_free()
