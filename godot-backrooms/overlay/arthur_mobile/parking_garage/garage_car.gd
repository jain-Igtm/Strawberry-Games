extends RigidBody3D

@export var body_color: Color = Color(0.48, 0.48, 0.42)
@export var appearance_seed: int = 0
@export var max_forward_speed: float = 14.5
@export var max_reverse_speed: float = 5.8
@export var acceleration: float = 4.9
@export var coast_drag: float = 3.4
@export var steer_rate: float = 1.38
@export var lateral_grip: float = 5.6

var driver: Node3D
var drive_input: Vector2 = Vector2.ZERO
var headlights_on: bool = false
var visual_root: Node3D
var left_headlight: SpotLight3D
var right_headlight: SpotLight3D
var headlight_lenses: Array[MeshInstance3D] = []
var tail_lights: Array[MeshInstance3D] = []
var headlight_off_mat: StandardMaterial3D
var headlight_on_mat: StandardMaterial3D
var tail_mat: StandardMaterial3D

func _ready() -> void:
	mass = 900.0
	gravity_scale = 1.0
	collision_layer = 3
	collision_mask = 3
	continuous_cd = true
	axis_lock_angular_x = true
	axis_lock_angular_z = true
	contact_monitor = true
	max_contacts_reported = 6
	linear_damp = 0.22
	angular_damp = 2.6
	freeze = true
	add_to_group("psychic_prop")
	add_to_group("enterable_car")
	_make_light_materials()
	_build_collision()
	_build_visual()
	_build_headlights()

func _make_light_materials() -> void:
	headlight_off_mat = _car_material(Color(0.62, 0.65, 0.58), 0.26)
	headlight_on_mat = _car_material(Color(0.86, 0.92, 0.78), 0.18)
	headlight_on_mat.emission_enabled = true
	headlight_on_mat.emission = Color(0.88, 0.95, 0.80)
	headlight_on_mat.emission_energy_multiplier = 2.2
	tail_mat = _car_material(Color(0.45, 0.025, 0.02), 0.30)
	tail_mat.emission_enabled = true
	tail_mat.emission = Color(0.58, 0.03, 0.02)
	tail_mat.emission_energy_multiplier = 0.65

func _build_collision() -> void:
	var collision: CollisionShape3D = CollisionShape3D.new()
	collision.name = "CollisionShape3D"
	collision.position = Vector3(0, 0.66, 0)
	var shape: BoxShape3D = BoxShape3D.new()
	shape.size = Vector3(1.96, 1.34, 4.18)
	collision.shape = shape
	add_child(collision)

func _build_visual() -> void:
	visual_root = Node3D.new()
	visual_root.name = "Visual"
	add_child(visual_root)

	var variant: int = posmod(appearance_seed, 4)
	var body_length: float = 3.92
	var cabin_length: float = 1.82
	var cabin_z: float = 0.18
	if variant == 1:
		body_length = 4.10
		cabin_length = 1.98
		cabin_z = 0.04
	elif variant == 2:
		body_length = 3.72
		cabin_length = 1.68
		cabin_z = 0.34
	elif variant == 3:
		body_length = 4.02
		cabin_length = 2.12
		cabin_z = 0.18

	_add_visual_box(Vector3(0, 0.55, 0), Vector3(1.86, 0.54, body_length), body_color, 0.36)
	_add_visual_box(Vector3(0, 0.83, -1.22), Vector3(1.76, 0.30, 1.28), body_color.lightened(0.015), 0.34)
	_add_visual_box(Vector3(0, 0.82, 1.35), Vector3(1.76, 0.28, 0.78), body_color.darkened(0.025), 0.37)

	var cabin_color: Color = body_color.darkened(0.07)
	_add_visual_box(Vector3(0, 1.13, cabin_z), Vector3(1.63, 0.61, cabin_length), cabin_color, 0.31)
	_add_glass_box(Vector3(0, 1.25, cabin_z - 0.03), Vector3(1.50, 0.40, cabin_length - 0.20))

	# Black pillars break up the primitive cabin silhouette and make it read as a car.
	for z: float in [cabin_z - cabin_length * 0.38, cabin_z + cabin_length * 0.38]:
		for x: float in [-0.79, 0.79]:
			_add_visual_box(Vector3(x, 1.23, z), Vector3(0.075, 0.47, 0.11), Color(0.035, 0.040, 0.041), 0.54)

	# Bumpers and rocker panels.
	_add_visual_box(Vector3(0, 0.46, -2.03), Vector3(1.82, 0.18, 0.14), Color(0.075, 0.078, 0.076), 0.76)
	_add_visual_box(Vector3(0, 0.46, 2.03), Vector3(1.82, 0.18, 0.14), Color(0.075, 0.078, 0.076), 0.76)
	for x: float in [-0.93, 0.93]:
		_add_visual_box(Vector3(x, 0.50, 0), Vector3(0.09, 0.17, 2.92), body_color.darkened(0.13), 0.48)

	_build_wheels()
	_build_small_details()

func _add_visual_box(position: Vector3, size: Vector3, color: Color, roughness_value: float) -> MeshInstance3D:
	var instance: MeshInstance3D = MeshInstance3D.new()
	var mesh: BoxMesh = BoxMesh.new()
	mesh.size = size
	instance.mesh = mesh
	instance.position = position
	instance.material_override = _car_material(color, roughness_value)
	visual_root.add_child(instance)
	return instance

func _add_glass_box(position: Vector3, size: Vector3) -> void:
	var instance: MeshInstance3D = MeshInstance3D.new()
	var mesh: BoxMesh = BoxMesh.new()
	mesh.size = size
	instance.mesh = mesh
	instance.position = position
	var glass_mat: StandardMaterial3D = _car_material(Color(0.040, 0.061, 0.071), 0.14)
	glass_mat.metallic = 0.18
	instance.material_override = glass_mat
	visual_root.add_child(instance)

func _build_wheels() -> void:
	for x: float in [-0.94, 0.94]:
		for z: float in [-1.28, 1.28]:
			var wheel: MeshInstance3D = MeshInstance3D.new()
			var wheel_mesh: CylinderMesh = CylinderMesh.new()
			wheel_mesh.top_radius = 0.34
			wheel_mesh.bottom_radius = 0.34
			wheel_mesh.height = 0.25
			wheel.mesh = wheel_mesh
			wheel.position = Vector3(x, 0.35, z)
			wheel.rotation.z = PI * 0.5
			wheel.material_override = _car_material(Color(0.020, 0.022, 0.023), 0.98)
			visual_root.add_child(wheel)

			var hub: MeshInstance3D = MeshInstance3D.new()
			var hub_mesh: CylinderMesh = CylinderMesh.new()
			hub_mesh.top_radius = 0.17
			hub_mesh.bottom_radius = 0.17
			hub_mesh.height = 0.27
			hub.mesh = hub_mesh
			hub.position = Vector3(x, 0.35, z)
			hub.rotation.z = PI * 0.5
			hub.material_override = _car_material(Color(0.32, 0.33, 0.31), 0.46)
			visual_root.add_child(hub)

func _build_small_details() -> void:
	# Mirrors.
	for x: float in [-1.02, 1.02]:
		_add_visual_box(Vector3(x, 1.13, -0.42), Vector3(0.19, 0.12, 0.28), body_color.darkened(0.08), 0.40)

	# License plates and rear lamps.
	_add_visual_box(Vector3(0, 0.64, -2.105), Vector3(0.62, 0.20, 0.035), Color(0.72, 0.73, 0.65), 0.58)
	_add_visual_box(Vector3(0, 0.64, 2.105), Vector3(0.62, 0.20, 0.035), Color(0.72, 0.73, 0.65), 0.58)
	for x: float in [-0.61, 0.61]:
		var tail: MeshInstance3D = MeshInstance3D.new()
		var tail_mesh: BoxMesh = BoxMesh.new()
		tail_mesh.size = Vector3(0.34, 0.20, 0.055)
		tail.mesh = tail_mesh
		tail.position = Vector3(x, 0.72, 2.105)
		tail.material_override = tail_mat
		visual_root.add_child(tail)
		tail_lights.append(tail)

func _car_material(color: Color, roughness_value: float) -> StandardMaterial3D:
	var material: StandardMaterial3D = StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness_value
	return material

func _build_headlights() -> void:
	left_headlight = _make_headlight(Vector3(-0.61, 0.72, -2.10))
	right_headlight = _make_headlight(Vector3(0.61, 0.72, -2.10))
	set_headlights(false)

func _make_headlight(local_pos: Vector3) -> SpotLight3D:
	var light: SpotLight3D = SpotLight3D.new()
	light.position = local_pos
	light.light_color = Color(0.91, 0.95, 0.82)
	light.light_energy = 3.2
	light.spot_range = 24.0
	light.spot_angle = 32.0
	light.spot_attenuation = 0.72
	light.shadow_enabled = false
	light.distance_fade_enabled = true
	light.distance_fade_begin = 25.0
	light.distance_fade_length = 8.0
	add_child(light)

	var lens: MeshInstance3D = MeshInstance3D.new()
	var lens_mesh: BoxMesh = BoxMesh.new()
	lens_mesh.size = Vector3(0.34, 0.18, 0.055)
	lens.mesh = lens_mesh
	lens.position = local_pos + Vector3(0, 0, -0.03)
	lens.material_override = headlight_off_mat
	add_child(lens)
	headlight_lenses.append(lens)
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
		linear_velocity *= 0.30
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
	for lens: MeshInstance3D in headlight_lenses:
		lens.material_override = headlight_on_mat if value else headlight_off_mat

func toggle_headlights() -> bool:
	set_headlights(not headlights_on)
	return headlights_on

func get_seat_position() -> Vector3:
	return to_global(Vector3(-0.43, 0.83, -0.02))

func get_exit_position() -> Vector3:
	return to_global(Vector3(-1.78, 0.92, 0.05))

func _integrate_forces(state: PhysicsDirectBodyState3D) -> void:
	if not has_driver():
		return

	var step: float = state.step
	var forward: Vector3 = -state.transform.basis.z
	forward.y = 0.0
	forward = forward.normalized()
	var right: Vector3 = state.transform.basis.x
	right.y = 0.0
	right = right.normalized()

	var current: Vector3 = state.linear_velocity
	var horizontal: Vector3 = Vector3(current.x, 0, current.z)
	var forward_speed: float = horizontal.dot(forward)
	var side_speed: float = horizontal.dot(right)
	var throttle: float = clampf(drive_input.y, -1.0, 1.0)
	var target_speed: float = throttle * (max_forward_speed if throttle >= 0.0 else max_reverse_speed)

	if absf(throttle) > 0.05:
		var desired_forward: float = move_toward(forward_speed, target_speed, acceleration * step * max_forward_speed * 0.35)
		horizontal = forward * desired_forward + right * side_speed
	else:
		horizontal = horizontal.move_toward(Vector3.ZERO, coast_drag * step)

	# Arcade grip keeps the car controllable in narrow indoor lanes without making
	# it snap perfectly to its forward vector.
	var grip: float = clampf(lateral_grip * step, 0.0, 1.0)
	var lateral: float = horizontal.dot(right)
	horizontal -= right * lateral * grip
	state.linear_velocity = Vector3(horizontal.x, current.y, horizontal.z)

	var steer: float = clampf(drive_input.x, -1.0, 1.0)
	var speed_factor: float = clampf(absf(forward_speed) / 4.5, 0.16, 1.0)
	var direction_sign: float = 1.0 if forward_speed >= -0.15 else -1.0
	var target_turn: float = -steer * steer_rate * speed_factor * direction_sign
	var angular: Vector3 = state.angular_velocity
	angular.y = lerpf(angular.y, target_turn, clampf(step * 7.0, 0.0, 1.0))
	state.angular_velocity = angular
