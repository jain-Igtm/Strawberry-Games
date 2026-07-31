class_name TownBuilder
extends Node3D

var spawn_points: Array[Vector3] = []
var materials: Dictionary = {}

const ROAD_DATA := [
	{"width": 10.8, "sidewalks": true, "points": [Vector2(-8, 72), Vector2(28, 72), Vector2(60, 72), Vector2(86, 72), Vector2(112, 72), Vector2(132, 72), Vector2(168, 72), Vector2(216, 72)]},
	{"width": 9.2, "sidewalks": true, "points": [Vector2(86, 5), Vector2(86, 35), Vector2(86, 72), Vector2(86, 108), Vector2(86, 136), Vector2(86, 166), Vector2(86, 188)]},
	{"width": 9.4, "sidewalks": true, "points": [Vector2(132, 72), Vector2(132, 106), Vector2(132, 136), Vector2(132, 166), Vector2(132, 188)]},
	{"width": 8.8, "sidewalks": true, "points": [Vector2(86, 136), Vector2(108, 136), Vector2(132, 136), Vector2(160, 136), Vector2(190, 136), Vector2(219, 136)]},
	{"width": 8.8, "sidewalks": true, "points": [Vector2(86, 166), Vector2(108, 166), Vector2(132, 166), Vector2(160, 166), Vector2(190, 166), Vector2(219, 166)]},
	{"width": 9.4, "sidewalks": false, "points": [Vector2(86, 122), Vector2(74, 132), Vector2(61, 146), Vector2(46, 162), Vector2(28, 178), Vector2(-8, 188)]},
	{"width": 7.2, "sidewalks": true, "points": [Vector2(20, 4), Vector2(20, 34), Vector2(20, 72)]},
	{"width": 7.2, "sidewalks": true, "points": [Vector2(53, 4), Vector2(53, 35), Vector2(53, 72)]},
	{"width": 7.0, "sidewalks": true, "points": [Vector2(3, 35), Vector2(20, 35), Vector2(53, 35), Vector2(86, 35)]},
	{"width": 6.8, "sidewalks": false, "points": [Vector2(143, 72), Vector2(148, 82), Vector2(170, 87), Vector2(196, 88)]},
]

func build() -> void:
	_create_materials()
	_add_ground_and_bounds()
	for road in ROAD_DATA:
		_add_road(road["points"], road["width"], road["sidewalks"])
	_add_neighborhood()
	_add_tower_block()
	_add_bar()
	_add_gas_station()
	_add_hospital()
	_add_factories_and_forge()
	_add_shopping_district()
	_add_forest()
	_add_fallout_range()
	_add_boundary_barricades()
	_add_vehicles()
	_add_spawn_points()

func _create_materials() -> void:
	materials = {
		"grass": TextureFactory.make_material("grass", 0.08),
		"asphalt": TextureFactory.make_material("asphalt", 0.12),
		"sidewalk": TextureFactory.make_material("sidewalk", 0.18),
		"brick": TextureFactory.make_material("brick", 0.18),
		"boards": TextureFactory.make_material("boards", 0.2),
		"concrete": TextureFactory.make_material("concrete", 0.14),
		"hospital": TextureFactory.make_material("hospital", 0.16),
		"metal": TextureFactory.make_material("metal", 0.22),
		"roof": TextureFactory.make_material("roof", 0.18),
		"wood": TextureFactory.make_material("wood", 0.22),
		"glass": TextureFactory.make_material("glass", 0.24),
	}

func _add_ground_and_bounds() -> void:
	_box(self, Vector3(104, -0.18, 99), Vector3(240, 0.36, 202), materials["grass"], true)
	_collision_box(Vector3(-15.5, 2.5, 99), Vector3(1.0, 5.0, 202))
	_collision_box(Vector3(222.5, 2.5, 99), Vector3(1.0, 5.0, 202))
	_collision_box(Vector3(104, 2.5, -1.5), Vector3(240, 5.0, 1.0))
	_collision_box(Vector3(104, 2.5, 199.5), Vector3(240, 5.0, 1.0))

func _add_road(points: Array, width: float, sidewalks: bool) -> void:
	for index in range(points.size() - 1):
		var a: Vector2 = points[index]
		var b: Vector2 = points[index + 1]
		var delta := b - a
		var length := delta.length()
		var midpoint := (a + b) * 0.5
		var yaw := -atan2(delta.y, delta.x)
		if sidewalks:
			_box(self, Vector3(midpoint.x, 0.025, midpoint.y), Vector3(length + 0.8, 0.05, width + 3.2), materials["sidewalk"], false, yaw)
		_box(self, Vector3(midpoint.x, 0.075, midpoint.y), Vector3(length + 0.8, 0.07, width), materials["asphalt"], false, yaw)
		var dash_count := maxi(1, int(length / 8.0))
		for dash_index in range(1, dash_count):
			var t := float(dash_index) / float(dash_count)
			var p := a.lerp(b, t)
			_box(self, Vector3(p.x, 0.125, p.y), Vector3(3.4, 0.025, 0.22), materials["hospital"], false, yaw)

func _add_neighborhood() -> void:
	var houses := [
		[7.0, 13.0, 1], [38.0, 13.0, 2], [71.0, 13.0, 1],
		[7.0, 25.0, 2], [38.0, 25.0, 1], [71.0, 25.0, 2],
		[7.0, 48.0, 2], [38.0, 48.0, 1], [71.0, 48.0, 2],
		[7.0, 60.0, 1], [38.0, 60.0, 2], [71.0, 60.0, 1],
	]
	for house in houses:
		_add_enterable_building(Vector3(house[0], 0, house[1]), 8.4, 8.2, house[2], "HOUSE", materials["boards"], 2.2)

func _add_tower_block() -> void:
	_add_closed_building(Vector3(48, 0, 91), 14, 13, 5, "CIVIC HOTEL", materials["brick"])
	_add_closed_building(Vector3(66, 0, 91), 14, 12, 6, "TOWER HOUSE", materials["concrete"])
	_add_closed_building(Vector3(96, 0, 91), 9, 13, 4, "CITY ROOMS", materials["boards"])
	_add_water_tower(Vector3(66, 0, 108))

func _add_closed_building(center: Vector3, width: float, depth: float, floors: int, label: String, material: Material) -> void:
	var height := floors * 3.2
	_box(self, center + Vector3(0, height * 0.5, 0), Vector3(width, height, depth), material, true)
	_box(self, center + Vector3(0, height + 0.2, 0), Vector3(width + 0.6, 0.4, depth + 0.6), materials["roof"], false)
	_add_windows(center, width, depth, floors)
	_label(label, center + Vector3(0, minf(height - 0.8, 3.0), -depth * 0.5 - 0.24))

func _add_enterable_building(center: Vector3, width: float, depth: float, floors: int, label: String, material: Material, door_width: float) -> void:
	var playable_height := 3.2
	_add_shell(center, width, depth, playable_height, material, door_width)
	_box(self, center + Vector3(0, 0.06, 0), Vector3(width - 0.4, 0.12, depth - 0.4), materials["concrete"], true)
	_box(self, center + Vector3(0, playable_height, 0), Vector3(width, 0.18, depth), materials["roof"], true)
	_wall_x(center.x - width * 0.5 + 0.25, center.x + width * 0.5 - 0.25, center.z + 0.8, [center.x], 1.9, playable_height, materials["boards"])
	if floors > 1:
		var upper_height := float(floors - 1) * 3.2
		_box(self, center + Vector3(0, playable_height + upper_height * 0.5, 0), Vector3(width, upper_height, depth), material, true)
		_box(self, center + Vector3(0, playable_height + upper_height + 0.18, 0), Vector3(width + 0.5, 0.36, depth + 0.5), materials["roof"], false)
	_add_windows(center + Vector3(0, 3.2, 0), width, depth, maxi(0, floors - 1))
	_label(label, center + Vector3(0, 2.55, -depth * 0.5 - 0.24))

func _add_shell(center: Vector3, width: float, depth: float, height: float, material: Material, door_width: float) -> void:
	var wall := 0.35
	_box(self, center + Vector3(0, height * 0.5, depth * 0.5 - wall * 0.5), Vector3(width, height, wall), material, true)
	_box(self, center + Vector3(-width * 0.5 + wall * 0.5, height * 0.5, 0), Vector3(wall, height, depth), material, true)
	_box(self, center + Vector3(width * 0.5 - wall * 0.5, height * 0.5, 0), Vector3(wall, height, depth), material, true)
	var side_width := (width - door_width) * 0.5
	_box(self, center + Vector3(-door_width * 0.5 - side_width * 0.5, height * 0.5, -depth * 0.5 + wall * 0.5), Vector3(side_width, height, wall), material, true)
	_box(self, center + Vector3(door_width * 0.5 + side_width * 0.5, height * 0.5, -depth * 0.5 + wall * 0.5), Vector3(side_width, height, wall), material, true)
	_box(self, center + Vector3(0, height - 0.35, -depth * 0.5 + wall * 0.5), Vector3(door_width, 0.7, wall), material, true)

func _add_windows(center: Vector3, width: float, depth: float, floors: int) -> void:
	if floors <= 0:
		return
	for floor_index in range(floors):
		var y := center.y + 1.8 + floor_index * 3.2
		var columns := maxi(2, int(width / 3.2))
		for column in range(columns):
			var x := center.x - width * 0.5 + 1.35 + float(column) * ((width - 2.7) / float(maxi(1, columns - 1)))
			_box(self, Vector3(x, y, center.z - depth * 0.5 - 0.03), Vector3(1.15, 1.25, 0.08), materials["glass"], false)

func _add_bar() -> void:
	var center := Vector3(112, 0, 88)
	var width := 16.0
	var depth := 16.0
	var height := 6.6
	_add_shell(center, width, depth, height, materials["brick"], 3.0)
	_box(self, center + Vector3(0, 0.06, 0), Vector3(width - 0.4, 0.12, depth - 0.4), materials["wood"], true)
	_box(self, center + Vector3(2.0, 3.22, 0), Vector3(11.5, 0.18, depth - 0.6), materials["wood"], true)
	for index in range(11):
		_box(self, center + Vector3(-5.25, 0.14 + index * 0.29, 4.8 - index * 0.58), Vector3(2.0, 0.28, 0.7), materials["wood"], true)
	var balcony_z := center.z - depth * 0.5 - 2.2
	_box(self, Vector3(center.x, 3.22, balcony_z), Vector3(11.0, 0.24, 4.2), materials["wood"], true)
	_box(self, Vector3(center.x - 5.3, 4.05, balcony_z), Vector3(0.18, 1.45, 4.2), materials["metal"], true)
	_box(self, Vector3(center.x + 5.3, 4.05, balcony_z), Vector3(0.18, 1.45, 4.2), materials["metal"], true)
	_box(self, Vector3(center.x, 4.05, balcony_z - 2.0), Vector3(10.8, 1.45, 0.18), materials["metal"], true)
	_label("DEADWATER BAR", center + Vector3(0, 5.4, -depth * 0.5 - 0.28))

func _add_gas_station() -> void:
	var center := Vector3(105, 0, 111)
	_add_enterable_building(center, 12, 9, 1, "FUEL", materials["concrete"], 2.6)
	_box(self, Vector3(105, 3.2, 100.5), Vector3(18, 0.35, 8), materials["metal"], true)
	for x in [100.0, 110.0]:
		_box(self, Vector3(x, 1.0, 100.5), Vector3(1.1, 2.0, 1.0), materials["metal"], true)

func _add_hospital() -> void:
	var center := Vector3(176, 0, 106)
	var width := 76.0
	var depth := 46.0
	var height := 4.2
	var wall := 0.42
	_box(self, center + Vector3(0, 0.06, 0), Vector3(width - 0.5, 0.12, depth - 0.5), materials["hospital"], true)
	_box(self, center + Vector3(0, height, 0), Vector3(width, 0.22, depth), materials["roof"], true)
	_box(self, center + Vector3(0, height * 0.5, depth * 0.5 - wall * 0.5), Vector3(width, height, wall), materials["hospital"], true)
	var front_z := center.z - depth * 0.5 + wall * 0.5
	var front_door := 7.0
	var front_side := (width - front_door) * 0.5
	_box(self, Vector3(center.x - front_door * 0.5 - front_side * 0.5, height * 0.5, front_z), Vector3(front_side, height, wall), materials["hospital"], true)
	_box(self, Vector3(center.x + front_door * 0.5 + front_side * 0.5, height * 0.5, front_z), Vector3(front_side, height, wall), materials["hospital"], true)
	_box(self, Vector3(center.x, height - 0.4, front_z), Vector3(front_door, 0.8, wall), materials["hospital"], true)
	_box(self, Vector3(center.x - width * 0.5 + wall * 0.5, height * 0.5, center.z), Vector3(wall, height, depth), materials["hospital"], true)
	_wall_z(center.x + width * 0.5 - wall * 0.5, center.z - depth * 0.5, center.z + depth * 0.5, [center.z], 4.0, height, materials["hospital"])
	for corridor_x in [171.0, 181.0]:
		_wall_z(corridor_x, 84.0, 128.0, [91.0, 100.0, 109.0, 118.0, 125.0], 1.8, height, materials["concrete"])
	for room_z in [94.0, 104.0, 114.0, 124.0]:
		_wall_x(138.4, 171.0, room_z, [168.0], 1.8, height, materials["concrete"])
		_wall_x(181.0, 213.6, room_z, [184.0], 1.8, height, materials["concrete"])
	_label("ST. AGNES HOSPITAL", Vector3(center.x, 3.1, front_z - 0.22))
	_label("EMERGENCY", Vector3(213.7, 2.8, center.z), true)
	for light_z in [90.0, 101.0, 112.0, 123.0]:
		var light := OmniLight3D.new()
		light.position = Vector3(176, 3.3, light_z)
		light.light_color = Color(0.72, 0.67, 0.58)
		light.light_energy = 2.2
		light.omni_range = 12.0
		add_child(light)

func _add_factories_and_forge() -> void:
	_add_enterable_building(Vector3(21, 0, 148), 18, 15, 1, "MERCER MACHINE", materials["metal"], 3.4)
	_add_enterable_building(Vector3(54, 0, 127), 18, 15, 1, "ASHFALL TOOL", materials["brick"], 3.4)
	_add_enterable_building(Vector3(54, 0, 148), 14, 12, 1, "FORGE", materials["metal"], 3.0)

func _add_shopping_district() -> void:
	_add_closed_building(Vector3(147, 0, 150), 14, 11, 4, "ALDER DEPT", materials["brick"])
	_add_enterable_building(Vector3(166, 0, 150), 15, 11, 4, "FIVE & DIME", materials["boards"], 2.8)
	_add_enterable_building(Vector3(196, 0, 150), 17, 11, 4, "NORTH MARKET", materials["concrete"], 3.0)
	_add_closed_building(Vector3(147, 0, 181), 14, 13, 5, "MILLER BLOCK", materials["concrete"])
	_add_closed_building(Vector3(166, 0, 181), 15, 13, 4, "GRAYSON STORE", materials["brick"])
	_add_enterable_building(Vector3(196, 0, 181), 17, 13, 4, "CROWN OUTFITTERS", materials["boards"], 3.0)
	for alley_x in [156.5, 181.0]:
		_box(self, Vector3(alley_x, 0.09, 166), Vector3(2.5, 0.08, 55), materials["concrete"], false)

func _add_water_tower(center: Vector3) -> void:
	for offset in [Vector2(-3.0, -3.0), Vector2(3.0, -3.0), Vector2(-3.0, 3.0), Vector2(3.0, 3.0)]:
		var leg := _box(self, center + Vector3(offset.x, 7.5, offset.y), Vector3(0.35, 15.0, 0.35), materials["metal"], true)
		leg.rotation.z = offset.x * 0.008
	var tank_body := MeshInstance3D.new()
	var tank_mesh := CylinderMesh.new()
	tank_mesh.top_radius = 5.5
	tank_mesh.bottom_radius = 5.5
	tank_mesh.height = 6.2
	tank_mesh.radial_segments = 16
	tank_body.mesh = tank_mesh
	tank_body.position = center + Vector3(0, 18.0, 0)
	tank_body.material_override = materials["metal"]
	add_child(tank_body)
	_label("DEADWATER", center + Vector3(0, 18.0, -5.55))

func _add_forest() -> void:
	var quad := QuadMesh.new()
	quad.size = Vector2(6.5, 14.0)
	quad.material = TextureFactory.make_tree_material(false)
	var multimesh := MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	var tree_count := 92
	multimesh.instance_count = tree_count * 2
	multimesh.mesh = quad
	var rng := RandomNumberGenerator.new()
	rng.seed = 96112
	for index in range(tree_count):
		var x := rng.randf_range(109.0, 219.0)
		var z := rng.randf_range(5.0, 68.0)
		var scale := rng.randf_range(0.82, 1.35)
		var origin := Vector3(x, 7.0 * scale, z)
		var yaw := rng.randf_range(-PI, PI)
		multimesh.set_instance_transform(index * 2, Transform3D(Basis(Vector3.UP, yaw).scaled(Vector3(scale, scale, scale)), origin))
		multimesh.set_instance_transform(index * 2 + 1, Transform3D(Basis(Vector3.UP, yaw + PI * 0.5).scaled(Vector3(scale, scale, scale)), origin))
	var trees := MultiMeshInstance3D.new()
	trees.multimesh = multimesh
	add_child(trees)
	_collision_box(Vector3(161, 2.5, 35), Vector3(78, 5, 52))
	_collision_box(Vector3(118, 2.5, 38), Vector3(23, 5, 35))
	_collision_box(Vector3(208, 2.5, 38), Vector3(22, 5, 42))
	_collision_box(Vector3(168, 2.5, 62), Vector3(75, 5, 12))
	_collision_box(Vector3(158, 2.5, 12), Vector3(88, 5, 15))
	for fire_position in [Vector3(140, 1.3, 34), Vector3(173, 1.4, 45), Vector3(201, 1.2, 28), Vector3(158, 1.3, 18)]:
		var light := OmniLight3D.new()
		light.position = fire_position
		light.light_color = Color(1.0, 0.24, 0.08)
		light.light_energy = 3.4
		light.omni_range = 9.0
		add_child(light)

func _add_fallout_range() -> void:
	for hill in [[-95.0, 198.0, 38.0, 18.0], [-62.0, 203.0, 44.0, 23.0], [-28.0, 206.0, 48.0, 26.0], [8.0, 204.0, 42.0, 21.0], [40.0, 200.0, 36.0, 17.0]]:
		_box(self, Vector3(hill[0], hill[3] * 0.5 - 1.0, hill[1]), Vector3(hill[2], hill[3], 8.0), materials["roof"], false)
	var plume := Sprite3D.new()
	plume.texture = TextureFactory.make_plume_texture()
	plume.position = Vector3(-63, 82, 217)
	plume.pixel_size = 0.56
	plume.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	plume.shaded = false
	plume.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
	add_child(plume)

func _add_boundary_barricades() -> void:
	_add_gate(Vector3(-7.2, 0, 187.8), 11.2, 0.22)
	_add_gate(Vector3(-7.5, 0, 72), 12.4, 0.0)
	_add_gate(Vector3(216.2, 0, 72), 12.4, 0.0)
	_add_gate(Vector3(219.2, 0, 136), 10.4, 0.0)
	_add_gate(Vector3(219.2, 0, 166), 10.4, 0.0)

func _add_gate(center: Vector3, depth: float, yaw: float) -> void:
	_box(self, center + Vector3(0, 1.1, 0), Vector3(0.5, 2.2, depth), materials["metal"], true, yaw)
	for offset in [-depth * 0.34, 0.0, depth * 0.34]:
		var local_offset := Vector3(0, 0.55, offset).rotated(Vector3.UP, yaw)
		_box(self, center + local_offset, Vector3(1.0, 1.1, depth * 0.24), materials["concrete"], true, yaw)

func _add_vehicles() -> void:
	_add_vehicle(Vector3(101, 0, 67), Vector3(2.2, 0.8, 4.8), PI * 0.5)
	_add_vehicle(Vector3(65, 0, 43), Vector3(1.9, 0.75, 3.9), 0.0)

func _add_vehicle(center: Vector3, size: Vector3, yaw: float) -> void:
	_box(self, center + Vector3(0, size.y * 0.5 + 0.25, 0), size, materials["metal"], true, yaw)
	_box(self, center + Vector3(0, 1.25, -size.z * 0.12).rotated(Vector3.UP, yaw), Vector3(size.x * 0.85, 0.9, size.z * 0.38), materials["glass"], true, yaw)

func _add_spawn_points() -> void:
	var points := [Vector2(112, 63), Vector2(130, 66), Vector2(149, 67), Vector2(169, 68), Vector2(190, 67), Vector2(210, 63), Vector2(148, 106), Vector2(176, 106), Vector2(202, 106), Vector2(176, 124), Vector2(216, 96), Vector2(216, 142), Vector2(209, 181), Vector2(181, 190), Vector2(140, 190), Vector2(101, 190), Vector2(66, 187), Vector2(32, 192), Vector2(1, 182), Vector2(-7, 139), Vector2(-5, 80), Vector2(3, 49), Vector2(5, 14), Vector2(43, 6), Vector2(78, 6)]
	for point in points:
		spawn_points.append(Vector3(point.x, 0.2, point.y))

func _wall_z(x: float, start_z: float, end_z: float, doors: Array, door_width: float, height: float, material: Material) -> void:
	var cursor := start_z
	for door_variant in doors:
		var door := float(door_variant)
		var segment_end := door - door_width * 0.5
		if segment_end > cursor:
			_box(self, Vector3(x, height * 0.5, (cursor + segment_end) * 0.5), Vector3(0.35, height, segment_end - cursor), material, true)
		cursor = door + door_width * 0.5
	if cursor < end_z:
		_box(self, Vector3(x, height * 0.5, (cursor + end_z) * 0.5), Vector3(0.35, height, end_z - cursor), material, true)

func _wall_x(start_x: float, end_x: float, z: float, doors: Array, door_width: float, height: float, material: Material) -> void:
	var cursor := start_x
	for door_variant in doors:
		var door := float(door_variant)
		var segment_end := door - door_width * 0.5
		if segment_end > cursor:
			_box(self, Vector3((cursor + segment_end) * 0.5, height * 0.5, z), Vector3(segment_end - cursor, height, 0.35), material, true)
		cursor = door + door_width * 0.5
	if cursor < end_x:
		_box(self, Vector3((cursor + end_x) * 0.5, height * 0.5, z), Vector3(end_x - cursor, height, 0.35), material, true)

func _box(parent: Node3D, at: Vector3, size: Vector3, material: Material, collision: bool, yaw: float = 0.0) -> Node3D:
	var holder: Node3D
	if collision:
		holder = StaticBody3D.new()
	else:
		holder = Node3D.new()
	holder.position = at
	holder.rotation.y = yaw
	var mesh_instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh_instance.mesh = mesh
	mesh_instance.material_override = material
	holder.add_child(mesh_instance)
	if collision:
		var shape_node := CollisionShape3D.new()
		var shape := BoxShape3D.new()
		shape.size = size
		shape_node.shape = shape
		holder.add_child(shape_node)
	parent.add_child(holder)
	return holder

func _collision_box(at: Vector3, size: Vector3) -> void:
	var body := StaticBody3D.new()
	body.position = at
	var shape_node := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	shape_node.shape = shape
	body.add_child(shape_node)
	add_child(body)

func _label(text: String, at: Vector3, rotate_sideways: bool = false) -> void:
	var label := Label3D.new()
	label.text = text
	label.position = at
	label.font_size = 48
	label.pixel_size = 0.012
	label.modulate = Color(0.86, 0.76, 0.62)
	label.outline_size = 8
	label.outline_modulate = Color(0.08, 0.06, 0.05)
	if rotate_sideways:
		label.rotation.y = -PI * 0.5
	add_child(label)
