extends Node3D

# Dock Town coordinates are copied from the stable Ashfall block plan.
const LIMITS := Rect2(-14.0, 0.0, 236.0, 198.0)
const PLAYER_START := Vector3(92.0, 0.08, 67.0)
const WATER_TOWER := Vector2(66.0, 108.0)
const HOSPITAL := Vector2(176.0, 106.0)
const BAR := Vector2(112.0, 88.0)
const FUEL_STATION := Vector2(105.0, 111.0)
const FORGE := Vector2(54.0, 128.0)
const FALLOUT_HILLS := Vector2(-52.0, 190.0)
const CLOUD := Vector2(-63.0, 217.0)

const ROADS := [
	{"width": 10.8, "sidewalk": true, "points": [Vector2(-8,72),Vector2(28,72),Vector2(60,72),Vector2(86,72),Vector2(112,72),Vector2(132,72),Vector2(168,72),Vector2(216,72)]},
	{"width": 9.2, "sidewalk": true, "points": [Vector2(86,5),Vector2(86,35),Vector2(86,72),Vector2(86,108),Vector2(86,136),Vector2(86,166),Vector2(86,188)]},
	{"width": 9.4, "sidewalk": true, "points": [Vector2(132,72),Vector2(132,106),Vector2(132,136),Vector2(132,166),Vector2(132,188)]},
	{"width": 8.8, "sidewalk": true, "points": [Vector2(86,136),Vector2(108,136),Vector2(132,136),Vector2(160,136),Vector2(190,136),Vector2(219,136)]},
	{"width": 8.8, "sidewalk": true, "points": [Vector2(86,166),Vector2(108,166),Vector2(132,166),Vector2(160,166),Vector2(190,166),Vector2(219,166)]},
	{"width": 9.4, "sidewalk": false, "points": [Vector2(86,122),Vector2(74,132),Vector2(61,146),Vector2(46,162),Vector2(28,178),Vector2(-8,188)]},
	{"width": 7.2, "sidewalk": true, "points": [Vector2(20,4),Vector2(20,34),Vector2(20,72)]},
	{"width": 7.2, "sidewalk": true, "points": [Vector2(53,4),Vector2(53,35),Vector2(53,72)]},
	{"width": 7.0, "sidewalk": true, "points": [Vector2(3,35),Vector2(20,35),Vector2(53,35),Vector2(86,35)]},
	{"width": 6.8, "sidewalk": false, "points": [Vector2(143,72),Vector2(148,82),Vector2(170,87),Vector2(196,88)]},
]

var spawn_points: Array[Vector3] = [
	Vector3(-5, 0.08, 72), Vector3(213, 0.08, 72), Vector3(86, 0.08, 188),
	Vector3(216, 0.08, 136), Vector3(216, 0.08, 166), Vector3(12, 0.08, 186),
	Vector3(10, 0.08, 8), Vector3(82, 0.08, 9), Vector3(124, 0.08, 184),
]

var interaction_points := {
	"fuel": Vector3(FUEL_STATION.x, 0.0, FUEL_STATION.y),
	"forge": Vector3(FORGE.x, 0.0, FORGE.y),
	"bar": Vector3(BAR.x, 0.0, BAR.y),
}

var _rng := RandomNumberGenerator.new()
var _materials: Dictionary = {}

func _ready() -> void:
	_rng.seed = 731991

func build() -> void:
	_build_ground()
	_build_roads()
	_build_neighborhood()
	_build_tower_block()
	_build_bar_and_fuel()
	_build_hospital()
	_build_factories_and_forge()
	_build_shopping_district()
	_build_forest()
	_build_fallout_horizon()
	_build_barricades_and_bounds()
	_build_street_clutter()

func _build_ground() -> void:
	_make_static_box("Ground", Vector3(104, -0.22, 99), Vector3(252, 0.4, 216), Color("#34352d"))
	# Slightly raised dead grass / dirt blocks outside the streets keep the low-poly texture rhythm.
	for x in range(-10, 220, 12):
		for z in range(4, 196, 12):
			if x > 104 and z < 70:
				continue
			var shade := 0.84 + _rng.randf_range(-0.08, 0.08)
			_make_visual_box(Vector3(10.8, 0.025, 10.8), Vector3(x + 5.4, 0.012, z + 5.4), Color(0.20 * shade, 0.20 * shade, 0.16 * shade))

func _build_roads() -> void:
	for road in ROADS:
		var points: Array = road["points"]
		var width: float = road["width"]
		if road["sidewalk"]:
			_add_road_polyline(points, width + 3.2, Color("#57514a"), 0.045)
		_add_road_polyline(points, width, Color("#252321"), 0.075)
		_add_center_lines(points)

func _add_road_polyline(points: Array, width: float, color: Color, lift: float) -> void:
	for i in range(points.size() - 1):
		var a: Vector2 = points[i]
		var b: Vector2 = points[i + 1]
		var delta := b - a
		var length := delta.length()
		var mid := (a + b) * 0.5
		var yaw := atan2(delta.x, delta.y)
		_make_visual_box(Vector3(width, 0.08, length + 0.3), Vector3(mid.x, lift, mid.y), color, Vector3(0, yaw, 0))

func _add_center_lines(points: Array) -> void:
	for i in range(points.size() - 1):
		var a: Vector2 = points[i]
		var b: Vector2 = points[i + 1]
		var delta := b - a
		var length := delta.length()
		if length < 3.0:
			continue
		var dir := delta.normalized()
		var count := maxi(1, int(length / 8.0))
		for n in range(count):
			if n % 2 == 1:
				continue
			var t := (float(n) + 0.5) / float(count)
			var p := a.lerp(b, t)
			var dash_len := minf(3.6, length / float(count) * 0.72)
			var yaw := atan2(dir.x, dir.y)
			_make_visual_box(Vector3(0.22, 0.045, dash_len), Vector3(p.x, 0.135, p.y), Color("#9b8156"), Vector3(0, yaw, 0), false, true)

func _build_neighborhood() -> void:
	var houses := [
		[7,13,1],[38,13,2],[71,13,1],
		[7,25,2],[38,25,1],[71,25,2],
		[7,48,2],[38,48,1],[71,48,2],
		[7,60,1],[38,60,2],[71,60,1],
	]
	for entry in houses:
		_add_house(float(entry[0]), float(entry[1]), int(entry[2]))

func _add_house(x: float, z: float, floors: int) -> void:
	var height := 3.0 * floors + 0.2
	var body := _make_static_box("House", Vector3(x, height * 0.5, z), Vector3(8.4, height, 8.2), Color("#5b554e"))
	_add_box_visual(body, Vector3(9.0, 0.35, 8.8), Vector3(0, height * 0.5 + 0.18, 0), Color("#252322"))
	_add_box_visual(body, Vector3(1.15, 2.05, 0.18), Vector3(0, -height * 0.5 + 1.04, -4.18), Color("#29231f"))
	for wx in [-2.45, 2.45]:
		for floor_index in range(floors):
			_add_box_visual(body, Vector3(1.15, 1.25, 0.12), Vector3(float(wx), -height * 0.5 + 1.8 + floor_index * 3.0, -4.2), Color("#202728"), Vector3.ZERO, true)
	_add_box_visual(body, Vector3(8.6, 0.18, 1.35), Vector3(0, -height * 0.5 + 0.16, -4.55), Color("#6b6258"))

func _build_tower_block() -> void:
	_add_closed_building(Vector3(48,0,91), Vector3(14,15.8,13), "CIVIC HOTEL", Color("#563127"))
	_add_closed_building(Vector3(66,0,91), Vector3(14,18.8,12), "TOWER HOUSE", Color("#55504a"))
	_add_closed_building(Vector3(96,0,91), Vector3(9,12.8,13), "CITY ROOMS", Color("#4b5550"))
	_add_water_tower()

func _add_water_tower() -> void:
	var root := Node3D.new()
	root.name = "WaterTower"
	root.position = Vector3(WATER_TOWER.x, 0, WATER_TOWER.y)
	add_child(root)
	for offset in [Vector2(-2.4,-2.4),Vector2(2.4,-2.4),Vector2(-2.4,2.4),Vector2(2.4,2.4)]:
		_add_box_visual(root, Vector3(0.42, 17.0, 0.42), Vector3(offset.x, 8.5, offset.y), Color("#343739"))
	var tank := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = 4.5
	mesh.bottom_radius = 4.5
	mesh.height = 6.0
	mesh.radial_segments = 12
	tank.mesh = mesh
	tank.position.y = 18.5
	tank.material_override = _mat(Color("#4b4f50"), 0.72, 0.55)
	root.add_child(tank)
	var cone := MeshInstance3D.new()
	var cone_mesh := CylinderMesh.new()
	cone_mesh.top_radius = 0.3
	cone_mesh.bottom_radius = 4.5
	cone_mesh.height = 2.2
	cone_mesh.radial_segments = 12
	cone.mesh = cone_mesh
	cone.position.y = 22.6
	cone.material_override = _mat(Color("#292c2c"), 0.82, 0.45)
	root.add_child(cone)
	_add_label(root, "DEADWATER", Vector3(0,18.7,-4.58), 44, Color("#c6b59d"))

func _build_bar_and_fuel() -> void:
	_add_enterable_box(Vector3(BAR.x,0,BAR.y), Vector3(16,6.4,13), "THE ANCHOR BAR", Color("#53352b"), 2.4)
	# Reachable second-floor balcony and a broad ramp preserve the jump/balcony play space.
	_make_static_box("BarBalcony", Vector3(BAR.x,3.25,BAR.y-7.7), Vector3(17.0,0.25,2.2), Color("#50443a"))
	var ramp := _make_static_box("BarRamp", Vector3(BAR.x+8.8,1.6,BAR.y-5.6), Vector3(2.4,0.22,8.0), Color("#4a4038"))
	ramp.rotation.z = deg_to_rad(-20.0)

	var fuel_root := Node3D.new()
	fuel_root.name = "FuelStation"
	fuel_root.position = Vector3(FUEL_STATION.x,0,FUEL_STATION.y)
	add_child(fuel_root)
	_add_box_visual(fuel_root, Vector3(18,0.45,9), Vector3(0,4.4,0), Color("#3b3d3b"))
	for p in [Vector3(-7,2.2,-3),Vector3(7,2.2,-3),Vector3(-7,2.2,3),Vector3(7,2.2,3)]:
		_add_box_visual(fuel_root, Vector3(0.45,4.4,0.45), p, Color("#343536"))
	for px in [-3.1,3.1]:
		var pump := _make_static_box("FuelPump", Vector3(FUEL_STATION.x+px,1.0,FUEL_STATION.y), Vector3(1.0,2.0,0.9), Color("#5f3024"))
		_add_box_visual(pump, Vector3(0.58,0.5,0.08), Vector3(0,0.35,-0.49), Color("#d3b58e"), Vector3.ZERO, true)
	_add_label(fuel_root, "FUEL • 300 PTS", Vector3(0,4.55,-4.6), 38, Color("#d3b58e"))

func _build_hospital() -> void:
	# H-shaped St. Agnes campus within the original 76 x 46 footprint.
	_add_hospital_wing(Vector3(149,0,106), Vector3(18,7.0,42), "WARD A")
	_add_hospital_wing(Vector3(203,0,106), Vector3(18,7.0,42), "WARD B")
	_add_hospital_wing(Vector3(176,0,106), Vector3(36,7.8,13), "ADMINISTRATION")
	# Emergency apron / canopy faces Main Street.
	_make_visual_box(Vector3(33,0.08,13), Vector3(190,0.10,80.5), Color("#4a4742"))
	var canopy_root := Node3D.new()
	canopy_root.position = Vector3(195,0,83)
	add_child(canopy_root)
	_add_box_visual(canopy_root, Vector3(15,0.34,6), Vector3(0,3.65,0), Color("#3c3e3e"))
	for x in [-6.0,6.0]:
		_add_box_visual(canopy_root, Vector3(0.35,3.5,0.35), Vector3(x,1.75,-2.3), Color("#393b3b"))
	_add_label(canopy_root, "EMERGENCY", Vector3(0,4.0,-3.15), 40, Color("#b95943"))

func _add_hospital_wing(pos: Vector3, size: Vector3, label_text: String) -> void:
	_add_enterable_box(pos, size, label_text, Color("#5a5751"), 2.7)

func _build_factories_and_forge() -> void:
	_add_enterable_box(Vector3(21,0,148), Vector3(24,8.8,18), "MERCER MACHINE", Color("#50433b"), 4.2)
	_add_enterable_box(Vector3(54,0,127), Vector3(25,8.0,18), "ASHFALL TOOL", Color("#4a4640"), 4.2)
	var forge := _make_static_box("WeaponForge", Vector3(FORGE.x,1.1,FORGE.y), Vector3(2.2,2.2,1.5), Color("#292c2c"))
	_add_box_visual(forge, Vector3(1.4,0.18,0.10), Vector3(0,0.25,-0.82), Color("#b56532"), Vector3.ZERO, true)
	_add_label(forge, "FORGE", Vector3(0,0.75,-0.84), 28, Color("#e0b17b"))

func _build_shopping_district() -> void:
	_add_closed_building(Vector3(147,0,150), Vector3(14,12.8,11), "ALDER DEPT", Color("#563127"))
	_add_enterable_box(Vector3(166,0,150), Vector3(15,12.8,11), "FIVE & DIME", Color("#4b5550"), 2.3)
	_add_enterable_box(Vector3(196,0,150), Vector3(17,12.8,11), "NORTH MARKET", Color("#55504a"), 2.4)
	_add_closed_building(Vector3(147,0,181), Vector3(14,15.8,13), "MILLER BLOCK", Color("#55504a"))
	_add_closed_building(Vector3(166,0,181), Vector3(15,12.8,13), "GRAYSON STORE", Color("#563127"))
	_add_enterable_box(Vector3(196,0,181), Vector3(17,12.8,13), "CROWN OUTFITTERS", Color("#4b5550"), 2.4)
	for alley_x in [156.5,181.0]:
		_make_visual_box(Vector3(2.5,0.05,55), Vector3(alley_x,0.105,166), Color("#55504a"))

func _build_forest() -> void:
	# The southeast forest remains non-traversable. The collision volume stops at z=69,
	# leaving Main Street clear exactly as the stable plan does.
	var forest_wall := StaticBody3D.new()
	forest_wall.name = "ImpassableForest"
	forest_wall.position = Vector3(163,2.0,35)
	var forest_shape := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(112,4.0,68)
	forest_shape.shape = shape
	forest_wall.add_child(forest_shape)
	add_child(forest_wall)

	for x in range(111, 219, 7):
		for z in range(6, 68, 7):
			if _rng.randf() < 0.24:
				continue
			_add_dead_tree(Vector3(x + _rng.randf_range(-2.3,2.3),0,z + _rng.randf_range(-2.3,2.3)), _rng.randf_range(0.75,1.35), _rng.randf() < 0.18)
	# Low ember haze, kept subtle so the post-blast world reads gray rather than actively exploding.
	for i in range(18):
		var p := Vector3(_rng.randf_range(118,214),0.18,_rng.randf_range(8,64))
		var ember := MeshInstance3D.new()
		var ember_mesh := SphereMesh.new()
		ember_mesh.radius = _rng.randf_range(0.08,0.18)
		ember_mesh.height = ember_mesh.radius * 2.0
		ember.mesh = ember_mesh
		ember.position = p
		ember.material_override = _mat(Color("#75402c"), 0.8, 0.0, true)
		add_child(ember)

func _add_dead_tree(pos: Vector3, scale_value: float, scorched: bool) -> void:
	var root := Node3D.new()
	root.position = pos
	root.scale = Vector3.ONE * scale_value
	add_child(root)
	var trunk_color := Color("#272725") if scorched else Color("#3d3a34")
	var trunk := MeshInstance3D.new()
	var trunk_mesh := CylinderMesh.new()
	trunk_mesh.top_radius = 0.20
	trunk_mesh.bottom_radius = 0.42
	trunk_mesh.height = 5.8
	trunk_mesh.radial_segments = 6
	trunk.mesh = trunk_mesh
	trunk.position.y = 2.9
	trunk.material_override = _mat(trunk_color, 1.0)
	root.add_child(trunk)
	for y in [4.2,5.2,6.0]:
		var crown := MeshInstance3D.new()
		var crown_mesh := SphereMesh.new()
		crown_mesh.radius = 1.2
		crown_mesh.height = 1.6
		crown_mesh.radial_segments = 6
		crown_mesh.rings = 4
		crown.mesh = crown_mesh
		crown.position = Vector3(_rng.randf_range(-0.5,0.5), y, _rng.randf_range(-0.4,0.4))
		crown.material_override = _mat(Color("#2f302a") if not scorched else Color("#1e1f1d"), 1.0)
		root.add_child(crown)

func _build_fallout_horizon() -> void:
	# Dark, static Castle Romeo aftermath: hills plus a dissipating grayscale plume.
	for i in range(13):
		var hill := MeshInstance3D.new()
		var mesh := SphereMesh.new()
		mesh.radius = _rng.randf_range(10.0,18.0)
		mesh.height = _rng.randf_range(11.0,20.0)
		mesh.radial_segments = 8
		mesh.rings = 5
		hill.mesh = mesh
		hill.scale = Vector3(1.7,0.75,0.9)
		hill.position = Vector3(FALLOUT_HILLS.x + i * 11.0 + _rng.randf_range(-3,3), _rng.randf_range(1.5,4.0), FALLOUT_HILLS.y + _rng.randf_range(-5,8))
		hill.material_override = _mat(Color("#444441"), 1.0)
		add_child(hill)

	var plume := Node3D.new()
	plume.name = "CastleRomeoPlume"
	plume.position = Vector3(CLOUD.x,0,CLOUD.y)
	add_child(plume)
	var cloud_mat := _mat(Color("#5a5b59"), 1.0)
	for y in [10.0,16.0,22.0,28.0,34.0,40.0]:
		for n in range(3):
			_add_cloud_lobe(plume, Vector3(_rng.randf_range(-3.5,3.5),y,_rng.randf_range(-2.5,2.5)), _rng.randf_range(3.6,5.8), cloud_mat)
	for n in range(22):
		var angle := TAU * float(n) / 22.0
		var radius := _rng.randf_range(8.0,18.0)
		_add_cloud_lobe(plume, Vector3(cos(angle)*radius,42.0+_rng.randf_range(-4,5),sin(angle)*radius*0.62), _rng.randf_range(5.5,9.5), cloud_mat)
	for n in range(13):
		var angle2 := TAU * float(n) / 13.0
		_add_cloud_lobe(plume, Vector3(cos(angle2)*_rng.randf_range(5,12),50.0+_rng.randf_range(-2,6),sin(angle2)*_rng.randf_range(4,9)), _rng.randf_range(5.0,8.0), cloud_mat)

func _add_cloud_lobe(parent: Node3D, pos: Vector3, radius: float, material: Material) -> void:
	var lobe := MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = radius * 1.55
	mesh.radial_segments = 8
	mesh.rings = 5
	lobe.mesh = mesh
	lobe.position = pos
	lobe.material_override = material
	parent.add_child(lobe)

func _build_barricades_and_bounds() -> void:
	# Four outward roads remain physically barricaded in the Town-only build.
	_add_gate(Vector3(-8,0,72), 12.5, PI/2.0)
	_add_gate(Vector3(216,0,72), 12.5, PI/2.0)
	_add_gate(Vector3(-8,0,188), 12.0, -0.73)
	_add_gate(Vector3(219,0,136), 11.0, PI/2.0)
	_add_gate(Vector3(219,0,166), 11.0, PI/2.0)

	# Invisible outer rails keep the player in the frozen Town footprint.
	_make_invisible_wall(Vector3(-14.7,2.0,99), Vector3(1.2,4.0,202))
	_make_invisible_wall(Vector3(222.7,2.0,99), Vector3(1.2,4.0,202))
	_make_invisible_wall(Vector3(104,2.0,-0.7), Vector3(240,4.0,1.2))
	_make_invisible_wall(Vector3(104,2.0,198.7), Vector3(240,4.0,1.2))

func _add_gate(pos: Vector3, width: float, yaw: float) -> void:
	var body := _make_static_box("RoadBarricade", Vector3(pos.x,0.75,pos.z), Vector3(width,1.5,0.9), Color("#5b3024"))
	body.rotation.y = yaw
	for x in [-width*0.3,width*0.3]:
		_add_box_visual(body, Vector3(0.22,2.1,0.22), Vector3(float(x),0.25,0), Color("#292625"))

func _build_street_clutter() -> void:
	# Cars, ambulances, traffic posts and debris give the exact road plan useful cover.
	_add_vehicle_prop(Vector3(102,0,68), 0.12, Color("#565a58"))
	_add_vehicle_prop(Vector3(123,0,77), -0.8, Color("#704136"))
	_add_vehicle_prop(Vector3(154,0,81), 1.3, Color("#d0cec5"), true)
	_add_vehicle_prop(Vector3(184,0,81), 1.45, Color("#d0cec5"), true)
	_add_vehicle_prop(Vector3(76,0,139), -0.7, Color("#3f4445"))
	for p in [Vector3(86,0,72),Vector3(132,0,72),Vector3(86,0,136),Vector3(132,0,166)]:
		_add_traffic_post(p + Vector3(4.2,0,4.2))
	for i in range(24):
		var p2 := Vector3(_rng.randf_range(0,210),0.18,_rng.randf_range(78,190))
		_make_visual_box(Vector3(_rng.randf_range(0.3,1.2),_rng.randf_range(0.12,0.35),_rng.randf_range(0.3,1.3)), p2, Color("#47433d"), Vector3(0,_rng.randf_range(0,TAU),0))

func _add_vehicle_prop(pos: Vector3, yaw: float, color: Color, ambulance := false) -> void:
	var body := _make_static_box("Vehicle", Vector3(pos.x,0.75,pos.z), Vector3(4.3,1.45,1.9), color)
	body.rotation.y = yaw
	_add_box_visual(body, Vector3(2.2,0.9,1.75), Vector3(-0.25,0.75,0), color.lightened(0.06))
	for x in [-1.45,1.45]:
		for z in [-0.88,0.88]:
			_add_box_visual(body, Vector3(0.55,0.55,0.30), Vector3(float(x),-0.62,float(z)), Color("#171818"))
	if ambulance:
		_add_box_visual(body, Vector3(0.12,0.8,0.9), Vector3(0,0.15,-0.97), Color("#8b3129"))
		_add_box_visual(body, Vector3(0.9,0.12,0.9), Vector3(0,0.15,-0.97), Color("#8b3129"))

func _add_traffic_post(pos: Vector3) -> void:
	var root := Node3D.new()
	root.position = pos
	add_child(root)
	_add_box_visual(root, Vector3(0.18,3.2,0.18), Vector3(0,1.6,0), Color("#262728"))
	_add_box_visual(root, Vector3(0.65,1.4,0.52), Vector3(0,3.05,0), Color("#1e2020"))
	for y in [2.72,3.05,3.38]:
		var lens_color := Color("#4a302b") if y < 3.3 else Color("#4b4730")
		_add_box_visual(root, Vector3(0.26,0.22,0.08), Vector3(0,float(y),-0.30), lens_color, Vector3.ZERO, true)

func _add_closed_building(pos: Vector3, size: Vector3, label_text: String, color: Color) -> void:
	var body := _make_static_box(label_text, Vector3(pos.x,size.y*0.5,pos.z), size, color)
	_add_box_visual(body, Vector3(size.x+0.6,0.35,size.z+0.6), Vector3(0,size.y*0.5+0.18,0), Color("#252627"))
	for floor_y in range(2, int(size.y)-1, 3):
		for x in [-size.x*0.28,0.0,size.x*0.28]:
			_add_box_visual(body, Vector3(1.15,1.25,0.12), Vector3(float(x),-size.y*0.5+floor_y,-size.z*0.5-0.08), Color("#202729"), Vector3.ZERO, true)
	_add_label(body, label_text, Vector3(0,-size.y*0.5+2.4,-size.z*0.5-0.18), 34, Color("#d9c7ae"))

func _add_enterable_box(pos: Vector3, size: Vector3, label_text: String, color: Color, door_width: float) -> void:
	var root := Node3D.new()
	root.name = label_text.validate_node_name()
	root.position = pos
	add_child(root)
	var wall_thickness := 0.34
	_make_static_box_local(root, "Floor", Vector3(0,0.12,0), Vector3(size.x,0.24,size.z), Color("#45413b"))
	_make_static_box_local(root, "BackWall", Vector3(0,size.y*0.5,size.z*0.5), Vector3(size.x,size.y,wall_thickness), color)
	_make_static_box_local(root, "LeftWall", Vector3(-size.x*0.5,size.y*0.5,0), Vector3(wall_thickness,size.y,size.z), color)
	_make_static_box_local(root, "RightWall", Vector3(size.x*0.5,size.y*0.5,0), Vector3(wall_thickness,size.y,size.z), color)
	var side_width := (size.x - door_width) * 0.5
	_make_static_box_local(root, "FrontLeft", Vector3(-(door_width+side_width)*0.5,size.y*0.5,-size.z*0.5), Vector3(side_width,size.y,wall_thickness), color)
	_make_static_box_local(root, "FrontRight", Vector3((door_width+side_width)*0.5,size.y*0.5,-size.z*0.5), Vector3(side_width,size.y,wall_thickness), color)
	_make_static_box_local(root, "DoorHeader", Vector3(0,size.y-0.65,-size.z*0.5), Vector3(door_width,1.3,wall_thickness), color)
	_make_static_box_local(root, "Roof", Vector3(0,size.y,0), Vector3(size.x+0.3,0.25,size.z+0.3), Color("#272828"))
	_add_label(root, label_text, Vector3(0,size.y-1.35,-size.z*0.5-0.22), 32, Color("#d9c7ae"))

func _make_static_box(name_text: String, pos: Vector3, size: Vector3, color: Color) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.name = name_text.validate_node_name()
	body.position = pos
	add_child(body)
	var shape_node := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	shape_node.shape = shape
	body.add_child(shape_node)
	_add_box_visual(body, size, Vector3.ZERO, color)
	return body

func _make_static_box_local(parent: Node3D, name_text: String, pos: Vector3, size: Vector3, color: Color) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.name = name_text
	body.position = pos
	parent.add_child(body)
	var shape_node := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	shape_node.shape = shape
	body.add_child(shape_node)
	_add_box_visual(body, size, Vector3.ZERO, color)
	return body

func _make_invisible_wall(pos: Vector3, size: Vector3) -> void:
	var body := StaticBody3D.new()
	body.position = pos
	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collision.shape = shape
	body.add_child(collision)
	add_child(body)

func _make_visual_box(size: Vector3, pos: Vector3, color: Color, rotation_value := Vector3.ZERO, emissive := false, unshaded := false) -> MeshInstance3D:
	var mesh_instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh_instance.mesh = mesh
	mesh_instance.position = pos
	mesh_instance.rotation = rotation_value
	mesh_instance.material_override = _mat(color, 0.94, 0.0, emissive, unshaded)
	add_child(mesh_instance)
	return mesh_instance

func _add_box_visual(parent: Node3D, size: Vector3, pos: Vector3, color: Color, rotation_value := Vector3.ZERO, emissive := false) -> MeshInstance3D:
	var mesh_instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh_instance.mesh = mesh
	mesh_instance.position = pos
	mesh_instance.rotation = rotation_value
	mesh_instance.material_override = _mat(color, 0.94, 0.0, emissive)
	parent.add_child(mesh_instance)
	return mesh_instance

func _add_label(parent: Node3D, text_value: String, pos: Vector3, font_size: int, color: Color) -> void:
	var label := Label3D.new()
	label.text = text_value
	label.font_size = font_size
	label.outline_size = 7
	label.modulate = color
	label.position = pos
	label.billboard = BaseMaterial3D.BILLBOARD_DISABLED
	parent.add_child(label)

func _mat(color: Color, roughness := 0.95, metalness := 0.0, emissive := false, unshaded := false) -> StandardMaterial3D:
	var key := "%s/%0.2f/%0.2f/%s/%s" % [color.to_html(), roughness, metalness, emissive, unshaded]
	if _materials.has(key):
		return _materials[key]
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	material.metallic = metalness
	if emissive:
		material.emission_enabled = true
		material.emission = color * 0.8
	if unshaded:
		material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_materials[key] = material
	return material
