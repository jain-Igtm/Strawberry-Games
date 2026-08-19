extends Node3D

const HallwalkerScene: PackedScene = preload("res://arthur_mobile/enemies/hallwalker.tscn")

@export var desired_population := 3
@export var max_population := 5
@export var min_spawn_distance := 17.0
@export var max_spawn_distance := 31.0
@export var minimum_enemy_spacing := 8.0
@export var despawn_distance := 58.0
@export var spawn_check_interval := 2.6

var world: Node3D
var player: CharacterBody3D
var rng := RandomNumberGenerator.new()
var spawn_timer := 0.0

func setup(world_node: Node3D, player_node: CharacterBody3D) -> void:
	world = world_node
	player = player_node

func _ready() -> void:
	rng.randomize()
	spawn_timer = 1.8

func _process(delta: float) -> void:
	if world == null:
		world = get_parent() as Node3D
	if player == null or not is_instance_valid(player):
		player = get_tree().get_first_node_in_group("player") as CharacterBody3D
	if world == null or player == null:
		return

	_despawn_far_enemies()
	spawn_timer -= delta
	if spawn_timer > 0.0:
		return
	spawn_timer = spawn_check_interval

	var live := _live_enemy_count()
	if live >= desired_population or live >= max_population:
		return
	for _attempt in range(10):
		if _try_spawn_one():
			break

func _live_enemy_count() -> int:
	var count := 0
	for node in get_tree().get_nodes_in_group("enemy"):
		if node is Node3D and is_instance_valid(node):
			count += 1
	return count

func _despawn_far_enemies() -> void:
	for node in get_tree().get_nodes_in_group("enemy"):
		if not (node is Node3D):
			continue
		var enemy := node as Node3D
		if not is_instance_valid(enemy):
			continue
		var planar := Vector2(enemy.global_position.x - player.global_position.x, enemy.global_position.z - player.global_position.z).length()
		var vertical := absf(enemy.global_position.y - player.global_position.y)
		if planar > despawn_distance or vertical > 6.2:
			enemy.queue_free()

func _try_spawn_one() -> bool:
	var angle := rng.randf_range(0.0, TAU)
	var radius := rng.randf_range(min_spawn_distance, max_spawn_distance)
	var candidate_xz := player.global_position + Vector3(cos(angle) * radius, 0.0, sin(angle) * radius)
	candidate_xz.y = player.global_position.y

	if world.has_method("enemy_spawn_allowed") and not bool(world.call("enemy_spawn_allowed", candidate_xz)):
		return false

	var base_y := player.global_position.y - 1.0
	if world.has_method("enemy_floor_height"):
		base_y = float(world.call("enemy_floor_height"))
	var ray_from := Vector3(candidate_xz.x, base_y + 3.5, candidate_xz.z)
	var ray_to := Vector3(candidate_xz.x, base_y - 1.5, candidate_xz.z)
	var ray := PhysicsRayQueryParameters3D.create(ray_from, ray_to)
	ray.exclude = [player.get_rid()]
	ray.collision_mask = 3
	var hit := player.get_world_3d().direct_space_state.intersect_ray(ray)
	if hit.is_empty():
		return false
	var normal: Vector3 = hit.get("normal", Vector3.ZERO)
	if normal.y < 0.72:
		return false
	var floor_point: Vector3 = hit.get("position", candidate_xz)
	var spawn_position := floor_point + Vector3.UP * 1.02

	if spawn_position.distance_to(player.global_position) < min_spawn_distance:
		return false
	for node in get_tree().get_nodes_in_group("enemy"):
		if node is Node3D and (node as Node3D).global_position.distance_to(spawn_position) < minimum_enemy_spacing:
			return false

	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.38
	capsule.height = 1.9
	var shape_query := PhysicsShapeQueryParameters3D.new()
	shape_query.shape = capsule
	shape_query.transform = Transform3D(Basis.IDENTITY, spawn_position + Vector3.UP * 0.02)
	shape_query.collision_mask = 3
	shape_query.exclude = [player.get_rid()]
	var overlaps := player.get_world_3d().direct_space_state.intersect_shape(shape_query, 8)
	if not overlaps.is_empty():
		return false

	var enemy := HallwalkerScene.instantiate() as RigidBody3D
	add_child(enemy)
	enemy.global_position = spawn_position
	enemy.rotation.y = rng.randf_range(-PI, PI)
	return true
