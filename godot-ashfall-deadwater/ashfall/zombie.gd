extends CharacterBody3D

var game: Node
var target: CharacterBody3D
var health := 175.0
var max_health := 175.0
var speed := 3.18
var damage := 9.5
var attack_delay := 0.70
var runner := false

var _dead := false
var _attack_left := 0.0
var _stuck_time := 0.0
var _steer_sign := 1.0
var _last_position := Vector3.ZERO
var _anim_time := 0.0
var _flash_left := 0.0

var _body: MeshInstance3D
var _head: MeshInstance3D
var _left_arm: MeshInstance3D
var _right_arm: MeshInstance3D
var _left_leg: MeshInstance3D
var _right_leg: MeshInstance3D
var _normal_material: StandardMaterial3D
var _flash_material: StandardMaterial3D

func _ready() -> void:
	_last_position = global_position
	_steer_sign = -1.0 if randi() % 2 == 0 else 1.0
	_build_visual()

func _physics_process(delta: float) -> void:
	if _dead or not is_instance_valid(target) or not is_instance_valid(game):
		return
	_attack_left = maxf(0.0, _attack_left - delta)
	_flash_left = maxf(0.0, _flash_left - delta)
	_anim_time += delta * (7.0 if runner else 5.2)
	_update_flash()
	_update_animation()

	if not bool(game.get("playing")) or bool(game.get("paused")):
		velocity.x = 0.0
		velocity.z = 0.0
		return

	var to_player := target.global_position - global_position
	to_player.y = 0.0
	var distance := to_player.length()
	if distance <= 1.12:
		velocity.x = 0.0
		velocity.z = 0.0
		_try_attack()
	else:
		var desired := to_player.normalized()
		desired = _avoid_obstacles(desired, delta)
		velocity.x = desired.x * speed
		velocity.z = desired.z * speed

	if not is_on_floor():
		velocity.y -= 20.5 * delta
	else:
		velocity.y = -0.05
	move_and_slide()

	if to_player.length_squared() > 0.2:
		look_at(Vector3(target.global_position.x, global_position.y + 1.0, target.global_position.z), Vector3.UP)

	var moved := global_position.distance_to(_last_position)
	if distance > 1.5 and moved < 0.018:
		_stuck_time += delta
	else:
		_stuck_time = maxf(0.0, _stuck_time - delta * 2.0)
	if _stuck_time > 0.75:
		_steer_sign *= -1.0
		_stuck_time = 0.0
	_last_position = global_position

func take_bullet(base_damage: float, world_hit_position: Vector3, headshot_multiplier: float) -> Dictionary:
	if _dead:
		return {}
	var local_hit := to_local(world_hit_position)
	var headshot := local_hit.y > 1.42
	var applied := base_damage * (headshot_multiplier if headshot else 1.0)
	health -= applied
	_flash_left = 0.08
	_apply_material(_flash_material)
	var killed := health <= 0.0
	if killed:
		_dead = true
		if is_instance_valid(game): game.on_zombie_killed(self)
		queue_free()
	return {"headshot": headshot, "killed": killed, "damage": applied}

func _try_attack() -> void:
	if _attack_left > 0.0:
		return
	_attack_left = attack_delay
	if target.has_method("take_damage"):
		target.take_damage(damage)

func _avoid_obstacles(direction: Vector3, delta: float) -> Vector3:
	var probe := direction * speed * maxf(delta, 0.016) * 1.8
	if not test_move(global_transform, probe):
		return direction
	for angle in [0.62 * _steer_sign, -0.62 * _steer_sign, 1.05 * _steer_sign]:
		var candidate := direction.rotated(Vector3.UP, float(angle))
		if not test_move(global_transform, candidate * speed * maxf(delta, 0.016) * 1.8):
			return candidate
	return direction.rotated(Vector3.UP, 1.35 * _steer_sign)

func _build_visual() -> void:
	var collision := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.43
	capsule.height = 1.78
	collision.shape = capsule
	collision.position.y = 0.89
	add_child(collision)

	_normal_material = StandardMaterial3D.new()
	_normal_material.albedo_color = Color("#76766d") if not runner else Color("#6a665e")
	_normal_material.roughness = 1.0
	_normal_material.vertex_color_use_as_albedo = false
	_flash_material = StandardMaterial3D.new()
	_flash_material.albedo_color = Color("#d8b99a")
	_flash_material.emission_enabled = true
	_flash_material.emission = Color("#7f3826")

	_body = _limb(Vector3(0.64,0.80,0.40), Vector3(0,1.05,0), Color("#5c625b"))
	_head = _sphere(0.27, Vector3(0,1.66,0), Color("#8a8376"))
	_left_arm = _limb(Vector3(0.15,0.70,0.15), Vector3(-0.43,1.08,-0.06), Color("#777369"))
	_right_arm = _limb(Vector3(0.15,0.70,0.15), Vector3(0.43,1.08,-0.06), Color("#777369"))
	_left_leg = _limb(Vector3(0.19,0.72,0.19), Vector3(-0.19,0.37,0), Color("#3d403c"))
	_right_leg = _limb(Vector3(0.19,0.72,0.19), Vector3(0.19,0.37,0), Color("#3d403c"))
	# Flat dark face details keep the zombie readable without returning to the over-detailed version.
	var eye_mat := StandardMaterial3D.new()
	eye_mat.albedo_color = Color("#181919")
	eye_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	for x in [-0.09,0.09]:
		var eye := MeshInstance3D.new()
		var eye_mesh := BoxMesh.new()
		eye_mesh.size = Vector3(0.06,0.045,0.03)
		eye.mesh = eye_mesh
		eye.position = Vector3(float(x),1.70,-0.258)
		eye.material_override = eye_mat
		add_child(eye)

func _limb(size: Vector3, pos: Vector3, color: Color) -> MeshInstance3D:
	var part := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	part.mesh = mesh
	part.position = pos
	var mat := _normal_material.duplicate() as StandardMaterial3D
	mat.albedo_color = color
	part.material_override = mat
	add_child(part)
	return part

func _sphere(radius: float, pos: Vector3, color: Color) -> MeshInstance3D:
	var part := MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = radius * 2.0
	mesh.radial_segments = 8
	mesh.rings = 5
	part.mesh = mesh
	part.position = pos
	var mat := _normal_material.duplicate() as StandardMaterial3D
	mat.albedo_color = color
	part.material_override = mat
	add_child(part)
	return part

func _apply_material(material: Material) -> void:
	for part in [_body,_head,_left_arm,_right_arm,_left_leg,_right_leg]:
		part.material_override = material

func _update_flash() -> void:
	if _flash_left <= 0.0 and _body.material_override == _flash_material:
		_body.material_override = _colored_material(Color("#5c625b"))
		_head.material_override = _colored_material(Color("#8a8376"))
		_left_arm.material_override = _colored_material(Color("#777369"))
		_right_arm.material_override = _colored_material(Color("#777369"))
		_left_leg.material_override = _colored_material(Color("#3d403c"))
		_right_leg.material_override = _colored_material(Color("#3d403c"))

func _colored_material(color: Color) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 1.0
	return mat

func _update_animation() -> void:
	var swing := sin(_anim_time) * (0.46 if runner else 0.32)
	_left_arm.rotation.x = -0.78 + swing
	_right_arm.rotation.x = -0.78 - swing
	_left_leg.rotation.x = -swing * 0.52
	_right_leg.rotation.x = swing * 0.52
	var bob := abs(sin(_anim_time)) * 0.025
	_body.position.y = 1.05 + bob
	_head.position.y = 1.66 + bob
