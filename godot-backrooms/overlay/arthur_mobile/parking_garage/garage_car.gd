extends RigidBody3D

@export var body_color: Color = Color(0.48, 0.48, 0.42)
@export var max_forward_speed: float = 13.0
@export var max_reverse_speed: float = 5.5
@export var acceleration: float = 4.6
@export var coast_drag: float = 3.2
@export var steer_rate: float = 1.45

var driver: Node3D
var drive_input: Vector2 = Vector2.ZERO
var headlights_on: bool = false
var visual_root: Node3D
var left_headlight: SpotLight3D
var right_headlight: SpotLight3D

func _ready() -> void:
	mass = 900.0
	gravity_scale = 1.0
	collision_layer = 3
	collision_mask = 3
	continuous_cd = true
	axis_lock_angular_x = true
	axis_lock_angular_z = true
	contact_monitor = true
	max_contacts_reported = 4
	freeze = true
	add_to_group("psychic_prop")
	add_to_group("enterable_car")
	_build_collision()
	_build_visual()
	_build_headlights()

func _build_collision() -> void:
	var collision: CollisionShape3D = CollisionShape3D.new()
	collision.name = "CollisionShape3D"
	collision.position = Vector3(0, 0.62, 0)
	var shape: BoxShape3D = BoxShape3D.new()
	shape.size = Vector3(1.95, 1.35, 4.15)
	collision.shape = shape
	add_child(collision)

func _build_visual() -> void:
	visual_root = Node3D.new()
	visual_root.name = "Visual"
	add_child(visual_root)

	var body_mesh: MeshInstance3D = MeshInstance3D.new()
	var body_box: BoxMesh = BoxMesh.new()
	body_box.size = Vector3(1.86, 0.65, 3.95)
	body_mesh.mesh = body_box
	body_mesh.position = Vector3(0, 0.62, 0)
	body_mesh.material_override = _car_material(body_color, 0.38)
	visual_root.add_child(body_mesh)

	var cabin: MeshInstance3D = MeshInstance3D.new()
	var cabin_box: BoxMesh = BoxMesh.new()
	cabin_box.size = Vector3(1.62, 0.72, 1.80)
	cabin.mesh = cabin_box
	cabin.position = Vector3(0, 1.18, 0.20)
	cabin.material_override = _car_material(body_color.darkened(0.08), 0.31)
	visual_root.add_child(cabin)

	var glass: MeshInstance3D = MeshInstance3D.new()
	var glass_box: BoxMesh = BoxMesh.new()
	glass_box.size = Vector3(1.48, 0.45, 1.56)
	glass.mesh = glass_box
	glass.position = Vector3(0, 1.27, 0.12)
	var glass_mat: StandardMaterial3D = _car_material(Color(0.055, 0.075, 0.082), 0.15)
	glass_mat.metallic = 0.12
	glass.material_override = glass_mat
	visual_root.add_child(glass)

	for x: float in [-0.92, 0.92]:
		for z: float in [-1.25, 1.25]:
			var wheel: MeshInstance3D = MeshInstance3D.new()
			var wheel_mesh: CylinderMesh = CylinderMesh.new()
			wheel_mesh.top_radius = 0.34
			wheel_mesh.bottom_radius = 0.34
			wheel_mesh.height = 0.24
			wheel.mesh = wheel_mesh
			wheel.position = Vector3(x, 0.37, z)
			wheel.rotation.z = PI * 0.5
			wheel.material_override = _car_material(Color(0.025, 0.027, 0.028), 0.98)
			visual_root.add_child(wheel)

func _car_material(color: Color, roughness_value: float) -> StandardMaterial3D:
	var material: StandardMaterial3D = StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness_value
	return material

func _build_headlights() -> void:
	left_headlight = _make_headlight(Vector3(-0.63, 0.72, -2.05))
	right_headlight = _make_headlight(Vector3(0.63, 0.72, -2.05))
	set_headlights(false)

func _make_headlight(local_pos: Vector3) -> SpotLight3D:
	var light: SpotLight3D = SpotLight3D.new()
	light.position = local_pos
	light.light_color = Color(0.91, 0.94, 0.82)
	light.light_energy = 3.0
	light.spot_range = 22.0
	light.spot_angle = 31.0
	light.spot_attenuation = 0.72
	light.shadow_enabled = false
	light.distance_fade_enabled = true
	light.distance_fade_begin = 24.0
	light.distance_fade_length = 8.0
	add_child(light)

	var lens: MeshInstance3D = MeshInstance3D.new()
	var lens_mesh: BoxMesh = BoxMesh.new()
	lens_mesh.size = Vector3(0.34, 0.18, 0.05)
	lens.mesh = lens_mesh
	lens.position = local_pos + Vector3(0, 0, -0.03)
	var lens_mat: StandardMaterial3D = StandardMaterial3D.new()
	lens_mat.albedo_color = Color(0.76, 0.81, 0.70)
	lens_mat.emission_enabled = true
	lens_mat.emission = Color(0.84, 0.90, 0.76)
	lens_mat.emission_energy_multiplier = 1.55
	lens.material_override = lens_mat
	add_child(lens)
	return light

func set_driver(value: Node3D) -> void:
	driver = value
	drive_input = Vector2.ZERO
	sleeping = false
	if has_driver():
		freeze = false
		if is_in_group("psychic_prop"):
			remove_from_group("psychic_prop")
	else:
		if not is_in_group("psychic_prop"):
			add_to_group("psychic_prop")
		linear_velocity *= 0.32
		angular_velocity = Vector3.ZERO
		set_headlights(false)

func has_driver() -> bool:
	return driver != null and is_instance_valid(driver)

func set_drive_input(value: Vector2) -> void:
	drive_input = value.limit_length(1.0)
	if has_driver() and absf(drive_input.y) > 0.12 and not headlights_on:
		set_headlights(true)

func set_headlights(value: bool) -> void:
	headlights_on = value
	if left_headlight != null:
		left_headlight.visible = value
	if right_headlight != null:
		right_headlight.visible = value

func toggle_headlights() -> bool:
	set_headlights(not headlights_on)
	return headlights_on

func get_seat_position() -> Vector3:
	return to_global(Vector3(-0.48, 0.82, 0.18))

func get_exit_position() -> Vector3:
	return to_global(Vector3(-1.72, 0.88, 0.10))

func _integrate_forces(state: PhysicsDirectBodyState3D) -> void:
	if not has_driver():
		return

	var step: float = state.step
	var forward: Vector3 = -state.transform.basis.z
	forward.y = 0.0
	forward = forward.normalized()

	var current: Vector3 = state.linear_velocity
	var horizontal: Vector3 = Vector3(current.x, 0, current.z)
	var forward_speed: float = horizontal.dot(forward)
	var throttle: float = clampf(drive_input.y, -1.0, 1.0)
	var target_speed: float = throttle * (max_forward_speed if throttle >= 0.0 else max_reverse_speed)

	if absf(throttle) > 0.05:
		var desired: Vector3 = forward * target_speed
		var response: float = clampf(acceleration * step, 0.0, 1.0)
		horizontal = horizontal.lerp(desired, response)
	else:
		horizontal = horizontal.move_toward(Vector3.ZERO, coast_drag * step)

	state.linear_velocity = Vector3(horizontal.x, current.y, horizontal.z)

	var steer: float = clampf(drive_input.x, -1.0, 1.0)
	var speed_factor: float = clampf(absf(forward_speed) / 4.0, 0.18, 1.0)
	var direction_sign: float = 1.0 if forward_speed >= -0.15 else -1.0
	var angular: Vector3 = state.angular_velocity
	angular.y = -steer * steer_rate * speed_factor * direction_sign
	state.angular_velocity = angular