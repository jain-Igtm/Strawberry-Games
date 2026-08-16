extends Node3D

const PLAYER_SCRIPT = preload("res://ashfall/player.gd")
const ZOMBIE_SCRIPT = preload("res://ashfall/zombie.gd")
const MOBILE_CONTROLS_SCRIPT = preload("res://ashfall/mobile_controls.gd")

var playing := false
var game_over := false
var round_number := 1
var pending_spawns := 0
var between_rounds := false
var zombies: Array[Node] = []

var player
var mobile_controls
var _spawn_timer: Timer
var _round_timer: Timer
var _rng := RandomNumberGenerator.new()

func _ready() -> void:
	_rng.randomize()
	_setup_environment()
	_build_village()
	_build_mobile_controls()
	_build_player()
	_build_wave_timers()
	_update_hud()

func _process(_delta: float) -> void:
	if not playing or game_over:
		return
	for i in range(zombies.size() - 1, -1, -1):
		var zombie := zombies[i]
		if not is_instance_valid(zombie) or zombie.is_queued_for_deletion():
			zombies.remove_at(i)
	if pending_spawns == 0 and zombies.is_empty() and not between_rounds:
		between_rounds = true
		_round_timer.start(1.0)
	_update_hud()

func on_player_health_changed(_health: int) -> void:
	_update_hud()

func on_player_died() -> void:
	playing = false
	game_over = true
	_spawn_timer.stop()
	_round_timer.stop()
	if is_instance_valid(mobile_controls):
		mobile_controls.show_game_over(round_number, int(player.get("kills")))
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

func on_zombie_killed(zombie: Node) -> void:
	zombies.erase(zombie)
	player.kills += 1
	_update_hud()

func _start_game() -> void:
	playing = true
	game_over = false
	round_number = 1
	between_rounds = false
	_clear_zombies()
	player.reset_player()
	player.capture_mouse()
	_begin_round()

func _restart_game() -> void:
	_start_game()

func _on_fire_pressed() -> void:
	if playing:
		player.shoot()

func _begin_round() -> void:
	between_rounds = false
	pending_spawns = 6 + round_number * 3
	_spawn_one_zombie()
	if pending_spawns > 0:
		_spawn_timer.start()
	_update_hud()

func _on_round_timer_timeout() -> void:
	if not playing or game_over:
		return
	round_number += 1
	_begin_round()

func _spawn_one_zombie() -> void:
	if not playing or game_over:
		_spawn_timer.stop()
		return
	if pending_spawns <= 0:
		_spawn_timer.stop()
		return

	var zombie = ZOMBIE_SCRIPT.new()
	zombie.game = self
	zombie.target = player
	zombie.health = 2 + int(floor(round_number * 0.45))
	zombie.speed = 1.2 + _rng.randf_range(0.0, 0.35) + round_number * 0.055
	zombie.position = _random_spawn_position()
	add_child(zombie)
	zombies.append(zombie)
	pending_spawns -= 1
	if pending_spawns <= 0:
		_spawn_timer.stop()
	_update_hud()

func _random_spawn_position() -> Vector3:
	var side := _rng.randi_range(0, 3)
	match side:
		0:
			return Vector3(_rng.randf_range(-25.0, -22.0), 0.05, _rng.randf_range(-35.0, 28.0))
		1:
			return Vector3(_rng.randf_range(22.0, 25.0), 0.05, _rng.randf_range(-35.0, 28.0))
		2:
			return Vector3(_rng.randf_range(-23.0, 23.0), 0.05, _rng.randf_range(-68.0, -64.0))
		_:
			return Vector3(_rng.randf_range(-22.0, 22.0), 0.05, _rng.randf_range(33.0, 35.0))

func _clear_zombies() -> void:
	for zombie in zombies:
		if is_instance_valid(zombie):
			zombie.queue_free()
	zombies.clear()
	pending_spawns = 0
	_spawn_timer.stop()
	_round_timer.stop()

func _update_hud() -> void:
	if not is_instance_valid(mobile_controls) or not is_instance_valid(player):
		return
	mobile_controls.update_hud(round_number, int(player.get("health")), zombies.size() + pending_spawns, int(player.get("kills")))

func _build_mobile_controls() -> void:
	mobile_controls = MOBILE_CONTROLS_SCRIPT.new()
	add_child(mobile_controls)
	mobile_controls.start_pressed.connect(_start_game)
	mobile_controls.restart_pressed.connect(_restart_game)
	mobile_controls.fire_pressed.connect(_on_fire_pressed)

func _build_player() -> void:
	player = PLAYER_SCRIPT.new()
	player.name = "Player"
	player.game = self
	player.mobile_controls = mobile_controls
	player.position = Vector3(0.0, 0.05, 31.0)
	add_child(player)

func _build_wave_timers() -> void:
	_spawn_timer = Timer.new()
	_spawn_timer.wait_time = 0.42
	_spawn_timer.one_shot = false
	_spawn_timer.timeout.connect(_spawn_one_zombie)
	add_child(_spawn_timer)

	_round_timer = Timer.new()
	_round_timer.one_shot = true
	_round_timer.timeout.connect(_on_round_timer_timeout)
	add_child(_round_timer)

func _setup_environment() -> void:
	var world_environment := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("#020405")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#617086")
	environment.ambient_light_energy = 0.32
	environment.fog_enabled = true
	environment.fog_light_color = Color("#0b1014")
	environment.fog_density = 0.018
	world_environment.environment = environment
	add_child(world_environment)

	var moon := DirectionalLight3D.new()
	moon.light_color = Color("#9eb5d2")
	moon.light_energy = 1.45
	moon.rotation_degrees = Vector3(-52.0, -34.0, 0.0)
	moon.shadow_enabled = true
	add_child(moon)

func _build_village() -> void:
	_make_static_box("Ground", Vector3(0.0, -0.12, -12.0), Vector3(150.0, 0.2, 170.0), Color("#182318"))
	_add_ground_patch(Vector3(0.0, 0.005, -44.0), Vector3(22.0, 0.02, 34.0), Color("#352b21"))
	_add_ground_patch(Vector3(0.0, 0.012, -4.0), Vector3(21.0, 0.025, 66.0), Color("#22301f"))

	_make_building(-15.0, 18.0, 9.4, 7.0, 5.1, PI / 2.0, "COWBOY TOWN", Color("#342920"), true, true)
	_make_building(-15.0, 7.0, 9.8, 7.2, 4.7, PI / 2.0, "MERCANTILE", Color("#4a3424"), true, true)
	_make_building(-15.0, -4.0, 8.8, 7.0, 4.5, PI / 2.0, "FARMER'S MARKET", Color("#513a27"), true, true)
	_make_building(-15.0, -15.0, 8.0, 6.6, 4.25, PI / 2.0, "POST OFFICE", Color("#30271f"), true, true)
	_make_building(-15.0, -25.0, 8.2, 7.0, 4.3, PI / 2.0, "TRADING POST", Color("#493423"), true, true)

	_make_building(15.0, 18.0, 8.5, 7.0, 4.4, -PI / 2.0, "CABIN 1", Color("#382a21"), false, true)
	_make_building(15.0, 7.0, 9.2, 7.2, 4.7, -PI / 2.0, "SALOON", Color("#503522"), true, true)
	_make_building(15.0, -4.0, 8.6, 7.0, 4.4, -PI / 2.0, "BLACKSMITH", Color("#2c2621"), true, true)
	_make_building(15.0, -15.0, 8.0, 6.8, 4.25, -PI / 2.0, "CABIN 2", Color("#443225"), false, true)
	_make_building(15.0, -25.0, 8.5, 7.2, 4.35, -PI / 2.0, "STABLE", Color("#31271f"), true, true)

	_make_building(-13.2, -47.5, 11.8, 9.2, 5.4, 0.0, "BARN", Color("#6a482b"), false, true, 2.0)
	_make_building(0.0, -52.5, 7.6, 10.2, 5.0, 0.0, "CHURCH", Color("#48534e"), false, true, 2.2)
	_make_building(13.2, -47.5, 8.2, 8.4, 4.7, 0.0, "RED SHED", Color("#6e3027"), false, true, 1.55)

	_make_fire_pit(Vector3(0.0, 0.0, -29.5))
	_make_barrel(Vector3(-7.5, 0.0, 3.0), 1.05)
	_make_barrel(Vector3(7.8, 0.0, -8.0), 0.9)
	_make_barrel(Vector3(10.0, 0.0, 21.5), 0.85)
	_make_bench(Vector3(-5.5, 0.0, -35.5), 0.12)
	_make_bench(Vector3(6.0, 0.0, -35.2), -0.2)

	for z in range(22, -26, -10):
		_make_string_lights(float(z))
	_make_string_lights(-39.0)

	for z in range(34, -73, -7):
		_make_tree(Vector3(-30.0 - _rng.randf_range(0.0, 3.5), 0.0, float(z) + _rng.randf_range(-1.5, 1.5)), _rng.randf_range(0.9, 1.35))
		_make_tree(Vector3(30.0 + _rng.randf_range(0.0, 3.5), 0.0, float(z) + _rng.randf_range(-1.5, 1.5)), _rng.randf_range(0.9, 1.35))
	for x in range(-28, 29, 6):
		_make_tree(Vector3(float(x) + _rng.randf_range(-1.5, 1.5), 0.0, -73.0 - _rng.randf_range(0.0, 3.0)), _rng.randf_range(1.0, 1.4))
		if abs(x) > 7:
			_make_tree(Vector3(float(x) + _rng.randf_range(-1.5, 1.5), 0.0, 39.0 + _rng.randf_range(0.0, 3.0)), _rng.randf_range(0.9, 1.25))

	_make_boundary(Vector3(-29.5, 2.0, -16.0), Vector3(3.0, 4.0, 112.0))
	_make_boundary(Vector3(29.5, 2.0, -16.0), Vector3(3.0, 4.0, 112.0))
	_make_boundary(Vector3(0.0, 2.0, -74.5), Vector3(62.0, 4.0, 3.0))
	_make_boundary(Vector3(0.0, 2.0, 40.5), Vector3(62.0, 4.0, 3.0))

func _make_building(x: float, z: float, width: float, depth: float, height: float, facing: float, label_text: String, wall_color: Color, false_front: bool, porch: bool, roof_rise: float = 1.3) -> void:
	var body := _make_static_box(label_text, Vector3(x, height * 0.5, z), Vector3(width, height, depth), wall_color)
	body.rotation.y = facing

	var roof_color := Color("#211d19")
	var trim_color := Color("#9f8a6b")
	var porch_color := Color("#624730")
	var slant_length := sqrt(pow(width * 0.5 + 0.35, 2.0) + pow(roof_rise, 2.0))
	var angle := atan2(roof_rise, width * 0.5 + 0.35)
	_add_box_visual(body, Vector3(slant_length, 0.20, depth + 0.65), Vector3(-width * 0.25, height * 0.5 + roof_rise * 0.5, 0.0), roof_color, Vector3(0.0, 0.0, angle))
	_add_box_visual(body, Vector3(slant_length, 0.20, depth + 0.65), Vector3(width * 0.25, height * 0.5 + roof_rise * 0.5, 0.0), roof_color, Vector3(0.0, 0.0, -angle))

	if false_front:
		_add_box_visual(body, Vector3(width + 0.18, height + 1.2, 0.30), Vector3(0.0, 0.60, depth * 0.5 + 0.08), wall_color)
		_add_box_visual(body, Vector3(width + 0.50, 0.20, 0.45), Vector3(0.0, height * 0.5 + 1.18, depth * 0.5 + 0.08), trim_color)

	if porch:
		var porch_depth := 2.15
		_add_box_visual(body, Vector3(width + 0.55, 0.18, porch_depth), Vector3(0.0, -height * 0.5 + 0.38, depth * 0.5 + porch_depth * 0.5 - 0.1), porch_color)
		_add_box_visual(body, Vector3(width + 0.45, 0.16, porch_depth + 0.25), Vector3(0.0, height * 0.5 - 0.18, depth * 0.5 + porch_depth * 0.5 - 0.1), roof_color)
		for px in [-width * 0.5 + 0.4, width * 0.5 - 0.4]:
			_add_box_visual(body, Vector3(0.16, height - 0.45, 0.16), Vector3(float(px), -0.05, depth * 0.5 + porch_depth - 0.32), trim_color)
		_add_lantern(body, Vector3(-width * 0.28, height * 0.5 - 0.78, depth * 0.5 + porch_depth - 0.40))
		_add_lantern(body, Vector3(width * 0.28, height * 0.5 - 0.78, depth * 0.5 + porch_depth - 0.40))

	_add_box_visual(body, Vector3(1.25, 2.2, 0.18), Vector3(0.0, -height * 0.5 + 1.48, depth * 0.5 + 0.20), Color("#251d17"))
	for wx in [-width * 0.28, width * 0.28]:
		if abs(float(wx)) < 0.8:
			continue
		var window_material := _material(Color("#ffd89a"), 0.30, true)
		_add_box_visual_with_material(body, Vector3(1.15, 1.45, 0.12), Vector3(float(wx), -height * 0.5 + 2.05, depth * 0.5 + 0.22), window_material)

	var sign := Label3D.new()
	sign.text = label_text
	sign.font_size = 48
	sign.outline_size = 10
	sign.modulate = Color("#d8bf88")
	sign.position = Vector3(0.0, height * 0.22, depth * 0.5 + 0.30)
	body.add_child(sign)

func _make_static_box(name_text: String, position_value: Vector3, size: Vector3, color: Color) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.name = name_text.validate_node_name()
	body.position = position_value
	add_child(body)

	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collision.shape = shape
	body.add_child(collision)

	_add_box_visual(body, size, Vector3.ZERO, color)
	return body

func _make_boundary(position_value: Vector3, size: Vector3) -> void:
	var body := StaticBody3D.new()
	body.position = position_value
	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collision.shape = shape
	body.add_child(collision)
	add_child(body)

func _add_ground_patch(position_value: Vector3, size: Vector3, color: Color) -> void:
	var patch := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	patch.mesh = mesh
	patch.position = position_value
	patch.material_override = _material(color, 1.0)
	add_child(patch)

func _add_box_visual(parent: Node3D, size: Vector3, local_position: Vector3, color: Color, local_rotation: Vector3 = Vector3.ZERO) -> MeshInstance3D:
	return _add_box_visual_with_material(parent, size, local_position, _material(color, 0.95), local_rotation)

func _add_box_visual_with_material(parent: Node3D, size: Vector3, local_position: Vector3, material: StandardMaterial3D, local_rotation: Vector3 = Vector3.ZERO) -> MeshInstance3D:
	var mesh_instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh_instance.mesh = mesh
	mesh_instance.position = local_position
	mesh_instance.rotation = local_rotation
	mesh_instance.material_override = material
	parent.add_child(mesh_instance)
	return mesh_instance

func _material(color: Color, roughness: float, emissive: bool = false) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	if emissive:
		material.emission_enabled = true
		material.emission = color * 0.75
	return material

func _add_lantern(parent: Node3D, local_position: Vector3) -> void:
	var bulb := MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = 0.09
	mesh.height = 0.18
	bulb.mesh = mesh
	bulb.position = local_position
	bulb.material_override = _material(Color("#ffd27d"), 0.35, true)
	parent.add_child(bulb)

	var light := OmniLight3D.new()
	light.light_color = Color("#ffb65f")
	light.light_energy = 2.8
	light.omni_range = 8.5
	light.position = local_position
	parent.add_child(light)

func _make_fire_pit(position_value: Vector3) -> void:
	var root := Node3D.new()
	root.position = position_value
	add_child(root)
	for i in range(12):
		var angle := TAU * float(i) / 12.0
		_add_box_visual(root, Vector3(0.38, 0.24, 0.30), Vector3(cos(angle) * 1.0, 0.12, sin(angle) * 1.0), Color("#574f43"), Vector3(0.0, angle, 0.0))
	var coal := MeshInstance3D.new()
	var coal_mesh := CylinderMesh.new()
	coal_mesh.top_radius = 0.75
	coal_mesh.bottom_radius = 0.75
	coal_mesh.height = 0.08
	coal.mesh = coal_mesh
	coal.position.y = 0.05
	coal.material_override = _material(Color("#8b2d13"), 0.8, true)
	root.add_child(coal)
	var fire_light := OmniLight3D.new()
	fire_light.light_color = Color("#ff7135")
	fire_light.light_energy = 3.6
	fire_light.omni_range = 10.0
	fire_light.position.y = 1.0
	root.add_child(fire_light)

func _make_barrel(position_value: Vector3, scale_value: float) -> void:
	var body := StaticBody3D.new()
	body.position = position_value
	add_child(body)
	var collision := CollisionShape3D.new()
	var shape := CylinderShape3D.new()
	shape.radius = 0.48 * scale_value
	shape.height = 0.95 * scale_value
	collision.shape = shape
	collision.position.y = 0.475 * scale_value
	body.add_child(collision)
	var mesh_instance := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = 0.42 * scale_value
	mesh.bottom_radius = 0.48 * scale_value
	mesh.height = 0.95 * scale_value
	mesh_instance.mesh = mesh
	mesh_instance.position.y = 0.475 * scale_value
	mesh_instance.material_override = _material(Color("#5e4028"), 0.95)
	body.add_child(mesh_instance)

func _make_bench(position_value: Vector3, rotation_y: float) -> void:
	var root := Node3D.new()
	root.position = position_value
	root.rotation.y = rotation_y
	add_child(root)
	_add_box_visual(root, Vector3(2.4, 0.16, 0.45), Vector3(0.0, 0.75, 0.0), Color("#624730"))
	_add_box_visual(root, Vector3(2.4, 0.16, 0.28), Vector3(0.0, 1.27, 0.18), Color("#624730"))
	for sx in [-0.85, 0.85]:
		_add_box_visual(root, Vector3(0.16, 0.78, 0.16), Vector3(float(sx), 0.39, 0.0), Color("#2a211a"))

func _make_string_lights(z_value: float) -> void:
	for i in range(10):
		var t := (float(i) + 0.5) / 10.0
		var x := lerpf(-10.2, 10.2, t)
		var y := 4.75 - sin(PI * t) * 0.45
		var bulb := MeshInstance3D.new()
		var mesh := SphereMesh.new()
		mesh.radius = 0.065
		mesh.height = 0.13
		bulb.mesh = mesh
		bulb.position = Vector3(x, y, z_value)
		bulb.material_override = _material(Color("#ffd27d"), 0.30, true)
		add_child(bulb)
		if i % 2 == 0:
			var light := OmniLight3D.new()
			light.light_color = Color("#ffc477")
			light.light_energy = 1.1
			light.omni_range = 5.3
			light.position = bulb.position
			add_child(light)

func _make_tree(position_value: Vector3, scale_value: float) -> void:
	var root := Node3D.new()
	root.position = position_value
	root.scale = Vector3.ONE * scale_value
	add_child(root)

	var trunk := MeshInstance3D.new()
	var trunk_mesh := CylinderMesh.new()
	trunk_mesh.top_radius = 0.32
	trunk_mesh.bottom_radius = 0.48
	trunk_mesh.height = 4.5
	trunk.mesh = trunk_mesh
	trunk.position.y = 2.25
	trunk.material_override = _material(Color("#171411"), 1.0)
	root.add_child(trunk)

	for offset in [Vector3(-0.6, 4.8, 0.0), Vector3(0.7, 5.1, 0.4), Vector3(0.0, 5.7, -0.5)]:
		var crown := MeshInstance3D.new()
		var crown_mesh := SphereMesh.new()
		crown_mesh.radius = 1.65
		crown_mesh.height = 2.6
		crown.mesh = crown_mesh
		crown.position = offset
		crown.material_override = _material(Color("#07100a"), 1.0)
		root.add_child(crown)
