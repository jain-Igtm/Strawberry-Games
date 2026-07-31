class_name AshfallZombie
extends CharacterBody3D

var target: AshfallPlayer
var speed := 3.0
var health := 68
var attack_cooldown := 0.0
var stride := 0.0
var left_arm: MeshInstance3D
var right_arm: MeshInstance3D
var left_leg: MeshInstance3D
var right_leg: MeshInstance3D

func _ready() -> void:
	_build_body()

func _build_body() -> void:
	var collision := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.38
	capsule.height = 1.75
	collision.shape = capsule
	collision.position.y = 0.88
	add_child(collision)

	var cloth := TextureFactory.make_material("cloth", 2.5)
	var skin := TextureFactory.make_material("concrete", 3.2)
	var dark := TextureFactory.make_material("roof", 2.0)

	var torso := _part(Vector3(0.64, 0.82, 0.34), cloth, Vector3(0, 1.22, 0))
	add_child(torso)

	var head := MeshInstance3D.new()
	var head_mesh := SphereMesh.new()
	head_mesh.radius = 0.27
	head_mesh.height = 0.54
	head_mesh.radial_segments = 8
	head_mesh.rings = 5
	head.mesh = head_mesh
	head.position = Vector3(0, 1.91, 0)
	head.material_override = skin
	add_child(head)

	left_arm = _part(Vector3(0.18, 0.86, 0.19), cloth, Vector3(-0.43, 1.25, -0.05))
	right_arm = _part(Vector3(0.18, 0.86, 0.19), cloth, Vector3(0.43, 1.25, -0.05))
	left_arm.rotation.x = -0.42
	right_arm.rotation.x = -0.42
	add_child(left_arm)
	add_child(right_arm)

	left_leg = _part(Vector3(0.24, 0.82, 0.25), dark, Vector3(-0.18, 0.42, 0))
	right_leg = _part(Vector3(0.24, 0.82, 0.25), dark, Vector3(0.18, 0.42, 0))
	add_child(left_leg)
	add_child(right_leg)

	for index in range(5):
		var strip := _part(
			Vector3(0.09 + float(index % 2) * 0.05, 0.46 + float(index % 3) * 0.08, 0.05),
			cloth,
			Vector3(-0.27 + index * 0.135, 0.78 - float(index % 2) * 0.08, -0.18)
		)
		strip.rotation.z = -0.18 + index * 0.08
		add_child(strip)

func _part(size: Vector3, material: Material, at: Vector3) -> MeshInstance3D:
	var part := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	part.mesh = mesh
	part.position = at
	part.material_override = material
	return part

func _physics_process(delta: float) -> void:
	if target == null or not is_instance_valid(target):
		return
	if not is_on_floor():
		velocity.y -= float(ProjectSettings.get_setting("physics/3d/default_gravity")) * delta

	var offset := target.global_position - global_position
	var distance := Vector2(offset.x, offset.z).length()
	var direction := Vector3(offset.x, 0, offset.z).normalized()
	if distance > 1.25:
		velocity.x = move_toward(velocity.x, direction.x * speed, delta * 8.0)
		velocity.z = move_toward(velocity.z, direction.z * speed, delta * 8.0)
	else:
		velocity.x = move_toward(velocity.x, 0.0, delta * 12.0)
		velocity.z = move_toward(velocity.z, 0.0, delta * 12.0)

	if direction.length_squared() > 0.01:
		rotation.y = lerp_angle(rotation.y, atan2(direction.x, direction.z), minf(1.0, delta * 7.0))

	move_and_slide()
	attack_cooldown = maxf(0.0, attack_cooldown - delta)
	if distance < 1.45 and attack_cooldown <= 0.0:
		target.take_damage(9)
		attack_cooldown = 0.82

	stride += delta * (4.0 + speed)
	var swing := sin(stride) * 0.42
	left_leg.rotation.x = swing
	right_leg.rotation.x = -swing
	left_arm.rotation.x = -0.42 - swing * 0.45
	right_arm.rotation.x = -0.42 + swing * 0.45

func take_hit(amount: int) -> void:
	health -= amount
	velocity += global_transform.basis.z * 1.8
	if health <= 0:
		queue_free()
