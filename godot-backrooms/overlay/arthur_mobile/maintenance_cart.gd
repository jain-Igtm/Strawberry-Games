extends CharacterBody3D

@export var max_forward_speed := 12.5
@export var max_reverse_speed := 5.0
@export var acceleration := 12.0
@export var braking := 18.0
@export var coast_drag := 5.2
@export var steering_rate := 1.55
@export var gravity := 18.0

var drive_input := Vector2.ZERO
var current_speed := 0.0
var driver: CharacterBody3D
var headlights: Array[OmniLight3D] = []
var wheel_nodes: Array[MeshInstance3D] = []
var body_material: StandardMaterial3D
var trim_material: StandardMaterial3D
var tire_material: StandardMaterial3D
var lamp_material: StandardMaterial3D

func _ready() -> void:
	add_to_group("driveable")
	_build_cart()
	_set_headlights(false)

func set_drive_input(value: Vector2) -> void:
	drive_input = value.limit_length(1.0)

func set_driver(value: CharacterBody3D) -> void:
	driver = value
	_set_headlights(driver != null)

func clear_driver() -> void:
	driver = null
	drive_input = Vector2.ZERO
	_set_headlights(false)

func has_driver() -> bool:
	return driver != null and is_instance_valid(driver)

func exit_position() -> Vector3:
	return global_position + global_transform.basis.x * 1.55 + Vector3.UP * 0.30

func seat_position() -> Vector3:
	return global_position + Vector3.UP * 1.02 - global_transform.basis.z * 0.12

func _physics_process(delta: float) -> void:
	var throttle := drive_input.y
	var target_speed := 0.0
	if throttle >= 0.0:
		target_speed = throttle * max_forward_speed
	else:
		target_speed = throttle * max_reverse_speed

	if absf(throttle) > 0.06:
		var rate := acceleration
		if signf(target_speed) != signf(current_speed) and absf(current_speed) > 0.4:
			rate = braking
		current_speed = move_toward(current_speed, target_speed, rate * delta)
	else:
		current_speed = move_toward(current_speed, 0.0, coast_drag * delta)

	if absf(current_speed) > 0.12:
		var speed_ratio := clampf(absf(current_speed) / max_forward_speed, 0.22, 1.0)
		var travel_sign := 1.0 if current_speed >= 0.0 else -1.0
		rotate_y(-drive_input.x * steering_rate * speed_ratio * travel_sign * delta)

	var forward := -global_transform.basis.z
	forward.y = 0.0
	forward = forward.normalized()
	velocity.x = forward.x * current_speed
	velocity.z = forward.z * current_speed
	if not is_on_floor():
		velocity.y -= gravity * delta
	else:
		velocity.y = minf(velocity.y, 0.0)
	move_and_slide()

	if absf(current_speed) > 0.02:
		var spin := current_speed * delta / 0.32
		for wheel in wheel_nodes:
			if is_instance_valid(wheel):
				wheel.rotate_x(spin)

	if has_driver():
		driver.global_position = seat_position()

func _build_cart() -> void:
	_ensure_materials()

	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(1.62, 0.92, 2.86)
	collision.shape = shape
	collision.position = Vector3(0.0, 0.56, 0.0)
	add_child(collision)

	_add_box(Vector3(0.0, 0.50, 0.0), Vector3(1.58, 0.54, 2.80), body_material)
	_add_box(Vector3(0.0, 0.92, 0.56), Vector3(1.42, 0.16, 1.20), trim_material)
	_add_box(Vector3(0.0, 1.42, 0.26), Vector3(1.54, 0.10, 1.82), trim_material)
	_add_box(Vector3(-0.69, 1.17, 0.31), Vector3(0.08, 0.54, 1.72), trim_material)
	_add_box(Vector3(0.69, 1.17, 0.31), Vector3(0.08, 0.54, 1.72), trim_material)
	_add_box(Vector3(0.0, 0.97, 0.82), Vector3(1.18, 0.10, 0.50), body_material)
	_add_box(Vector3(0.0, 0.78, -1.34), Vector3(1.44, 0.18, 0.12), trim_material)

	for x_sign in [-1.0, 1.0]:
		for z_sign in [-1.0, 1.0]:
			var wheel := MeshInstance3D.new()
			var mesh := CylinderMesh.new()
			mesh.top_radius = 0.31
			mesh.bottom_radius = 0.31
			mesh.height = 0.20
			mesh.radial_segments = 12
			mesh.material = tire_material
			wheel.mesh = mesh
			wheel.rotation.z = PI * 0.5
			wheel.position = Vector3(0.82 * x_sign, 0.34, 0.92 * z_sign)
			add_child(wheel)
			wheel_nodes.append(wheel)

	for x_sign in [-1.0, 1.0]:
		var lamp_holder := MeshInstance3D.new()
		var lamp_mesh := BoxMesh.new()
		lamp_mesh.size = Vector3(0.28, 0.16, 0.08)
		lamp_mesh.material = lamp_material
		lamp_holder.mesh = lamp_mesh
		lamp_holder.position = Vector3(0.47 * x_sign, 0.72, -1.43)
		add_child(lamp_holder)

		var light := OmniLight3D.new()
		light.position = Vector3(0.47 * x_sign, 0.75, -1.56)
		light.light_color = Color(1.0, 0.88, 0.62, 1.0)
		light.light_energy = 0.82
		light.omni_range = 7.5
		light.shadow_enabled = false
		add_child(light)
		headlights.append(light)

func _add_box(position: Vector3, size: Vector3, material: Material) -> void:
	var instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = material
	instance.mesh = mesh
	instance.position = position
	add_child(instance)

func _ensure_materials() -> void:
	body_material = StandardMaterial3D.new()
	body_material.albedo_color = Color(0.72, 0.63, 0.26, 1.0)
	body_material.roughness = 0.78

	trim_material = StandardMaterial3D.new()
	trim_material.albedo_color = Color(0.15, 0.16, 0.14, 1.0)
	trim_material.metallic = 0.12
	trim_material.roughness = 0.62

	tire_material = StandardMaterial3D.new()
	tire_material.albedo_color = Color(0.035, 0.035, 0.032, 1.0)
	tire_material.roughness = 0.96

	lamp_material = StandardMaterial3D.new()
	lamp_material.albedo_color = Color(0.96, 0.84, 0.52, 1.0)
	lamp_material.emission_enabled = true
	lamp_material.emission = Color(0.95, 0.76, 0.36, 1.0)

func _set_headlights(enabled: bool) -> void:
	for light in headlights:
		if is_instance_valid(light):
			light.visible = enabled
