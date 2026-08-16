extends Node3D

const WORLD_SCRIPT = preload("res://ashfall/world_builder.gd")
const PLAYER_SCRIPT = preload("res://ashfall/player.gd")
const ZOMBIE_SCRIPT = preload("res://ashfall/zombie.gd")
const CONTROLS_SCRIPT = preload("res://ashfall/mobile_controls.gd")
const WEAPON_RULES = preload("res://ashfall/weapons.gd")
const VEHICLE_SCRIPT = preload("res://ashfall/vehicle.gd")
const DROP_SCRIPT = preload("res://ashfall/drop_pickup.gd")

var playing := false
var paused := false
var game_over := false
var wave := 1
var kills := 0
var score := 0

var _pending_spawns := 0
var _spawn_left := 0.0
var _intermission := 0.0
var _between_waves := false
var _zombies: Array[Node] = []
var _vehicles: Array[CharacterBody3D] = []
var _vehicle_spawn_data: Array[Dictionary] = []
var _weapon_lockers: Array[Dictionary] = []
var _world
var _player
var _controls
var _environment: Environment
var _key_light: DirectionalLight3D
var _rng := RandomNumberGenerator.new()
var _brightness_index := 2
var _brightness_labels := ["LOW","BRIGHT","HIGH","MAX"]
var _brightness_energy := [0.72,0.88,1.05,1.26]
var _sensitivity_labels := ["NORMAL","FAST","VERY FAST"]

var _siren_player: AudioStreamPlayer
var _siren_playback: AudioStreamGeneratorPlayback
var _siren_phase := 0.0
var _siren_lfo_phase := 0.0
const SIREN_RATE := 22050.0

func _ready() -> void:
	_rng.randomize()
	if DisplayServer.is_touchscreen_available(): Engine.max_fps = 60
	_build_environment()
	_world = WORLD_SCRIPT.new()
	_world.name = "DockTown"
	add_child(_world)
	_world.build()
	_build_controls()
	_build_player()
	_build_progression_objects()
	_build_location_lights()
	_build_siren()
	_update_hud()

func _process(delta: float) -> void:
	_fill_siren_buffer()
	for vehicle in _vehicles:
		if is_instance_valid(vehicle) and not is_instance_valid(vehicle.driver):
			vehicle.coast(delta)
	if not playing or paused or game_over:
		return
	_prune_zombies()
	if _pending_spawns > 0:
		_spawn_left -= delta
		if _spawn_left <= 0.0 and _zombies.size() < _active_zombie_cap():
			_spawn_zombie()
			_spawn_left = _spawn_interval_for_wave(wave)
	elif _zombies.is_empty():
		if not _between_waves:
			_between_waves = true
			_intermission = 3.2
			_controls.show_toast("STREET CLEAR • RESUPPLY", 1.2)
		else:
			_intermission -= delta
			if _intermission <= 0.0:
				_finish_intermission()
	_update_hud()

func _start_game() -> void:
	_clear_zombies()
	_clear_drops()
	playing = true
	paused = false
	game_over = false
	wave = 1
	kills = 0
	score = 0
	_reset_vehicles()
	_player.reset_player()
	_player.capture_mouse()
	_controls.set_paused(false)
	_start_siren()
	_begin_wave()
	_update_hud()

func _restart_game() -> void:
	_start_game()

func _begin_wave() -> void:
	_between_waves = false
	_pending_spawns = _zombies_for_wave(wave)
	_spawn_left = 0.05
	_controls.show_wave_banner(wave, _pending_spawns)
	_controls.show_toast("HOLD THE STREETS", 1.4)

func _finish_intermission() -> void:
	var reserve_bonus := 75 + mini(90, wave * 5)
	_player.add_reserve(reserve_bonus)
	wave += 1
	_begin_wave()

func _spawn_zombie() -> void:
	if _pending_spawns <= 0: return
	var zombie = ZOMBIE_SCRIPT.new()
	zombie.game = self
	zombie.target = _player
	var base_health := round(175.0 * pow(1.14,float(wave-1)))
	var base_speed := minf(6.6,3.0+float(wave)*0.18)
	var base_damage := minf(42.0,8.0+float(wave)*1.5)
	zombie.max_health = base_health
	zombie.health = base_health
	zombie.speed = base_speed
	zombie.damage = base_damage
	zombie.attack_delay = maxf(0.32,0.72-float(wave)*0.02)
	var roll := _rng.randf()
	var brute_chance := minf(0.20, maxf(0.0,float(wave-4))*0.022)
	var radiated_chance := minf(0.18, maxf(0.0,float(wave-6))*0.020)
	if wave >= 5 and roll < brute_chance:
		zombie.variant = "brute"
		zombie.max_health *= 1.75
		zombie.health = zombie.max_health
		zombie.speed *= 0.82
		zombie.damage *= 1.45
		zombie.attack_delay *= 1.08
		zombie.bounty = 2.2
	elif wave >= 7 and roll < brute_chance + radiated_chance:
		zombie.variant = "radiated"
		zombie.max_health *= 0.86
		zombie.health = zombie.max_health
		zombie.speed = minf(7.2,zombie.speed*1.25)
		zombie.damage *= 1.15
		zombie.attack_delay *= 0.82
		zombie.bounty = 1.7
	else:
		zombie.runner = wave >= 4 and _rng.randf() < minf(0.35,0.08+wave*0.018)
		if zombie.runner:
			zombie.speed = minf(6.9,zombie.speed*1.12)
			zombie.bounty = 1.25
	zombie.position = _choose_spawn_position()
	add_child(zombie)
	_zombies.append(zombie)
	_pending_spawns -= 1

func _choose_spawn_position() -> Vector3:
	var candidates: Array[Vector3] = _world.spawn_points
	var best := candidates[_rng.randi_range(0,candidates.size()-1)]
	for attempt in range(8):
		var candidate := candidates[_rng.randi_range(0,candidates.size()-1)]
		if candidate.distance_to(_player.global_position) > 28.0:
			return candidate + Vector3(_rng.randf_range(-2.2,2.2),0,_rng.randf_range(-2.2,2.2))
	return best

func _prune_zombies() -> void:
	for i in range(_zombies.size()-1,-1,-1):
		if not is_instance_valid(_zombies[i]) or _zombies[i].is_queued_for_deletion(): _zombies.remove_at(i)

func _clear_zombies() -> void:
	for zombie in _zombies:
		if is_instance_valid(zombie): zombie.queue_free()
	_zombies.clear()
	_pending_spawns = 0
	_between_waves = false

func _clear_drops() -> void:
	for child in get_children():
		if child.get_script() == DROP_SCRIPT: child.queue_free()

func on_zombie_killed(zombie: Node) -> void:
	_zombies.erase(zombie)
	kills += 1
	if _rng.randf() < 0.14:
		_spawn_drop(zombie.global_position,"ammo",24+wave*2)
	elif _rng.randf() < 0.065:
		_spawn_drop(zombie.global_position,"health",22)
	_update_hud()

func _spawn_drop(position_value: Vector3, kind: String, amount: int) -> void:
	var drop = DROP_SCRIPT.new()
	drop.setup(kind,_player,amount)
	drop.position = Vector3(position_value.x,0.48,position_value.z)
	add_child(drop)

func register_hit(headshot: bool, killed: bool, bounty := 1.0) -> void:
	var awarded := 0
	if killed:
		awarded = roundi(float(160 if headshot else 100)*bounty)
	else:
		awarded = roundi(float(20 if headshot else 10)*minf(1.45,bounty))
	score += awarded
	_controls.flash_hit(killed)
	if killed:
		_controls.show_toast(("HEADSHOT " if headshot else "KILL ") + "+%d" % awarded,0.55)
	_update_hud()

func arc_chain_from(origin: Vector3, damage: float) -> void:
	var candidates: Array[Dictionary] = []
	for zombie in _zombies:
		if not is_instance_valid(zombie): continue
		var distance := zombie.global_position.distance_to(origin)
		if distance > 0.8 and distance <= 7.5:
			candidates.append({"node":zombie,"distance":distance})
	candidates.sort_custom(func(a: Dictionary,b: Dictionary) -> bool: return float(a["distance"]) < float(b["distance"]))
	for i in range(mini(3,candidates.size())):
		var target = candidates[i]["node"]
		if not is_instance_valid(target): continue
		var result: Dictionary = target.take_bullet(damage,target.global_position+Vector3(0,1.0,0),1.0)
		if not result.is_empty(): register_hit(false,bool(result.get("killed",false)),float(result.get("bounty",1.0)))

func on_player_state_changed() -> void:
	_update_hud()

func on_player_died() -> void:
	if game_over: return
	if _player.is_in_vehicle(): _player.exit_vehicle(true)
	playing = false
	game_over = true
	paused = false
	_player.release_mouse()
	_controls.show_game_over(score,kills,wave)

func request_use() -> void:
	if not playing or paused: return
	var fuel_pos: Vector3 = _world.interaction_points["fuel"]
	if _player.is_in_vehicle():
		if _player.global_position.distance_to(fuel_pos) < 7.0:
			if score < 300:
				_controls.show_toast("FUEL REQUIRES 300 PTS",1.0)
			else:
				score -= 300
				_player.current_vehicle.refill()
				_controls.show_toast("TANK FILLED",0.9)
				_update_hud()
			return
		_player.exit_vehicle()
		_controls.show_toast("ON FOOT",0.55)
		return
	var nearest_vehicle := _nearest_vehicle(3.6)
	if is_instance_valid(nearest_vehicle):
		_player.enter_vehicle(nearest_vehicle)
		_controls.show_toast("ENTERED " + str(nearest_vehicle.label),0.9)
		return
	var locker := _nearest_weapon_locker(4.2)
	if not locker.is_empty():
		_purchase_locker(locker)
		return
	var forge_pos: Vector3 = _world.interaction_points["forge"]
	if _player.global_position.distance_to(forge_pos) < 5.0:
		var cost: int = int(_player.current_upgrade_cost())
		if score < cost:
			_controls.show_toast("FORGE REQUIRES %d PTS" % cost,1.2)
			return
		score -= cost
		var level: int = int(_player.upgrade_current_weapon())
		_controls.show_toast("%s • FORGE LV.%d" % [_player.current_weapon_name(),level],1.4)
		_update_hud()
	elif _player.global_position.distance_to(fuel_pos) < 5.5:
		_controls.show_toast("FUEL PUMP • BRING A VEHICLE",1.1)
	else:
		_controls.show_toast("NOTHING TO USE",0.65)

func request_swap() -> void:
	if not playing or paused: return
	if _player.swap_weapon():
		_controls.show_toast(_player.current_weapon_name(),0.65)
	else:
		_controls.show_toast("NO SECONDARY EQUIPPED",0.75)

func _nearest_vehicle(radius: float) -> CharacterBody3D:
	var best: CharacterBody3D
	var best_distance := radius
	for vehicle in _vehicles:
		if not is_instance_valid(vehicle) or is_instance_valid(vehicle.driver): continue
		var distance := vehicle.global_position.distance_to(_player.global_position)
		if distance < best_distance:
			best = vehicle
			best_distance = distance
	return best

func _nearest_weapon_locker(radius: float) -> Dictionary:
	var best: Dictionary = {}
	var best_distance := radius
	for locker in _weapon_lockers:
		var locker_position: Vector3 = locker["position"]
		var distance: float = locker_position.distance_to(_player.global_position)
		if distance < best_distance:
			best = locker
			best_distance = distance
	return best

func _purchase_locker(locker: Dictionary) -> void:
	var id := str(locker["id"])
	var base_cost := int(locker["cost"])
	var already_owned: bool = bool(_player.has_weapon(id))
	var cost := int(round(base_cost*0.38)) if already_owned else base_cost
	if score < cost:
		_controls.show_toast("%s REQUIRES %d PTS" % [str(WEAPON_RULES.definition(id)["name"]),cost],1.2)
		return
	score -= cost
	_player.give_weapon(id)
	_controls.show_toast(("AMMO • " if already_owned else "ACQUIRED • ") + _player.current_weapon_name(),1.0)
	_update_hud()

func toggle_pause() -> void:
	if game_over or not playing: return
	paused = not paused
	if paused: _player.release_mouse()
	else: _player.capture_mouse()
	_controls.set_paused(paused,_sensitivity_labels[_player.sensitivity_index],_brightness_labels[_brightness_index])

func _resume() -> void:
	if paused: toggle_pause()

func _cycle_sensitivity() -> void:
	_player.cycle_sensitivity()
	_controls.set_paused(true,_sensitivity_labels[_player.sensitivity_index],_brightness_labels[_brightness_index])

func _cycle_brightness() -> void:
	_brightness_index = (_brightness_index+1)%_brightness_energy.size()
	_key_light.light_energy = _brightness_energy[_brightness_index]
	_environment.ambient_light_energy = 0.76+float(_brightness_index)*0.12
	_controls.set_paused(true,_sensitivity_labels[_player.sensitivity_index],_brightness_labels[_brightness_index])

func _build_controls() -> void:
	_controls = CONTROLS_SCRIPT.new()
	add_child(_controls)
	_controls.set_district("DOCK TOWN")
	_controls.start_pressed.connect(_start_game)
	_controls.restart_pressed.connect(_restart_game)
	_controls.reload_pressed.connect(func() -> void: _player.request_reload())
	_controls.use_pressed.connect(request_use)
	_controls.swap_pressed.connect(request_swap)
	_controls.ads_pressed.connect(func() -> void: _player.toggle_ads())
	_controls.jump_pressed.connect(func() -> void: _player.request_jump())
	_controls.pause_pressed.connect(toggle_pause)
	_controls.resume_pressed.connect(_resume)
	_controls.sensitivity_pressed.connect(_cycle_sensitivity)
	_controls.brightness_pressed.connect(_cycle_brightness)

func _build_player() -> void:
	_player = PLAYER_SCRIPT.new()
	_player.name = "Player"
	_player.game = self
	_player.controls = _controls
	_player.position = Vector3(92.0,0.08,67.0)
	add_child(_player)

func _build_progression_objects() -> void:
	_add_vehicle("town-pickup","TOWN PICKUP","truck",Vector3(101,0.15,63),PI/2.0)
	_add_vehicle("neighborhood-sedan","NEIGHBORHOOD SEDAN","buggy",Vector3(65,0.15,43),0.0)
	_add_weapon_locker("smg",Vector3(112,0.55,84),WEAPON_RULES.PICKUP_COSTS["smg"])
	_add_weapon_locker("shotgun",Vector3(190,0.55,83),WEAPON_RULES.PICKUP_COSTS["shotgun"])
	_add_weapon_locker("marksman",Vector3(66,0.55,101),WEAPON_RULES.PICKUP_COSTS["marksman"])
	_add_weapon_locker("lmg",Vector3(48,0.55,127),WEAPON_RULES.PICKUP_COSTS["lmg"])
	_add_weapon_locker("harpoon",Vector3(196,0.55,145),WEAPON_RULES.PICKUP_COSTS["harpoon"])
	_add_weapon_locker("arc",Vector3(196,0.55,176),WEAPON_RULES.PICKUP_COSTS["arc"])

func _add_vehicle(id: String, label: String, kind: String, position_value: Vector3, yaw_value: float) -> void:
	var vehicle = VEHICLE_SCRIPT.new()
	vehicle.setup(id,label,kind)
	vehicle.position = position_value
	vehicle.rotation.y = yaw_value
	add_child(vehicle)
	_vehicles.append(vehicle)
	_vehicle_spawn_data.append({"node":vehicle,"position":position_value,"yaw":yaw_value})

func _reset_vehicles() -> void:
	for data in _vehicle_spawn_data:
		var vehicle = data["node"]
		if not is_instance_valid(vehicle): continue
		vehicle.driver = null
		vehicle.global_position = data["position"]
		vehicle.rotation = Vector3(0,float(data["yaw"]),0)
		vehicle.fuel = 62.0
		vehicle.velocity = Vector3.ZERO

func _add_weapon_locker(id: String, position_value: Vector3, cost: int) -> void:
	var root := Node3D.new()
	root.name = (id+"_locker").validate_node_name()
	root.position = position_value
	add_child(root)
	var body := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(1.25,1.1,0.75)
	body.mesh = mesh
	var mat := StandardMaterial3D.new()
	var accent: Color = WEAPON_RULES.definition(id)["accent"]
	mat.albedo_color = accent.darkened(0.52)
	mat.metallic = 0.45
	mat.roughness = 0.63
	body.material_override = mat
	root.add_child(body)
	var strip := MeshInstance3D.new()
	var strip_mesh := BoxMesh.new()
	strip_mesh.size = Vector3(0.86,0.10,0.78)
	strip.mesh = strip_mesh
	strip.position.y = 0.22
	var strip_mat := StandardMaterial3D.new()
	strip_mat.albedo_color = accent
	strip_mat.emission_enabled = true
	strip_mat.emission = accent*0.7
	strip.material_override = strip_mat
	root.add_child(strip)
	var label := Label3D.new()
	label.text = "%s\n%d PTS" % [str(WEAPON_RULES.definition(id)["name"]),cost]
	label.font_size = 26
	label.outline_size = 6
	label.position = Vector3(0,1.12,0)
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.modulate = Color("#ead8c4")
	root.add_child(label)
	_weapon_lockers.append({"id":id,"position":position_value,"cost":cost,"node":root})

func _build_environment() -> void:
	var world_env := WorldEnvironment.new()
	_environment = Environment.new()
	_environment.background_mode = Environment.BG_COLOR
	_environment.background_color = Color("#252729")
	_environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	_environment.ambient_light_color = Color("#a3a6a5")
	_environment.ambient_light_energy = 1.0
	_environment.fog_enabled = true
	_environment.fog_light_color = Color("#777a79")
	_environment.fog_density = 0.0062
	world_env.environment = _environment
	add_child(world_env)
	_key_light = DirectionalLight3D.new()
	_key_light.light_color = Color("#b8c0c0")
	_key_light.light_energy = _brightness_energy[_brightness_index]
	_key_light.rotation_degrees = Vector3(-53,-38,0)
	_key_light.shadow_enabled = true
	_key_light.directional_shadow_max_distance = 95.0
	add_child(_key_light)
	var blast_fill := DirectionalLight3D.new()
	blast_fill.light_color = Color("#b16a4d")
	blast_fill.light_energy = 0.42
	blast_fill.rotation_degrees = Vector3(-34,122,0)
	blast_fill.shadow_enabled = false
	add_child(blast_fill)

func _build_location_lights() -> void:
	_add_location_light(Vector3(190,4.6,82),Color("#c75d3e"),2.0,15.0)
	_add_location_light(Vector3(105,4.5,111),Color("#d09a63"),1.7,13.0)
	_add_location_light(Vector3(112,4.2,88),Color("#c26845"),1.35,10.0)
	_add_location_light(Vector3(54,2.2,128),Color("#e27a3d"),1.55,9.0)

func _add_location_light(pos: Vector3, color: Color, energy: float, range_value: float) -> void:
	var light := OmniLight3D.new()
	light.position = pos
	light.light_color = color
	light.light_energy = energy
	light.omni_range = range_value
	light.shadow_enabled = false
	add_child(light)

func _build_siren() -> void:
	_siren_player = AudioStreamPlayer.new()
	var stream := AudioStreamGenerator.new()
	stream.mix_rate = SIREN_RATE
	stream.buffer_length = 0.6
	_siren_player.stream = stream
	_siren_player.volume_db = -18.0
	add_child(_siren_player)

func _start_siren() -> void:
	if not _siren_player.playing:
		_siren_player.play()
		_siren_playback = _siren_player.get_stream_playback() as AudioStreamGeneratorPlayback

func _fill_siren_buffer() -> void:
	if not is_instance_valid(_siren_playback): return
	var frames := _siren_playback.get_frames_available()
	for i in range(frames):
		var frequency := 515.0+sin(_siren_lfo_phase)*175.0
		_siren_phase = fmod(_siren_phase+TAU*frequency/SIREN_RATE,TAU)
		_siren_lfo_phase = fmod(_siren_lfo_phase+TAU*0.105/SIREN_RATE,TAU)
		var sample := sin(_siren_phase)*0.085+sin(_siren_phase*2.01)*0.018
		_siren_playback.push_frame(Vector2(sample,sample))

func _update_hud() -> void:
	if not is_instance_valid(_controls) or not is_instance_valid(_player): return
	var label: String = str(_player.current_weapon_name())
	if _player.current_weapon_level() > 0: label += " +%d" % _player.current_weapon_level()
	if _player.is_in_vehicle(): label = _player.vehicle_status()+" • "+label
	_controls.update_hud(wave,_player.health,kills,score,_player.ammo,_player.reserve,label)

func _zombies_for_wave(wave_number: int) -> int:
	var safe_wave := maxi(1,wave_number)
	return mini(84,13+safe_wave*5+int(floor(float(safe_wave*safe_wave)*0.2)))

func _spawn_interval_for_wave(wave_number: int) -> float:
	return maxf(0.18,0.72-float(maxi(1,wave_number))*0.03)

func _active_zombie_cap() -> int:
	return 28 if DisplayServer.is_touchscreen_available() else 50