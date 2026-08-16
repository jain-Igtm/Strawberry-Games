extends "res://arthur_mobile/world_production.gd"

# Production stair-access layer.
# The inherited v0.10-v0.12 system cut holes out of one moving 120 m CSG slab.
# On device those subtraction children could visually/collision-wise lag the moving
# parent, leaving a perfectly valid staircase sealed by a floor or ceiling. This
# layer stops using subtraction for the broad yellow surfaces entirely. The slabs
# are built as ordinary mesh/static-body rectangles around the opening, so there is
# literally no render or collision geometry spanning the stairwell.

const SURFACE_SPAN := 120.0
const FLOOR_THICKNESS := 1.0
const CEILING_THICKNESS := 0.22
const OPENING_PADDING := 0.34
const MIN_SURFACE_STRIP := 0.08

var segmented_floor_root: Node3D
var segmented_ceiling_root: Node3D
var last_surface_signature := ""

func _ready() -> void:
	super._ready()
	segmented_floor_root = Node3D.new()
	segmented_floor_root.name = "SegmentedYellowFloor"
	add_child(segmented_floor_root)
	segmented_ceiling_root = Node3D.new()
	segmented_ceiling_root.name = "SegmentedYellowCeiling"
	add_child(segmented_ceiling_root)
	_disable_legacy_broad_surfaces()
	_rebuild_segmented_surfaces(true)
	if DisplayServer.get_name().to_lower() == "headless":
		_validate_surface_openings()

func _process(delta: float) -> void:
	super._process(delta)
	_disable_legacy_broad_surfaces()
	_rebuild_segmented_surfaces(false)

func _disable_legacy_broad_surfaces() -> void:
	# Pool/service biomes already own their local floor/ceiling cells. Yellow uses
	# the segmented roots below. The old monolithic slabs are never allowed to
	# render or collide in the production build.
	floor_mesh.visible = false
	floor_mesh.use_collision = false
	floor_mesh.collision_layer = 0
	floor_mesh.collision_mask = 0
	ceiling_mesh.visible = false
	ceiling_mesh.use_collision = false
	ceiling_mesh.collision_layer = 0
	ceiling_mesh.collision_mask = 0

func _rebuild_segmented_surfaces(force: bool) -> void:
	if segmented_floor_root == null or segmented_ceiling_root == null:
		return

	var world_cell := Vector2i(
		floori(player.global_position.x / CELL),
		floori(player.global_position.z / CELL)
	)
	var source_cell := _virtual_cell(world_cell, current_level)
	var sample := _biome_sample_for_cell(source_cell)
	var yellow_active := int(sample["primary"]) == BIOME_YELLOW

	segmented_floor_root.visible = yellow_active
	segmented_ceiling_root.visible = yellow_active
	if not yellow_active:
		_set_surface_collision_enabled(segmented_floor_root, false)
		_set_surface_collision_enabled(segmented_ceiling_root, false)
		last_surface_signature = "non-yellow-%d" % current_level
		return

	var signature := _surface_signature()
	if not force and signature == last_surface_signature:
		return
	last_surface_signature = signature

	_clear_surface_root(segmented_floor_root)
	_clear_surface_root(segmented_ceiling_root)

	var base_y := float(current_level) * STOREY_HEIGHT
	_build_surface_with_cutouts(
		segmented_floor_root,
		floor_mesh.global_position.x,
		floor_mesh.global_position.z,
		base_y + FLOOR_LOCAL_Y,
		FLOOR_THICKNESS,
		YELLOW_FLOOR,
		floor_cutouts
	)
	_build_surface_with_cutouts(
		segmented_ceiling_root,
		ceiling_mesh.global_position.x,
		ceiling_mesh.global_position.z,
		base_y + CEILING_LOCAL_Y,
		CEILING_THICKNESS,
		YELLOW_CEILING,
		ceiling_cutouts
	)

func _surface_signature() -> String:
	var parts: Array[String] = [
		str(current_level),
		str(snappedf(floor_mesh.global_position.x, 0.01)),
		str(snappedf(floor_mesh.global_position.z, 0.01))
	]
	for cut in floor_cutouts:
		if is_instance_valid(cut):
			parts.append("F:%0.2f:%0.2f:%0.2f:%0.2f" % [
				float(cut.get_meta("world_x", 0.0)),
				float(cut.get_meta("world_z", 0.0)),
				cut.size.x,
				cut.size.z
			])
	for cut in ceiling_cutouts:
		if is_instance_valid(cut):
			parts.append("C:%0.2f:%0.2f:%0.2f:%0.2f" % [
				float(cut.get_meta("world_x", 0.0)),
				float(cut.get_meta("world_z", 0.0)),
				cut.size.x,
				cut.size.z
			])
	return "|".join(parts)

func _build_surface_with_cutouts(
	root: Node3D,
	center_x: float,
	center_z: float,
	y: float,
	thickness: float,
	material: Material,
	cuts: Array[CSGBox3D]
) -> void:
	var valid_cuts: Array[Rect2] = []
	for cut in cuts:
		if not is_instance_valid(cut):
			continue
		var world_x := float(cut.get_meta("world_x", cut.global_position.x))
		var world_z := float(cut.get_meta("world_z", cut.global_position.z))
		var width := cut.size.x + OPENING_PADDING * 2.0
		var depth := cut.size.z + OPENING_PADDING * 2.0
		valid_cuts.append(Rect2(world_x - width * 0.5, world_z - depth * 0.5, width, depth))

	# The connector generator creates at most one down opening per floor surface
	# and one up opening per ceiling surface. Keep a safe multi-cut fallback anyway.
	if valid_cuts.is_empty():
		_add_surface_rect(root, Rect2(center_x - SURFACE_SPAN * 0.5, center_z - SURFACE_SPAN * 0.5, SURFACE_SPAN, SURFACE_SPAN), y, thickness, material)
		return

	var regions: Array[Rect2] = [Rect2(center_x - SURFACE_SPAN * 0.5, center_z - SURFACE_SPAN * 0.5, SURFACE_SPAN, SURFACE_SPAN)]
	for hole in valid_cuts:
		var next_regions: Array[Rect2] = []
		for region in regions:
			_split_rect_around_hole(region, hole, next_regions)
		regions = next_regions

	for region in regions:
		if region.size.x >= MIN_SURFACE_STRIP and region.size.y >= MIN_SURFACE_STRIP:
			_add_surface_rect(root, region, y, thickness, material)

func _split_rect_around_hole(region: Rect2, hole: Rect2, output: Array[Rect2]) -> void:
	var intersection := region.intersection(hole)
	if intersection.size.x <= 0.001 or intersection.size.y <= 0.001:
		output.append(region)
		return

	var r_left := region.position.x
	var r_right := region.end.x
	var r_top := region.position.y
	var r_bottom := region.end.y
	var h_left := intersection.position.x
	var h_right := intersection.end.x
	var h_top := intersection.position.y
	var h_bottom := intersection.end.y

	if h_left - r_left >= MIN_SURFACE_STRIP:
		output.append(Rect2(r_left, r_top, h_left - r_left, region.size.y))
	if r_right - h_right >= MIN_SURFACE_STRIP:
		output.append(Rect2(h_right, r_top, r_right - h_right, region.size.y))
	if h_top - r_top >= MIN_SURFACE_STRIP:
		output.append(Rect2(h_left, r_top, h_right - h_left, h_top - r_top))
	if r_bottom - h_bottom >= MIN_SURFACE_STRIP:
		output.append(Rect2(h_left, h_bottom, h_right - h_left, r_bottom - h_bottom))

func _add_surface_rect(root: Node3D, rect: Rect2, y: float, thickness: float, material: Material) -> void:
	var center := Vector3(rect.position.x + rect.size.x * 0.5, y, rect.position.y + rect.size.y * 0.5)
	var size := Vector3(rect.size.x, thickness, rect.size.y)

	var mesh_instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = material
	mesh_instance.mesh = mesh
	mesh_instance.position = center
	mesh_instance.set_meta("surface_rect", rect)
	root.add_child(mesh_instance)

	var body := StaticBody3D.new()
	body.position = center
	body.collision_layer = 3
	body.collision_mask = 3
	body.set_meta("surface_rect", rect)
	var shape_node := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	shape_node.shape = shape
	body.add_child(shape_node)
	root.add_child(body)

func _set_surface_collision_enabled(root: Node3D, enabled: bool) -> void:
	for child in root.get_children():
		if child is StaticBody3D:
			var body := child as StaticBody3D
			body.collision_layer = 3 if enabled else 0
			body.collision_mask = 3 if enabled else 0

func _clear_surface_root(root: Node3D) -> void:
	for child in root.get_children():
		root.remove_child(child)
		child.queue_free()

func _validate_surface_openings() -> void:
	# CI assertion: if the connector system says there is a stair hole, no broad
	# yellow floor/ceiling rectangle is allowed to overlap its padded opening.
	_validate_root_against_cuts(segmented_floor_root, floor_cutouts, "floor")
	_validate_root_against_cuts(segmented_ceiling_root, ceiling_cutouts, "ceiling")

func _validate_root_against_cuts(root: Node3D, cuts: Array[CSGBox3D], label: String) -> void:
	for cut in cuts:
		if not is_instance_valid(cut):
			continue
		var world_x := float(cut.get_meta("world_x", cut.global_position.x))
		var world_z := float(cut.get_meta("world_z", cut.global_position.z))
		var hole := Rect2(
			world_x - (cut.size.x + OPENING_PADDING * 2.0) * 0.5,
			world_z - (cut.size.z + OPENING_PADDING * 2.0) * 0.5,
			cut.size.x + OPENING_PADDING * 2.0,
			cut.size.z + OPENING_PADDING * 2.0
		)
		for child in root.get_children():
			if not child.has_meta("surface_rect"):
				continue
			var rect := child.get_meta("surface_rect") as Rect2
			var overlap := rect.intersection(hole)
			assert(overlap.size.x <= 0.001 or overlap.size.y <= 0.001, "Segmented %s still covers a stair opening" % label)
