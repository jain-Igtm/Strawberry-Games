extends CharacterBody3D
class_name GroundStalker

# Uses the tiny official Godot Squash the Creeps mob GLB. The lab workflows
# inject the pinned MIT-licensed asset before Godot imports the project.
const MOB_SCENE: PackedScene = preload("res://arthur_mobile/enemies/assets/godot_mob/mob.glb")

@export var chase_speed := 2.65
@export var dash_speed := 5.35
@export var acceleration := 9.5
@export var lifetime := 34.0
@export var wake_delay := 0.7
@export var dash_interval_min := 3.2
@export var dash_interval_max := 5.8
@export var max_target_distance := 28.0

var target: Node3D
var rng := RandomNumberGenerator.new()
var age := 0.0
var dash_timer := 3.5
var dash_left := 0.0
var steer_left := 0.0
var steer_sign := 1.0
var recoil_left := 0.0
var body_pivot: Node3D
var model_root: Node3D
var gravity := 9.8

func configure(target_node: Node3D) -> void:
	target = target_node

func _ready() -> void:
	add_to_group("enemy")
	add_to_group("enemy_ambient")
	rng.randomize()
	gravity = float(ProjectSettings.get_setting("physics/3d/default_gravity", 9.8))
	floor_snap_length = 0.42
	floor_max_angle = deg_to_rad(48.0)
	up_direction = Vector3.UP
	_build_collision()
	_build_visual()
	dash_timer = rng.randf_range(dash_interval_min, dash_interval_max)
	steer_sign = -1.0 if rng.randf() < 0.5 else 1.0
	if target == null:
		target = get_tree().get_first_node_in_group("player") as Node3D

func _physics_process(delta: float) -> void:
	age += delta
	if age >= lifetime:
		queue_free()
		return
	if not is_instance_valid(target):
		velocity = Vector3.ZERO
		return

	var to_target := target.global_position - global_position
	var planar := Vector3(to_target.x, 0.0, to_target.z)
	var distance := planar.length()
	if distance > max_target_distance or absf(to_target.y) > 7.0:
		queue_free()
		return

	if not is_on_floor():
		velocity.y -= gravity * delta
	else:
		velocity.y = minf(velocity.y, 0.0)

	if age < wake_delay:
		velocity.x = move_toward(velocity.x, 0.0, acceleration * delta)
		velocity.z = move_toward(velocity.z, 0.0, acceleration * delta)
		move_and_slide()
		_animate_body(delta)
		return

	dash_timer -= delta
	dash_left = maxf(dash_left - delta, 0.0)
	steer_left = maxf(steer_left - delta, 0.0)
	recoil_left = maxf(recoil_left - delta, 0.0)

	if dash_timer <= 0.0 and distance > 1.45 and distance < 6.2 and recoil_left <= 0.0:
		dash_left = rng.randf_range(0.42, 0.62)
		dash_timer = rng.randf_range(dash_interval_min, dash_interval_max)

	var desired_dir := planar.normalized() if distance > 0.01 else Vector3.ZERO
	if steer_left > 0.0 and desired_dir.length_squared() > 0.0:
		desired_dir = desired_dir.rotated(Vector3.UP, deg_to_rad(58.0) * steer_sign)

	var speed := dash_speed if dash_left > 0.0 else chase_speed
	if recoil_left > 0.0:
		desired_dir = -desired_dir
		speed = chase_speed * 0.72

	var desired_velocity := desired_dir * speed
	velocity.x = move_toward(velocity.x, desired_velocity.x, acceleration * delta)
	velocity.z = move_toward(velocity.z, desired_velocity.z, acceleration * delta)

	if desired_dir.length_squared() > 0.01:
		var desired_yaw := atan2(-desired_dir.x, -desired_dir.z)
		rotation.y = lerp_angle(rotation.y, desired_yaw, clampf(delta * 7.5, 0.0, 1.0))

	move_and_slide()

	if is_on_wall() and steer_left <= 0.0:
		steer_sign *= -1.0
		steer_left = rng.randf_range(0.38, 0.72)
		if is_on_floor():
			velocity.y = 1.55

	# A close pass is the attack for now. It visibly commits, then recoils,
	# without requiring health-system changes in the player's workstation.
	if distance < 0.82 and recoil_left <= 0.0:
		recoil_left = 0.55
		dash_left = 0.0
		_try_bump_target(desired_dir)

	_animate_body(delta)

func _build_collision() -> void:
	var collision := CollisionShape3D.new()
	collision.name = "BodyCollision"
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.42
	capsule.height = 0.92
	collision.shape = capsule
	collision.position = Vector3(0.0, 0.46, 0.0)
	add_child(collision)

func _build_visual() -> void:
	body_pivot = Node3D.new()
	body_pivot.name = "BodyPivot"
	body_pivot.position = Vector3(0.0, 0.05, 0.0)
	add_child(body_pivot)

	model_root = MOB_SCENE.instantiate() as Node3D
	if model_root == null:
		return
	model_root.name = "GodotMobModel"
	model_root.scale = Vector3(0.70, 0.50, 0.78)
	model_root.rotation_degrees = Vector3(-4.0, 180.0, 0.0)
	body_pivot.add_child(model_root)
	_tune_model_materials(model_root)

func _tune_model_materials(root: Node) -> void:
	for child in root.get_children():
		if child is MeshInstance3D:
			var mesh_instance := child as MeshInstance3D
			mesh_instance.visibility_range_end = 34.0
			mesh_instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
			var mesh := mesh_instance.mesh
			if mesh != null:
				for surface in range(mesh.get_surface_count()):
					var source := mesh.surface_get_material(surface)
					if source is StandardMaterial3D:
						var material := (source as StandardMaterial3D).duplicate() as StandardMaterial3D
						var label := material.resource_name.to_lower()
						if "eye" in label:
							material.albedo_color = Color(0.48, 0.035, 0.045, 1.0)
							material.emission_enabled = true
							material.emission = Color(0.18, 0.008, 0.012, 1.0)
							material.emission_energy_multiplier = 0.65
							material.roughness = 0.32
						else:
							var original := material.albedo_color
							material.albedo_color = Color(
								original.r * 0.18 + 0.018,
								original.g * 0.22 + 0.022,
								original.b * 0.16 + 0.018,
								1.0
							)
							material.metallic = 0.0
							material.roughness = 0.86
						mesh_instance.set_surface_override_material(surface, material)
		_tune_model_materials(child)

func _animate_body(delta: float) -> void:
	if body_pivot == null:
		return
	var planar_speed := Vector2(velocity.x, velocity.z).length()
	var move_amount := clampf(planar_speed / maxf(dash_speed, 0.01), 0.0, 1.0)
	var cadence := 10.5 + move_amount * 6.0
	var skitter := sin(age * cadence)
	body_pivot.position.y = 0.045 + absf(skitter) * 0.035 * move_amount
	body_pivot.rotation.z = skitter * 0.045 * move_amount
	body_pivot.rotation.x = -0.035 + cos(age * cadence * 0.5) * 0.025 * move_amount
	var squash := 1.0 + skitter * 0.025 * move_amount
	body_pivot.scale = Vector3(1.0 / squash, squash, 1.0 / squash)

func _try_bump_target(direction: Vector3) -> void:
	if not (target is CharacterBody3D):
		return
	var body := target as CharacterBody3D
	var push := direction
	if push.length_squared() < 0.01:
		push = (body.global_position - global_position)
		push.y = 0.0
		push = push.normalized()
	body.velocity.x += push.x * 2.7
	body.velocity.z += push.z * 2.7
	body.velocity.y = maxf(body.velocity.y, 1.1)
