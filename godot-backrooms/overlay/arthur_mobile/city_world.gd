extends Node3D

# Arthur City v0.2
# Dense normal-world city environment. Arthur's player, movement, levitation,
# illumination and telekinesis scripts are intentionally untouched.

const CITY_ASSET_ROOT := "res://arthur_assets/kaykit_city/gltf/"
const BLOCK_SPACING := 26.0
const BLOCK_SIZE := 21.0
const HALF_BLOCK := BLOCK_SIZE * 0.5
const CITY_EXTENT := 82.0
const SPAWN := Vector3(0.0, 1.05, -13.0)
const GRID_MIN := -2
const GRID_MAX := 2

@onready var player: CharacterBody3D = $Player
@onready var coords_label: Label = $UI/Overlay/Coords

var asphalt_mat: StandardMaterial3D
var concrete_mat: StandardMaterial3D
var concrete_dark_mat: StandardMaterial3D
var grass_mat: StandardMaterial3D
var stripe_mat: StandardMaterial3D
var crosswalk_mat: StandardMaterial3D
var curb_mat: StandardMaterial3D
var prop_mat: StandardMaterial3D
var brick_mat: StandardMaterial3D
var roof_mat: StandardMaterial3D
var storefront_mats: Array[StandardMaterial3D] = []
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

# player_v09 asks the world about water every physics tick.
func is_water_at_position(_position: Vector3) -> bool:
	return false

func _build_materials() -> void:
	asphalt_mat = _make_material(Color(0.075, 0.082, 0.088, 1.0), 0.96)
	concrete_mat = _make_material(Color(0.49, 0.50, 0.49, 1.0), 0.93)
	concrete_dark_mat = _make_material(Color(0.25, 0.27, 0.28, 1.0), 0.94)
	grass_mat = _make_material(Color(0.13, 0.28, 0.14, 1.0), 1.0)
	stripe_mat = _make_material(Color(0.86, 0.73, 0.28, 1.0), 0.86)
	crosswalk_mat = _make_material(Color(0.88, 0.88, 0.82, 1.0), 0.9)
	curb_mat = _make_material(Color(0.63, 0.62, 0.58, 1.0), 0.94)
	prop_mat = _make_material(Color(0.27, 0.30, 0.32, 1.0), 0.74, 0.06)
	brick_mat = _make_material(Color(0.28, 0.18, 0.15, 1.0), 0.97)
	roof_mat = _make_material(Color(0.12, 0.13, 0.14, 1.0), 0.91)
	storefront_mats = [
		_make_material(Color(0.50, 0.16, 0.13, 1.0), 0.82),
		_make_material(Color(0.10, 0.29, 0.39, 1.0), 0.82),
		_make_material(Color(0.12, 0.34, 0.25, 1.0), 0.82),
		_make_material(Color(0.48, 0.34, 0.12, 1.0), 0.82)
	]

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

	# Road slab. Most of this disappears beneath raised city blocks, so Arthur now
	# sees streets between buildings instead of one enormous asphalt sheet.
	_add_box(geometry, "RoadBase", Vector3(0.0, -0.40, 0.0), Vector3(CITY_EXTENT * 2.0, 0.8, CITY_EXTENT * 2.0), asphalt_mat, true)

	for ix in range(GRID_MIN, GRID_MAX + 1):
		for iz in range(GRID_MIN, GRID_MAX + 1):
			var center := Vector3(float(ix) * BLOCK_SPACING, 0.0, float(iz) * BLOCK_SPACING)
			var kind := _lot_kind(ix, iz)
			if kind == "park":
				_build_park(geometry, center)
			elif kind == "parking":
				_build_parking_lot(geometry, center, ix, iz)
			elif kind == "plaza":
				_build_plaza(geometry, center, ix, iz)
			else:
				_build_dense_block(geometry, center, ix, iz)

	_build_road_markings(geometry)
	_build_crosswalks(geometry)
	_build_street_furniture(geometry)
	_build_curbside_cars(geometry)
	_build_loose_psychic_props(geometry)
	_build_horizon(geometry)

func _lot_kind(ix: int, iz: int) -> String:
	if ix == 0 and iz == 0:
		return "park"
	if ix == -2 and iz == 1:
		return "parking"
	if ix == 2 and iz == -1:
		return "plaza"
	return "building"

func _road_centers() -> Array[float]:
	return [-39.0, -13.0, 13.0, 39.0]

func _build_road_markings(parent: Node3D) -> void:
	for x in _road_centers():
		for z in range(-70, 71, 8):
			if _near_intersection(float(z)):
				continue
			_add_box(parent, "LaneDashV", Vector3(x, 0.025, float(z)), Vector3(0.10, 0.022, 3.0), stripe_mat, false)
	for z in _road_centers():
		for x in range(-70, 71, 8):
			if _near_intersection(float(x)):
				continue
			_add_box(parent, "LaneDashH", Vector3(float(x), 0.026, z), Vector3(3.0, 0.022, 0.10), stripe_mat, false)

func _near_intersection(value: float) -> bool:
	for road in _road_centers():
		if absf(value - road) < 5.0:
			return true
	return false

func _build_crosswalks(parent: Node3D) -> void:
	for rx in _road_centers():
		for rz in _road_centers():
			# Compact zebra crossings on all four approaches make intersections read
			# immediately from eye level without hundreds of meshes.
			for i in range(-2, 3):
				var off := float(i) * 0.62
				_add_box(parent, "CrosswalkV", Vector3(rx + off, 0.032, rz - 3.25), Vector3(0.34, 0.024, 1.65), crosswalk_mat, false)
				_add_box(parent, "CrosswalkH", Vector3(rx - 3.25, 0.033, rz + off), Vector3(1.65, 0.024, 0.34), crosswalk_mat, false)

func _build_dense_block(parent: Node3D, center: Vector3, ix: int, iz: int) -> void:
	_add_box(parent, "SidewalkBlock", center + Vector3(0.0, 0.10, 0.0), Vector3(BLOCK_SIZE, 0.20, BLOCK_SIZE), concrete_mat, true)

	# Four street-facing buildings per block. This is the key v0.2 change: the
	# sidewalk edge is occupied continuously instead of placing one tiny structure
	# in a sea of pavement.
	var offsets := [
		Vector3(-5.0, 0.0, -5.0), Vector3(5.0, 0.0, -5.0),
		Vector3(-5.0, 0.0, 5.0), Vector3(5.0, 0.0, 5.0)
	]
	for n in range(offsets.size()):
		_build_city_building(parent, center + offsets[n], ix, iz, n)

	# Narrow service alleys through the block. They make the density navigable
	# instead of turning every block into one solid collision cube.
	_add_box(parent, "AlleyX", center + Vector3(0.0, 0.215, 0.0), Vector3(2.0, 0.035, 17.8), concrete_dark_mat, false)
	_add_box(parent, "AlleyZ", center + Vector3(0.0, 0.216, 0.0), Vector3(17.8, 0.035, 2.0), concrete_dark_mat, false)

	if posmod(ix * 3 + iz, 2) == 0:
		_instance_asset("dumpster.gltf", parent, center + Vector3(1.2, 0.28, 4.4), PI * 0.5, Vector3.ONE * 0.95)
	if posmod(ix - iz, 3) == 0:
		_instance_asset("bench.gltf", parent, center + Vector3(-8.7, 0.25, 0.0), PI * 0.5, Vector3.ONE * 0.95)

func _build_city_building(parent: Node3D, position: Vector3, ix: int, iz: int, slot: int) -> void:
	var letters := ["A", "B", "C", "D", "E", "F", "G", "H"]
	var index := posmod(ix * 13 + iz * 7 + slot * 3, letters.size())
	var asset := "building_%s_withoutBase.gltf" % letters[index]
	var downtownness := 2 - mini(2, maxi(abs(ix), abs(iz)))
	var scale_factor := 1.55 + float(posmod(ix * 5 - iz * 3 + slot, 4)) * 0.10 + float(downtownness) * 0.16
	var rotation_y := float(posmod(slot + ix - iz, 4)) * PI * 0.5
	var visual := _instance_asset(asset, parent, position + Vector3(0.0, 0.20, 0.0), rotation_y, Vector3.ONE * scale_factor)
	if visual != null:
		visual.name = "Building_%d_%d_%d" % [ix, iz, slot]

	var footprint := 7.7
	var height := 9.5 + float(posmod(ix * 11 + iz * 17 + slot * 5, 5)) * 1.45 + float(downtownness) * 2.4
	_add_static_collision(parent, "BuildingCollision", position + Vector3(0.0, 0.20 + height * 0.5, 0.0), Vector3(footprint, height, footprint))

	# Low-cost rooftop mass and storefront/awning accents fill the silhouette and
	# keep repeated public-kit buildings from reading as cloned props.
	if downtownness > 0 and posmod(slot + ix, 2) == 0:
		_add_box(parent, "RoofPlant", position + Vector3(0.0, height + 0.55, 0.0), Vector3(2.3, 1.1, 2.3), roof_mat, false)

	var edge_x := signf(position.x - float(ix) * BLOCK_SPACING)
	var edge_z := signf(position.z - float(iz) * BLOCK_SPACING)
	var accent_mat := storefront_mats[posmod(ix + iz + slot, storefront_mats.size())]
	if absf(edge_z) > 0.1:
		_add_box(parent, "Awning", position + Vector3(0.0, 2.3, edge_z * 4.02), Vector3(3.8, 0.38, 0.55), accent_mat, false)
	else:
		_add_box(parent, "Awning", position + Vector3(edge_x * 4.02, 2.3, 0.0), Vector3(0.55, 0.38, 3.8), accent_mat, false)

func _build_park(parent: Node3D, center: Vector3) -> void:
	_add_box(parent, "ParkCurb", center + Vector3(0.0, 0.10, 0.0), Vector3(BLOCK_SIZE, 0.20, BLOCK_SIZE), curb_mat, true)
	_add_box(parent, "ParkLawn", center + Vector3(0.0, 0.225, 0.0), Vector3(18.5, 0.05, 18.5), grass_mat, false)
	_add_box(parent, "ParkPathX", center + Vector3(0.0, 0.265, 0.0), Vector3(19.0, 0.035, 2.2), concrete_dark_mat, false)
	_add_box(parent, "ParkPathZ", center + Vector3(0.0, 0.266, 0.0), Vector3(2.2, 0.035, 19.0), concrete_dark_mat, false)

	var bushes := [
		Vector3(-7.1, 0.28, -7.1), Vector3(0.0, 0.28, -7.3), Vector3(7.1, 0.28, -7.1),
		Vector3(-7.1, 0.28, 7.1), Vector3(0.0, 0.28, 7.3), Vector3(7.1, 0.28, 7.1),
		Vector3(-7.3, 0.28, 0.0), Vector3(7.3, 0.28, 0.0)
	]
	for offset in bushes:
		_instance_asset("bush.gltf", parent, center + offset, 0.0, Vector3.ONE * 1.45)

	for spec in [
		[Vector3(-5.0, 0.28, 2.2), PI * 0.5], [Vector3(5.0, 0.28, -2.2), -PI * 0.5],
		[Vector3(2.2, 0.28, 5.0), 0.0], [Vector3(-2.2, 0.28, -5.0), PI]
	]:
		_instance_asset("bench.gltf", parent, center + spec[0] as Vector3, float(spec[1]), Vector3.ONE)

	var monument := _add_box(parent, "ParkMonument", center + Vector3(0.0, 1.35, 0.0), Vector3(1.4, 2.2, 1.4), brick_mat, true)
	monument.rotation.y = PI * 0.25

func _build_parking_lot(parent: Node3D, center: Vector3, ix: int, iz: int) -> void:
	_add_box(parent, "ParkingCurb", center + Vector3(0.0, 0.10, 0.0), Vector3(BLOCK_SIZE, 0.20, BLOCK_SIZE), curb_mat, true)
	_add_box(parent, "ParkingPad", center + Vector3(0.0, 0.225, 0.0), Vector3(18.8, 0.05, 18.8), asphalt_mat, false)
	for row in [-5.4, 5.4]:
		for slot in range(-3, 4):
			_add_box(parent, "ParkingLine", center + Vector3(float(slot) * 2.25, 0.265, row), Vector3(0.07, 0.022, 3.8), crosswalk_mat, false)

	var car_names := ["car_hatchback.gltf", "car_sedan.gltf", "car_stationwagon.gltf", "car_taxi.gltf"]
	for n in range(10):
		var row_z := -5.4 if n < 5 else 5.4
		var slot_index := n if n < 5 else n - 5
		var slot_x := float(slot_index - 2) * 2.8
		var rot := 0.0 if row_z < 0.0 else PI
		_spawn_psychic_car(parent, car_names[posmod(n + ix - iz, car_names.size())], center + Vector3(slot_x, 0.83, row_z), rot)

	# Small corner shop keeps the parking lot from becoming another empty void.
	_instance_asset("building_H_withoutBase.gltf", parent, center + Vector3(7.0, 0.25, 7.0), PI, Vector3.ONE * 1.25)
	_add_static_collision(parent, "ParkingShopCollision", center + Vector3(7.0, 4.4, 7.0), Vector3(5.8, 8.4, 5.8))

func _build_plaza(parent: Node3D, center: Vector3, ix: int, iz: int) -> void:
	_add_box(parent, "Plaza", center + Vector3(0.0, 0.10, 0.0), Vector3(BLOCK_SIZE, 0.20, BLOCK_SIZE), concrete_mat, true)
	_build_city_building(parent, center + Vector3(-5.0, 0.0, -5.0), ix, iz, 0)
	_build_city_building(parent, center + Vector3(5.0, 0.0, -5.0), ix, iz, 1)
	_build_city_building(parent, center + Vector3(5.0, 0.0, 5.0), ix, iz, 2)
	_instance_asset("bench.gltf", parent, center + Vector3(-5.5, 0.26, 5.5), -PI * 0.25, Vector3.ONE)
	_instance_asset("bench.gltf", parent, center + Vector3(-2.5, 0.26, 6.8), PI * 0.25, Vector3.ONE)
	for p in [Vector3(-6.8, 0.27, 3.0), Vector3(-4.0, 0.27, 7.0), Vector3(0.0, 0.27, 6.8)]:
		_instance_asset("bush.gltf", parent, center + p, 0.0, Vector3.ONE * 1.3)

func _build_street_furniture(parent: Node3D) -> void:
	# Lights and hydrants sit on sidewalks at block corners rather than out in the
	# road. Alternating corners keeps draw count sane on phones.
	for ix in range(GRID_MIN, GRID_MAX + 1):
		for iz in range(GRID_MIN, GRID_MAX + 1):
			var center := Vector3(float(ix) * BLOCK_SPACING, 0.0, float(iz) * BLOCK_SPACING)
			var corner_x := HALF_BLOCK - 0.75
			var corner_z := HALF_BLOCK - 0.75
			if posmod(ix + iz, 2) == 0:
				_instance_asset("streetlight.gltf", parent, center + Vector3(corner_x, 0.24, corner_z), PI, Vector3.ONE * 1.08)
				_instance_asset("streetlight.gltf", parent, center + Vector3(-corner_x, 0.24, -corner_z), 0.0, Vector3.ONE * 1.08)
			else:
				_instance_asset("streetlight.gltf", parent, center + Vector3(-corner_x, 0.24, corner_z), PI * 0.5, Vector3.ONE * 1.08)
				_instance_asset("streetlight.gltf", parent, center + Vector3(corner_x, 0.24, -corner_z), -PI * 0.5, Vector3.ONE * 1.08)
			if posmod(ix * 5 + iz * 3, 4) == 0:
				_instance_asset("firehydrant.gltf", parent, center + Vector3(corner_x - 1.2, 0.25, -corner_z), 0.0, Vector3.ONE)

	for rx in _road_centers():
		for rz in _road_centers():
			if posmod(int(rx + rz), 2) == 0:
				_instance_asset("trafficlight_A.gltf", parent, Vector3(rx - 2.2, 0.20, rz - 2.2), 0.0, Vector3.ONE)

func _build_curbside_cars(parent: Node3D) -> void:
	var car_names := ["car_sedan.gltf", "car_hatchback.gltf", "car_stationwagon.gltf", "car_taxi.gltf", "car_police.gltf"]
	var segments := [-65.0, -52.0, -26.0, 0.0, 26.0, 52.0, 65.0]
	var counter := 0

	for road_x in _road_centers():
		for z in segments:
			if _near_intersection(z):
				continue
			if posmod(counter, 3) != 0:
				var side := -1.0 if posmod(counter, 2) == 0 else 1.0
				_spawn_psychic_car(parent, car_names[posmod(counter, car_names.size())], Vector3(road_x + side * 1.72, 0.72, z), 0.0 if side > 0.0 else PI)
			counter += 1

	for road_z in _road_centers():
		for x in segments:
			if _near_intersection(x):
				continue
			if posmod(counter, 3) != 1:
				var side := -1.0 if posmod(counter, 2) == 0 else 1.0
				_spawn_psychic_car(parent, car_names[posmod(counter, car_names.size())], Vector3(x, 0.72, road_z + side * 1.72), PI * 0.5 if side > 0.0 else -PI * 0.5)
			counter += 1

func _build_loose_psychic_props(parent: Node3D) -> void:
	var points := [
		Vector3(8.8, 0.72, -9.1), Vector3(9.8, 0.72, -8.6), Vector3(-17.0, 0.72, 8.8),
		Vector3(34.0, 0.72, -8.8), Vector3(-43.0, 0.72, 34.0), Vector3(34.0, 0.72, 43.0),
		Vector3(-8.8, 0.72, -43.0), Vector3(43.0, 0.72, 8.9)
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
		mesh.size = Vector3(0.72, 1.05, 0.72)
		mesh_instance.mesh = mesh
		mesh_instance.material_override = prop_mat
		body.add_child(mesh_instance)

		var shape := CollisionShape3D.new()
		var box := BoxShape3D.new()
		box.size = Vector3(0.72, 1.05, 0.72)
		shape.shape = box
		body.add_child(shape)

func _build_horizon(parent: Node3D) -> void:
	# Cheap perimeter masses close the skyline so the playable district does not
	# visibly dissolve into an empty plane. They are solid because Arthur can fly.
	for i in range(-4, 5):
		var p := float(i) * 17.0
		var h1 := 13.0 + float(posmod(i * 7, 6)) * 2.3
		var h2 := 15.0 + float(posmod(i * 11, 5)) * 2.5
		_add_horizon_building(parent, Vector3(p, 0.0, -75.0), Vector3(13.0, h1, 10.0), i)
		_add_horizon_building(parent, Vector3(p, 0.0, 75.0), Vector3(13.0, h2, 10.0), i + 5)
		_add_horizon_building(parent, Vector3(-75.0, 0.0, p), Vector3(10.0, h2, 13.0), i + 9)
		_add_horizon_building(parent, Vector3(75.0, 0.0, p), Vector3(10.0, h1, 13.0), i + 13)

func _add_horizon_building(parent: Node3D, base_position: Vector3, size: Vector3, seed_value: int) -> void:
	var mat := brick_mat if posmod(seed_value, 2) == 0 else concrete_dark_mat
	_add_box(parent, "HorizonBuilding", base_position + Vector3(0.0, size.y * 0.5, 0.0), size, mat, true)
	_add_box(parent, "HorizonRoof", base_position + Vector3(0.0, size.y + 0.22, 0.0), Vector3(size.x + 0.4, 0.42, size.z + 0.4), roof_mat, false)

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