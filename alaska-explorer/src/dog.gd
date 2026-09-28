extends CharacterBody3D

@export var walk_speed := 3.2
@export var run_speed := 5.1

var player: CharacterBody3D
var world_controller: Node3D
var boat: Node3D
var pet_until := 0
var gait_time := 0.0
var visual_root: Node3D
var tail_pivot: Node3D

func _ready() -> void:
	add_to_group("dog")
	process_physics_priority = 5
	visual_root = get_node_or_null("Visual") as Node3D
	tail_pivot = get_node_or_null("Visual/TailPivot") as Node3D
	call_deferred("_resolve_refs")

func _resolve_refs() -> void:
	player = get_tree().get_first_node_in_group("player") as CharacterBody3D
	world_controller = get_tree().get_first_node_in_group("world") as Node3D
	boat = get_tree().get_first_node_in_group("boat") as Node3D
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

	var target := player.global_position + player.global_basis.z * 1.65 - player.global_basis.x * 0.45
	var piloted_boat = player.get("piloting_boat")
	if piloted_boat != null and is_instance_valid(piloted_boat):
		boat = piloted_boat as Node3D
		target = boat.to_global(Vector3(-1.20, 1.78, 4.25))
		if global_position.distance_to(target) > 5.5:
			global_position = target
			velocity = Vector3.ZERO
			reset_physics_interpolation()

	var horizontal := Vector3(target.x - global_position.x, 0.0, target.z - global_position.z)
	var distance := horizontal.length()
	var speed := 0.0
	if distance > 5.0:
		speed = run_speed
	elif distance > 2.15:
		speed = walk_speed

	if speed > 0.0 and distance > 0.05:
		var direction := horizontal / distance
		velocity.x = move_toward(velocity.x, direction.x * speed, delta * 8.5)
		velocity.z = move_toward(velocity.z, direction.z * speed, delta * 8.5)
		look_at(global_position + direction, Vector3.UP)
		gait_time += delta * (8.0 if speed == run_speed else 5.7)
	else:
		velocity.x = move_toward(velocity.x, 0.0, delta * 9.0)
		velocity.z = move_toward(velocity.z, 0.0, delta * 9.0)
		gait_time += delta * 2.0

	if not is_on_floor():
		velocity += get_gravity() * delta

	move_and_slide()

	if boat != null and global_position.y < -2.0:
		global_position = boat.to_global(Vector3(-1.20, 1.78, 4.25))
		velocity = Vector3.ZERO
		reset_physics_interpolation()

	_animate_companion(speed > 0.0)

func _animate_companion(moving: bool) -> void:
	var happy := Time.get_ticks_msec() < pet_until
	if visual_root != null:
		var bob := sin(gait_time * 2.0) * (0.028 if moving else 0.009)
		visual_root.position.y = bob
	if tail_pivot != null:
		var wag_speed := 10.0 if happy else (6.5 if moving else 3.0)
		var wag_amount := 0.78 if happy else (0.46 if moving else 0.20)
		tail_pivot.rotation.y = sin(Time.get_ticks_msec() * 0.001 * wag_speed) * wag_amount

func get_interaction_prompt() -> String:
	return "Pet dog"

func interact(next_player: Node) -> void:
	pet_until = Time.get_ticks_msec() + 2800
	if next_player != null and next_player.has_method("show_status_message"):
		next_player.call("show_status_message", "Your dog leans into your hand.", 2.4)
