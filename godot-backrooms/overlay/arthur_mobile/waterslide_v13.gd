extends "res://arthur_mobile/waterslide_v12.gd"

const WATER_V13: Material = preload("res://arthur_mobile/materials/water_surface_v13.tres")

var slide_shell: StandardMaterial3D
var slide_rail: StandardMaterial3D
var slide_support: StandardMaterial3D

func _build() -> void:
	_ensure_v13_slide_materials()
	ride_points.clear()
	_build_smooth_ride_path()
	if ride_points.size() < 4:
		return

	_add_entry_platform_v13()
	_add_continuous_trough()
	_add_slide_water_ribbon()
	_add_sparse_supports()
	_add_trigger(ride_points[0])
	_add_water_audio()

func _ensure_v13_slide_materials() -> void:
	if slide_shell != null:
		return
	slide_shell = StandardMaterial3D.new()
	slide_shell.albedo_color = Color(0.70, 0.91, 0.90, 1.0)
	slide_shell.roughness = 0.34

	slide_rail = StandardMaterial3D.new()
	slide_rail.albedo_color = Color(0.94, 0.95, 0.84, 1.0)
	slide_rail.roughness = 0.45

	slide_support = StandardMaterial3D.new()
	slide_support.albedo_color = Color(0.52, 0.68, 0.68, 1.0)
	slide_support.roughness = 0.58

func _build_smooth_ride_path() -> void:
	var side_sign: float = -1.0 if (seed & 1) == 0 else 1.0
	var end_y: float = -3.55 if cross_floor else 0.54
	var actual: Array[Vector3] = [
		Vector3(7.2 * side_sign, 3.48, -7.55),
		Vector3(6.65 * side_sign, 3.22, -5.20),
		Vector3(4.85 * side_sign, 2.62, -2.55),
		Vector3(2.10 * side_sign, 1.86, 0.25),
		Vector3(0.55 * side_sign, 1.20, 3.20),
		Vector3(2.45 * side_sign, end_y, 5.75)
	]
	if cross_floor:
		actual.insert(5, Vector3(-0.20 * side_sign, -0.45, 5.20))

	var controls: Array[Vector3] = []
	controls.append(actual[0])
	for point in actual:
		controls.append(point)
	controls.append(actual[actual.size() - 1])

	var samples_per_segment := 7
	for segment in range(1, controls.size() - 2):
		for sample in range(samples_per_segment):
			var t: float = float(sample) / float(samples_per_segment)
			ride_points.append(_catmull_rom(controls[segment - 1], controls[segment], controls[segment + 1], controls[segment + 2], t))
	ride_points.append(actual[actual.size() - 1])

func _catmull_rom(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: float) -> Vector3:
	var t2: float = t * t
	var t3: float = t2 * t
	return 0.5 * ((2.0 * p1) + (-p0 + p2) * t + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3)

func _add_continuous_trough() -> void:
	var tool := SurfaceTool.new()
	tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	tool.set_material(slide_shell)
	var offsets := [-0.98, -0.58, 0.0, 0.58, 0.98]
	var heights := [0.44, 0.12, 0.0, 0.12, 0.44]

	for i in range(ride_points.size() - 1):
		var p0: Vector3 = ride_points[i]
		var p1: Vector3 = ride_points[i + 1]
		var side0: Vector3 = _path_side(i)
		var side1: Vector3 = _path_side(i + 1)
		for j in range(offsets.size() - 1):
			var a := p0 + side0 * float(offsets[j]) + Vector3.UP * float(heights[j])
			var b := p0 + side0 * float(offsets[j + 1]) + Vector3.UP * float(heights[j + 1])
			var c := p1 + side1 * float(offsets[j + 1]) + Vector3.UP * float(heights[j + 1])
			var d := p1 + side1 * float(offsets[j]) + Vector3.UP * float(heights[j])
			_add_surface_quad(tool, a, d, c, b)

	tool.generate_normals()
	var mesh: ArrayMesh = tool.commit()
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	add_child(instance)

	var body := StaticBody3D.new()
	body.collision_layer = 3
	body.collision_mask = 3
	var shape_node := CollisionShape3D.new()
	var shape := ConcavePolygonShape3D.new()
	shape.backface_collision = true
	shape.set_faces(mesh.get_faces())
	shape_node.shape = shape
	body.add_child(shape_node)
	add_child(body)

func _add_slide_water_ribbon() -> void:
	var tool := SurfaceTool.new()
	tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	tool.set_material(WATER_V13)
	for i in range(ride_points.size() - 1):
		var p0: Vector3 = ride_points[i] + Vector3.UP * 0.095
		var p1: Vector3 = ride_points[i + 1] + Vector3.UP * 0.095
		var side0: Vector3 = _path_side(i)
		var side1: Vector3 = _path_side(i + 1)
		var a := p0 - side0 * 0.67
		var b := p0 + side0 * 0.67
		var c := p1 + side1 * 0.67
		var d := p1 - side1 * 0.67
		_add_surface_quad(tool, a, d, c, b)
	tool.generate_normals()
	var mesh: ArrayMesh = tool.commit()
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	add_child(instance)

func _path_side(index: int) -> Vector3:
	var previous_index: int = maxi(index - 1, 0)
	var next_index: int = mini(index + 1, ride_points.size() - 1)
	var tangent: Vector3 = (ride_points[next_index] - ride_points[previous_index]).normalized()
	var horizontal := Vector3(-tangent.z, 0.0, tangent.x)
	if horizontal.length_squared() < 0.001:
		return Vector3.RIGHT
	return horizontal.normalized()

func _add_surface_quad(tool: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, d: Vector3) -> void:
	tool.add_vertex(a)
	tool.add_vertex(b)
	tool.add_vertex(c)
	tool.add_vertex(a)
	tool.add_vertex(c)
	tool.add_vertex(d)

func _add_entry_platform_v13() -> void:
	var start: Vector3 = ride_points[0]
	var tangent: Vector3 = (ride_points[1] - ride_points[0]).normalized()
	var side: Vector3 = _path_side(0)
	var platform_center := start - tangent * 1.18 + Vector3.DOWN * 0.20
	_add_slide_static_box(platform_center, Vector3(3.25, 0.24, 2.55), slide_rail)

	for sign_value in [-1.0, 1.0]:
		var lateral := side * (1.47 * sign_value)
		var post_a := platform_center + lateral - tangent * 0.80 + Vector3.UP * 0.62
		var post_b := platform_center + lateral + tangent * 0.65 + Vector3.UP * 0.62
		_add_slide_beam(post_a, post_b, 0.07, slide_support)
		_add_slide_post(platform_center + lateral - tangent * 0.80, 0.78)
		_add_slide_post(platform_center + lateral + tangent * 0.65, 0.78)

func _add_sparse_supports() -> void:
	var indices := [int(ride_points.size() * 0.30), int(ride_points.size() * 0.60)]
	for raw_index in indices:
		var index: int = clampi(int(raw_index), 0, ride_points.size() - 1)
		var point: Vector3 = ride_points[index]
		if point.y <= 1.0:
			continue
		var height: float = point.y - 0.12
		var support := MeshInstance3D.new()
		var mesh := CylinderMesh.new()
		mesh.top_radius = 0.18
		mesh.bottom_radius = 0.23
		mesh.height = height
		mesh.radial_segments = 12
		mesh.material = slide_support
		support.mesh = mesh
		support.position = Vector3(point.x, height * 0.5, point.z)
		add_child(support)

func _add_slide_static_box(position: Vector3, size: Vector3, material: Material) -> void:
	var instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = material
	instance.mesh = mesh
	instance.position = position
	add_child(instance)

	var body := StaticBody3D.new()
	body.position = position
	body.collision_layer = 3
	body.collision_mask = 3
	var shape_node := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	shape_node.shape = shape
	body.add_child(shape_node)
	add_child(body)

func _add_slide_beam(a: Vector3, b: Vector3, thickness: float, material: Material) -> void:
	var delta := b - a
	if delta.length() <= 0.01:
		return
	var pivot := Node3D.new()
	pivot.position = (a + b) * 0.5
	add_child(pivot)
	pivot.look_at(pivot.global_position + delta.normalized(), Vector3.UP)
	var beam := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(thickness, thickness, delta.length())
	mesh.material = material
	beam.mesh = mesh
	pivot.add_child(beam)

func _add_slide_post(base: Vector3, height: float) -> void:
	var post := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.07, height, 0.07)
	mesh.material = slide_support
	post.mesh = mesh
	post.position = base + Vector3.UP * (height * 0.5)
	add_child(post)
