extends "res://arthur_mobile/world_stair_collision_polish.gd"

# Visual-only polish over the phone-tested stair/collision build.
# 1. Cull ordinary streamed fluorescent fixtures whose cells overlap a stair opening.
# 2. Keep the stairwell's useful fill light, but remove its floating visible fixture.
# 3. Keep side coping + guard rails, but omit the crosswise opening-end trim slabs
#    that can read as floating ceiling tiles when viewed from below.

var stair_fixture_cull_signature := ""

func _add_cell(world_cell: Vector2i) -> void:
	super._add_cell(world_cell)
	_refresh_stair_opening_fixture_for_cell(world_cell)

func _rebuild_connectors(force: bool) -> void:
	super._rebuild_connectors(force)
	var next_signature := _make_stair_fixture_cull_signature()
	if force or next_signature != stair_fixture_cull_signature:
		stair_fixture_cull_signature = next_signature
		_refresh_all_stair_opening_fixtures()

func _make_stair_fixture_cull_signature() -> String:
	var text := "%d" % current_level
	for cut in ceiling_cutouts:
		if not is_instance_valid(cut):
			continue
		text += ":%0.2f:%0.2f:%0.2f:%0.2f" % [
			float(cut.get_meta("world_x", cut.global_position.x)),
			float(cut.get_meta("world_z", cut.global_position.z)),
			cut.size.x,
			cut.size.z
		]
	return text

func _refresh_all_stair_opening_fixtures() -> void:
	for raw_cell in active_tiles.keys():
		if typeof(raw_cell) != TYPE_VECTOR2I:
			continue
		var world_cell: Vector2i = raw_cell
		_refresh_stair_opening_fixture_for_cell(world_cell)

func _refresh_stair_opening_fixture_for_cell(world_cell: Vector2i) -> void:
	if not active_tiles.has(world_cell):
		return
	var root := active_tiles[world_cell] as Node3D
	if root == null or not is_instance_valid(root):
		return

	var hide_fixture := _cell_overlaps_stair_ceiling_opening(world_cell)
	for child in root.get_children():
		if not (child is Node3D):
			continue
		var node := child as Node3D
		if not String(node.name).begins_with("FluorescentFixture"):
			continue
		node.visible = not hide_fixture
		node.set_meta("stair_opening_fixture_hidden", hide_fixture)

func _cell_overlaps_stair_ceiling_opening(world_cell: Vector2i) -> bool:
	var center_x := float(world_cell.x) * CELL
	var center_z := float(world_cell.y) * CELL
	var cell_rect := Rect2(
		center_x - CELL * 0.5,
		center_z - CELL * 0.5,
		CELL,
		CELL
	)

	for cut in ceiling_cutouts:
		if not is_instance_valid(cut):
			continue
		var world_x: float = float(cut.get_meta("world_x", cut.global_position.x))
		var world_z: float = float(cut.get_meta("world_z", cut.global_position.z))
		var width: float = cut.size.x + OPENING_PADDING * 2.0
		var depth: float = cut.size.z + OPENING_PADDING * 2.0
		var opening_rect := Rect2(
			world_x - width * 0.5,
			world_z - depth * 0.5,
			width,
			depth
		)
		if cell_rect.intersects(opening_rect):
			return true
	return false

# The old architectural stair light drew a glowing box in open air. Preserve only
# a gentle light source so the stairwell remains readable without a floating mesh.
func _add_stairwell_light(root: Node3D, opening_center: Vector3) -> void:
	var light := OmniLight3D.new()
	light.name = "StairwellFillLight"
	light.position = opening_center + Vector3.UP * (STOREY_HEIGHT - 0.55)
	light.light_color = Color(1.0, 0.87, 0.58, 1.0)
	light.light_energy = 0.58
	light.omni_range = 4.8
	light.shadow_enabled = false
	light.set_meta("stair_invisible_fill_light", true)
	root.add_child(light)

# Keep only the long side coping and side guard rails. The two end strips formerly
# crossed the stair opening width and could look like detached ceiling tiles below.
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
