extends Node3D

# Arthur City v0.1
# A normal-world city branch. Arthur's player and psychic scripts are intentionally
# untouched; this script only replaces the Backrooms environment generator.

const CITY_ASSET_ROOT := "res://arthur_assets/kaykit_city/gltf/"
const BLOCK_SPACING := 30.0
const BLOCK_SIZE := 20.0
const CITY_EXTENT := 92.0
const SPAWN := Vector3(0.0, 1.05, -15.0)

@onready var player: CharacterBody3D = $Player
@onready var coords_label: Label = $UI/Overlay/Coords

var asphalt_mat: StandardMaterial3D
var concrete_mat: StandardMaterial3D
var concrete_dark_mat: StandardMaterial3D
var grass_mat: StandardMaterial3D
var stripe_mat: StandardMaterial3D
var curb_mat: StandardMaterial3D
var prop_mat: StandardMaterial3D

var asset_cache: Dictionary = {}

func _ready() -> void:
	_build_materials()
	_build_city()
	player.global_position = SPAWN

func _process(_delta: float) -> void:
	if player == null:
		return
	if coords_label != null:
		coords_label.text = "CITY  %d, %d  //  ALT %.0f m" % [
			int(round(player.global_position.x)),
			int(round(player.global_position.z)),
			maxf(0.0, player.global_position.y)
		]
	if player.global_position.y < -14.0:
		player.global_position = SPAWN
		player.velocity = Vector3.ZERO
		player.set_psychic_levitation(false)

# player_v09 asks the world about water every physics tick. There is deliberately
# no pool/swimming volume in the city yet, so the Backrooms water state stays off.
func is_water_at_position(_position: Vector3) -> bool:
	return false

func _build_materials() -> void:
	asphalt_mat = _make_material(Color(0.075, 0.083, 0.09, 1.0), 0.94)
	concrete_mat = _make_material(Color(0.54, 0.55, 0.55, 1.0), 0.9)
	concrete_dark_mat = _make_material(Color(0.31, 0.33, 0.35, 1.0), 0.9)
	grass_mat = _make_material(Color(0.16, 0.31, 0.18, 1.0), 1.0)
	stripe_mat = _make_material(Color(0.82, 0.78, 0.58, 1.0), 0.86)
	curb_mat = _make_material(Color(0.69, 0.68, 0.64, 1.0), 0.92)
	prop_mat = _make_material(Color(0.32, 0.36, 0.39, 1.0), 0.72, 0.08)

func _make_material(color: Color, roughness: float, metallic: float = 0.0) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = roughness
	mat.metallic = metallic
	return mat

func _build_city() -> void:
	var geometry := Node3D.new()
	geometry.name = "CityGeometry"
	add_child(geometry)

	_add_box(geometry, "AsphaltGround", Vector3(0.0, -0.46, 0.0), Vector3(CITY_EXTENT * 2.0, 0.9, CITY_EXTENT * 2.0), asphalt_mat, true)
	_build_lane_markings(geometry)

	for ix in range(-2, 3):
		for iz in range(-2, 3):
			var center := Vector3(float(ix) * BLOCK_SPACING, 0.0, float(iz) * BLOCK_SPACING)
			var kind := _lot_kind(ix, iz)
			if kind == "park":
				_build_park(geometry, center)
			elif kind == "parking":
				_build_parking_lot(geometry, center, ix, iz)
			else:
				_build_building_block(geometry, center, ix, iz)

	_build_street_furniture(geometry)
	_build_parked_cars(geometry)
	_build_loose_psychic_props(geometry)

func _lot_kind(ix: int, iz: int) -> String:
	if ix == 0 and iz == 0:
		return "park"
	if (ix == -2 and iz == 1) or (ix == 2 and iz == -1) or (ix == 1 and iz == 2):
		return "parking"
	return "building"

func _build_lane_markings(parent: Node3D) -> void:
	var roads := [-75.0, -45.0, -15.0, 15.0, 45.0, 75.0]
	for x in roads:
		for z in range(-84, 85, 9):
			_add_box(parent, "VDash", Vector3(x, 0.018, float(z)), Vector3(0.13, 0.025, 3.6), stripe_mat, false)
	for z in roads:
		for x in range(-84, 85, 9):
			_add_box(parent, "HDash", Vector3(float(x), 0.02, z), Vector3(3.6, 0.025, 0.13), stripe_mat, false)

func _build_building_block(parent: Node3D, center: Vector3, ix: int, iz: int) -> void:
	_add_box(parent, "Sidewalk", center + Vector3(0.0, 0.09, 0.0), Vector3(BLOCK_SIZE, 0.18, BLOCK_SIZE), concrete_mat, true)

	var index := posmod(ix * 7 + iz * 11, 8)
	var asset := "building_%s_withoutBase.gltf" % char(65 + index)
	var scale_factor := 2.15 + float(posmod(ix * 5 - iz * 3, 4)) * 0.18
	var rotation_y := float(posmod(ix - iz, 4)) * PI * 0.5
	var visual := _instance_asset(asset, parent, center + Vector3(0.0, 0.19, 0.0), rotation_y, Vector3.ONE * scale_factor)
	if visual != null:
		visual.name = "BuildingVisual_%d_%d" % [ix, iz]

	# Cheap broad-phase collision keeps mobile flight smooth while still making
	# rooftops/walls solid. The public model remains purely visual.
	var footprint := 12.0 + float(posmod(ix + iz, 2)) * 1.4
	var height := 12.0 + float(posmod(ix * 3 + iz * 5, 5)) * 2.4
	_add_static_collision(parent, "BuildingCollision", center + Vector3(0.0, 0.18 + height * 0.5, 0.0), Vector3(footprint, height, footprint))

	# A little service-space breathing room around every block keeps the city from
	# becoming one repeated wall canyon.
	if posmod(ix + iz, 3) == 0:
		_instance_asset("dumpster.gltf", parent, center + Vector3(7.1, 0.2, -6.8), rotation_y, Vector3.ONE * 1.1)
	if posmod(ix * 2 + iz, 4) == 0:
		_instance_asset("bench.gltf", parent, center + Vector3(-7.0, 0.2, 6.8), rotation_y + PI * 0.5, Vector3.ONE * 1.05)

func _build_park(parent: Node3D, center: Vector3) -> void:
	_add_box(parent, "ParkCurb", center + Vector3(0.0, 0.09, 0.0), Vector3(BLOCK_SIZE, 0.18, BLOCK_SIZE), curb_mat, true)
	_add_box(parent, "ParkLawn", center + Vector3(0.0, 0.205, 0.0), Vector3(15.6, 0.05, 15.6), grass_mat, false)
	_add_box(parent, "ParkPathX", center + Vector3(0.0, 0.235, 0.0), Vector3(16.4, 0.035, 2.2), concrete_dark_mat, false)
	_add_box(parent, "ParkPathZ", center + Vector3(0.0, 0.236, 0.0), Vector3(2.2, 0.035, 16.4), concrete_dark_mat, false)

	for offset in [Vector3(-5.6, 0.22, -5.6), Vector3(5.6, 0.22, -5.6), Vector3(-5.6, 0.22, 5.6), Vector3(5.6, 0.22, 5.6)]:
		_instance_asset("bush.gltf", parent, center + offset, 0.0, Vector3.ONE * 1.4)
	_instance_asset("bench.gltf", parent, center + Vector3(-4.2, 0.22, 1.8), PI * 0.5, Vector3.ONE * 1.1)
	_instance_asset("bench.gltf", parent, center + Vector3(4.2, 0.22, -1.8), -PI * 0.5, Vector3.ONE * 1.1)

	var monument := _add_box(parent, "ParkMonument", center + Vector3(0.0, 1.15, 0.0), Vector3(1.2, 2.0, 1.2), concrete_dark_mat, true)
	monument.rotation.y = PI * 0.25

func _build_parking_lot(parent: Node3D, center: Vector3, ix: int, iz: int) -> void:
	_add_box(parent, "ParkingPad", center + Vector3(0.0, 0.035, 0.0), Vector3(BLOCK_SIZE, 0.07, BLOCK_SIZE), asphalt_mat, false)
	for row in [-5.8, 5.8]:
		for slot in range(-3, 4):
			_add_box(parent, "ParkingLine", center + Vector3(float(slot) * 2.35, 0.082, row), Vector3(0.07, 0.025, 4.0), stripe_mat, false)

	var car_names := ["car_hatchback.gltf", "car_sedan.gltf", "car_stationwagon.gltf", "car_taxi.gltf"]
	for n in range(5):
		var row_z := -5.7 if n < 3 else 5.7
		var slot_x := (-2.0 + float(n if n < 3 else n - 3)) * 2.8
		var rot := 0.0 if row_z < 0.0 else PI
		_spawn_psychic_car(parent, car_names[posmod(n + ix - iz, car_names.size())], center + Vector3(slot_x, 0.72, row_z), rot)

func _build_street_furniture(parent: Node3D) -> void:
	var road_edges := [-69.3, -39.3, -9.3, 20.7, 50.7]
	for x in road_edges:
		for z in [-67.0, -37.0, -7.0, 23.0, 53.0]:
			if absf(x) < 12.0 and absf(z) < 12.0:
				continue
			_instance_asset("streetlight.gltf", parent, Vector3(x, 0.2, z), 0.0, Vector3.ONE * 1.18)

	var hydrants := [Vector3(-8.8, 0.2, -37.0), Vector3(20.8, 0.2, -7.0), Vector3(50.8, 0.2, 23.0), Vector3(-39.2, 0.2, 53.0), Vector3(-69.2, 0.2, -7.0)]
	for p in hydrants:
		_instance_asset("firehydrant.gltf", parent, p, 0.0, Vector3.ONE * 1.1)

	var signals := [Vector3(-10.0, 0.2, -10.0), Vector3(20.0, 0.2, -10.0), Vector3(-10.0, 0.2, 20.0), Vector3(20.0, 0.2, 20.0)]
	for i in range(signals.size()):
		_instance_asset("trafficlight_A.gltf", parent, signals[i], float(i) * PI * 0.5, Vector3.ONE * 1.05)

func _build_parked_cars(parent: Node3D) -> void:
	var specs := [
		["car_sedan.gltf", Vector3(-4.0, 0.72, -45.0), PI * 0.5],
		["car_hatchback.gltf", Vector3(34.0, 0.72, -15.0), PI * 0.5],
		["car_stationwagon.gltf", Vector3(-26.0, 0.72, 15.0), -PI * 0.5],
		["car_taxi.gltf", Vector3(56.0, 0.72, 45.0), PI * 0.5],
		["car_sedan.gltf", Vector3(-56.0, 0.72, 75.0), -PI * 0.5],
		["car_hatchback.gltf", Vector3(15.0, 0.72, 66.0), 0.0],
		["car_police.gltf", Vector3(-45.0, 0.72, -65.0), 0.0]
	]
	for spec in specs:
		_spawn_psychic_car(parent, spec[0] as String, spec[1] as Vector3, float(spec[2]))

func _build_loose_psychic_props(parent: Node3D) -> void:
	var points := [
		Vector3(6.0, 0.72, -8.2), Vector3(7.3, 0.72, -8.0), Vector3(-38.0, 0.72, 8.4),
		Vector3(51.0, 0.72, -8.5), Vector3(-68.5, 0.72, 38.0), Vector3(38.0, 0.72, 68.0)
	]
	for i in range(points.size()):
		var body := RigidBody3D.new()
		body.name = "PsychicStreetProp_%02d" % i
		body.position = points[i]
		body.mass = 1.25
		body.collision_layer = 3
		body.collision_mask = 3
		body.add_to_group("psychic_prop")
		parent.add_child(body)

		var mesh_instance := MeshInstance3D.new()
		var mesh := BoxMesh.new()
		mesh.size = Vector3(0.85, 1.15, 0.85)
		mesh_instance.mesh = mesh
		mesh_instance.material_override = prop_mat
		body.add_child(mesh_instance)

		var shape := CollisionShape3D.new()
		var box := BoxShape3D.new()
		box.size = Vector3(0.85, 1.15, 0.85)
		shape.shape = box
		body.add_child(shape)

func _spawn_psychic_car(parent: Node3D, asset_name: String, position: Vector3, rotation_y: float) -> void:
	var body := RigidBody3D.new()
	body.name = "PsychicCar"
	body.position = position
	body.rotation.y = rotation_y
	body.mass = 4.0
	body.freeze = true
	body.collision_layer = 3
	body.collision_mask = 3
	body.add_to_group("psychic_prop")
	parent.add_child(body)

	var visual := _instance_asset(asset_name, body, Vector3(0.0, -0.58, 0.0), 0.0, Vector3.ONE * 1.15)
	if visual != null:
		visual.name = "CarVisual"

	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(3.9, 1.35, 1.9)
	shape.shape = box
	body.add_child(shape)

func _instance_asset(asset_name: String, parent: Node, position: Vector3, rotation_y: float = 0.0, scale_value: Vector3 = Vector3.ONE) -> Node3D:
	var packed := _load_asset(asset_name)
	if packed == null:
		return null
	var node := packed.instantiate() as Node3D
	if node == null:
		return null
	parent.add_child(node)
	node.position = position
	node.rotation.y = rotation_y
	node.scale = scale_value
	return node

func _load_asset(asset_name: String) -> PackedScene:
	if asset_cache.has(asset_name):
		return asset_cache[asset_name] as PackedScene
	var path := CITY_ASSET_ROOT + asset_name
	if not ResourceLoader.exists(path):
		push_warning("Arthur City asset missing: %s" % path)
		return null
	var resource := load(path) as PackedScene
	if resource != null:
		asset_cache[asset_name] = resource
	return resource

func _add_box(parent: Node3D, node_name: String, position: Vector3, size: Vector3, material: Material, collision: bool) -> MeshInstance3D:
	var mesh_instance := MeshInstance3D.new()
	mesh_instance.name = node_name
	mesh_instance.position = position
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh_instance.mesh = mesh
	mesh_instance.material_override = material
	parent.add_child(mesh_instance)
	if collision:
		_add_static_collision(parent, node_name + "Collision", position, size)
	return mesh_instance

func _add_static_collision(parent: Node3D, node_name: String, position: Vector3, size: Vector3) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.name = node_name
	body.position = position
	body.collision_layer = 1
	body.collision_mask = 3
	parent.add_child(body)
	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collision.shape = shape
	body.add_child(collision)
	return body
