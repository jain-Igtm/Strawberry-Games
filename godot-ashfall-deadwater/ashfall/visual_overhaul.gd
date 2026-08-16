extends Node3D

# High-density presentation pass layered over the stable Dock Town geometry.
# It intentionally avoids changing gameplay collision/layout so the proven build remains intact.

var _rng := RandomNumberGenerator.new()
var _root: Node
var _player: Node3D
var _lamp_lights: Array[OmniLight3D] = []
var _weapon_probe_left := 0.0
var _flicker_time := 0.0
var _materials: Dictionary = {}

const ASPHALT_DARK := Color("#16181a")
const GRIME := Color("#242526")
const CONCRETE := Color("#575651")
const STEEL := Color("#2d3235")
const RUST := Color("#633a2c")
const GLASS := Color("#263238")
const WARM := Color("#db8f55")
const BLOOD := Color("#391917")

func _ready() -> void:
	_rng.seed = 920441
	set_process(false)
	call_deferred("_boot")

func _boot() -> void:
	await get_tree().process_frame
	await get_tree().process_frame
	_root = get_parent()
	if not is_instance_valid(_root):
		return
	_root.child_entered_tree.connect(_on_root_child_entered)
	_retune_environment()
	_build_ground_detail()
	_build_street_furniture()
	_build_facade_pass()
	_build_hospital_pass()
	_build_industrial_pass()
	_build_waterfront_identity()
	_build_background_silhouette()
	_build_ashfall()
	for child in _root.get_children():
		_defer_possible_zombie(child)
	set_process(true)

func _process(delta: float) -> void:
	_flicker_time += delta
	_weapon_probe_left -= delta
	if _weapon_probe_left <= 0.0:
		_weapon_probe_left = 0.28
		_find_player_and_upgrade_weapon()
	for index in range(_lamp_lights.size()):
		var light: OmniLight3D = _lamp_lights[index]
		if not is_instance_valid(light):
			continue
		var noise_value := sin(_flicker_time * (4.8 + float(index) * 0.19) + float(index) * 2.13)
		light.light_energy = 1.15 + noise_value * 0.08

func _on_root_child_entered(node: Node) -> void:
	_defer_possible_zombie(node)

func _defer_possible_zombie(node: Node) -> void:
	if node != null and node.has_method("take_bullet") and node.has_method("_avoid_obstacles"):
		call_deferred("_decorate_zombie", node)

func _retune_environment() -> void:
	for node in _root.get_children():
		if node is WorldEnvironment:
			var env_node := node as WorldEnvironment
			if env_node.environment != null:
				var env := env_node.environment
				env.background_mode = Environment.BG_COLOR
				env.background_color = Color("#161b1e")
				env.ambient_light_color = Color("#929a9b")
				env.ambient_light_energy = 0.82
				env.fog_enabled = true
				env.fog_light_color = Color("#5d6263")
				env.fog_density = 0.0105
	for node in _root.get_children():
		if node is DirectionalLight3D:
			var sun := node as DirectionalLight3D
			if sun.shadow_enabled:
				sun.light_color = Color("#aeb8ba")
				sun.light_energy = 0.92
				sun.directional_shadow_max_distance = 125.0

func _build_ground_detail() -> void:
	# Street scars, patched asphalt, oil, rubble and blast dust break the flat prototype surfaces.
	for i in range(88):
		var p := _random_street_position()
		var length := _rng.randf_range(0.7, 2.8)
		var yaw := _rng.randf_range(0.0, TAU)
		_box(self, Vector3(0.055, 0.012, length), p + Vector3(0, 0.147, 0), ASPHALT_DARK, Vector3(0, yaw, 0), 1.0, 0.0)
		if i % 3 == 0:
			_box(self, Vector3(0.038, 0.010, length * 0.55), p + Vector3(cos(yaw) * 0.28, 0.151, sin(yaw) * 0.28), Color("#0d0e0f"), Vector3(0, yaw + _rng.randf_range(-0.8, 0.8), 0), 1.0, 0.0)
	for i in range(20):
		var stain_pos := _random_street_position()
		var disc := MeshInstance3D.new()
		var disc_mesh := CylinderMesh.new()
		disc_mesh.top_radius = _rng.randf_range(0.45, 1.4)
		disc_mesh.bottom_radius = disc_mesh.top_radius * _rng.randf_range(0.72, 1.0)
		disc_mesh.height = 0.018
		disc_mesh.radial_segments = 12
		disc.mesh = disc_mesh
		disc.position = stain_pos + Vector3(0, 0.145, 0)
		disc.scale = Vector3(_rng.randf_range(0.7, 1.5), 1.0, _rng.randf_range(0.55, 1.0))
		disc.material_override = _mat(Color(0.05, 0.055, 0.058, 0.78), 0.42, 0.0, false, true)
		disc.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(disc)
	for i in range(46):
		var debris_pos := Vector3(_rng.randf_range(-3.0, 214.0), 0.24, _rng.randf_range(77.0, 190.0))
		var debris_size := Vector3(_rng.randf_range(0.12, 0.62), _rng.randf_range(0.08, 0.30), _rng.randf_range(0.16, 0.75))
		_box(self, debris_size, debris_pos, Color("#3d3a36").lerp(RUST, _rng.randf_range(0.0, 0.28)), Vector3(_rng.randf_range(-0.25, 0.25), _rng.randf_range(0.0, TAU), _rng.randf_range(-0.2, 0.2)), 0.95, 0.05)
	_build_blast_crater(Vector3(127, 0.16, 154), 2.4)
	_build_blast_crater(Vector3(34, 0.16, 171), 1.9)
	_build_blast_crater(Vector3(171, 0.16, 132), 1.6)

func _random_street_position() -> Vector3:
	var lanes := [72.0, 136.0, 166.0]
	if _rng.randf() < 0.52:
		return Vector3(_rng.randf_range(-5.0, 216.0), 0.0, lanes[_rng.randi_range(0, lanes.size() - 1)] + _rng.randf_range(-3.6, 3.6))
	var verticals := [86.0, 132.0]
	return Vector3(verticals[_rng.randi_range(0, verticals.size() - 1)] + _rng.randf_range(-3.0, 3.0), 0.0, _rng.randf_range(5.0, 188.0))

func _build_blast_crater(pos: Vector3, radius: float) -> void:
	var center := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius * 0.88
	mesh.height = 0.045
	mesh.radial_segments = 18
	center.mesh = mesh
	center.position = pos
	center.scale = Vector3(1.0, 1.0, 0.72)
	center.material_override = _mat(Color("#101213"), 0.98)
	center.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(center)
	for n in range(13):
		var angle := TAU * float(n) / 13.0 + _rng.randf_range(-0.12, 0.12)
		var r := radius * _rng.randf_range(0.82, 1.18)
		_box(self, Vector3(_rng.randf_range(0.28, 0.75), _rng.randf_range(0.18, 0.42), _rng.randf_range(0.30, 0.86)), pos + Vector3(cos(angle) * r, 0.20, sin(angle) * r * 0.72), Color("#47423c"), Vector3(_rng.randf_range(-0.35, 0.35), angle, _rng.randf_range(-0.28, 0.28)), 0.95, 0.0)

func _build_street_furniture() -> void:
	var poles := [
		Vector3(15,0,76), Vector3(48,0,76), Vector3(81,0,76), Vector3(116,0,76), Vector3(152,0,76), Vector3(188,0,76),
		Vector3(90,0,22), Vector3(90,0,112), Vector3(90,0,157), Vector3(136,0,111), Vector3(136,0,154), Vector3(136,0,184)
	]
	for i in range(poles.size()):
		_add_street_lamp(poles[i], i % 3 == 0)
	var power_poles := [Vector3(4,0,39), Vector3(31,0,39), Vector3(61,0,39), Vector3(99,0,139), Vector3(126,0,139), Vector3(159,0,139), Vector3(191,0,139)]
	for pole_pos in power_poles:
		_add_power_pole(pole_pos)
	for i in range(power_poles.size() - 1):
		if power_poles[i].distance_to(power_poles[i + 1]) < 40.0:
			_add_wire(power_poles[i] + Vector3(0, 6.0, 0), power_poles[i + 1] + Vector3(0, 6.0, 0))
	_add_bus_shelter(Vector3(118,0,75.2))
	_add_bus_shelter(Vector3(164,0,139.3))
	_add_evacuate_sign(Vector3(84.2,0,96), -PI/2.0, "EVACUATION\nNORTH")
	_add_evacuate_sign(Vector3(130.2,0,151), PI/2.0, "SHELTER\nST. AGNES")
	for p in [Vector3(27,0,78), Vector3(58,0,78), Vector3(144,0,139), Vector3(207,0,139), Vector3(96,0,169)]:
		_add_trash_cluster(p)

func _add_street_lamp(pos: Vector3, live_light: bool) -> void:
	var root := Node3D.new()
	root.position = pos
	add_child(root)
	_cylinder(root, 0.12, 0.16, 5.4, Vector3(0, 2.7, 0), STEEL, 0.72, 0.65, 8)
	_box(root, Vector3(1.15, 0.10, 0.12), Vector3(0.48, 5.26, 0), STEEL, Vector3.ZERO, 0.72, 0.65)
	_box(root, Vector3(0.44, 0.13, 0.28), Vector3(1.0, 5.18, 0), Color("#d6b56f"), Vector3.ZERO, 0.5, 0.05, true)
	if live_light:
		var light := OmniLight3D.new()
		light.position = Vector3(1.0, 4.9, 0)
		light.light_color = Color("#e8ba76")
		light.light_energy = 1.15
		light.omni_range = 10.5
		light.shadow_enabled = false
		root.add_child(light)
		_lamp_lights.append(light)

func _add_power_pole(pos: Vector3) -> void:
	var root := Node3D.new()
	root.position = pos
	add_child(root)
	_cylinder(root, 0.18, 0.25, 6.2, Vector3(0, 3.1, 0), Color("#3a342e"), 1.0, 0.0, 7)
	_box(root, Vector3(2.5, 0.18, 0.18), Vector3(0, 5.75, 0), Color("#332e29"), Vector3.ZERO, 1.0, 0.0)
	for x in [-0.9, 0.0, 0.9]:
		_cylinder(root, 0.08, 0.08, 0.32, Vector3(float(x), 6.0, 0), Color("#6f6b61"), 0.65, 0.18, 8)

func _add_wire(a: Vector3, b: Vector3) -> void:
	var mid := (a + b) * 0.5
	var sag := Vector3(0, -0.55, 0)
	_add_wire_segment(a, mid + sag)
	_add_wire_segment(mid + sag, b)

func _add_wire_segment(a: Vector3, b: Vector3) -> void:
	var delta := b - a
	var length := delta.length()
	if length <= 0.01:
		return
	var wire := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = 0.022
	mesh.bottom_radius = 0.022
	mesh.height = length
	mesh.radial_segments = 5
	wire.mesh = mesh
	wire.position = (a + b) * 0.5
	wire.material_override = _mat(Color("#17191a"), 0.75, 0.62)
	wire.quaternion = Quaternion(Vector3.UP, delta.normalized())
	wire.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(wire)

func _add_bus_shelter(pos: Vector3) -> void:
	var root := Node3D.new()
	root.position = pos
	add_child(root)
	_box(root, Vector3(4.6,0.16,1.8), Vector3(0,2.35,0), STEEL, Vector3.ZERO, 0.7, 0.62)
	for x in [-2.15,2.15]:
		_box(root, Vector3(0.14,2.4,0.14), Vector3(float(x),1.2,0), STEEL, Vector3.ZERO, 0.7, 0.62)
	_box(root, Vector3(4.15,0.16,0.56), Vector3(0,0.78,0.55), Color("#494642"), Vector3.ZERO, 0.95, 0.0)
	_box(root, Vector3(4.15,1.75,0.045), Vector3(0,1.35,0.86), Color(0.17,0.22,0.24,0.48), Vector3.ZERO, 0.22, 0.02, false, true)

func _add_evacuate_sign(pos: Vector3, yaw: float, text_value: String) -> void:
	var root := Node3D.new()
	root.position = pos
	root.rotation.y = yaw
	add_child(root)
	_box(root, Vector3(0.10,2.2,0.10), Vector3(0,1.1,0), STEEL, Vector3.ZERO, 0.78, 0.55)
	_box(root, Vector3(1.55,0.82,0.09), Vector3(0,2.05,0), Color("#35433d"), Vector3.ZERO, 0.62, 0.18)
	var label := Label3D.new()
	label.text = text_value
	label.font_size = 22
	label.outline_size = 5
	label.position = Vector3(0,2.05,-0.06)
	label.modulate = Color("#d9d1bc")
	root.add_child(label)

func _add_trash_cluster(pos: Vector3) -> void:
	for n in range(3):
		var offset := Vector3(_rng.randf_range(-0.8,0.8),0.28,_rng.randf_range(-0.6,0.6))
		_cylinder(self, 0.24, 0.27, 0.56, pos + offset, Color("#35393a"), 0.72, 0.58, 10)
	for n in range(4):
		_box(self, Vector3(_rng.randf_range(0.22,0.52),0.08,_rng.randf_range(0.26,0.65)), pos + Vector3(_rng.randf_range(-1.3,1.3),0.12,_rng.randf_range(-0.8,0.8)), Color("#45423c"), Vector3(0,_rng.randf_range(0,TAU),0), 0.96, 0.0)

func _build_facade_pass() -> void:
	# Towers and commercial blocks get depth layers, frames, boarded apertures and roof equipment.
	_add_facade(Vector3(48,0,84.42), 14.0, 15.8, 5, Color("#6a3c31"), "CIVIC HOTEL")
	_add_facade(Vector3(66,0,84.92), 14.0, 18.8, 6, Color("#68635d"), "TOWER HOUSE")
	_add_facade(Vector3(96,0,84.42), 9.0, 12.8, 4, Color("#58645f"), "CITY ROOMS")
	_add_facade(Vector3(147,0,144.42), 14.0, 12.8, 4, Color("#6b3d31"), "ALDER")
	_add_facade(Vector3(166,0,144.42), 15.0, 12.8, 4, Color("#596763"), "FIVE & DIME")
	_add_facade(Vector3(196,0,144.42), 17.0, 12.8, 4, Color("#67625b"), "NORTH MARKET")
	_add_facade(Vector3(147,0,174.42), 14.0, 15.8, 5, Color("#625d57"), "MILLER BLOCK")
	_add_facade(Vector3(166,0,174.42), 15.0, 12.8, 4, Color("#6a3c31"), "GRAYSON")
	_add_facade(Vector3(196,0,174.42), 17.0, 12.8, 4, Color("#58645f"), "CROWN OUTFITTERS")
	_build_bar_details()
	_build_fuel_details()

func _add_facade(origin: Vector3, width: float, height: float, rows: int, trim_color: Color, sign_text: String) -> void:
	var root := Node3D.new()
	root.position = origin
	add_child(root)
	_box(root, Vector3(width + 0.18,0.26,0.28), Vector3(0,height-0.34,0), trim_color.darkened(0.35), Vector3.ZERO, 0.86, 0.08)
	for row in range(rows):
		var y := 2.05 + float(row) * 2.55
		if y > height - 0.85:
			continue
		var cols := maxi(2, int(width / 3.1))
		for col in range(cols):
			var x := -width * 0.5 + 1.45 + float(col) * ((width - 2.9) / maxf(1.0,float(cols - 1)))
			var boarded := ((row * 7 + col * 3 + int(origin.x)) % 11) == 0
			_add_window(root, Vector3(x,y,-0.02), boarded)
	for x in [-width*0.48, width*0.48]:
		_box(root, Vector3(0.22,height-0.5,0.26), Vector3(float(x),height*0.5-0.1,0.02), trim_color.darkened(0.28), Vector3.ZERO, 0.84, 0.08)
	var sign := Label3D.new()
	sign.text = sign_text
	sign.font_size = 27
	sign.outline_size = 7
	sign.position = Vector3(0,1.25,-0.19)
	sign.modulate = Color("#d0bda5")
	root.add_child(sign)
	_add_roof_plant(Vector3(origin.x,0,origin.z+0.9), height, width)

func _add_window(parent: Node3D, pos: Vector3, boarded: bool) -> void:
	_box(parent, Vector3(1.42,1.34,0.10), pos, Color("#1b2225"), Vector3.ZERO, 0.2, 0.1)
	_box(parent, Vector3(1.18,1.12,0.035), pos + Vector3(0,0,-0.075), GLASS, Vector3.ZERO, 0.12, 0.22, false, true)
	_box(parent, Vector3(0.07,1.26,0.05), pos + Vector3(0,0,-0.115), Color("#35393a"), Vector3.ZERO, 0.82, 0.38)
	_box(parent, Vector3(1.28,0.07,0.05), pos + Vector3(0,0,-0.115), Color("#35393a"), Vector3.ZERO, 0.82, 0.38)
	if boarded:
		_box(parent, Vector3(1.65,0.18,0.10), pos + Vector3(0,0.18,-0.17), Color("#5b4635"), Vector3(0,0,0.20), 0.95, 0.0)
		_box(parent, Vector3(1.65,0.18,0.10), pos + Vector3(0,-0.24,-0.18), Color("#5b4635"), Vector3(0,0,-0.16), 0.95, 0.0)

func _add_roof_plant(pos: Vector3, height: float, width: float) -> void:
	var root := Node3D.new()
	root.position = Vector3(pos.x, height, pos.z)
	add_child(root)
	for x in [-width*0.20, width*0.20]:
		_box(root, Vector3(1.55,0.72,1.15), Vector3(float(x),0.38,0), Color("#404447"), Vector3.ZERO, 0.84, 0.52)
		for n in range(3):
			_box(root, Vector3(0.12,0.42,1.20), Vector3(float(x)-0.45+float(n)*0.45,0.38,-0.04), Color("#242729"), Vector3.ZERO, 0.86, 0.62)

func _build_bar_details() -> void:
	var root := Node3D.new()
	root.position = Vector3(112,0,81.44)
	add_child(root)
	_box(root, Vector3(10.2,0.42,1.15), Vector3(0,2.55,0), Color("#3a2721"), Vector3(deg_to_rad(-8),0,0), 0.92, 0.0)
	for x in [-5.8,-2.0,2.0,5.8]:
		_add_window(root, Vector3(float(x),3.6,-0.02), x == 5.8)
	var neon := Label3D.new()
	neon.text = "THE ANCHOR"
	neon.font_size = 42
	neon.outline_size = 8
	neon.position = Vector3(0,5.45,-0.30)
	neon.modulate = Color("#e48752")
	neon.outline_modulate = Color("#391d16")
	root.add_child(neon)
	_box(root, Vector3(8.6,0.12,0.12), Vector3(0,4.85,-0.18), Color("#bc5b36"), Vector3.ZERO, 0.4, 0.08, true)

func _build_fuel_details() -> void:
	var root := Node3D.new()
	root.position = Vector3(105,0,111)
	add_child(root)
	_box(root, Vector3(18.2,0.10,0.18), Vector3(0,4.12,-4.48), Color("#963f2c"), Vector3.ZERO, 0.55, 0.35, true)
	_box(root, Vector3(18.2,0.10,0.18), Vector3(0,4.12,4.48), Color("#7b372a"), Vector3.ZERO, 0.62, 0.35)
	_add_evacuate_sign(Vector3(96.8,0,115.2), 0.0, "FUEL\nRATIONED")
	for x in [-3.1,3.1]:
		_box(root, Vector3(0.20,1.20,0.18), Vector3(float(x)+0.72,1.1,0.55), Color("#17191a"), Vector3(0,0,0.22), 0.7, 0.35)

func _build_hospital_pass() -> void:
	# Stronger landmark read: illuminated cross, ambulance bay detail, windows and rooftop equipment.
	var front := Node3D.new()
	front.position = Vector3(176,0,99.35)
	add_child(front)
	for x in range(-14, 15, 4):
		_add_window(front, Vector3(float(x),3.0,-0.03), (x + 14) % 12 == 0)
		_add_window(front, Vector3(float(x),5.75,-0.03), false)
	_box(front, Vector3(7.8,0.35,0.28), Vector3(0,7.35,0), Color("#ddd5c7"), Vector3.ZERO, 0.74, 0.05)
	_box(front, Vector3(0.70,3.4,0.20), Vector3(0,9.25,-0.20), Color("#b94d3d"), Vector3.ZERO, 0.42, 0.05, true)
	_box(front, Vector3(3.4,0.70,0.20), Vector3(0,9.25,-0.21), Color("#b94d3d"), Vector3.ZERO, 0.42, 0.05, true)
	var hospital_label := Label3D.new()
	hospital_label.text = "ST. AGNES MEDICAL CENTER"
	hospital_label.font_size = 30
	hospital_label.outline_size = 8
	hospital_label.position = Vector3(0,7.95,-0.25)
	hospital_label.modulate = Color("#e5ddd0")
	front.add_child(hospital_label)
	for p in [Vector3(149,7.2,106),Vector3(203,7.2,106),Vector3(176,8.0,106)]:
		for dx in [-4.0,4.0]:
			_box(self, Vector3(2.3,0.8,1.7), p + Vector3(dx,0,0), Color("#3f4446"), Vector3.ZERO, 0.82, 0.52)
	for p in [Vector3(186,0,78.8), Vector3(194,0,78.8), Vector3(202,0,78.8)]:
		_box(self, Vector3(0.10,0.22,1.8), p + Vector3(0,0.16,0), Color("#8e3d33"), Vector3.ZERO, 0.85, 0.0)

func _build_industrial_pass() -> void:
	for base in [Vector3(21,8.8,148), Vector3(54,8.0,127)]:
		for x in [-7.0,0.0,7.0]:
			_cylinder(self, 0.42,0.58,4.6, Vector3(base.x+x,base.y+2.2,base.z+2.8), Color("#34383a"),0.82,0.62,10)
			_cylinder(self, 0.52,0.52,0.22, Vector3(base.x+x,base.y+4.55,base.z+2.8), RUST,0.76,0.58,10)
	for p in [Vector3(12,0.55,157),Vector3(30,0.55,158),Vector3(43,0.55,137),Vector3(63,0.55,137)]:
		_add_pallet_stack(p)
	var crane := Node3D.new()
	crane.position = Vector3(74,0,181)
	add_child(crane)
	_box(crane,Vector3(0.65,12.0,0.65),Vector3(0,6,0),Color("#5c4c34"),Vector3.ZERO,0.78,0.58)
	_box(crane,Vector3(13.0,0.55,0.55),Vector3(5.5,11.6,0),Color("#5c4c34"),Vector3(0,0,deg_to_rad(-4)),0.78,0.58)
	_box(crane,Vector3(0.06,5.0,0.06),Vector3(10.8,8.9,0),Color("#17191a"),Vector3.ZERO,0.75,0.45)

func _add_pallet_stack(pos: Vector3) -> void:
	for level in range(3):
		for plank in range(5):
			_box(self,Vector3(1.9,0.12,0.22),pos+Vector3(0,float(level)*0.28,float(plank)*0.29-0.58),Color("#5d4938"),Vector3(0,_rng.randf_range(-0.04,0.04),0),0.95,0.0)

func _build_waterfront_identity() -> void:
	# Visible beyond the frozen gameplay rail: Dock Town finally reads as a waterfront district.
	var water := MeshInstance3D.new()
	var water_mesh := PlaneMesh.new()
	water_mesh.size = Vector2(270, 80)
	water.mesh = water_mesh
	water.position = Vector3(104,-0.05,228)
	var water_mat := _mat(Color(0.075,0.11,0.13,0.92),0.16,0.12,false,true)
	water.material_override = water_mat
	water.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(water)
	for x in [-4.0,24.0,52.0,80.0,108.0,136.0,164.0,192.0,218.0]:
		_box(self,Vector3(8.0,0.35,17.0),Vector3(float(x),0.05,205.5),Color("#413b34"),Vector3.ZERO,0.94,0.02)
		for dx in [-3.2,3.2]:
			_cylinder(self,0.22,0.30,4.2,Vector3(float(x)+dx,-1.6,211.0),Color("#332d28"),0.98,0.0,7)
	for p in [Vector3(18,0,218),Vector3(101,0,224),Vector3(183,0,216)]:
		_add_background_boat(p)

func _add_background_boat(pos: Vector3) -> void:
	var root := Node3D.new()
	root.position = pos
	add_child(root)
	_box(root,Vector3(8.4,1.2,2.5),Vector3(0,0.55,0),Color("#2e3335"),Vector3(0,_rng.randf_range(-0.25,0.25),0),0.76,0.42)
	_box(root,Vector3(3.4,1.6,2.1),Vector3(-0.7,1.65,0),Color("#4a4d4c"),Vector3.ZERO,0.82,0.18)
	_cylinder(root,0.11,0.11,5.2,Vector3(0.6,3.55,0),STEEL,0.72,0.58,7)

func _build_background_silhouette() -> void:
	for i in range(34):
		var side := -1.0 if i % 2 == 0 else 1.0
		var x := -32.0 if side < 0.0 else 246.0
		x += _rng.randf_range(-22.0,18.0) * side
		var z := _rng.randf_range(14.0,196.0)
		var h := _rng.randf_range(7.0,24.0)
		var w := _rng.randf_range(5.0,12.0)
		_box(self,Vector3(w,h,_rng.randf_range(5.0,10.0)),Vector3(x,h*0.5,z),Color("#25292a"),Vector3.ZERO,1.0,0.02)
		if i % 5 == 0:
			_cylinder(self,0.35,0.45,_rng.randf_range(6.0,12.0),Vector3(x,h+3.0,z),Color("#232627"),0.92,0.32,8)

func _build_ashfall() -> void:
	var particles := GPUParticles3D.new()
	particles.name = "AshfallAtmosphere"
	particles.amount = 260 if DisplayServer.is_touchscreen_available() else 520
	particles.lifetime = 9.5
	particles.preprocess = 9.5
	particles.visibility_aabb = AABB(Vector3(-145,-10,-125),Vector3(290,60,250))
	particles.position = Vector3(104,24,99)
	particles.local_coords = true
	var process := ParticleProcessMaterial.new()
	process.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	process.emission_box_extents = Vector3(130,25,108)
	process.direction = Vector3(0.45,-1.0,0.20).normalized()
	process.spread = 28.0
	process.initial_velocity_min = 0.45
	process.initial_velocity_max = 1.6
	process.gravity = Vector3(0,-0.42,0)
	process.scale_min = 0.05
	process.scale_max = 0.16
	process.color = Color(0.72,0.72,0.69,0.66)
	particles.process_material = process
	var flake := QuadMesh.new()
	flake.size = Vector2(0.055,0.055)
	flake.orientation = PlaneMesh.FACE_Z
	var flake_mat := StandardMaterial3D.new()
	flake_mat.albedo_color = Color(0.72,0.72,0.69,0.72)
	flake_mat.vertex_color_use_as_albedo = true
	flake_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	flake_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	flake.material = flake_mat
	particles.draw_pass_1 = flake
	add_child(particles)

func _decorate_zombie(zombie: Node) -> void:
	if not is_instance_valid(zombie) or zombie.has_node("OverhaulDetail"):
		return
	var detail := Node3D.new()
	detail.name = "OverhaulDetail"
	zombie.add_child(detail)
	var brute := str(zombie.get("variant")) == "brute"
	var radiated := str(zombie.get("variant")) == "radiated"
	var scale_factor := 1.22 if brute else (0.93 if radiated else 1.0)
	var coat := Color("#3e4542") if radiated else (Color("#393936") if brute else Color("#55554f"))
	# Shoulder silhouette and torn overshirt add depth without replacing gameplay collision.
	_box(detail,Vector3(0.88,0.18,0.46)*scale_factor,Vector3(0,1.39,-0.01)*scale_factor,coat.darkened(0.16),Vector3(0,0,_rng.randf_range(-0.08,0.08)),0.96,0.0)
	_box(detail,Vector3(0.58,0.40,0.08)*scale_factor,Vector3(0.05,1.04,-0.235)*scale_factor,coat.lightened(0.03),Vector3(0,0,_rng.randf_range(-0.12,0.12)),0.98,0.0)
	_box(detail,Vector3(0.22,0.12,0.09)*scale_factor,Vector3(-0.16,1.1,-0.29)*scale_factor,BLOOD,Vector3(0,0,0.35),1.0,0.0)
	_box(detail,Vector3(0.10,0.30,0.12)*scale_factor,Vector3(0.14,1.68,-0.255)*scale_factor,Color("#4a443d"),Vector3(0.1,0,0.1),1.0,0.0)
	if brute:
		_box(detail,Vector3(0.54,0.22,0.28)*scale_factor,Vector3(0,1.82,0.02)*scale_factor,Color("#2c2e2c"),Vector3.ZERO,1.0,0.0)
	if radiated:
		_sphere(detail,0.08*scale_factor,Vector3(-0.28,1.18,-0.27)*scale_factor,Color("#79c982"),0.65,0.0,true)
		_sphere(detail,0.055*scale_factor,Vector3(0.25,0.88,-0.25)*scale_factor,Color("#79c982"),0.65,0.0,true)

func _find_player_and_upgrade_weapon() -> void:
	if not is_instance_valid(_player):
		for node in _root.get_children():
			if node is CharacterBody3D and node.name == "Player":
				_player = node
				break
	if not is_instance_valid(_player):
		return
	var camera: Camera3D
	for child in _player.get_children():
		if child is Camera3D:
			camera = child
			break
	if not is_instance_valid(camera):
		return
	for child in camera.get_children():
		if child is Node3D and not child.name.begins_with("Presentation"):
			var weapon_root := child as Node3D
			if weapon_root.get_child_count() >= 3 and not weapon_root.has_node("PresentationUpgrade"):
				_upgrade_weapon_model(weapon_root)

func _upgrade_weapon_model(weapon_root: Node3D) -> void:
	var detail := Node3D.new()
	detail.name = "PresentationUpgrade"
	weapon_root.add_child(detail)
	# Receiver bevel illusion, rails, sight posts, barrel collars, magazine ribs and visible hands.
	_box(detail,Vector3(0.32,0.08,0.52),Vector3(0,0.13,-0.20),Color("#181b1d"),Vector3.ZERO,0.42,0.72)
	for z in [-0.40,-0.29,-0.18,-0.07]:
		_box(detail,Vector3(0.28,0.035,0.035),Vector3(0,0.185,float(z)),Color("#101214"),Vector3.ZERO,0.52,0.78)
	_cylinder(detail,0.075,0.085,0.34,Vector3(0,0.08,-0.79),Color("#15181a"),0.38,0.82,10,Vector3(PI/2.0,0,0))
	_cylinder(detail,0.11,0.12,0.12,Vector3(0,0.08,-0.59),Color("#2b2f31"),0.46,0.76,10,Vector3(PI/2.0,0,0))
	_box(detail,Vector3(0.07,0.13,0.06),Vector3(-0.10,0.25,-0.31),Color("#101214"),Vector3.ZERO,0.42,0.78)
	_box(detail,Vector3(0.07,0.13,0.06),Vector3(0.10,0.25,-0.31),Color("#101214"),Vector3.ZERO,0.42,0.78)
	_box(detail,Vector3(0.06,0.18,0.08),Vector3(0,0.27,-0.08),Color("#101214"),Vector3.ZERO,0.42,0.78)
	for y in [-0.08,-0.14,-0.20]:
		_box(detail,Vector3(0.22,0.026,0.12),Vector3(0,float(y),0.06),Color("#17191b"),Vector3(deg_to_rad(-10),0,0),0.46,0.72)
	# Hands/forearms make the gun feel held instead of floating in camera space.
	_box(detail,Vector3(0.18,0.15,0.28),Vector3(0.19,-0.17,0.13),Color("#b08b72"),Vector3(deg_to_rad(-18),deg_to_rad(4),deg_to_rad(-8)),0.92,0.0)
	_box(detail,Vector3(0.18,0.15,0.30),Vector3(-0.16,-0.13,-0.28),Color("#b08b72"),Vector3(deg_to_rad(16),deg_to_rad(-4),deg_to_rad(7)),0.92,0.0)
	_box(detail,Vector3(0.22,0.20,0.46),Vector3(0.25,-0.22,0.42),Color("#34383a"),Vector3(deg_to_rad(-8),0,deg_to_rad(-7)),0.96,0.0)
	_box(detail,Vector3(0.22,0.20,0.46),Vector3(-0.23,-0.18,0.16),Color("#34383a"),Vector3(deg_to_rad(8),0,deg_to_rad(7)),0.96,0.0)

func _box(parent: Node, size: Vector3, pos: Vector3, color: Color, rot := Vector3.ZERO, roughness := 0.82, metallic := 0.0, emissive := false, transparent := false) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	instance.mesh = mesh
	instance.position = pos
	instance.rotation = rot
	instance.material_override = _mat(color,roughness,metallic,emissive,transparent)
	if size.length() < 1.1:
		instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(instance)
	return instance

func _cylinder(parent: Node, top_radius: float, bottom_radius: float, height: float, pos: Vector3, color: Color, roughness := 0.82, metallic := 0.0, segments := 10, rot := Vector3.ZERO) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = top_radius
	mesh.bottom_radius = bottom_radius
	mesh.height = height
	mesh.radial_segments = segments
	instance.mesh = mesh
	instance.position = pos
	instance.rotation = rot
	instance.material_override = _mat(color,roughness,metallic)
	parent.add_child(instance)
	return instance

func _sphere(parent: Node, radius: float, pos: Vector3, color: Color, roughness := 0.82, metallic := 0.0, emissive := false) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = radius * 2.0
	mesh.radial_segments = 8
	mesh.rings = 5
	instance.mesh = mesh
	instance.position = pos
	instance.material_override = _mat(color,roughness,metallic,emissive)
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(instance)
	return instance

func _mat(color: Color, roughness := 0.82, metallic := 0.0, emissive := false, transparent := false) -> StandardMaterial3D:
	var key := "%s|%.2f|%.2f|%s|%s" % [color.to_html(true),roughness,metallic,str(emissive),str(transparent)]
	if _materials.has(key):
		return _materials[key]
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	material.metallic = metallic
	if emissive:
		material.emission_enabled = true
		material.emission = Color(color.r,color.g,color.b,1.0) * 0.72
	if transparent or color.a < 0.999:
		material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.vertex_color_use_as_albedo = true
	_materials[key] = material
	return material
