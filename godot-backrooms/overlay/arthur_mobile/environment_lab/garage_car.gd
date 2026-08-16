extends RigidBody3D

@export var body_color := Color(0.48, 0.48, 0.42)
@export var model_resource_path := ""
@export var model_scale := 0.92
@export var max_forward_speed := 13.0
@export var max_reverse_speed := 5.5
@export var acceleration := 4.6
@export var coast_drag := 3.2
@export var steer_rate := 1.45

var driver: Node3D
var drive_input := Vector2.ZERO
var headlights_on := false
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
	add_to_group("psychic_prop")
	add_to_group("enterable_car")
	_build_collision()
	_build_visual()
	_build_headlights()

func _build_collision() -> void:
	if get_node_or_null("CollisionShape3D") != null:
		return
	var collision := CollisionShape3D.new()
	collision.name = "CollisionShape3D"
	collision.position = Vector3(0, 0.62, 0)
	var shape := BoxShape3D.new()
	shape.size = Vector3(1.95, 1.35, 4.15)
	collision.shape = shape
	add_child(collision)

func _build_visual() -> void:
	visual_root = Node3D.new()
	visual_root.name = "Visual"
	add_child(visual_root)

	if not model_resource_path.is_empty() and ResourceLoader.exists(model_resource_path):
		var resource := ResourceLoader.load(model_resource_path)
		if resource is PackedScene:
			var model := (resource as PackedScene).instantiate() as Node3D
			if model != null:
				model.scale = Vector3.ONE * model_scale
				visual_root.add_child(model)
				return

	# Primitive fallback keeps the lab build functional even if a vehicle pack is removed.
	var body_mesh := MeshInstance3D.new()
	var body_box := BoxMesh.new()
	body_box.size = Vector3(1.86, 0.65, 3.95)
	body_mesh.mesh = body_box
	body_mesh.position = Vector3(0, 0.62, 0)
	body_mesh.material_override = _car_material(body_color, 0.40)
	visual_root.add_child(body_mesh)

	var cabin := MeshInstance3D.new()
	var cabin_box := BoxMesh.new()
	cabin_box.size = Vector3(1.62, 0.72, 1.80)
	cabin.mesh = cabin_box
	cabin.position = Vector3(0, 1.18, 0.20)
	cabin.material_override = _car_material(body_color.darkened(0.08), 0.34)
	visual_root.add_child(cabin)

	var glass := MeshInstance3D.new()
	var glass_box := BoxMesh.new()
	glass_box.size = Vector3(1.48, 0.45, 1.56)
	glass.mesh = glass_box
	glass.position = Vector3(0, 1.27, 0.12)
	var glass_mat := _car_material(Color(0.055, 0.085, 0.095), 0.16)
	glass_mat.metallic = 0.15
	glass.material_override = glass_mat
	visual_root.add_child(glass)

	for x in [-0.92, 0.92]:
		for z in [-1.25, 1.25]:
			var wheel := MeshInstance3D.new()
			var wheel_mesh := CylinderMesh.new()
			wheel_mesh.top_radius = 0.34
			wheel_mesh.bottom_radius = 0.34
			wheel_mesh.height = 0.24
			wheel.mesh = wheel_mesh
			wheel.position = Vector3(x, 0.37, z)
			wheel.rotation.z = PI * 0.5
			wheel.material_override = _car_material(Color(0.025, 0.027, 0.028), 0.98)
			visual_root.add_child(wheel)

func _car_material(color: Color, roughness: float) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	return material

func _build_headlights() -> void:
	left_headlight = _make_headlight(Vector3(-0.63, 0.72, -2.05))
	right_headlight = _make_headlight(Vector3(0.63, 0.72, -2.05))
	set_headlights(false)

func _make_headlight(local_pos: Vector3) -> SpotLight3D:
	var light := SpotLight3D.new()
	light.position = local_pos
	light.light_color = Color(0.91, 0.94, 0.82)
	light.light_energy = 3.2
	light.spot_range = 22.0
	light.spot_angle = 31.0
	light.spot_attenuation = 0.72
	light.shadow_enabled = false
	light.distance_fade_enabled = true
	light.distance_fade_begin = 26.0
	light.distance_fade_length = 8.0
	add_child(light)

	var lens := MeshInstance3D.new()
	var lens_mesh := BoxMesh.new()
	lens_mesh.size = Vector3(0.34, 0.18, 0.05)
	lens.mesh = lens_mesh
	lens.position = local_pos + Vector3(0, 0, -0.03)
	var lens_mat := StandardMaterial3D.new()
	lens_mat.albedo_color = Color(0.76, 0.81, 0.70)
	lens_mat.emission_enabled = true
	lens_mat.emission = Color(0.84, 0.90, 0.76)
	lens_mat.emission_energy_multiplier = 1.7
	lens.material_override = lens_mat
	add_child(lens)
	return light

func set_driver(value: Node3D) -> void:
	driver = value
	drive_input = Vector2.ZERO
	can_sleep = driver == null
	sleeping = false
	if driver == null:
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
	return to_global(Vector3(-0.48, 0.58, 0.18))

func get_exit_position() -> Vector3:
	return to_global(Vector3(-1.72, 0.78, 0.10))

func get_forward_speed() -> float:
	var forward := -global_transform.basis.z.normalized()
	var horizontal := Vector3(linear_velocity.x, 0, linear_velocity.z)
	return horizontal.dot(forward)

func _integrate_forces(state: PhysicsDirectBodyState3D) -> void:
	if not has_driver():
		return

	var step := state.step
	var forward := -state.transform.basis.z
	forward.y = 0.0
	forward = forward.normalized()

	var current := state.linear_velocity
	var horizontal := Vector3(current.x, 0, current.z)
	var forward_speed := horizontal.dot(forward)
	var throttle := clampf(drive_input.y, -1.0, 1.0)
	var target_speed := throttle * (max_forward_speed if throttle >= 0.0 else max_reverse_speed)

	if absf(throttle) > 0.05:
		var desired := forward * target_speed
		var response := clampf(acceleration * step, 0.0, 1.0)
		horizontal = horizontal.lerp(desired, response)
	else:
		horizontal = horizontal.move_toward(Vector3.ZERO, coast_drag * step)

	state.linear_velocity = Vector3(horizontal.x, current.y, horizontal.z)

	var steer := clampf(drive_input.x, -1.0, 1.0)
	var speed_factor := clampf(absf(forward_speed) / 4.0, 0.18, 1.0)
	var direction_sign := 1.0 if forward_speed >= -0.15 else -1.0
	var angular := state.angular_velocity
	angular.y = -steer * steer_rate * speed_factor * direction_sign
	state.angular_velocity = angular
