extends CharacterBody3D

var game: Node
var target: CharacterBody3D
var health := 2
var speed := 1.35
var _dead := false
var _last_attack_msec := -10000
var _phase := 0.0
var _hit_flash := 0.0

var _body_mesh: MeshInstance3D
var _head_mesh: MeshInstance3D
var _left_arm: MeshInstance3D
var _right_arm: MeshInstance3D
var _normal_material: StandardMaterial3D
var _hit_material: StandardMaterial3D

func _ready() -> void:
	_build_body()

func _physics_process(delta: float) -> void:
	if _dead or not is_instance_valid(target) or not is_instance_valid(game):
		return
	if not bool(game.get("playing")):
		velocity = Vector3.ZERO
		return

	_phase += delta * 5.0
	_hit_flash = maxf(0.0, _hit_flash - delta)
	_update_animation()

	var offset := target.global_position - global_position
	offset.y = 0.0
	var distance := offset.length()
	if distance > 1.02:
		var direction := offset.normalized()
		direction = _steer_around_obstacle(direction, delta)
		velocity.x = direction.x * speed
		velocity.z = direction.z * speed
	else:
		velocity.x = 0.0
		velocity.z = 0.0
		_try_attack()

	if not is_on_floor():
		velocity.y -= 19.0 * delta
	else:
		velocity.y = -0.05
	move_and_slide()

	if distance > 0.2:
		var look_target := Vector3(target.global_position.x, global_position.y, target.global_position.z)
		look_at(look_target, Vector3.UP)

func take_damage(amount: int) -> void:
	if _dead:
		return
	health -= amount
	_hit_flash = 0.11
	_apply_flash_material()
	if health <= 0:
		_dead = true
		if is_instance_valid(game) and game.has_method("on_zombie_killed"):
			game.on_zombie_killed(self)
		queue_free()

func _try_attack() -> void:
	var now := Time.get_ticks_msec()
	if now - _last_attack_msec < 650:
		return
	_last_attack_msec = now
	if target.has_method("take_hit"):
		target.take_hit(10)

func _steer_around_obstacle(direction: Vector3, delta: float) -> Vector3:
	var motion := direction * speed * delta * 1.5
	if not test_move(global_transform, motion):
		return direction
	var left := direction.rotated(Vector3.UP, 0.72)
	var right := direction.rotated(Vector3.UP, -0.72)
	var left_blocked := test_move(global_transform, left * speed * delta * 1.5)
	var right_blocked := test_move(global_transform, right * speed * delta * 1.5)
	if not left_blocked:
		return left
	if not right_blocked:
		return right
	return Vector3.ZERO

func _build_body() -> void:
	var collision := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.42
	capsule.height = 1.72
	collision.shape = capsule
	collision.position.y = 0.86
	add_child(collision)

	_normal_material = StandardMaterial3D.new()
	_normal_material.albedo_color = Color("#4d5549")
	_normal_material.roughness = 1.0
	_hit_material = StandardMaterial3D.new()
	_hit_material.albedo_color = Color("#ffe2ad")
	_hit_material.emission_enabled = true
	_hit_material.emission = Color("#8f4f2d")

	_body_mesh = MeshInstance3D.new()
	var body_box := BoxMesh.new()
	body_box.size = Vector3(0.66, 0.84, 0.42)
	_body_mesh.mesh = body_box
	_body_mesh.position = Vector3(0.0, 1.02, 0.0)
	_body_mesh.material_override = _normal_material
	add_child(_body_mesh)

	_head_mesh = MeshInstance3D.new()
	var head_sphere := SphereMesh.new()
	head_sphere.radius = 0.27
	head_sphere.height = 0.54
	_head_mesh.mesh = head_sphere
	_head_mesh.position = Vector3(0.0, 1.65, 0.0)
	_head_mesh.material_override = _normal_material
	add_child(_head_mesh)

	_left_arm = _make_limb(Vector3(0.15, 0.68, 0.14), Vector3(-0.44, 1.08, -0.12))
	_right_arm = _make_limb(Vector3(0.15, 0.68, 0.14), Vector3(0.44, 1.08, -0.12))
	_make_limb(Vector3(0.18, 0.72, 0.18), Vector3(-0.20, 0.38, 0.0))
	_make_limb(Vector3(0.18, 0.72, 0.18), Vector3(0.20, 0.38, 0.0))

func _make_limb(size: Vector3, local_position: Vector3) -> MeshInstance3D:
	var limb := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	limb.mesh = mesh
	limb.position = local_position
	limb.material_override = _normal_material
	add_child(limb)
	return limb

func _update_animation() -> void:
	var swing := sin(_phase) * 0.34
	_left_arm.rotation.x = -0.72 + swing
	_right_arm.rotation.x = -0.72 - swing
	var bob := sin(_phase * 2.0) * 0.025
	_body_mesh.position.y = 1.02 + bob
	_head_mesh.position.y = 1.65 + bob
	if _hit_flash <= 0.0 and _body_mesh.material_override == _hit_material:
		_body_mesh.material_override = _normal_material
		_head_mesh.material_override = _normal_material
		_left_arm.material_override = _normal_material
		_right_arm.material_override = _normal_material

func _apply_flash_material() -> void:
	_body_mesh.material_override = _hit_material
	_head_mesh.material_override = _hit_material
	_left_arm.material_override = _hit_material
	_right_arm.material_override = _hit_material
