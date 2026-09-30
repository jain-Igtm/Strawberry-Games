extends CharacterBody3D

@export var walk_speed := 3.2
@export var run_speed := 5.1
@export var follow_distance := 3.45

var player: CharacterBody3D
var world_controller: Node3D
var boat: Node3D
var boat_spot: Marker3D
var pet_until := 0
var gait_time := 0.0
var visual_root: Node3D
var tail_pivot: Node3D
var leg_meshes: Array[Node3D] = []
var is_sitting := false

func _ready() -> void:
	add_to_group("dog")
	add_to_group("pet")
	process_physics_priority = 5
	motion_mode = CharacterBody3D.MOTION_MODE_GROUNDED
	floor_max_angle = deg_to_rad(52.0)
	floor_snap_length = 0.38
	floor_constant_speed = true
	max_slides = 6
	visual_root = get_node_or_null("Visual") as Node3D
	tail_pivot = get_node_or_null("Visual/TailPivot") as Node3D
	if visual_root != null:
		for child in visual_root.get_children():
			if child is Node3D and str(child.name).begins_with("Leg"):
				leg_meshes.append(child as Node3D)
	call_deferred("_resolve_refs")

func _resolve_refs() -> void:
	player = get_tree().get_first_node_in_group("player") as CharacterBody3D
	world_controller = get_tree().get_first_node_in_group("world") as Node3D
	boat = get_tree().get_first_node_in_group("boat") as Node3D
	if boat != null:
		boat_spot = boat.get_node_or_null("DogSpot") as Marker3D
	if player != null:
		add_collision_exception_with(player)
		player.add_collision_exception_with(self)

func _physics_process(delta: float) -> void:
	if player == null or not is_instance_valid(player):
		_resolve_refs()
		if player == null:
			return
	if boat == null or not is_instance_valid(boat):
		boat = get_tree().get_first_node_in_group("boat") as Node3D
		if boat != null:
			boat_spot = boat.get_node_or_null("DogSpot") as Marker3D

	if is_sitting:
		_hold_position(delta)
		return

	var target := _follow_target()
	var horizontal := Vector3(target.x - global_position.x, 0.0, target.z - global_position.z)
	var distance := horizontal.length()
	if _should_snap_to_companion(distance):
		global_position = target
		velocity = Vector3.ZERO
		reset_physics_interpolation()
		horizontal = Vector3.ZERO
		distance = 0.0

	var speed := 0.0
	if distance > 5.8:
		speed = run_speed
	elif distance > 0.65:
		speed = walk_speed

	if speed > 0.0 and distance > 0.05:
		var direction := horizontal / distance
		velocity.x = move_toward(velocity.x, direction.x * speed, delta * 8.5)
		velocity.z = move_toward(velocity.z, direction.z * speed, delta * 8.5)
		rotation.y = lerp_angle(rotation.y, atan2(-direction.x, -direction.z), clampf(delta * 7.0, 0.0, 1.0))
		gait_time += delta * (8.0 if speed == run_speed else 5.7)
	else:
		velocity.x = move_toward(velocity.x, 0.0, delta * 9.0)
		velocity.z = move_toward(velocity.z, 0.0, delta * 9.0)
		gait_time += delta * 2.0

	if not is_on_floor():
		velocity += get_gravity() * delta
	else:
		velocity.y = -0.3
	move_and_slide()

	if boat != null and global_position.y < -2.0:
		global_position = boat_spot.global_position if boat_spot != null else boat.to_global(Vector3(-1.20, 1.78, 4.25))
		velocity = Vector3.ZERO
		reset_physics_interpolation()

	_animate_companion(delta, speed > 0.0)

func _follow_target() -> Vector3:
	var piloted_boat = player.get("piloting_boat")
	if piloted_boat != null and is_instance_valid(piloted_boat):
		boat = piloted_boat as Node3D
		if boat_spot == null or boat_spot.get_parent() != boat:
			boat_spot = boat.get_node_or_null("DogSpot") as Marker3D
		return boat_spot.global_position if boat_spot != null else boat.to_global(Vector3(-1.20, 1.78, 4.25))

	var player_motion := Vector3(player.velocity.x, 0.0, player.velocity.z)
	var behind := Vector3.ZERO
	var side := Vector3.ZERO
	if player_motion.length() > 0.45:
		var motion_direction := player_motion.normalized()
		behind = -motion_direction * follow_distance
		side = Vector3(-motion_direction.z, 0.0, motion_direction.x) * 0.85
	else:
		var resting_direction := global_position - player.global_position
		resting_direction.y = 0.0
		if resting_direction.length_squared() < 0.1:
			resting_direction = player.global_transform.basis.z
		behind = resting_direction.normalized() * follow_distance
	return player.global_position + behind + side

func _should_snap_to_companion(distance: float) -> bool:
	if player.get("piloting_boat") != null:
		return distance > 6.0
	return distance > 14.0

func _hold_position(delta: float) -> void:
	velocity.x = 0.0
	velocity.z = 0.0
	if not is_on_floor():
		velocity += get_gravity() * delta
	else:
		velocity.y = -0.3
	move_and_slide()
	if boat != null and global_position.y < -2.0:
		global_position = boat_spot.global_position if boat_spot != null else boat.to_global(Vector3(-1.20, 1.78, 4.25))
		velocity = Vector3.ZERO
		reset_physics_interpolation()
	_animate_sitting(delta)

func _animate_companion(delta: float, moving: bool) -> void:
	var happy := Time.get_ticks_msec() < pet_until
	if visual_root != null:
		var bob := sin(gait_time * 2.0) * (0.028 if moving else 0.009)
		visual_root.position.y = lerpf(visual_root.position.y, bob, clampf(delta * 10.0, 0.0, 1.0))
	for leg in leg_meshes:
		leg.rotation.x = lerp_angle(leg.rotation.x, 0.0, clampf(delta * 10.0, 0.0, 1.0))
	if tail_pivot != null:
		var wag_speed := 10.0 if happy else (6.5 if moving else 3.0)
		var wag_amount := 0.78 if happy else (0.46 if moving else 0.20)
		tail_pivot.rotation.y = sin(Time.get_ticks_msec() * 0.001 * wag_speed) * wag_amount

func _animate_sitting(delta: float) -> void:
	gait_time += delta * 2.4
	if visual_root != null:
		visual_root.position.y = lerpf(visual_root.position.y, -0.16, clampf(delta * 8.0, 0.0, 1.0))
	for leg in leg_meshes:
		var target_angle := deg_to_rad(-58.0) if leg.position.z > 0.0 else 0.0
		leg.rotation.x = lerp_angle(leg.rotation.x, target_angle, clampf(delta * 9.0, 0.0, 1.0))
	if tail_pivot != null:
		tail_pivot.rotation.y = sin(gait_time * 2.8) * 0.44

func get_interaction_prompt() -> String:
	return "Call Scout along" if is_sitting else "Tell Scout to sit"

func interact(next_player: Node) -> void:
	is_sitting = not is_sitting
	velocity.x = 0.0
	velocity.z = 0.0
	pet_until = Time.get_ticks_msec() + 2800
	if next_player != null and next_player.has_method("show_status_message"):
		var message := "Scout settles down and stays." if is_sitting else "Scout rises and falls in behind you."
		next_player.call("show_status_message", message, 2.8)
