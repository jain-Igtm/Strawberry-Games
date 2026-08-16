extends Node3D

const GARAGE_CAR_SCRIPT := preload("res://arthur_mobile/environment_lab/garage_car.gd")

var concrete_mat: StandardMaterial3D
var dark_concrete_mat: StandardMaterial3D
var ceiling_mat: StandardMaterial3D
var paint_mat: StandardMaterial3D
var yellow_mat: StandardMaterial3D
var rust_mat: StandardMaterial3D
var rubber_mat: StandardMaterial3D
var carpet_mat: StandardMaterial3D
var fluorescent_mat: StandardMaterial3D
var red_emissive_mat: StandardMaterial3D
var glass_mat: StandardMaterial3D

func _ready() -> void:
	_make_materials()
	_build_parking_concourse()
	_build_vehicle_boulevard()
	_build_dry_carwash()
	_build_attendant_lounge()
	_build_strange_setpieces()
	_build_lighting()
	_spawn_cars()
	_spawn_psychic_clutter()
	_spawn_furniture_assets()

func _make_materials() -> void:
	concrete_mat = _mat(Color(0.36, 0.37, 0.36), 0.87)
	dark_concrete_mat = _mat(Color(0.17, 0.18, 0.18), 0.94)
	ceiling_mat = _mat(Color(0.27, 0.28, 0.27), 0.90)
	paint_mat = _mat(Color(0.76, 0.74, 0.61), 0.72)
	yellow_mat = _mat(Color(0.82, 0.62, 0.10), 0.67)
	rust_mat = _mat(Color(0.31, 0.13, 0.07), 0.95)
	rubber_mat = _mat(Color(0.035, 0.038, 0.040), 0.98)
	carpet_mat = _mat(Color(0.20, 0.27, 0.23), 0.96)
	fluorescent_mat = _emissive_mat(Color(0.72, 0.88, 0.83), 2.0)
	red_emissive_mat = _emissive_mat(Color(0.80, 0.08, 0.04), 2.5)
	glass_mat = _mat(Color(0.13, 0.19, 0.20), 0.22)
	glass_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	glass_mat.albedo_color.a = 0.40

func _mat(color: Color, roughness: float) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	return material

func _emissive_mat(color: Color, energy: float) -> StandardMaterial3D:
	var material := _mat(color, 0.40)
	material.emission_enabled = true
	material.emission = color
	material.emission_energy_multiplier = energy
	return material

func _build_parking_concourse() -> void:
	_solid_box("GarageFloor", Vector3(0, -0.18, 0), Vector3(74, 0.36, 56), concrete_mat)
	_solid_box("GarageCeiling", Vector3(0, 3.72, 0), Vector3(74, 0.30, 56), ceiling_mat)

	# Perimeter with a 14 m vehicle opening into the interior boulevard.
	_solid_box("NorthWall", Vector3(0, 1.75, 28), Vector3(74, 3.8, 0.45), dark_concrete_mat)
	_solid_box("WestWall", Vector3(-37, 1.75, 0), Vector3(0.45, 3.8, 56), dark_concrete_mat)
	_solid_box("EastWall", Vector3(37, 1.75, 0), Vector3(0.45, 3.8, 56), dark_concrete_mat)
	_solid_box("SouthWallL", Vector3(-22, 1.75, -28), Vector3(30, 3.8, 0.45), dark_concrete_mat)
	_solid_box("SouthWallR", Vector3(22, 1.75, -28), Vector3(30, 3.8, 0.45), dark_concrete_mat)

	for z in [-20.0, -10.0, 0.0, 10.0, 20.0]:
		for x in [-16.0, 16.0]:
			_solid_box("Column", Vector3(x, 1.65, z), Vector3(1.05, 3.3, 1.05), dark_concrete_mat)
			_visual_box(Vector3(x, 0.62, z), Vector3(1.10, 0.22, 1.10), yellow_mat)

	# Parking stripes. Thin visual geometry only, so the cars do not snag on it.
	for z in range(-23, 24, 5):
		_visual_box(Vector3(-27.0, 0.018, float(z)), Vector3(16.0, 0.025, 0.10), paint_mat)
		_visual_box(Vector3(27.0, 0.018, float(z)), Vector3(16.0, 0.025, 0.10), paint_mat)
	for x in [-19.0, -35.0, 19.0, 35.0]:
		_visual_box(Vector3(x, 0.020, 0), Vector3(0.10, 0.026, 51.0), paint_mat)

	# Drain channels give the slab a reason to feel wet without needing expensive reflections.
	for x in [-7.2, 7.2]:
		_visual_box(Vector3(x, 0.012, 0), Vector3(0.22, 0.028, 51.0), rubber_mat)

	# Low collision islands make the room read as a garage while keeping broad drive lines.
	for z in [-22.0, 22.0]:
		_solid_box("WheelStopIsland", Vector3(0, 0.11, z), Vector3(8.0, 0.22, 0.55), dark_concrete_mat)

func _build_vehicle_boulevard() -> void:
	# A road that never becomes outdoors: loading docks and a low ceiling continue deep into the level.
	_solid_box("BoulevardFloor", Vector3(0, -0.18, -69), Vector3(16, 0.36, 82), concrete_mat)
	_solid_box("BoulevardCeiling", Vector3(0, 4.10, -69), Vector3(16, 0.30, 82), ceiling_mat)
	_solid_box("BoulevardWallL", Vector3(-8, 1.95, -69), Vector3(0.45, 4.2, 82), dark_concrete_mat)
	_solid_box("BoulevardWallR", Vector3(8, 1.95, -69), Vector3(0.45, 4.2, 82), dark_concrete_mat)
	_visual_box(Vector3(0, 0.018, -69), Vector3(0.11, 0.025, 78), yellow_mat)

	# Recessed-looking loading bays are staged with shutters rather than carved geometry.
	for side in [-1.0, 1.0]:
		for z in [-45.0, -63.0, -81.0]:
			var x := side * 7.70
			_visual_box(Vector3(x, 1.65, z), Vector3(0.10, 2.65, 7.8), rust_mat)
			for stripe in range(-3, 4):
				_visual_box(Vector3(x - side * 0.07, 1.65 + stripe * 0.34, z), Vector3(0.05, 0.045, 7.4), dark_concrete_mat)

	# Deliberately too-small side portals demonstrate physical access rules for cars.
	_solid_box("NarrowPortalLeft", Vector3(-8.15, 1.6, -94), Vector3(4.5, 3.4, 0.5), ceiling_mat)
	_solid_box("NarrowPortalRight", Vector3(8.15, 1.6, -94), Vector3(4.5, 3.4, 0.5), ceiling_mat)

func _build_dry_carwash() -> void:
	# The boulevard terminates in a carwash that has no water source.
	_solid_box("WashFloor", Vector3(0, -0.18, -118), Vector3(18, 0.36, 20), dark_concrete_mat)
	_solid_box("WashCeiling", Vector3(0, 4.35, -118), Vector3(18, 0.30, 20), ceiling_mat)
	_solid_box("WashWallL", Vector3(-9, 2.05, -118), Vector3(0.45, 4.4, 20), dark_concrete_mat)
	_solid_box("WashWallR", Vector3(9, 2.05, -118), Vector3(0.45, 4.4, 20), dark_concrete_mat)
	_solid_box("WashEnd", Vector3(0, 2.05, -128), Vector3(18, 4.4, 0.45), dark_concrete_mat)

	for z in [-112.0, -118.0, -124.0]:
		for x in [-6.5, 6.5]:
			_solid_box("BrushPost", Vector3(x, 2.0, z), Vector3(0.35, 4.0, 0.35), rust_mat)
			for blade in range(9):
				var y := 0.45 + blade * 0.35
				_visual_box(Vector3(x + signf(x) * -0.55, y, z), Vector3(1.2, 0.10, 0.16), rubber_mat)

func _build_attendant_lounge() -> void:
	# A domestic room occupying four parking bays without changing the garage around it.
	_visual_box(Vector3(26.0, 0.025, 17.0), Vector3(12.0, 0.05, 8.5), carpet_mat)
	_solid_box("LoungeBack", Vector3(31.8, 1.45, 17.0), Vector3(0.20, 2.9, 8.5), glass_mat)
	_solid_box("LoungeSide", Vector3(26.0, 1.45, 21.15), Vector3(12.0, 2.9, 0.20), glass_mat)

	# Attendant booth, a small lit glass aquarium inside the larger concrete room.
	for x in [21.2, 24.8]:
		_solid_box("BoothWall", Vector3(x, 1.35, 10.8), Vector3(0.16, 2.7, 5.0), glass_mat)
	_solid_box("BoothBack", Vector3(23.0, 1.35, 13.25), Vector3(3.8, 2.7, 0.16), glass_mat)
	_solid_box("BoothDesk", Vector3(23.0, 0.62, 11.7), Vector3(2.5, 0.12, 0.9), rust_mat)

func _build_strange_setpieces() -> void:
	# "Car cathedral": concrete plinths with empty wheel-shaped gaps, made to accept parked cars.
	for index in range(5):
		var z := -18.0 + index * 9.0
		_solid_box("CarPlinth", Vector3(-31.8, 0.38, z), Vector3(7.0, 0.76, 4.6), dark_concrete_mat)

	# A row of chairs is aimed at a completely blank wall. The furniture asset pass fills it later.
	for index in range(6):
		_visual_box(Vector3(4.5 + index * 1.15, 0.48, 24.8), Vector3(0.70, 0.08, 0.70), rust_mat)

	# Hanging "traffic fruit": cones/weights suspended well above driving height.
	for index in range(8):
		var x := -10.5 + index * 3.0
		_visual_box(Vector3(x, 3.05, 13.5), Vector3(0.12, 1.1, 0.12), rust_mat)
		_visual_box(Vector3(x, 2.45, 13.5), Vector3(0.55, 0.25, 0.55), yellow_mat)

	# Exit signage points in mutually incompatible directions.
	for z in [-52.0, -70.0, -88.0]:
		_visual_box(Vector3(0, 3.15, z), Vector3(5.0, 0.65, 0.10), red_emissive_mat)

func _build_lighting() -> void:
	# Emissive fixtures do most of the visual work; only a subset carry realtime light.
	var fixture_index := 0
	for z in range(-24, 25, 8):
		for x in [-24.0, -8.0, 8.0, 24.0]:
			_fixture(Vector3(x, 3.48, float(z)), fixture_index % 3 == 0, Color(0.72, 0.88, 0.83))
			fixture_index += 1

	for z in range(-38, -128, -10):
		_fixture(Vector3(0, 3.80, float(z)), z % 20 == 0, Color(0.73, 0.82, 0.72))

	_local_light(Vector3(26, 2.8, 17), Color(0.95, 0.66, 0.42), 2.0, 9.0, true)
	_local_light(Vector3(23, 2.4, 11), Color(0.56, 0.72, 0.90), 1.6, 7.0, false)
	_local_light(Vector3(0, 2.0, -122), Color(0.46, 0.65, 0.72), 1.8, 10.0, false)

func _fixture(pos: Vector3, powered: bool, color: Color) -> void:
	_visual_box(pos, Vector3(2.7, 0.08, 0.20), fluorescent_mat)
	if powered:
		_local_light(pos + Vector3(0, -0.22, 0), color, 1.05, 8.0, false)

func _local_light(pos: Vector3, color: Color, energy: float, range_m: float, shadows: bool) -> void:
	var light := OmniLight3D.new()
	light.position = pos
	light.light_color = color
	light.light_energy = energy
	light.omni_range = range_m
	light.shadow_enabled = shadows
	light.distance_fade_enabled = true
	light.distance_fade_begin = maxf(8.0, range_m * 1.5)
	light.distance_fade_length = 8.0
	add_child(light)

func _spawn_cars() -> void:
	var colors := [
		Color(0.70, 0.67, 0.50),
		Color(0.25, 0.39, 0.31),
		Color(0.42, 0.18, 0.15),
		Color(0.29, 0.25, 0.39)
	]
	var models := [
		"res://arthur_assets/kenney_racing/vehicle-truck-yellow.glb",
		"res://arthur_assets/kenney_racing/vehicle-truck-green.glb",
		"res://arthur_assets/kenney_racing/vehicle-truck-red.glb",
		"res://arthur_assets/kenney_racing/vehicle-truck-purple.glb"
	]
	var placements := [
		Vector3(-27, 0.75, -18), Vector3(-27, 0.75, -7), Vector3(-27, 0.75, 8),
		Vector3(27, 0.75, -20), Vector3(27, 0.75, -4), Vector3(27, 0.75, 13),
		Vector3(-31.8, 1.10, 18), Vector3(0, 0.75, -54), Vector3(0, 0.75, -83)
	]
	for index in range(placements.size()):
		var car := RigidBody3D.new()
		car.name = "EnterableCar%02d" % index
		car.set_script(GARAGE_CAR_SCRIPT)
		car.position = placements[index]
		car.rotation.y = PI if index % 2 == 0 else 0.0
		car.set("body_color", colors[index % colors.size()])
		car.set("model_resource_path", models[index % models.size()])
		car.set("max_forward_speed", 13.0 if index < 7 else 16.0)
		add_child(car)

func _spawn_psychic_clutter() -> void:
	var clutter := [
		[Vector3(-5, 0.45, 15), Vector3(0.65, 0.65, 0.65), yellow_mat, 6.0],
		[Vector3(-3.8, 0.45, 16.2), Vector3(0.50, 0.82, 0.50), rust_mat, 5.0],
		[Vector3(5.0, 0.35, -17.0), Vector3(1.0, 0.45, 0.7), dark_concrete_mat, 12.0],
		[Vector3(6.2, 0.35, -18.2), Vector3(0.55, 0.55, 0.55), yellow_mat, 4.0],
		[Vector3(3.4, 0.42, -62.0), Vector3(0.75, 0.70, 0.75), rust_mat, 8.0],
		[Vector3(-3.4, 0.42, -75.0), Vector3(0.75, 0.70, 0.75), rust_mat, 8.0]
	]
	for item in clutter:
		_rigid_box(item[0], item[1], item[2], item[3])

	# Shopping-cart-ish frames, deliberately throwable but kept sparse for mobile physics.
	for index in range(4):
		var body := _rigid_box(Vector3(-10.0 + index * 1.4, 0.52, 20.0), Vector3(1.0, 0.85, 0.65), rust_mat, 7.0)
		body.name = "PsychicCart%02d" % index

func _spawn_furniture_assets() -> void:
	# Existing CI already supplies this CC0 KayKit pack. Missing assets simply fall back to generated set dressing.
	var items := [
		["res://arthur_assets/kaykit/gltf/armchair.gltf", Vector3(25.0, 0.05, 17.0), 0.0, 1.15],
		["res://arthur_assets/kaykit/gltf/armchair_pillows.gltf", Vector3(28.0, 0.05, 17.0), PI, 1.15],
		["res://arthur_assets/kaykit/gltf/bed_double_A.gltf", Vector3(27.0, 0.05, 19.5), PI * 0.5, 0.90]
	]
	for item in items:
		_spawn_asset(item[0], item[1], item[2], item[3])

func _spawn_asset(path: String, pos: Vector3, yaw: float, uniform_scale: float) -> Node3D:
	if not ResourceLoader.exists(path):
		return null
	var resource := ResourceLoader.load(path)
	if not (resource is PackedScene):
		return null
	var instance := (resource as PackedScene).instantiate() as Node3D
	if instance == null:
		return null
	instance.position = pos
	instance.rotation.y = yaw
	instance.scale = Vector3.ONE * uniform_scale
	add_child(instance)
	return instance

func _solid_box(node_name: String, pos: Vector3, size: Vector3, material: Material) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.name = node_name
	body.position = pos
	body.collision_layer = 1
	body.collision_mask = 3

	var mesh_instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh_instance.mesh = mesh
	mesh_instance.material_override = material
	body.add_child(mesh_instance)

	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collision.shape = shape
	body.add_child(collision)

	add_child(body)
	return body

func _visual_box(pos: Vector3, size: Vector3, material: Material) -> MeshInstance3D:
	var mesh_instance := MeshInstance3D.new()
	mesh_instance.position = pos
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh_instance.mesh = mesh
	mesh_instance.material_override = material
	add_child(mesh_instance)
	return mesh_instance

func _rigid_box(pos: Vector3, size: Vector3, material: Material, mass_kg: float) -> RigidBody3D:
	var body := RigidBody3D.new()
	body.position = pos
	body.mass = mass_kg
	body.collision_layer = 3
	body.collision_mask = 3
	body.add_to_group("psychic_prop")

	var mesh_instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh_instance.mesh = mesh
	mesh_instance.material_override = material
	body.add_child(mesh_instance)

	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collision.shape = shape
	body.add_child(collision)

	add_child(body)
	return body
