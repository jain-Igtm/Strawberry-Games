extends RigidBody3D

@export var max_health := 100.0
@export var patrol_speed := 1.75
@export var chase_speed := 7.15
@export var acceleration := 12.0
@export var detection_distance := 27.0
@export var lose_distance := 42.0
@export var sight_memory_seconds := 5.5
@export var attack_range := 1.45
@export var attack_damage := 18.0
@export var attack_cooldown := 0.95
@export var corpse_lifetime := 12.0

@onready var rig: Node3D = $VisualRig
@onready var torso: Node3D = $VisualRig/TorsoPivot
@onready var head: Node3D = $VisualRig/HeadPivot
@onready var arm_l: Node3D = $VisualRig/ArmL
@onready var arm_r: Node3D = $VisualRig/ArmR
@onready var leg_l: Node3D = $VisualRig/LegL
@onready var leg_r: Node3D = $VisualRig/LegR

var health := 100.0
var player: CharacterBody3D
var world: Node
var rng := RandomNumberGenerator.new()

var dead := false
var corpse_timer := 0.0
var stun_timer := 0.0
var attack_timer := 0.0
var attack_anim := 0.0
var memory_timer := 0.0
var recent_psychic_release := 0.0
var was_psychic_frozen := false
var hit_reaction := 0.0

var gait_phase := 0.0
var patrol_direction := Vector3.FORWARD
var patrol_turn_timer := 0.0
var next_waypoint := Vector3.ZERO
var repath_timer := 0.0
var last_seen_position := Vector3.ZERO
var impact_speed_cache := 0.0

func _ready() -> void:
	health = max_health
	player = get_tree().get_first_node_in_group("player") as CharacterBody3D
	world = get_tree().current_scene
	rng.seed = int(get_instance_id()) * 92821 + 17
	patrol_direction = Vector3(cos(rng.randf_range(0.0, TAU)), 0.0, sin(rng.randf_range(0.0, TAU))).normalized()
	contact_monitor = true
	max_contacts_reported = 12
	can_sleep = false
	body_entered.connect(_on_body_entered)
	linear_damp = 1.6
	angular_damp = 3.8
	lock_rotation = true

func _physics_process(delta: float) -> void:
	impact_speed_cache = linear_velocity.length()
	attack_timer = maxf(0.0, attack_timer - delta)
	attack_anim = maxf(0.0, attack_anim - delta * 2.9)
	stun_timer = maxf(0.0, stun_timer - delta)
	hit_reaction = maxf(0.0, hit_reaction - delta * 4.0)
	recent_psychic_release = maxf(0.0, recent_psychic_release - delta)
	memory_timer = maxf(0.0, memory_timer - delta)
	repath_timer = maxf(0.0, repath_timer - delta)
	patrol_turn_timer = maxf(0.0, patrol_turn_timer - delta)

	if dead:
		corpse_timer -= delta
		_animate_body(delta, 0.0, false, true)
		if corpse_timer <= 0.0:
			queue_free()
		return

	# Arthur's existing TK freezes RigidBody3D psychic props while held or suspended.
	# The Hallwalker is intentionally one of those props, so AI yields completely.
	if freeze:
		was_psychic_frozen = true
		lock_rotation = false
		_animate_body(delta, 0.0, false, true)
		return

	if was_psychic_frozen:
		was_psychic_frozen = false
		recent_psychic_release = 1.75
		stun_timer = maxf(stun_timer, 0.42)
		lock_rotation = false

	var grounded := _is_grounded()
	if stun_timer > 0.0 or (not grounded and recent_psychic_release > 0.0):
		_animate_body(delta, linear_velocity.length(), false, true)
		if grounded and linear_velocity.length() < 2.1:
			_recover_upright(delta)
		return

	_recover_upright(delta)
	lock_rotation = true
	if player == null or not is_instance_valid(player):
		player = get_tree().get_first_node_in_group("player") as CharacterBody3D
	if player == null:
		_slow_horizontal(delta)
		_animate_body(delta, 0.0, false, false)
		return

	var to_player := player.global_position - global_position
	var horizontal_to_player := Vector3(to_player.x, 0.0, to_player.z)
	var distance := horizontal_to_player.length()
	var sees_player := distance <= detection_distance and _can_see_player()
	if sees_player:
		memory_timer = sight_memory_seconds
		last_seen_position = player.global_position
	elif distance > lose_distance:
		memory_timer = 0.0

	var chasing := sees_player or memory_timer > 0.0
	var desired_direction := Vector3.ZERO
	if chasing:
		var goal := player.global_position if sees_player else last_seen_position
		desired_direction = _direction_toward_goal(goal)
	else:
		desired_direction = _patrol_direction(delta)

	if desired_direction.length_squared() > 0.001:
		desired_direction = _avoid_wall(desired_direction.normalized())

	var desired_speed := chase_speed if chasing else patrol_speed
	var target_velocity := desired_direction * desired_speed
	linear_velocity.x = move_toward(linear_velocity.x, target_velocity.x, acceleration * delta)
	linear_velocity.z = move_toward(linear_velocity.z, target_velocity.z, acceleration * delta)

	if desired_direction.length_squared() > 0.001:
		var target_yaw := atan2(-desired_direction.x, -desired_direction.z)
		rotation.y = lerp_angle(rotation.y, target_yaw, clampf(delta * (7.5 if chasing else 3.8), 0.0, 1.0))

	if chasing and distance <= attack_range and attack_timer <= 0.0 and _can_see_player():
		_attack_player(horizontal_to_player)

	_animate_body(delta, Vector2(linear_velocity.x, linear_velocity.z).length(), chasing, false)

func _direction_toward_goal(goal: Vector3) -> Vector3:
	if repath_timer <= 0.0:
		repath_timer = 0.26
		next_waypoint = goal
		if world != null and world.has_method("enemy_path_step"):
			var result = world.call("enemy_path_step", global_position, goal)
			if result is Vector3:
				next_waypoint = result
	var delta := next_waypoint - global_position
	delta.y = 0.0
	if delta.length_squared() < 0.35:
		repath_timer = 0.0
	return delta.normalized() if delta.length_squared() > 0.001 else Vector3.ZERO

func _patrol_direction(_delta: float) -> Vector3:
	if patrol_turn_timer <= 0.0 or _clearance(patrol_direction, 1.55) < 0.8:
		patrol_turn_timer = rng.randf_range(1.5, 4.8)
		var turn := rng.randf_range(-1.15, 1.15)
		patrol_direction = patrol_direction.rotated(Vector3.UP, turn).normalized()
	return patrol_direction

func _avoid_wall(direction: Vector3) -> Vector3:
	var front := _clearance(direction, 1.45)
	if front >= 1.15:
		return direction
	var left_dir := direction.rotated(Vector3.UP, PI * 0.52)
	var right_dir := direction.rotated(Vector3.UP, -PI * 0.52)
	var left_space := _clearance(left_dir, 2.1)
	var right_space := _clearance(right_dir, 2.1)
	var chosen := left_dir if left_space > right_space else right_dir
	return direction.lerp(chosen, 0.78).normalized()

func _clearance(direction: Vector3, distance: float) -> float:
	var from := global_position + Vector3.UP * 0.35
	var to := from + direction.normalized() * distance
	var query := PhysicsRayQueryParameters3D.create(from, to)
	query.exclude = [get_rid()]
	query.collision_mask = 3
	var hit := get_world_3d().direct_space_state.intersect_ray(query)
	if hit.is_empty():
		return distance
	var collider = hit.get("collider")
	if collider == player:
		return distance
	return from.distance_to(hit.get("position", to))

func _can_see_player() -> bool:
	if player == null:
		return false
	var from := global_position + Vector3.UP * 0.42
	var to := player.global_position + Vector3.UP * 0.58
	var query := PhysicsRayQueryParameters3D.create(from, to)
	query.exclude = [get_rid()]
	query.collision_mask = 3
	var hit := get_world_3d().direct_space_state.intersect_ray(query)
	if hit.is_empty():
		return true
	return hit.get("collider") == player

func _is_grounded() -> bool:
	var from := global_position + Vector3.UP * 0.08
	var to := global_position + Vector3.DOWN * 1.18
	var query := PhysicsRayQueryParameters3D.create(from, to)
	query.exclude = [get_rid()]
	query.collision_mask = 3
	var hit := get_world_3d().direct_space_state.intersect_ray(query)
	if hit.is_empty():
		return false
	var normal: Vector3 = hit.get("normal", Vector3.ZERO)
	return normal.y > 0.52

func _slow_horizontal(delta: float) -> void:
	linear_velocity.x = move_toward(linear_velocity.x, 0.0, acceleration * delta)
	linear_velocity.z = move_toward(linear_velocity.z, 0.0, acceleration * delta)

func _recover_upright(delta: float) -> void:
	rotation.x = lerp_angle(rotation.x, 0.0, clampf(delta * 6.0, 0.0, 1.0))
	rotation.z = lerp_angle(rotation.z, 0.0, clampf(delta * 6.0, 0.0, 1.0))
	angular_velocity.x = move_toward(angular_velocity.x, 0.0, delta * 7.5)
	angular_velocity.z = move_toward(angular_velocity.z, 0.0, delta * 7.5)

func _attack_player(horizontal_to_player: Vector3) -> void:
	attack_timer = attack_cooldown
	attack_anim = 1.0
	var direction := horizontal_to_player.normalized() if horizontal_to_player.length_squared() > 0.001 else -global_transform.basis.z
	if player.has_method("receive_enemy_attack"):
		player.call("receive_enemy_attack", attack_damage, direction * 2.8 + Vector3.UP * 0.42, self)

func take_psychic_damage(amount: float, impulse: Vector3 = Vector3.ZERO, source: String = "psychic") -> void:
	if dead:
		return
	health -= maxf(0.0, amount)
	hit_reaction = 1.0
	stun_timer = maxf(stun_timer, clampf(amount / 85.0, 0.12, 0.72))
	if not freeze and impulse.length_squared() > 0.001:
		lock_rotation = false
		apply_central_impulse(impulse)
		angular_velocity += Vector3(0.45, -0.7, 0.38) * clampf(impulse.length() * 0.08, 0.4, 2.5)
	if health <= 0.0:
		_die(impulse, source)

func _die(impulse: Vector3, _source: String) -> void:
	dead = true
	corpse_timer = corpse_lifetime
	stun_timer = 999.0
	memory_timer = 0.0
	attack_timer = 999.0
	remove_from_group("enemy")
	lock_rotation = false
	freeze = false
	gravity_scale = 1.0
	collision_layer = 2
	collision_mask = 3
	if impulse.length_squared() > 0.001:
		apply_central_impulse(impulse * 0.55)

func _on_body_entered(body: Node) -> void:
	if dead:
		return
	if body is RigidBody3D:
		var other := body as RigidBody3D
		if other.is_in_group("psychic_prop") and not other.is_in_group("enemy"):
			var relative_speed := (other.linear_velocity - linear_velocity).length()
			if relative_speed >= 4.5:
				var mass_factor := clampf(other.mass, 0.45, 5.0)
				var damage := clampf((relative_speed - 3.7) * (5.2 + mass_factor * 1.8), 8.0, 72.0)
				var impulse := other.linear_velocity.normalized() * clampf(relative_speed * mass_factor * 0.55, 2.0, 12.0)
				take_psychic_damage(damage, impulse, "thrown_prop")
				return

	# A Hallwalker Arthur has thrown can also be hurt by the environment on impact.
	if recent_psychic_release > 0.0 and impact_speed_cache >= 7.0 and not body.is_in_group("player"):
		var crash_damage := clampf((impact_speed_cache - 5.5) * 7.0, 10.0, 62.0)
		take_psychic_damage(crash_damage, Vector3.ZERO, "tk_impact")
		recent_psychic_release = 0.0

func _animate_body(delta: float, horizontal_speed: float, chasing: bool, limp: bool) -> void:
	var speed_ratio := clampf(horizontal_speed / maxf(chase_speed, 0.1), 0.0, 1.0)
	if not limp and speed_ratio > 0.025:
		gait_phase += delta * lerpf(4.2, 11.0, speed_ratio)

	var stride := lerpf(0.22, 0.88, speed_ratio)
	var gait := sin(gait_phase)
	var gait_opposite := sin(gait_phase + PI)
	var bob := absf(sin(gait_phase * 2.0)) * 0.025 * speed_ratio
	var lean := -0.055 if chasing else -0.018
	var attack_push := sin((1.0 - attack_anim) * PI) if attack_anim > 0.0 else 0.0

	if limp:
		rig.position.y = lerpf(rig.position.y, -0.04, clampf(delta * 6.0, 0.0, 1.0))
		torso.rotation.x = lerp_angle(torso.rotation.x, 0.18, clampf(delta * 4.0, 0.0, 1.0))
		arm_l.rotation.x = lerp_angle(arm_l.rotation.x, -0.25, clampf(delta * 3.0, 0.0, 1.0))
		arm_r.rotation.x = lerp_angle(arm_r.rotation.x, 0.32, clampf(delta * 3.0, 0.0, 1.0))
		leg_l.rotation.x = lerp_angle(leg_l.rotation.x, 0.18, clampf(delta * 3.0, 0.0, 1.0))
		leg_r.rotation.x = lerp_angle(leg_r.rotation.x, -0.12, clampf(delta * 3.0, 0.0, 1.0))
		return

	rig.position.y = lerpf(rig.position.y, bob, clampf(delta * 10.0, 0.0, 1.0))
	torso.rotation.x = lerp_angle(torso.rotation.x, lean - attack_push * 0.18, clampf(delta * 8.0, 0.0, 1.0))
	torso.rotation.z = lerp_angle(torso.rotation.z, gait * 0.025 * speed_ratio + hit_reaction * 0.08, clampf(delta * 8.0, 0.0, 1.0))
	head.rotation.y = lerp_angle(head.rotation.y, sin(gait_phase * 0.5) * 0.055 + hit_reaction * 0.10, clampf(delta * 7.0, 0.0, 1.0))
	head.rotation.x = lerp_angle(head.rotation.x, 0.025 + attack_push * 0.10, clampf(delta * 7.0, 0.0, 1.0))

	leg_l.rotation.x = lerp_angle(leg_l.rotation.x, gait * stride, clampf(delta * 14.0, 0.0, 1.0))
	leg_r.rotation.x = lerp_angle(leg_r.rotation.x, gait_opposite * stride, clampf(delta * 14.0, 0.0, 1.0))
	arm_l.rotation.x = lerp_angle(arm_l.rotation.x, gait_opposite * stride * 0.72 - attack_push * 0.95, clampf(delta * 13.0, 0.0, 1.0))
	arm_r.rotation.x = lerp_angle(arm_r.rotation.x, gait * stride * 0.72 - attack_push * 0.95, clampf(delta * 13.0, 0.0, 1.0))
	arm_l.rotation.z = lerp_angle(arm_l.rotation.z, -0.08 - attack_push * 0.16, clampf(delta * 10.0, 0.0, 1.0))
	arm_r.rotation.z = lerp_angle(arm_r.rotation.z, 0.08 + attack_push * 0.16, clampf(delta * 10.0, 0.0, 1.0))
