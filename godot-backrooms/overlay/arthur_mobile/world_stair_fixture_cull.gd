extends "res://arthur_mobile/world_stair_collision_polish.gd"

# Visual-only protection for streamed ceiling fixtures around an active stair opening.
# The segmented ceiling already removes the ceiling surface itself, but ordinary
# per-cell fluorescent fixtures are spawned independently by the inherited yellow
# world generator. Hide any fixture whose 4 m cell overlaps the current ceiling cut,
# then restore it automatically when the connector/opening moves elsewhere.

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
