extends CharacterBody3D

var vehicle_id := "vehicle"
var label := "VEHICLE"
var kind := "truck"
var max_speed := 13.0
var turn_rate := 1.35
var enter_radius := 3.2
var fuel := 62.0
var fuel_capacity := 100.0
var driver: CharacterBody3D

var _speed := 0.0
var _wheel_spin := 0.0
var _wheels: Array[MeshInstance3D] = []

func setup(id_value: String, label_value: String, kind_value: String) -> void:
	vehicle_id = id_value
	label = label_value
	kind = kind_value
	if kind == "buggy":
		max_speed = 16.5
		turn_rate = 1.8
	elif kind == "forklift":
		max_speed = 9.5
		turn_rate = 1.35
	else:
		max_speed = 13.0
		turn_rate = 1.35
	fuel = 62.0
	fuel_capacity = 100.0

func _ready() -> void:
	_build_body()

func drive(input_vec: Vector2, delta: float) -> void:
	if fuel <= 0.0:
		input_vec = Vector2.ZERO
	var throttle := clampf(input_vec.y, -1.0, 1.0)
	var steer := clampf(input_vec.x, -1.0, 1.0)
	var target_speed := throttle * max_speed
	var acceleration := 13.0 if absf(target_speed) > absf(_speed) else 19.0
	_speed = move_toward(_speed, target_speed, acceleration * delta)
	if absf(_speed) > 0.12:
		var steering_scale := clampf(absf(_speed) / max_speed, 0.24, 1.0)
		rotation.y -= steer * turn_rate * steering_scale * delta * signf(_speed)
		fuel = maxf(0.0, fuel - absf(_speed) * delta * 0.0105)
	var forward := -global_transform.basis.z
	velocity.x = forward.x * _speed
	velocity.z = forward.z * _speed
	if not is_on_floor():
		velocity.y -= 20.5 * delta
	else:
		velocity.y = -0.1
	move_and_slide()
	if get_slide_collision_count() > 0:
		_speed *= 0.58
	_update_wheels(delta)

func coast(delta: float) -> void:
	_speed = move_toward(_speed, 0.0, 8.0 * delta)
	if absf(_speed) > 0.05:
		var forward := -global_transform.basis.z
		velocity.x = forward.x * _speed
		velocity.z = forward.z * _speed
	else:
		velocity.x = 0.0
		velocity.z = 0.0
	if not is_on_floor(): velocity.y -= 20.5 * delta
	else: velocity.y = -0.1
	move_and_slide()
	_update_wheels(delta)

func refill() -> void:
	fuel = fuel_capacity

func fuel_percent() -> int:
	return clampi(roundi(fuel / fuel_capacity * 100.0), 0, 100)

func _build_body() -> void:
	var body_length := 4.9 if kind == "truck" else 3.8
	var body_width := 2.25 if kind == "truck" else 1.9
	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(body_width,1.45,body_length)
	collision.shape = shape
	collision.position.y = 0.78
	add_child(collision)
	var paint := Color("#8c4b32") if kind == "truck" else Color("#9a6e2d")
	_add_box(Vector3(body_width,0.74,body_length), Vector3(0,0.72,0), paint)
	_add_box(Vector3(body_width*0.90,1.10,body_length*0.38), Vector3(0,1.48,-body_length*0.18), Color("#252829"))
	_add_box(Vector3(body_width*0.82,0.42,body_length*0.31), Vector3(0,1.54,-body_length*0.385), Color("#1d2527"), true)
	for x in [-body_width*0.55, body_width*0.55]:
		for z in [-body_length*0.32, body_length*0.32]:
			var wheel := _add_wheel(Vector3(float(x),0.43,float(z)))
			_wheels.append(wheel)
	var plate := Label3D.new()
	plate.text = label
	plate.font_size = 30
	plate.outline_size = 6
	plate.modulate = Color("#ead8c4")
	plate.position = Vector3(0,2.25,0)
	plate.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	add_child(plate)

func _add_box(size: Vector3, pos: Vector3, color: Color, glass := false) -> MeshInstance3D:
	var part := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	part.mesh = mesh
	part.position = pos
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 0.28 if glass else 0.84
	mat.metallic = 0.18 if not glass else 0.05
	part.material_override = mat
	add_child(part)
	return part

func _add_wheel(pos: Vector3) -> MeshInstance3D:
	var wheel := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = 0.48
	mesh.bottom_radius = 0.48
	mesh.height = 0.34
	mesh.radial_segments = 10
	wheel.mesh = mesh
	wheel.position = pos
	wheel.rotation.z = PI/2.0
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color("#171818")
	mat.roughness = 0.9
	wheel.material_override = mat
	add_child(wheel)
	return wheel

func _update_wheels(delta: float) -> void:
	_wheel_spin += _speed * delta * 1.7
	for wheel in _wheels:
		wheel.rotation.x = _wheel_spin
