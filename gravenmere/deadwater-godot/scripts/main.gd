extends Node3D

var player: AshfallPlayer
var town: TownBuilder
var health_label: Label
var district_label: Label

func _ready() -> void:
	_setup_environment()
	town = TownBuilder.new()
	town.name = "DockTown"
	add_child(town)
	town.build()
	player = AshfallPlayer.new()
	player.name = "Player"
	player.position = Vector3(92, 0.22, 67)
	add_child(player)
	player.health_changed.connect(_on_health_changed)
	_spawn_zombies()
	_setup_hud()

func _process(_delta: float) -> void:
	if player == null or district_label == null:
		return
	district_label.text = _district_at(player.global_position)

func _setup_environment() -> void:
	var world_environment := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color(0.29, 0.27, 0.25)
	environment.background_energy_multiplier = 0.72
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color(0.54, 0.49, 0.44)
	environment.ambient_light_energy = 0.82
	environment.fog_enabled = true
	environment.fog_light_color = Color(0.36, 0.33, 0.31)
	environment.fog_light_energy = 0.72
	environment.fog_density = 0.0055
	environment.fog_height = 4.0
	environment.fog_height_density = 0.04
	world_environment.environment = environment
	add_child(world_environment)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48, -28, 0)
	sun.light_color = Color(0.93, 0.79, 0.65)
	sun.light_energy = 1.18
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 120.0
	add_child(sun)

func _spawn_zombies() -> void:
	var count := mini(20, town.spawn_points.size())
	for index in range(count):
		var zombie := AshfallZombie.new()
		zombie.position = town.spawn_points[index]
		zombie.target = player
		zombie.speed = 2.45 + float(index % 6) * 0.16
		zombie.rotation.y = float(index) * 0.71
		add_child(zombie)

func _setup_hud() -> void:
	var canvas := CanvasLayer.new()
	canvas.layer = 10
	add_child(canvas)
	var ui := Control.new()
	ui.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	canvas.add_child(ui)
	var title := Label.new()
	title.text = "ASHFALL // GODOT MOBILE TEXTURE SPIKE"
	title.position = Vector2(22, 18)
	title.add_theme_font_size_override("font_size", 21)
	title.add_theme_color_override("font_color", Color(0.9, 0.82, 0.7))
	title.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(title)
	health_label = Label.new()
	health_label.text = "HEALTH 100"
	health_label.position = Vector2(22, 48)
	health_label.add_theme_font_size_override("font_size", 20)
	health_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(health_label)
	district_label = Label.new()
	district_label.text = "MAIN STREET"
	district_label.anchor_left = 0.5
	district_label.anchor_right = 0.5
	district_label.offset_left = -160
	district_label.offset_right = 160
	district_label.offset_top = 18
	district_label.offset_bottom = 50
	district_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	district_label.add_theme_font_size_override("font_size", 20)
	district_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(district_label)
	var crosshair := Label.new()
	crosshair.text = "+"
	crosshair.anchor_left = 0.5
	crosshair.anchor_top = 0.5
	crosshair.anchor_right = 0.5
	crosshair.anchor_bottom = 0.5
	crosshair.offset_left = -12
	crosshair.offset_top = -18
	crosshair.offset_right = 12
	crosshair.offset_bottom = 18
	crosshair.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	crosshair.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	crosshair.add_theme_font_size_override("font_size", 28)
	crosshair.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(crosshair)
	var move_hint := Label.new()
	move_hint.text = "DRAG LEFT TO MOVE"
	move_hint.anchor_top = 1.0
	move_hint.anchor_bottom = 1.0
	move_hint.offset_left = 28
	move_hint.offset_top = -68
	move_hint.offset_right = 250
	move_hint.offset_bottom = -34
	move_hint.add_theme_color_override("font_color", Color(0.82, 0.8, 0.76, 0.58))
	move_hint.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(move_hint)
	var look_hint := Label.new()
	look_hint.text = "DRAG RIGHT TO LOOK"
	look_hint.anchor_left = 1.0
	look_hint.anchor_top = 1.0
	look_hint.anchor_right = 1.0
	look_hint.anchor_bottom = 1.0
	look_hint.offset_left = -370
	look_hint.offset_top = -68
	look_hint.offset_right = -178
	look_hint.offset_bottom = -34
	look_hint.add_theme_color_override("font_color", Color(0.82, 0.8, 0.76, 0.58))
	look_hint.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(look_hint)
	var fire_button := Button.new()
	fire_button.text = "FIRE"
	fire_button.anchor_left = 1.0
	fire_button.anchor_top = 1.0
	fire_button.anchor_right = 1.0
	fire_button.anchor_bottom = 1.0
	fire_button.offset_left = -165
	fire_button.offset_top = -165
	fire_button.offset_right = -25
	fire_button.offset_bottom = -25
	fire_button.add_theme_font_size_override("font_size", 25)
	fire_button.modulate = Color(0.82, 0.75, 0.68, 0.9)
	fire_button.button_down.connect(func() -> void: player.shoot())
	ui.add_child(fire_button)

func _on_health_changed(value: int) -> void:
	if health_label != null:
		health_label.text = "HEALTH %d" % value

func _district_at(position: Vector3) -> String:
	var x := position.x
	var z := position.z
	if z < 68.0 and x < 100.0:
		return "SOUTH NEIGHBORHOOD"
	if z < 70.0 and x >= 100.0:
		return "BURNING TREELINE"
	if x >= 137.0 and z >= 80.0 and z < 133.0:
		return "ST. AGNES HOSPITAL"
	if x >= 94.0 and x < 130.0 and z >= 74.0 and z < 133.0:
		return "BAR DISTRICT"
	if Vector2(x - 66.0, z - 108.0).length() < 17.0:
		return "WATER TOWER"
	if z >= 134.0 and x >= 137.0:
		return "SHOPPING DISTRICT"
	if z >= 118.0 and x < 83.0:
		return "SMALL FACTORIES"
	if z >= 110.0 and x < 94.0:
		return "SHIPYARD ROAD"
	return "MAIN STREET"
