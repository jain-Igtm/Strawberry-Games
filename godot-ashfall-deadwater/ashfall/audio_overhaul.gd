extends Node

# Lightweight procedural sound layer. No external samples are required, keeping the Android build compact.

const RATE := 22050
var _root: Node
var _player: CharacterBody3D
var _last_ammo := -1
var _last_player_pos := Vector3.ZERO
var _step_left := 0.0
var _moan_left := 2.0
var _rng := RandomNumberGenerator.new()
var _shot_player: AudioStreamPlayer
var _step_player: AudioStreamPlayer
var _wind_player: AudioStreamPlayer
var _shot_cache: Dictionary = {}
var _step_cache: Array[AudioStreamWAV] = []
var _moan_cache: Array[AudioStreamWAV] = []

func _ready() -> void:
	_rng.seed = 81821
	call_deferred("_boot")

func _boot() -> void:
	await get_tree().process_frame
	await get_tree().process_frame
	_root = get_parent()
	_shot_player = AudioStreamPlayer.new()
	_shot_player.volume_db = -5.0
	add_child(_shot_player)
	_step_player = AudioStreamPlayer.new()
	_step_player.volume_db = -18.0
	add_child(_step_player)
	_build_audio_cache()
	_build_wind()

func _process(delta: float) -> void:
	if not is_instance_valid(_root):
		return
	if not is_instance_valid(_player):
		_find_player()
		return
	if not bool(_root.get("playing")) or bool(_root.get("paused")):
		_last_ammo = int(_player.get("ammo"))
		_last_player_pos = _player.global_position
		return
	_detect_shot()
	_update_steps(delta)
	_update_moans(delta)

func _find_player() -> void:
	for child in _root.get_children():
		if child is CharacterBody3D and child.name == "Player":
			_player = child
			_last_ammo = int(_player.get("ammo"))
			_last_player_pos = _player.global_position
			break

func _detect_shot() -> void:
	var current_ammo := int(_player.get("ammo"))
	if _last_ammo >= 0 and current_ammo < _last_ammo and not bool(_player.get("reloading")):
		var weapon_id := str(_player.get("current_weapon_id"))
		if _shot_cache.has(weapon_id):
			_shot_player.stream = _shot_cache[weapon_id]
			_shot_player.pitch_scale = _rng.randf_range(0.96,1.035)
			_shot_player.play()
	_last_ammo = current_ammo

func _update_steps(delta: float) -> void:
	_step_left = maxf(0.0,_step_left-delta)
	var distance := _player.global_position.distance_to(_last_player_pos)
	if distance > 0.035 and _step_left <= 0.0 and _player.is_on_floor() and not bool(_player.has_method("is_in_vehicle") and _player.is_in_vehicle()):
		_step_left = 0.34
		_step_player.stream = _step_cache[_rng.randi_range(0,_step_cache.size()-1)]
		_step_player.pitch_scale = _rng.randf_range(0.91,1.08)
		_step_player.play()
	_last_player_pos = _player.global_position

func _update_moans(delta: float) -> void:
	_moan_left -= delta
	if _moan_left > 0.0:
		return
	_moan_left = _rng.randf_range(2.6,5.4)
	var candidates: Array[Node3D] = []
	for child in _root.get_children():
		if child is Node3D and child.has_method("take_bullet"):
			var distance := (child as Node3D).global_position.distance_to(_player.global_position)
			if distance > 4.0 and distance < 30.0:
				candidates.append(child)
	if candidates.is_empty():
		return
	var zombie := candidates[_rng.randi_range(0,candidates.size()-1)]
	var voice := AudioStreamPlayer3D.new()
	voice.stream = _moan_cache[_rng.randi_range(0,_moan_cache.size()-1)]
	voice.volume_db = -11.0
	voice.max_distance = 34.0
	voice.unit_size = 5.0
	voice.pitch_scale = _rng.randf_range(0.84,1.12)
	voice.position = zombie.global_position
	_root.add_child(voice)
	voice.finished.connect(voice.queue_free)
	voice.play()

func _build_audio_cache() -> void:
	_shot_cache["carbine"] = _make_shot(0.16,88.0,0.86,0.48)
	_shot_cache["smg"] = _make_shot(0.105,116.0,0.72,0.42)
	_shot_cache["shotgun"] = _make_shot(0.28,64.0,1.0,0.70)
	_shot_cache["marksman"] = _make_shot(0.23,72.0,0.96,0.58)
	_shot_cache["lmg"] = _make_shot(0.18,78.0,0.92,0.55)
	_shot_cache["harpoon"] = _make_shot(0.32,46.0,0.68,0.38)
	_shot_cache["arc"] = _make_arc_shot()
	_step_cache.append(_make_step(0.095,0.74))
	_step_cache.append(_make_step(0.11,0.62))
	_step_cache.append(_make_step(0.085,0.82))
	_moan_cache.append(_make_moan(0.78,79.0))
	_moan_cache.append(_make_moan(1.05,66.0))
	_moan_cache.append(_make_moan(0.64,93.0))

func _build_wind() -> void:
	_wind_player = AudioStreamPlayer.new()
	_wind_player.volume_db = -30.0
	_wind_player.stream = _make_wind(3.6)
	add_child(_wind_player)
	_wind_player.play()

func _make_shot(duration: float, body_frequency: float, crack: float, boom: float) -> AudioStreamWAV:
	var count := int(duration*RATE)
	var data := PackedByteArray()
	data.resize(count*2)
	var local_rng := RandomNumberGenerator.new()
	local_rng.seed = int(body_frequency*917.0+duration*10000.0)
	for i in range(count):
		var t := float(i)/float(RATE)
		var normalized := t/duration
		var envelope := exp(-normalized*8.2)
		var noise := local_rng.randf_range(-1.0,1.0)
		var body := sin(TAU*body_frequency*t)*exp(-normalized*5.1)
		var lower := sin(TAU*(body_frequency*0.47)*t)*exp(-normalized*3.6)
		var snap := noise*exp(-normalized*19.0)*crack
		var sample := (snap + body*boom + lower*boom*0.52)*envelope
		_write_sample(data,i,clampf(sample,-1.0,1.0))
	return _wav(data,RATE,false)

func _make_arc_shot() -> AudioStreamWAV:
	var duration := 0.24
	var count := int(duration*RATE)
	var data := PackedByteArray()
	data.resize(count*2)
	var local_rng := RandomNumberGenerator.new()
	local_rng.seed = 77117
	for i in range(count):
		var t := float(i)/float(RATE)
		var n := t/duration
		var freq := 860.0-520.0*n
		var tone := sin(TAU*freq*t)+0.45*sin(TAU*freq*1.91*t)
		var spark := local_rng.randf_range(-1.0,1.0)*exp(-n*8.0)
		var sample := (tone*0.30+spark*0.44)*exp(-n*4.6)
		_write_sample(data,i,clampf(sample,-1.0,1.0))
	return _wav(data,RATE,false)

func _make_step(duration: float, hardness: float) -> AudioStreamWAV:
	var count := int(duration*RATE)
	var data := PackedByteArray()
	data.resize(count*2)
	var local_rng := RandomNumberGenerator.new()
	local_rng.seed = int(duration*99991.0)
	for i in range(count):
		var t := float(i)/float(RATE)
		var n := t/duration
		var noise := local_rng.randf_range(-1.0,1.0)
		var thud := sin(TAU*92.0*t)*exp(-n*7.0)
		var sample := (noise*0.32*hardness+thud*0.55)*exp(-n*6.5)
		_write_sample(data,i,clampf(sample,-1.0,1.0))
	return _wav(data,RATE,false)

func _make_moan(duration: float, frequency: float) -> AudioStreamWAV:
	var count := int(duration*RATE)
	var data := PackedByteArray()
	data.resize(count*2)
	var local_rng := RandomNumberGenerator.new()
	local_rng.seed = int(frequency*723.0)
	for i in range(count):
		var t := float(i)/float(RATE)
		var n := t/duration
		var fade_in := minf(1.0,n*8.0)
		var fade_out := minf(1.0,(1.0-n)*5.0)
		var vibrato := sin(TAU*4.2*t)*4.0
		var voice := sin(TAU*(frequency+vibrato)*t)+0.40*sin(TAU*(frequency*2.02)*t)+0.22*sin(TAU*(frequency*3.08)*t)
		var rasp := local_rng.randf_range(-1.0,1.0)*0.18
		var sample := (voice*0.28+rasp)*fade_in*fade_out
		_write_sample(data,i,clampf(sample,-1.0,1.0))
	return _wav(data,RATE,false)

func _make_wind(duration: float) -> AudioStreamWAV:
	var count := int(duration*RATE)
	var data := PackedByteArray()
	data.resize(count*2)
	var local_rng := RandomNumberGenerator.new()
	local_rng.seed = 120091
	var smoothed := 0.0
	for i in range(count):
		var t := float(i)/float(RATE)
		var noise := local_rng.randf_range(-1.0,1.0)
		smoothed = lerpf(smoothed,noise,0.015)
		var gust := 0.55+0.45*sin(TAU*0.21*t+sin(t*0.7))
		var sample := smoothed*0.88*gust
		_write_sample(data,i,clampf(sample,-1.0,1.0))
	var stream := _wav(data,RATE,true)
	stream.loop_begin = 0
	stream.loop_end = count
	return stream

func _wav(data: PackedByteArray, rate: int, looping: bool) -> AudioStreamWAV:
	var stream := AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = rate
	stream.stereo = false
	stream.data = data
	stream.loop_mode = AudioStreamWAV.LOOP_FORWARD if looping else AudioStreamWAV.LOOP_DISABLED
	return stream

func _write_sample(data: PackedByteArray, index: int, sample: float) -> void:
	var value := int(round(sample*32767.0))
	if value < 0:
		value += 65536
	data[index*2] = value & 255
	data[index*2+1] = (value >> 8) & 255
