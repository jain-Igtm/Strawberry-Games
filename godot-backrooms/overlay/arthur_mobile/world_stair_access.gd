extends "res://arthur_mobile/world_v12.gd"

# Production-safe stair access layer. Keep the proven v0.12 world as the parent
# and carry only the later stair-specific protections here. This avoids pulling
# unrelated v13/v14 runtime inheritance into the production world while retaining
# connector separation and exact-top collision ramps.

const SURFACE_SPAN := 120.0
const FLOOR_THICKNESS := 1.0
const CEILING_THICKNESS := 0.22
const OPENING_PADDING := 0.48
const MIN_STRIP := 0.08
const PROD_STAIR_CUT_WIDTH := 3.10
const PROD_STAIR_CUT_LENGTH := 5.10
const STAIR_ACCESS_SEARCH_RADIUS_BLOCKS := 3
const STAIR_ACCESS_MIN_SEPARATION_CELLS := 4
const STAIR_COLLISION_THICKNESS := 0.18
const STAIR_COLLISION_INSET := 0.06

var segmented_floor: Node3D
var segmented_ceiling: Node3D
var surface_signature := ""

# These names match the architectural subclass API, but reuse the production
# world's existing materials rather than creating a second material palette.
var stair_tread_material: Material
var stair_riser_material: Material
var stair_rail_material: Material
var stair_lamp_material: StandardMaterial3D

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

# Preserve v13's connector-separation behavior without inheriting the entire v13
# pool/world class. Up and down stairs are never allowed to occupy the same local
# reservation; an alternate lower connector is selected when necessary.
func _rebuild_connectors(force: bool) -> void:
	if connector_root == null:
		return

	var world_cell := Vector2i(
		floori(player.global_position.x / CELL),
		floori(player.global_position.z / CELL)
	)
	var next_block: Vector2i = _block_for_world_cell(world_cell)
	if not force and next_block == connector_block and current_level == connector_level:
		return

	connector_block = next_block
	connector_level = current_level
	_clear_connectors()

	var up: Dictionary = _nearest_stair(current_level, world_cell)
	var down: Dictionary = _nearest_stair(current_level - 1, world_cell)

	if bool(up.get("valid", false)) and bool(down.get("valid", false)):
		var up_start: Vector2i = up.get("start", Vector2i.ZERO) as Vector2i
		var down_start: Vector2i = down.get("start", Vector2i.ZERO) as Vector2i
		if _stair_starts_too_close(up_start, down_start):
			var alternate_down: Dictionary = _nearest_stair_avoiding(current_level - 1, world_cell, up_start)
			if bool(alternate_down.get("valid", false)):
				down = alternate_down
			else:
				var up_distance: float = Vector2(up_start - world_cell).length_squared()
				var down_distance: float = Vector2(down_start - world_cell).length_squared()
				if down_distance < up_distance:
					up = {"valid": false}
				else:
					down = {"valid": false}

	if bool(up.get("valid", false)):
		_spawn_stair(up, false)
	if bool(down.get("valid", false)):
		_spawn_stair(down, true)

	_position_cutouts()

func _nearest_stair_avoiding(lower_level: int, world_cell: Vector2i, avoid_start: Vector2i) -> Dictionary:
	var center_block: Vector2i = _block_for_world_cell(world_cell)
	var best: Dictionary = {"valid": false}
	var best_distance: float = INF

	for bz in range(center_block.y - STAIR_ACCESS_SEARCH_RADIUS_BLOCKS, center_block.y + STAIR_ACCESS_SEARCH_RADIUS_BLOCKS + 1):
		for bx in range(center_block.x - STAIR_ACCESS_SEARCH_RADIUS_BLOCKS, center_block.x + STAIR_ACCESS_SEARCH_RADIUS_BLOCKS + 1):
			var candidate: Dictionary = _stair_descriptor(Vector2i(bx, bz), lower_level)
			if not bool(candidate.get("valid", false)):
				continue
			var start: Vector2i = candidate.get("start", Vector2i.ZERO) as Vector2i
			if _stair_starts_too_close(start, avoid_start):
				continue
			var dx: float = float(start.x - world_cell.x)
			var dz: float = float(start.y - world_cell.y)
			var distance_sq: float = dx * dx + dz * dz
			if distance_sq < best_distance:
				best_distance = distance_sq
				best = candidate
	return best

func _stair_starts_too_close(a: Vector2i, b: Vector2i) -> bool:
	var dx: int = a.x - b.x
	var dz: int = a.y - b.y
	var minimum: int = STAIR_ACCESS_MIN_SEPARATION_CELLS
	return dx * dx + dz * dz < minimum * minimum

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

func _build_surface(
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

func _ensure_stair_materials() -> void:
	if stair_tread_material != null:
		return
	stair_tread_material = YELLOW_FLOOR
	stair_riser_material = YELLOW_WALL
	stair_rail_material = YELLOW_WALL
	stair_lamp_material = StandardMaterial3D.new()
	stair_lamp_material.albedo_color = Color(1.0, 0.94, 0.72, 1.0)
	stair_lamp_material.emission_enabled = true
	stair_lamp_material.emission = Color(1.0, 0.88, 0.52, 1.0)

func _add_stair_mesh_box(root: Node3D, position: Vector3, size: Vector3, material: Material, yaw: float) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = material
	instance.mesh = mesh
	instance.position = position
	instance.rotation.y = yaw
	root.add_child(instance)
	return instance

func _add_stair_collision_box(root: Node3D, position: Vector3, size: Vector3, yaw: float) -> void:
	var body := StaticBody3D.new()
	body.position = position
	body.rotation.y = yaw
	body.collision_layer = 3
	body.collision_mask = 3
	var shape_node := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	shape_node.shape = shape
	body.add_child(shape_node)
	root.add_child(body)

func _add_stair_collision_ramp(root: Node3D, top_start: Vector3, top_end: Vector3, width: float, thickness: float) -> void:
	var delta := top_end - top_start
	if delta.length() <= 0.01:
		return

	var z_axis := delta.normalized()
	var horizontal := Vector3(delta.x, 0.0, delta.z).normalized()
	var x_axis := Vector3(horizontal.z, 0.0, -horizontal.x)
	var y_axis := z_axis.cross(x_axis).normalized()
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

func _add_sloped_stair_slab(root: Node3D, a: Vector3, b: Vector3, width: float, thickness: float, material: Material) -> void:
	var delta := b - a
	if delta.length() <= 0.01:
		return
	var pivot := Node3D.new()
	pivot.position = (a + b) * 0.5
	root.add_child(pivot)
	pivot.look_at(pivot.global_position + delta.normalized(), Vector3.UP)
	var slab := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(width, thickness, delta.length())
	mesh.material = material
	slab.mesh = mesh
	pivot.add_child(slab)

func _add_stair_beam_between(root: Node3D, a: Vector3, b: Vector3, thickness: float, material: Material) -> void:
	var delta := b - a
	if delta.length() <= 0.01:
		return
	var pivot := Node3D.new()
	pivot.position = (a + b) * 0.5
	root.add_child(pivot)
	pivot.look_at(pivot.global_position + delta.normalized(), Vector3.UP)
	var beam := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(thickness, thickness, delta.length())
	mesh.material = material
	beam.mesh = mesh
	pivot.add_child(beam)

func _add_stairwell_light(root: Node3D, opening_center: Vector3) -> void:
	var fixture_position := opening_center + Vector3.UP * (STOREY_HEIGHT - 0.26)
	_add_stair_mesh_box(root, fixture_position, Vector3(1.10, 0.055, 0.24), stair_lamp_material, 0.0)
	var light := OmniLight3D.new()
	light.position = opening_center + Vector3.UP * (STOREY_HEIGHT - 0.55)
	light.light_color = Color(1.0, 0.87, 0.58, 1.0)
	light.light_energy = 0.78
	light.omni_range = 5.4
	light.shadow_enabled = false
	root.add_child(light)

func _headless_stair_access_smoke() -> void:
	# Construct both stair orientations through dynamic dispatch, then construct a
	# synthetic opening using the active stair subclass's _make_cut(). This catches
	# stale opening dimensions as well as stair-builder runtime errors.
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

	var fake_cut: CSGBox3D = _make_cut(Vector2i(1, 0), 2.0)
	fake_cut.set_meta("world_x", 0.0)
	fake_cut.set_meta("world_z", 0.0)
	var fake_cuts: Array[CSGBox3D] = [fake_cut]
	var probe := Node3D.new()
	add_child(probe)
	_build_surface(probe, 0.0, 0.0, -0.5, FLOOR_THICKNESS, YELLOW_FLOOR, fake_cuts)

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
			"STAIR ACCESS FAILURE: segmented surface still spans opening"
		)

	probe.queue_free()
	fake_cut.queue_free()
