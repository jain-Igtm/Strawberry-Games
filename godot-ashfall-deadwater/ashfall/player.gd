extends CharacterBody3D

const WEAPON_RULES = preload("res://ashfall/weapons.gd")
const WALK_SPEED := 7.45
const JUMP_VELOCITY := 6.25
const GRAVITY := 20.5
const LOOK_SENSITIVITIES := [1.15, 1.6, 2.05]

var game: Node
var controls: CanvasLayer

var health := 100.0
var ammo := 30
var reserve := 180
var yaw := PI
var pitch := -0.03
var sensitivity_index := 1
var ads := false
var reloading := false
var current_weapon_id := "carbine"
var weapon_slots: Array[String] = ["carbine"]
var weapon_index := 0
var weapon_ammo: Dictionary = {}
var weapon_levels: Dictionary = {}
var current_vehicle: CharacterBody3D

var _reload_left := 0.0
var _fire_cooldown := 0.0
var _mouse_fire_held := false
var _trigger_was_held := false
var _jump_queued := false
var _seconds_since_damage := 99.0
var _was_airborne := false
var _fall_start_y := 0.0
var _bob := 0.0
var _recoil := 0.0

var _collision: CollisionShape3D
var _camera: Camera3D
var _weapon_root: Node3D
var _muzzle: MeshInstance3D
var _muzzle_light: OmniLight3D
var _muzzle_timer: Timer
var _rng := RandomNumberGenerator.new()

func _ready() -> void:
	_rng.randomize()
	_build_collision()
	_build_camera()
	_muzzle_timer = Timer.new()
	_muzzle_timer.one_shot = true
	_muzzle_timer.wait_time = 0.04
	_muzzle_timer.timeout.connect(_hide_muzzle)
	add_child(_muzzle_timer)
	_initialize_weapon_state()
	_build_weapon_visual()
	rotation.y = yaw

func _physics_process(delta: float) -> void:
	_fire_cooldown = maxf(0.0, _fire_cooldown - delta)
	_recoil = move_toward(_recoil, 0.0, delta * 6.0)
	_seconds_since_damage += delta
	if health < 100.0 and _seconds_since_damage >= 4.25 and is_gameplay_active():
		health = minf(100.0, health + 5.5 * delta)
		game.on_player_state_changed()

	if reloading:
		_reload_left -= delta
		if _reload_left <= 0.0:
			_finish_reload()

	if not is_gameplay_active():
		velocity = Vector3.ZERO
		_trigger_was_held = false
		return

	_apply_touch_look()

	if is_in_vehicle():
		var drive_input := _movement_vector()
		current_vehicle.drive(drive_input, delta)
		global_position = current_vehicle.global_position + Vector3(0.0, 0.54, 0.0)
		velocity = Vector3.ZERO
		_trigger_was_held = false
		return

	var input_vec := _movement_vector()
	var forward := -global_transform.basis.z
	var right := global_transform.basis.x
	forward.y = 0.0
	right.y = 0.0
	forward = forward.normalized()
	right = right.normalized()
	var wish := right * input_vec.x + forward * input_vec.y
	if wish.length_squared() > 1.0:
		wish = wish.normalized()
	velocity.x = wish.x * WALK_SPEED
	velocity.z = wish.z * WALK_SPEED

	if _jump_queued and is_on_floor():
		velocity.y = JUMP_VELOCITY
		_was_airborne = true
		_fall_start_y = global_position.y
	_jump_queued = false

	_apply_gravity(delta)
	move_and_slide()
	_check_fall_damage()
	_update_view_bob(delta, wish.length_squared() > 0.01 and is_on_floor())

	var trigger_held := _mouse_fire_held
	if is_instance_valid(controls):
		trigger_held = trigger_held or bool(controls.get("fire_held"))
	var definition := current_weapon_definition()
	if trigger_held and (bool(definition["automatic"]) or not _trigger_was_held):
		fire()
	_trigger_was_held = trigger_held

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED and is_gameplay_active():
		var scale := LOOK_SENSITIVITIES[sensitivity_index]
		_apply_look(event.relative.x * 0.0021 * scale, event.relative.y * 0.0019 * scale)
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED and is_gameplay_active():
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
			return
		_mouse_fire_held = event.pressed
	elif event is InputEventKey and event.pressed and not event.echo:
		match event.physical_keycode:
			KEY_R:
				request_reload()
			KEY_SPACE:
				request_jump()
			KEY_E:
				if is_instance_valid(game): game.request_use()
			KEY_Q:
				if is_instance_valid(game): game.request_swap()
			KEY_ESCAPE:
				if is_instance_valid(game): game.toggle_pause()

func is_gameplay_active() -> bool:
	return is_instance_valid(game) and bool(game.get("playing")) and not bool(game.get("paused")) and health > 0.0

func reset_player() -> void:
	if is_in_vehicle():
		exit_vehicle(true)
	health = 100.0
	yaw = PI
	pitch = -0.03
	ads = false
	reloading = false
	_reload_left = 0.0
	_fire_cooldown = 0.0
	_trigger_was_held = false
	_seconds_since_damage = 99.0
	velocity = Vector3.ZERO
	global_position = Vector3(92.0, 0.08, 67.0)
	rotation = Vector3(0.0, yaw, 0.0)
	_camera.rotation = Vector3(pitch, 0.0, 0.0)
	_camera.fov = 69.0
	weapon_slots = ["carbine"]
	weapon_index = 0
	weapon_ammo.clear()
	weapon_levels.clear()
	_initialize_weapon_state()
	_load_weapon("carbine")
	if is_instance_valid(controls): controls.set_ads(false)

func capture_mouse() -> void:
	if not DisplayServer.is_touchscreen_available():
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func release_mouse() -> void:
	_mouse_fire_held = false
	_trigger_was_held = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

func request_jump() -> void:
	if is_gameplay_active() and not is_in_vehicle():
		_jump_queued = true

func request_reload() -> void:
	if not is_gameplay_active() or is_in_vehicle() or reloading or reserve <= 0:
		return
	var mag_size := current_magazine_size()
	if ammo >= mag_size:
		return
	reloading = true
	_reload_left = float(current_weapon_definition()["reload"])
	if is_instance_valid(controls):
		controls.set_reloading(true)
		controls.show_toast("RELOADING " + current_weapon_name(), 0.8)
	game.on_player_state_changed()

func toggle_ads() -> void:
	if not is_gameplay_active() or is_in_vehicle():
		return
	ads = not ads
	var optic := WEAPON_RULES.optic_fov(current_weapon_id, current_weapon_level())
	_camera.fov = optic if ads and optic > 0.0 else (54.0 if ads else 69.0)
	var base_view: Vector3 = current_weapon_definition()["view"]
	_weapon_root.position.x = 0.04 if ads else base_view.x
	_weapon_root.position.y = -0.24 if ads else base_view.y
	if is_instance_valid(controls): controls.set_ads(ads)

func cycle_sensitivity() -> void:
	sensitivity_index = (sensitivity_index + 1) % LOOK_SENSITIVITIES.size()

func fire() -> void:
	if not is_gameplay_active() or is_in_vehicle() or reloading or _fire_cooldown > 0.0:
		return
	if ammo <= 0:
		request_reload()
		return
	var definition := current_weapon_definition()
	ammo -= 1
	_store_current_ammo()
	_fire_cooldown = float(definition["fire_delay"])
	_recoil = 1.0
	_show_muzzle()
	game.on_player_state_changed()

	var pellets := int(definition["pellets"])
	var base_damage := float(definition["damage"]) * WEAPON_RULES.damage_multiplier(current_weapon_level())
	var spread := float(definition["spread"]) * (0.35 if ads else 1.0)
	var origin := _camera.global_position
	var forward := -_camera.global_transform.basis.z
	var right := _camera.global_transform.basis.x
	var up := _camera.global_transform.basis.y
	for pellet in range(pellets):
		var direction := (forward + right * _rng.randf_range(-spread, spread) + up * _rng.randf_range(-spread, spread)).normalized()
		var query := PhysicsRayQueryParameters3D.create(origin, origin + direction * 220.0)
		query.exclude = [get_rid()]
		query.collide_with_areas = false
		var hit := get_world_3d().direct_space_state.intersect_ray(query)
		if hit.is_empty():
			continue
		var collider = hit.get("collider")
		if is_instance_valid(collider) and collider.has_method("take_bullet"):
			var result: Dictionary = collider.take_bullet(base_damage, hit.get("position", Vector3.ZERO), float(definition["headshot"]))
			if not result.is_empty():
				game.register_hit(bool(result.get("headshot", false)), bool(result.get("killed", false)), float(result.get("bounty", 1.0)))
				if current_weapon_id == "arc" and bool(result.get("killed", false)) and game.has_method("arc_chain_from"):
					game.arc_chain_from(hit.get("position", Vector3.ZERO), base_damage * 0.42)

func take_damage(amount: float) -> void:
	if health <= 0.0 or not bool(game.get("playing")):
		return
	health = maxf(0.0, health - amount)
	_seconds_since_damage = 0.0
	if is_instance_valid(controls): controls.flash_damage()
	game.on_player_state_changed()
	if health <= 0.0:
		game.on_player_died()

func heal(amount: float) -> void:
	if health <= 0.0:
		return
	var before := health
	health = minf(100.0, health + amount)
	if health > before and is_instance_valid(controls):
		controls.show_toast("MEDICAL +%d" % roundi(health - before), 0.7)
	game.on_player_state_changed()

func add_reserve(amount: int) -> void:
	var definition := current_weapon_definition()
	var cap := int(definition["reserve"]) * 2
	reserve = mini(cap, reserve + amount)
	_store_current_ammo()
	if is_instance_valid(controls): controls.show_toast("AMMO +%d" % amount, 0.55)
	game.on_player_state_changed()

func give_weapon(id: String) -> bool:
	if not WEAPON_RULES.WEAPONS.has(id):
		return false
	_store_current_ammo()
	if weapon_slots.has(id):
		var state: Dictionary = weapon_ammo[id]
		var definition := WEAPON_RULES.definition(id)
		state["reserve"] = mini(int(definition["reserve"]) * 2, int(state["reserve"]) + int(definition["reserve"]) / 2)
		weapon_ammo[id] = state
		weapon_index = weapon_slots.find(id)
	else:
		weapon_slots.append(id)
		weapon_index = weapon_slots.size() - 1
		var definition2 := WEAPON_RULES.definition(id)
		weapon_ammo[id] = {"ammo": int(definition2["magazine"]), "reserve": int(definition2["reserve"])}
		weapon_levels[id] = 0
	_load_weapon(id)
	return true

func swap_weapon() -> bool:
	if weapon_slots.size() <= 1 or is_in_vehicle():
		return false
	_store_current_ammo()
	weapon_index = (weapon_index + 1) % weapon_slots.size()
	_load_weapon(weapon_slots[weapon_index])
	return true

func upgrade_current_weapon() -> int:
	var old_level := current_weapon_level()
	var old_mag := current_magazine_size()
	var new_level := old_level + 1
	weapon_levels[current_weapon_id] = new_level
	var new_mag := current_magazine_size()
	ammo = mini(new_mag, ammo + maxi(0, new_mag - old_mag))
	_store_current_ammo()
	_build_weapon_visual()
	return new_level

func current_weapon_definition() -> Dictionary:
	return WEAPON_RULES.definition(current_weapon_id)

func current_weapon_name() -> String:
	return str(current_weapon_definition()["name"])

func current_weapon_level() -> int:
	return int(weapon_levels.get(current_weapon_id, 0))

func current_magazine_size() -> int:
	return WEAPON_RULES.magazine_size(current_weapon_id, current_weapon_level())

func current_upgrade_cost() -> int:
	return WEAPON_RULES.upgrade_cost(current_weapon_level())

func has_weapon(id: String) -> bool:
	return weapon_slots.has(id)

func enter_vehicle(vehicle: CharacterBody3D) -> bool:
	if is_in_vehicle() or not is_instance_valid(vehicle):
		return false
	current_vehicle = vehicle
	vehicle.driver = self
	_collision.set_deferred("disabled", true)
	_weapon_root.visible = false
	ads = false
	_camera.fov = 72.0
	if is_instance_valid(controls): controls.set_ads(false)
	return true

func exit_vehicle(force_exit := false) -> bool:
	if not is_in_vehicle():
		return false
	var vehicle := current_vehicle
	vehicle.driver = null
	current_vehicle = null
	var side := vehicle.global_transform.basis.x.normalized()
	global_position = vehicle.global_position + side * (2.25 if not force_exit else 2.8) + Vector3(0,0.15,0)
	_collision.set_deferred("disabled", false)
	_weapon_root.visible = true
	_camera.fov = 69.0
	return true

func is_in_vehicle() -> bool:
	return is_instance_valid(current_vehicle)

func vehicle_status() -> String:
	if not is_in_vehicle():
		return ""
	return "%s • FUEL %d%%" % [str(current_vehicle.label), int(current_vehicle.fuel_percent())]

func _finish_reload() -> void:
	reloading = false
	var needed := current_magazine_size() - ammo
	var moved := mini(needed, reserve)
	ammo += moved
	reserve -= moved
	_store_current_ammo()
	if is_instance_valid(controls): controls.set_reloading(false)
	game.on_player_state_changed()

func _movement_vector() -> Vector2:
	var x := 0.0
	var y := 0.0
	if Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP): y += 1.0
	if Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN): y -= 1.0
	if Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT): x += 1.0
	if Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT): x -= 1.0
	if is_instance_valid(controls):
		var touch_move: Vector2 = controls.get("move_vector")
		x += touch_move.x
		y += -touch_move.y
	var result := Vector2(x, y)
	return result.normalized() if result.length() > 1.0 else result

func _apply_touch_look() -> void:
	if not is_instance_valid(controls): return
	var delta: Vector2 = controls.consume_look_delta()
	if delta == Vector2.ZERO: return
	var scale := LOOK_SENSITIVITIES[sensitivity_index]
	_apply_look(delta.x * 0.0048 * scale, delta.y * 0.0042 * scale)

func _apply_look(dx: float, dy: float) -> void:
	yaw -= dx
	pitch = clampf(pitch - dy, -1.18, 1.04)
	rotation.y = yaw
	_camera.rotation.x = pitch

func _apply_gravity(delta: float) -> void:
	if not is_on_floor():
		if not _was_airborne:
			_was_airborne = true
			_fall_start_y = global_position.y
		velocity.y -= GRAVITY * delta
	elif velocity.y <= 0.0:
		velocity.y = -0.05

func _check_fall_damage() -> void:
	if _was_airborne and is_on_floor():
		_was_airborne = false
		var drop := _fall_start_y - global_position.y
		if drop > 2.4:
			var damage := minf(18.0, maxf(4.0, ceil((drop - 2.4) * 3.0)))
			take_damage(damage)

func _update_view_bob(delta: float, moving: bool) -> void:
	if moving:
		_bob += delta * 10.0
	var bob_y := sin(_bob) * 0.026 if moving else 0.0
	var bob_x := cos(_bob * 0.5) * 0.012 if moving else 0.0
	_camera.position = Vector3(bob_x, 1.82 + bob_y, 0.0)
	var base_view: Vector3 = current_weapon_definition()["view"]
	_weapon_root.position.z = base_view.z + _recoil * (0.13 if current_weapon_id == "shotgun" else 0.065)
	_weapon_root.rotation.x = -_recoil * (0.085 if current_weapon_id in ["shotgun","marksman","harpoon"] else 0.045)

func _build_collision() -> void:
	_collision = CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.5
	capsule.height = 1.8
	_collision.shape = capsule
	_collision.position.y = 0.9
	add_child(_collision)

func _build_camera() -> void:
	_camera = Camera3D.new()
	_camera.fov = 69.0
	_camera.near = 0.06
	_camera.far = 440.0
	_camera.position = Vector3(0, 1.82, 0)
	_camera.current = true
	_camera.rotation.x = pitch
	add_child(_camera)

func _initialize_weapon_state() -> void:
	var carbine := WEAPON_RULES.definition("carbine")
	weapon_ammo["carbine"] = {"ammo": int(carbine["magazine"]), "reserve": int(carbine["reserve"])}
	weapon_levels["carbine"] = 0
	current_weapon_id = "carbine"
	ammo = int(carbine["magazine"])
	reserve = int(carbine["reserve"])

func _store_current_ammo() -> void:
	weapon_ammo[current_weapon_id] = {"ammo": ammo, "reserve": reserve}

func _load_weapon(id: String) -> void:
	current_weapon_id = id
	var state: Dictionary = weapon_ammo.get(id, {})
	var definition := WEAPON_RULES.definition(id)
	if state.is_empty():
		state = {"ammo": int(definition["magazine"]), "reserve": int(definition["reserve"])}
		weapon_ammo[id] = state
	ammo = int(state["ammo"])
	reserve = int(state["reserve"])
	reloading = false
	ads = false
	_camera.fov = 69.0
	if is_instance_valid(controls):
		controls.set_ads(false)
		controls.set_reloading(false)
	_build_weapon_visual()
	if is_instance_valid(game): game.on_player_state_changed()

func _build_weapon_visual() -> void:
	if is_instance_valid(_weapon_root):
		_weapon_root.queue_free()
	_weapon_root = Node3D.new()
	_weapon_root.name = current_weapon_name().validate_node_name()
	var definition := current_weapon_definition()
	_weapon_root.position = definition["view"]
	_weapon_root.scale = definition["scale"]
	_camera.add_child(_weapon_root)
	var accent: Color = definition["accent"]
	_add_weapon_box(Vector3(0.18,0.18,0.70), Vector3(0,0,-0.28), Color("#252728"))
	_add_weapon_box(Vector3(0.28,0.24,0.43), Vector3(0,-0.04,0.10), accent.darkened(0.42))
	_add_weapon_box(Vector3(0.13,0.30,0.18), Vector3(0,-0.21,0.06), Color("#35251f"), Vector3(deg_to_rad(-12),0,0))
	_add_weapon_box(Vector3(0.10,0.09,0.52), Vector3(0,0.08,-0.63), Color("#1e2021"))
	_add_weapon_box(Vector3(0.23,0.12,0.30), Vector3(0,0.11,0.06), accent)
	if current_weapon_id in ["marksman","harpoon"]:
		_add_weapon_box(Vector3(0.15,0.16,0.34), Vector3(0,0.22,-0.14), Color("#1a1e20"))
	if current_weapon_id == "lmg":
		_add_weapon_box(Vector3(0.34,0.32,0.36), Vector3(0,-0.18,-0.05), accent.darkened(0.32))
	if current_weapon_id == "arc":
		_add_weapon_box(Vector3(0.10,0.10,0.48), Vector3(0.14,0.10,-0.34), accent, Vector3.ZERO, true)
		_add_weapon_box(Vector3(0.10,0.10,0.48), Vector3(-0.14,0.10,-0.34), accent, Vector3.ZERO, true)
	_muzzle = MeshInstance3D.new()
	var flash_mesh := SphereMesh.new()
	flash_mesh.radius = 0.09
	flash_mesh.height = 0.18
	_muzzle.mesh = flash_mesh
	_muzzle.position = Vector3(0,0.08,-0.93)
	var flash_mat := StandardMaterial3D.new()
	flash_mat.albedo_color = Color("#aaf6ff") if current_weapon_id == "arc" else Color("#ffc66e")
	flash_mat.emission_enabled = true
	flash_mat.emission = Color("#54d9e8") if current_weapon_id == "arc" else Color("#ff8a38")
	_muzzle.material_override = flash_mat
	_muzzle.visible = false
	_weapon_root.add_child(_muzzle)
	_muzzle_light = OmniLight3D.new()
	_muzzle_light.position = _muzzle.position
	_muzzle_light.light_color = Color("#65dce8") if current_weapon_id == "arc" else Color("#ff9a52")
	_muzzle_light.light_energy = 4.2
	_muzzle_light.omni_range = 5.4
	_muzzle_light.visible = false
	_weapon_root.add_child(_muzzle_light)
	_weapon_root.visible = not is_in_vehicle()

func _add_weapon_box(size: Vector3, pos: Vector3, color: Color, rot := Vector3.ZERO, emissive := false) -> void:
	var instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	instance.mesh = mesh
	instance.position = pos
	instance.rotation = rot
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.78
	material.metallic = 0.35
	if emissive:
		material.emission_enabled = true
		material.emission = color
	instance.material_override = material
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_weapon_root.add_child(instance)

func _show_muzzle() -> void:
	if not is_instance_valid(_muzzle): return
	_muzzle.visible = true
	_muzzle_light.visible = true
	_muzzle_timer.start()

func _hide_muzzle() -> void:
	if is_instance_valid(_muzzle): _muzzle.visible = false
	if is_instance_valid(_muzzle_light): _muzzle_light.visible = false
