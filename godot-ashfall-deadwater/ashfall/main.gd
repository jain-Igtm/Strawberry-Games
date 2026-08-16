extends Node3D

const WORLD_SCRIPT = preload("res://ashfall/world_builder.gd")
const PLAYER_SCRIPT = preload("res://ashfall/player.gd")
const ZOMBIE_SCRIPT = preload("res://ashfall/zombie.gd")
const CONTROLS_SCRIPT = preload("res://ashfall/mobile_controls.gd")

var playing := false
var paused := false
var game_over := false
var wave := 1
var kills := 0
var score := 0
var weapon_level := 0
var weapon_damage_multiplier := 1.0

var _pending_spawns := 0
var _spawn_left := 0.0
var _intermission := 0.0
var _between_waves := false
var _zombies: Array[Node] = []
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

# Procedural civil-defense siren, so the native build stays offline and asset-free.
var _siren_player: AudioStreamPlayer
var _siren_playback: AudioStreamGeneratorPlayback
var _siren_phase := 0.0
var _siren_lfo_phase := 0.0
const SIREN_RATE := 22050.0

func _ready() -> void:
	_rng.randomize()
	_build_environment()
	_world = WORLD_SCRIPT.new()
	_world.name = "DockTown"
	add_child(_world)
	_world.build()
	_build_controls()
	_build_player()
	_build_siren()
	_update_hud()

func _process(delta: float) -> void:
	_fill_siren_buffer()
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
		else:
			_intermission -= delta
			if _intermission <= 0.0:
				_finish_intermission()
	_update_hud()

func _start_game() -> void:
	_clear_zombies()
	playing = true
	paused = false
	game_over = false
	wave = 1
	kills = 0
	score = 0
	weapon_level = 0
	weapon_damage_multiplier = 1.0
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
	if _pending_spawns <= 0:
		return
	var spawn_position := _choose_spawn_position()
	var zombie = ZOMBIE_SCRIPT.new()
	zombie.game = self
	zombie.target = _player
	zombie.max_health = round(175.0 * pow(1.14, float(wave - 1)))
	zombie.health = zombie.max_health
	zombie.speed = minf(6.6, 3.0 + float(wave) * 0.18)
	zombie.damage = minf(42.0, 8.0 + float(wave) * 1.5)
	zombie.attack_delay = maxf(0.32, 0.72 - float(wave) * 0.02)
	zombie.runner = wave >= 4 and _rng.randf() < minf(0.35, 0.08 + wave * 0.018)
	if zombie.runner:
		zombie.speed = minf(6.6, zombie.speed * 1.12)
	zombie.position = spawn_position
	add_child(zombie)
	_zombies.append(zombie)
	_pending_spawns -= 1

func _choose_spawn_position() -> Vector3:
	var candidates: Array[Vector3] = _world.spawn_points
	var best := candidates[_rng.randi_range(0, candidates.size()-1)]
	for attempt in range(8):
		var candidate := candidates[_rng.randi_range(0, candidates.size()-1)]
		if candidate.distance_to(_player.global_position) > 28.0:
			return candidate + Vector3(_rng.randf_range(-2.2,2.2),0,_rng.randf_range(-2.2,2.2))
	return best

func _prune_zombies() -> void:
	for i in range(_zombies.size()-1, -1, -1):
		if not is_instance_valid(_zombies[i]) or _zombies[i].is_queued_for_deletion():
			_zombies.remove_at(i)

func _clear_zombies() -> void:
	for zombie in _zombies:
		if is_instance_valid(zombie): zombie.queue_free()
	_zombies.clear()
	_pending_spawns = 0
	_between_waves = false

func on_zombie_killed(zombie: Node) -> void:
	_zombies.erase(zombie)
	kills += 1
	_update_hud()

func register_hit(headshot: bool, killed: bool) -> void:
	if killed:
		score += 160 if headshot else 100
	else:
		score += 20 if headshot else 10
	_controls.flash_hit(killed)
	if headshot and killed:
		_controls.show_toast("HEADSHOT +160", 0.7)
	elif killed:
		_controls.show_toast("KILL +100", 0.55)
	_update_hud()

func on_player_state_changed() -> void:
	_update_hud()

func on_player_died() -> void:
	if game_over:
		return
	playing = false
	game_over = true
	paused = false
	_player.release_mouse()
	_controls.show_game_over(score, kills, wave)

func request_use() -> void:
	if not playing or paused:
		return
	var forge_pos: Vector3 = _world.interaction_points["forge"]
	var fuel_pos: Vector3 = _world.interaction_points["fuel"]
	if _player.global_position.distance_to(forge_pos) < 5.0:
		var cost := 2200 + weapon_level * 1800
		if score < cost:
			_controls.show_toast("FORGE REQUIRES %d PTS" % cost, 1.2)
			return
		score -= cost
		weapon_level += 1
		weapon_damage_multiplier = 1.0 + float(weapon_level) * 0.48
		_controls.show_toast("RUSTLINE FORGE LV.%d" % weapon_level, 1.4)
		_update_hud()
	elif _player.global_position.distance_to(fuel_pos) < 5.5:
		_controls.show_toast("FUEL PUMP • 300 PTS • VEHICLE REQUIRED", 1.3)
	else:
		_controls.show_toast("NOTHING TO USE", 0.7)

func request_swap() -> void:
	if playing and not paused:
		_controls.show_toast("NO SECONDARY EQUIPPED", 0.8)

func toggle_pause() -> void:
	if game_over or not playing:
		return
	paused = not paused
	if paused:
		_player.release_mouse()
	else:
		_player.capture_mouse()
	_controls.set_paused(paused, _sensitivity_labels[_player.sensitivity_index], _brightness_labels[_brightness_index])

func _resume() -> void:
	if paused:
		toggle_pause()

func _cycle_sensitivity() -> void:
	_player.cycle_sensitivity()
	_controls.set_paused(true, _sensitivity_labels[_player.sensitivity_index], _brightness_labels[_brightness_index])

func _cycle_brightness() -> void:
	_brightness_index = (_brightness_index + 1) % _brightness_energy.size()
	_key_light.light_energy = _brightness_energy[_brightness_index]
	_environment.ambient_light_energy = 0.76 + float(_brightness_index) * 0.12
	_controls.set_paused(true, _sensitivity_labels[_player.sensitivity_index], _brightness_labels[_brightness_index])

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
	if not is_instance_valid(_siren_playback):
		return
	var frames := _siren_playback.get_frames_available()
	for i in range(frames):
		var frequency := 515.0 + sin(_siren_lfo_phase) * 175.0
		_siren_phase = fmod(_siren_phase + TAU * frequency / SIREN_RATE, TAU)
		_siren_lfo_phase = fmod(_siren_lfo_phase + TAU * 0.105 / SIREN_RATE, TAU)
		var sample := sin(_siren_phase) * 0.085 + sin(_siren_phase * 2.01) * 0.018
		_siren_playback.push_frame(Vector2(sample,sample))

func _update_hud() -> void:
	if not is_instance_valid(_controls) or not is_instance_valid(_player):
		return
	_controls.update_hud(wave, _player.health, kills, score, _player.ammo, _player.reserve, "RUSTLINE CARBINE +%d" % weapon_level if weapon_level > 0 else "RUSTLINE CARBINE")

func _zombies_for_wave(wave_number: int) -> int:
	var safe_wave := maxi(1, wave_number)
	return mini(84, 13 + safe_wave * 5 + int(floor(float(safe_wave * safe_wave) * 0.2)))

func _spawn_interval_for_wave(wave_number: int) -> float:
	return maxf(0.18, 0.72 - float(maxi(1,wave_number)) * 0.03)

func _active_zombie_cap() -> int:
	return 28 if DisplayServer.is_touchscreen_available() else 50
