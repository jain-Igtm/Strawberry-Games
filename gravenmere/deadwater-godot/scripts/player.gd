class_name AshfallPlayer
extends CharacterBody3D

signal health_changed(value: int)

@export var walk_speed := 7.2
@export var acceleration := 24.0
@export var jump_velocity := 7.0
@export var mouse_sensitivity := 0.0022
@export var touch_sensitivity := 0.0032

var camera: Camera3D
var health := 100
var move_touch_id := -1
var look_touch_id := -1
var move_touch_origin := Vector2.ZERO
var move_touch := Vector2.ZERO
var last_shot_ms := 0
var gun_pivot: Node3D
var recoil := 0.0
var spawn_position := Vector3.ZERO

func _ready() -> void:
	spawn_position = global_position
	_build_body()
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _build_body() -> void:
	var collision := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.38
	capsule.height = 1.8
	collision.shape = capsule
	collision.position.y = 0.9
	add_child(collision)

	camera = Camera3D.new()
	camera.position = Vector3(0, 1.58, 0)
	camera.fov = 72.0
	camera.near = 0.05
	camera.far = 420.0
	add_child(camera)

	gun_pivot = Node3D.new()
	gun_pivot.position = Vector3(0.27, -0.24, -0.58)
	camera.add_child(gun_pivot)

	var receiver := MeshInstance3D.new()
	var receiver_mesh := BoxMesh.new()
	receiver_mesh.size = Vector3(0.13, 0.14, 0.66)
	receiver.mesh = receiver_mesh
	receiver.material_override = TextureFactory.make_material("metal", 2.4)
	gun_pivot.add_child(receiver)

	var grip := MeshInstance3D.new()
	var grip_mesh := BoxMesh.new()
	grip_mesh.size = Vector3(0.11, 0.24, 0.13)
	grip.mesh = grip_mesh
	grip.position = Vector3(0, -0.14, 0.16)
	grip.rotation.x = -0.24
	grip.material_override = TextureFactory.make_material("wood", 3.0)
	gun_pivot.add_child(grip)

func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= float(ProjectSettings.get_setting("physics/3d/default_gravity")) * delta
	elif Input.is_action_just_pressed("jump"):
		velocity.y = jump_velocity

	var keyboard := Input.get_vector("move_left", "move_right", "move_forward", "move_backward")
	var input_vector := move_touch if move_touch_id != -1 else keyboard
	var forward := -global_transform.basis.z
	var right := global_transform.basis.x
	var direction := right * input_vector.x + forward * -input_vector.y
	direction.y = 0
	direction = direction.normalized()

	var target_x := direction.x * walk_speed
	var target_z := direction.z * walk_speed
	velocity.x = move_toward(velocity.x, target_x, acceleration * delta)
	velocity.z = move_toward(velocity.z, target_z, acceleration * delta)
	move_and_slide()

	recoil = move_toward(recoil, 0.0, delta * 7.0)
	gun_pivot.position.z = -0.58 + recoil * 0.08
	gun_pivot.rotation.x = recoil * 0.08

	if Input.is_action_just_pressed("shoot"):
		shoot()

func _input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_apply_look(event.relative.x * mouse_sensitivity, event.relative.y * mouse_sensitivity)
	elif event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if Input.mouse_mode == Input.MOUSE_MODE_VISIBLE:
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

	if event is InputEventScreenTouch:
		var viewport_size := get_viewport().get_visible_rect().size
		var reserved_fire_area := event.position.x > viewport_size.x * 0.78 and event.position.y > viewport_size.y * 0.68
		if reserved_fire_area:
			return
		if event.pressed:
			if event.position.x < viewport_size.x * 0.5 and move_touch_id == -1:
				move_touch_id = event.index
				move_touch_origin = event.position
				move_touch = Vector2.ZERO
			elif look_touch_id == -1:
				look_touch_id = event.index
		else:
			if event.index == move_touch_id:
				move_touch_id = -1
				move_touch = Vector2.ZERO
			if event.index == look_touch_id:
				look_touch_id = -1
	elif event is InputEventScreenDrag:
		if event.index == move_touch_id:
			move_touch = ((event.position - move_touch_origin) / 88.0).limit_length(1.0)
		elif event.index == look_touch_id:
			_apply_look(event.relative.x * touch_sensitivity, event.relative.y * touch_sensitivity)

func _apply_look(yaw_delta: float, pitch_delta: float) -> void:
	rotate_y(-yaw_delta)
	camera.rotation.x = clamp(camera.rotation.x - pitch_delta, -1.32, 1.32)

func shoot() -> void:
	var now := Time.get_ticks_msec()
	if now - last_shot_ms < 145:
		return
	last_shot_ms = now
	recoil = 1.0

	var origin := camera.global_position
	var end := origin + -camera.global_transform.basis.z * 120.0
	var query := PhysicsRayQueryParameters3D.create(origin, end)
	query.exclude = [get_rid()]
	query.collide_with_areas = true
	var hit := get_world_3d().direct_space_state.intersect_ray(query)
	if hit.is_empty():
		return
	var collider: Object = hit.get("collider")
	if collider != null and collider.has_method("take_hit"):
		collider.call("take_hit", 34)

func take_damage(amount: int) -> void:
	health = maxi(0, health - amount)
	health_changed.emit(health)
	if health == 0:
		global_position = spawn_position
		velocity = Vector3.ZERO
		health = 100
		health_changed.emit(health)
