extends CharacterBody3D

const WALK_SPEED := 7.45
const JUMP_VELOCITY := 6.25
const GRAVITY := 20.5
const FIRE_DELAY := 0.105
const RELOAD_TIME := 1.65
const BASE_DAMAGE := 36.0
const HEADSHOT_MULTIPLIER := 1.9
const MAGAZINE_SIZE := 30
const LOOK_SENSITIVITIES := [1.15, 1.6, 2.05]

var game: Node
var controls: CanvasLayer

var health := 100.0
var ammo := MAGAZINE_SIZE
var reserve := 180
var yaw := PI
var pitch := -0.03
var sensitivity_index := 1
var ads := false
var reloading := false
var _reload_left := 0.0
var _fire_cooldown := 0.0
var _mouse_fire_held := false
var _jump_queued := false
var _seconds_since_damage := 99.0
var _was_airborne := false
var _fall_start_y := 0.0
var _bob := 0.0
var _recoil := 0.0

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
	_build_weapon()
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
		velocity.x = 0.0
		velocity.z = 0.0
		_apply_gravity(delta)
		move_and_slide()
		return

	_apply_touch_look()
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
	if trigger_held:
		fire()

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
	health = 100.0
	ammo = MAGAZINE_SIZE
	reserve = 180
	yaw = PI
	pitch = -0.03
	ads = false
	reloading = false
	_reload_left = 0.0
	_fire_cooldown = 0.0
	_seconds_since_damage = 99.0
	velocity = Vector3.ZERO
	global_position = Vector3(92.0, 0.08, 67.0)
	rotation = Vector3(0.0, yaw, 0.0)
	_camera.rotation = Vector3(pitch, 0.0, 0.0)
	_camera.fov = 69.0
	_weapon_root.visible = true
	if is_instance_valid(controls): controls.set_ads(false)

func capture_mouse() -> void:
	if not DisplayServer.is_touchscreen_available():
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func release_mouse() -> void:
	_mouse_fire_held = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

func request_jump() -> void:
	if is_gameplay_active():
		_jump_queued = true

func request_reload() -> void:
	if not is_gameplay_active() or reloading or ammo >= MAGAZINE_SIZE or reserve <= 0:
		return
	reloading = true
	_reload_left = RELOAD_TIME
	if is_instance_valid(controls):
		controls.set_reloading(true)
		controls.show_toast("RELOADING", 0.8)
	game.on_player_state_changed()

func toggle_ads() -> void:
	if not is_gameplay_active():
		return
	ads = not ads
	_camera.fov = 54.0 if ads else 69.0
	_weapon_root.position.x = 0.04 if ads else 0.34
	_weapon_root.position.y = -0.24 if ads else -0.29
	if is_instance_valid(controls): controls.set_ads(ads)

func cycle_sensitivity() -> void:
	sensitivity_index = (sensitivity_index + 1) % LOOK_SENSITIVITIES.size()

func fire() -> void:
	if not is_gameplay_active() or reloading or _fire_cooldown > 0.0:
		return
	if ammo <= 0:
		request_reload()
		return
	ammo -= 1
	_fire_cooldown = FIRE_DELAY
	_recoil = 1.0
	_show_muzzle()
	game.on_player_state_changed()

	var origin := _camera.global_position
	var forward := -_camera.global_transform.basis.z
	var right := _camera.global_transform.basis.x
	var up := _camera.global_transform.basis.y
	var spread_scale := 0.35 if ads else 1.0
	var direction := (forward + right * _rng.randf_range(-0.0025, 0.0025) * spread_scale + up * _rng.randf_range(-0.0025, 0.0025) * spread_scale).normalized()
	var query := PhysicsRayQueryParameters3D.create(origin, origin + direction * 220.0)
	query.exclude = [get_rid()]
	query.collide_with_areas = false
	var hit := get_world_3d().direct_space_state.intersect_ray(query)
	if hit.is_empty():
		return
	var collider = hit.get("collider")
	if is_instance_valid(collider) and collider.has_method("take_bullet"):
		var damage_multiplier := 1.0
		if is_instance_valid(game):
			damage_multiplier = float(game.get("weapon_damage_multiplier"))
		var result: Dictionary = collider.take_bullet(BASE_DAMAGE * damage_multiplier, hit.get("position", Vector3.ZERO), HEADSHOT_MULTIPLIER)
		if not result.is_empty():
			game.register_hit(bool(result.get("headshot", false)), bool(result.get("killed", false)))

func take_damage(amount: float) -> void:
	if health <= 0.0 or not bool(game.get("playing")):
		return
	health = maxf(0.0, health - amount)
	_seconds_since_damage = 0.0
	if is_instance_valid(controls): controls.flash_damage()
	game.on_player_state_changed()
	if health <= 0.0:
		game.on_player_died()

func add_reserve(amount: int) -> void:
	reserve = mini(360, reserve + amount)
	game.on_player_state_changed()

func _finish_reload() -> void:
	reloading = false
	var needed := MAGAZINE_SIZE - ammo
	var moved := mini(needed, reserve)
	ammo += moved
	reserve -= moved
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
	_weapon_root.position.z = -0.61 + _recoil * 0.065
	_weapon_root.rotation.x = -_recoil * 0.045

func _build_collision() -> void:
	var collision := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.5
	capsule.height = 1.8
	collision.shape = capsule
	collision.position.y = 0.9
	add_child(collision)

func _build_camera() -> void:
	_camera = Camera3D.new()
	_camera.fov = 69.0
	_camera.near = 0.06
	_camera.far = 440.0
	_camera.position = Vector3(0, 1.82, 0)
	_camera.current = true
	_camera.rotation.x = pitch
	add_child(_camera)

func _build_weapon() -> void:
	_weapon_root = Node3D.new()
	_weapon_root.name = "RustlineCarbine"
	_weapon_root.position = Vector3(0.34,-0.29,-0.61)
	_camera.add_child(_weapon_root)
	_add_weapon_box(Vector3(0.18,0.18,0.70), Vector3(0,0,-0.28), Color("#252728"))
	_add_weapon_box(Vector3(0.28,0.24,0.43), Vector3(0,-0.04,0.10), Color("#4a2d22"))
	_add_weapon_box(Vector3(0.13,0.30,0.18), Vector3(0,-0.21,0.06), Color("#35251f"), Vector3(deg_to_rad(-12),0,0))
	_add_weapon_box(Vector3(0.10,0.09,0.52), Vector3(0,0.08,-0.63), Color("#1e2021"))
	_add_weapon_box(Vector3(0.23,0.12,0.30), Vector3(0,0.11,0.06), Color("#a85a2a"))
	_muzzle = MeshInstance3D.new()
	var flash_mesh := SphereMesh.new()
	flash_mesh.radius = 0.09
	flash_mesh.height = 0.18
	_muzzle.mesh = flash_mesh
	_muzzle.position = Vector3(0,0.08,-0.93)
	var flash_mat := StandardMaterial3D.new()
	flash_mat.albedo_color = Color("#ffc66e")
	flash_mat.emission_enabled = true
	flash_mat.emission = Color("#ff8a38")
	_muzzle.material_override = flash_mat
	_muzzle.visible = false
	_weapon_root.add_child(_muzzle)
	_muzzle_light = OmniLight3D.new()
	_muzzle_light.position = _muzzle.position
	_muzzle_light.light_color = Color("#ff9a52")
	_muzzle_light.light_energy = 4.0
	_muzzle_light.omni_range = 5.0
	_muzzle_light.visible = false
	_weapon_root.add_child(_muzzle_light)
	_muzzle_timer = Timer.new()
	_muzzle_timer.one_shot = true
	_muzzle_timer.wait_time = 0.04
	_muzzle_timer.timeout.connect(_hide_muzzle)
	add_child(_muzzle_timer)

func _add_weapon_box(size: Vector3, pos: Vector3, color: Color, rot := Vector3.ZERO) -> void:
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
	instance.material_override = material
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_weapon_root.add_child(instance)

func _show_muzzle() -> void:
	_muzzle.visible = true
	_muzzle_light.visible = true
	_muzzle_timer.start()

func _hide_muzzle() -> void:
	_muzzle.visible = false
	_muzzle_light.visible = false
