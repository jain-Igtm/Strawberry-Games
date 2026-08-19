extends "res://arthur_mobile/pool_complex_v13.gd"

func _add_slide_access_stair(side_sign: float) -> void:
	var step_count: int = 15
	var rise: float = 3.20 / float(step_count)
	var run: float = 0.38
	var stair_width: float = 1.75
	var x: float = 8.85 * side_sign
	var start_z: float = -1.95
	var direction: Vector3 = Vector3(0.0, 0.0, -1.0)
	var side: Vector3 = Vector3.RIGHT

	# Visible stair is conventional thin tread + riser construction. Collision is
	# separate and invisible so no growing solid blocks appear in the room.
	for i in range(step_count):
		var top_y: float = rise * float(i + 1)
		var z: float = start_z - float(i) * run
		var tread_position: Vector3 = Vector3(x, top_y - 0.045, z)
		_mesh_box(tread_position, Vector3(stair_width, 0.09, run + 0.025), deck_tile)

		var riser_position: Vector3 = Vector3(x, top_y - rise * 0.5, z + run * 0.5)
		_mesh_box(riser_position, Vector3(stair_width, rise, 0.065), wall_tile)

		_add_slide_stair_collision(
			Vector3(x, top_y * 0.5, z),
			Vector3(stair_width, top_y, run + 0.035)
		)

	# A continuous underside makes the flight read as one built object rather than
	# a row of disconnected treads when viewed from the room below.
	var soffit_start: Vector3 = Vector3(x, 0.04, start_z + run * 0.35)
	var soffit_end: Vector3 = Vector3(
		x,
		3.20 - rise * 0.55,
		start_z - float(step_count - 1) * run - run * 0.35
	)
	_add_slide_stair_soffit(soffit_start, soffit_end, stair_width * 0.90)

	var landing_center: Vector3 = Vector3(x, 3.16, -7.55)
	_solid_box(landing_center, Vector3(3.10, 0.22, 2.45), warm_plaster_v13, true)

	# Both stair edges receive continuous handrails and regularly spaced posts.
	for sign_value in [-1.0, 1.0]:
		var lateral: Vector3 = side * ((stair_width * 0.5 + 0.08) * float(sign_value))
		var rail_start: Vector3 = Vector3(x, rise + 0.92, start_z) + lateral
		var rail_end: Vector3 = Vector3(x, 3.20 + 0.92, start_z - float(step_count - 1) * run) + lateral
		_add_beam_v13(rail_start, rail_end, 0.065, metal_trim)
		for post_i in range(0, step_count, 3):
			var base_y: float = rise * float(post_i + 1)
			var base_z: float = start_z - float(post_i) * run
			_add_post_v13(Vector3(x, base_y, base_z) + lateral, 0.92)

	# Landing guard closes the exposed outer edge while leaving the slide entrance open.
	var landing_outer_x: float = x - 1.45 * side_sign
	var landing_a: Vector3 = Vector3(landing_outer_x, 4.08, -8.55)
	var landing_b: Vector3 = Vector3(landing_outer_x, 4.08, -6.55)
	_add_beam_v13(landing_a, landing_b, 0.065, metal_trim)
	_add_post_v13(Vector3(landing_outer_x, 3.16, -8.55), 0.92)
	_add_post_v13(Vector3(landing_outer_x, 3.16, -6.55), 0.92)

func _add_slide_stair_collision(position: Vector3, size: Vector3) -> void:
	var body: StaticBody3D = StaticBody3D.new()
	body.position = position
	body.collision_layer = 3
	body.collision_mask = 3
	var shape_node: CollisionShape3D = CollisionShape3D.new()
	var shape: BoxShape3D = BoxShape3D.new()
	shape.size = size
	shape_node.shape = shape
	body.add_child(shape_node)
	add_child(body)

func _add_slide_stair_soffit(a: Vector3, b: Vector3, width: float) -> void:
	var delta: Vector3 = b - a
	if delta.length() <= 0.01:
		return
	var pivot: Node3D = Node3D.new()
	pivot.position = (a + b) * 0.5
	add_child(pivot)
	pivot.look_at(pivot.global_position + delta.normalized(), Vector3.UP)
	var slab: MeshInstance3D = MeshInstance3D.new()
	var mesh: BoxMesh = BoxMesh.new()
	mesh.size = Vector3(width, 0.14, delta.length())
	mesh.material = wall_tile
	slab.mesh = mesh
	pivot.add_child(slab)
