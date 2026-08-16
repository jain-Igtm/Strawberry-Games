extends CharacterBody3D

var game: Node
var mobile_controls: CanvasLayer

var health := 100
var kills := 0
var walk_speed := 5.1
var yaw := 0.0
var pitch := -0.02
var _bob_time := 0.0
var _last_shot_msec := -10000
var _recoil := 0.0

var _camera: Camera3D
var _gun_root: Node3D
var _muzzle_flash: MeshInstance3D
var _muzzle_light: OmniLight3D
var _muzzle_timer: Timer

func _ready() -> void:
	_build_body()
	_build_camera_and_weapon()

func _physics_process(delta: float) -> void:
	if not is_instance_valid(game):
		return

	if not bool(game.get("playing")):
		velocity.x = 0.0
		velocity.z = 0.0
		_apply_gravity(delta)
		move_and_slide()
		return

	_apply_mobile_look()
	var input_vector := _movement_input()
	var basis_forward := -global_transform.basis.z
	var basis_right := global_transform.basis.x
	basis_forward.y = 0.0
	basis_right.y = 0.0
	basis_forward = basis_forward.normalized()
	basis_right = basis_right.normalized()
	var desired := (basis_right * input_vector.x + basis_forward * input_vector.y)
	if desired.length_squared() > 1.0:
		desired = desired.normalized()

	velocity.x = desired.x * walk_speed
	velocity.z = desired.z * walk_speed
	_apply_gravity(delta)
	move_and_slide()

	var moving := desired.length_squared() > 0.01 and is_on_floor()
	if moving:
		_bob_time += delta * 8.2
	var bob_y := sin(_bob_time) * 0.028 if moving else 0.0
	var bob_x := cos(_bob_time * 0.5) * 0.012 if moving else 0.0
	_camera.position = Vector3(bob_x, 1.64 + bob_y, 0.0)
	_recoil = move_toward(_recoil, 0.0, delta * 7.0)
	_gun_root.position = Vector3(0.31, -0.27, -0.62 + _recoil * 0.06)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_apply_look(event.relative * Vector2(0.0022, 0.0019))

	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if bool(game.get("playing")):
			if Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
				Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
			else:
				shoot()

func capture_mouse() -> void:
	if not DisplayServer.is_touchscreen_available():
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func reset_player() -> void:
	health = 100
	kills = 0
	velocity = Vector3.ZERO
	global_position = Vector3(0.0, 0.05, 31.0)
	yaw = 0.0
	pitch = -0.02
	rotation = Vector3(0.0, yaw, 0.0)
	_camera.rotation = Vector3(pitch, 0.0, 0.0)

func take_hit(amount: int) -> void:
	if health <= 0:
		return
	health = maxi(0, health - amount)
	if game.has_method("on_player_health_changed"):
		game.on_player_health_changed(health)
	if health <= 0 and game.has_method("on_player_died"):
		game.on_player_died()

func shoot() -> void:
	if health <= 0 or not bool(game.get("playing")):
		return
	var now := Time.get_ticks_msec()
	if now - _last_shot_msec < 165:
		return
	_last_shot_msec = now
	_recoil = 1.0
	_show_muzzle_flash()

	var from := _camera.global_position
	var to := from + (-_camera.global_transform.basis.z * 60.0)
	var query := PhysicsRayQueryParameters3D.create(from, to)
	query.exclude = [get_rid()]
	query.collide_with_areas = false
	var hit := get_world_3d().direct_space_state.intersect_ray(query)
	if not hit.is_empty():
		var collider = hit.get("collider")
		if is_instance_valid(collider) and collider.has_method("take_damage"):
			collider.take_damage(1)

func _movement_input() -> Vector2:
	var strafe := 0.0
	var forward := 0.0
	if Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP):
		forward += 1.0
	if Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN):
		forward -= 1.0
	if Input.is_physical_key_pressed(KEY_D):
		strafe += 1.0
	if Input.is_physical_key_pressed(KEY_A):
		strafe -= 1.0

	if is_instance_valid(mobile_controls):
		var mobile_move: Vector2 = mobile_controls.get("move_vector")
		strafe += mobile_move.x
		forward += -mobile_move.y

	var input_vector := Vector2(strafe, forward)
	if input_vector.length() > 1.0:
		input_vector = input_vector.normalized()
	return input_vector

func _apply_mobile_look() -> void:
	if not is_instance_valid(mobile_controls) or not mobile_controls.has_method("consume_look_delta"):
		return
	var look_delta: Vector2 = mobile_controls.consume_look_delta()
	if look_delta != Vector2.ZERO:
		_apply_look(look_delta * Vector2(0.0052, 0.0045))

func _apply_look(delta_radians: Vector2) -> void:
	yaw -= delta_radians.x
	pitch = clampf(pitch - delta_radians.y, -1.25, 1.05)
	rotation.y = yaw
	_camera.rotation.x = pitch

func _apply_gravity(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= 19.0 * delta
	else:
		velocity.y = -0.05

func _build_body() -> void:
	var collision := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.44
	capsule.height = 1.76
	collision.shape = capsule
	collision.position.y = 0.88
	add_child(collision)

func _build_camera_and_weapon() -> void:
	_camera = Camera3D.new()
	_camera.fov = 68.0
	_camera.near = 0.05
	_camera.position = Vector3(0.0, 1.64, 0.0)
	_camera.current = true
	add_child(_camera)

	_gun_root = Node3D.new()
	_gun_root.position = Vector3(0.31, -0.27, -0.62)
	_camera.add_child(_gun_root)

	_add_gun_box(Vector3(0.20, 0.16, 0.34), Vector3(0.0, -0.02, 0.0), Color("#2c2119"))
	_add_gun_box(Vector3(0.09, 0.09, 0.58), Vector3(-0.02, 0.01, -0.38), Color("#171411"))
	_add_gun_box(Vector3(0.08, 0.20, 0.16), Vector3(0.02, -0.16, 0.02), Color("#65452c"))
	_add_gun_box(Vector3(0.17, 0.10, 0.24), Vector3(0.0, -0.04, 0.24), Color("#5d3f29"))

	_muzzle_flash = MeshInstance3D.new()
	var flash_mesh := SphereMesh.new()
	flash_mesh.radius = 0.10
	flash_mesh.height = 0.20
	_muzzle_flash.mesh = flash_mesh
	var flash_material := StandardMaterial3D.new()
	flash_material.albedo_color = Color("#ffd27d")
	flash_material.emission_enabled = true
	flash_material.emission = Color("#ff9d3b")
	_muzzle_flash.material_override = flash_material
	_muzzle_flash.position = Vector3(-0.02, 0.01, -0.72)
	_muzzle_flash.visible = false
	_gun_root.add_child(_muzzle_flash)

	_muzzle_light = OmniLight3D.new()
	_muzzle_light.light_color = Color("#ffb45f")
	_muzzle_light.light_energy = 4.2
	_muzzle_light.omni_range = 4.0
	_muzzle_light.position = _muzzle_flash.position
	_muzzle_light.visible = false
	_gun_root.add_child(_muzzle_light)

	_muzzle_timer = Timer.new()
	_muzzle_timer.one_shot = true
	_muzzle_timer.wait_time = 0.045
	_muzzle_timer.timeout.connect(_hide_muzzle_flash)
	add_child(_muzzle_timer)

func _add_gun_box(size: Vector3, local_position: Vector3, color: Color) -> void:
	var mesh_instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh_instance.mesh = mesh
	mesh_instance.position = local_position
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.82
	mesh_instance.material_override = material
	mesh_instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_gun_root.add_child(mesh_instance)

func _show_muzzle_flash() -> void:
	_muzzle_flash.visible = true
	_muzzle_light.visible = true
	_muzzle_timer.start()

func _hide_muzzle_flash() -> void:
	_muzzle_flash.visible = false
	_muzzle_light.visible = false
