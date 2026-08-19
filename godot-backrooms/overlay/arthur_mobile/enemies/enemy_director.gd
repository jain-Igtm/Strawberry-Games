extends Node3D

const HallwalkerScene: PackedScene = preload("res://arthur_mobile/enemies/hallwalker.tscn")

# Mirrors the existing stable world generator constants without subclassing it.
# This keeps enemy logic isolated from the stairs implementation.
const CELL := 4.0
const STOREY_HEIGHT := 4.4
const BIOME_POOL := 1
const EDGE_SOLID := 2
const ENEMY_PATH_RADIUS_CELLS := 16
const ENEMY_PATH_NODE_BUDGET := 420

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
	add_to_group("enemy_director")
	rng.randomize()
	spawn_timer = 1.8
	if world == null:
		world = get_parent() as Node3D
	if player == null or not is_instance_valid(player):
		player = get_tree().get_first_node_in_group("player") as CharacterBody3D

func _process(delta: float) -> void:
	if world == null or not is_instance_valid(world):
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

	var live: int = _live_enemy_count()
	if live >= desired_population or live >= max_population:
		return
	for _attempt: int in range(10):
		if _try_spawn_one():
			break

func _live_enemy_count() -> int:
	var count := 0
	for node: Node in get_tree().get_nodes_in_group("enemy"):
		if node is Node3D and is_instance_valid(node):
			count += 1
	return count

func _despawn_far_enemies() -> void:
	for node: Node in get_tree().get_nodes_in_group("enemy"):
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

	if not enemy_spawn_allowed(candidate_xz):
		return false

	var base_y := enemy_floor_height()
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
	for node: Node in get_tree().get_nodes_in_group("enemy"):
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

func enemy_floor_height() -> float:
	return float(_current_level()) * STOREY_HEIGHT

func enemy_spawn_allowed(position: Vector3) -> bool:
	if world == null:
		return false
	var cell := _enemy_world_cell(position)
	var active_tiles_value: Variant = world.get("active_tiles")
	if active_tiles_value is Dictionary and not (active_tiles_value as Dictionary).has(cell):
		return false
	var sample := _world_biome_sample(cell)
	if sample.is_empty():
		return true
	return int(sample.get("primary", 0)) != BIOME_POOL

func enemy_path_step(origin: Vector3, target: Vector3) -> Vector3:
	if world == null:
		return target
	var start := _enemy_world_cell(origin)
	var goal := _enemy_world_cell(target)
	if start == goal:
		return target

	var active_tiles_value: Variant = world.get("active_tiles")
	if not (active_tiles_value is Dictionary):
		return target
	var active_tiles: Dictionary = active_tiles_value as Dictionary
	var frontier: Array[Vector2i] = [start]
	var head := 0
	var came_from: Dictionary = {start: start}
	var found := false
	var visited := 0

	while head < frontier.size() and visited < ENEMY_PATH_NODE_BUDGET:
		var current: Vector2i = frontier[head]
		head += 1
		visited += 1
		if current == goal:
			found = true
			break

		for direction: Vector2i in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var next := current + direction
			if came_from.has(next):
				continue
			if maxi(abs(next.x - start.x), abs(next.y - start.y)) > ENEMY_PATH_RADIUS_CELLS:
				continue
			if not active_tiles.has(next):
				continue
			if not _enemy_cell_walkable(next):
				continue
			if not _enemy_cells_connected(current, next):
				continue
			came_from[next] = current
			frontier.append(next)

	if not found and not came_from.has(goal):
		return target

	var step := goal
	if not came_from.has(step):
		return target
	while came_from.has(step) and (came_from[step] as Vector2i) != start:
		step = came_from[step] as Vector2i

	return Vector3(float(step.x) * CELL, enemy_floor_height() + 1.02, float(step.y) * CELL)

func _enemy_world_cell(position: Vector3) -> Vector2i:
	return Vector2i(floori(position.x / CELL), floori(position.z / CELL))

func _enemy_cell_walkable(world_cell: Vector2i) -> bool:
	var sample := _world_biome_sample(world_cell)
	if sample.is_empty():
		return true
	return int(sample.get("primary", 0)) != BIOME_POOL

func _enemy_cells_connected(a_world: Vector2i, b_world: Vector2i) -> bool:
	if abs(a_world.x - b_world.x) + abs(a_world.y - b_world.y) != 1:
		return false
	if world == null or not world.has_method("_topology_edge") or not world.has_method("_virtual_cell"):
		return true
	var level := _current_level()
	var a_source: Vector2i = world.call("_virtual_cell", a_world, level)
	var b_source: Vector2i = world.call("_virtual_cell", b_world, level)
	return int(world.call("_topology_edge", a_source, b_source)) != EDGE_SOLID

func _world_biome_sample(world_cell: Vector2i) -> Dictionary:
	if world == null or not world.has_method("_biome_sample_for_cell"):
		return {}
	var source := world_cell
	if world.has_method("_virtual_cell"):
		source = world.call("_virtual_cell", world_cell, _current_level()) as Vector2i
	var result: Variant = world.call("_biome_sample_for_cell", source)
	return result as Dictionary if result is Dictionary else {}

func _current_level() -> int:
	if world == null:
		return 0
	var value: Variant = world.get("current_level")
	return int(value) if value != null else 0
