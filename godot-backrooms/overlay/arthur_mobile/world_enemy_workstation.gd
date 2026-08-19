extends "res://arthur_mobile/world_v14_stable_stairs.gd"

const EnemyDirectorScript = preload("res://arthur_mobile/enemies/enemy_director.gd")
const ENEMY_PATH_RADIUS_CELLS := 16
const ENEMY_PATH_NODE_BUDGET := 420

var enemy_director: Node3D

func _ready() -> void:
	super._ready()
	enemy_director = EnemyDirectorScript.new() as Node3D
	enemy_director.name = "EnemyDirector"
	add_child(enemy_director)
	enemy_director.call("setup", self, player)

func enemy_floor_height() -> float:
	return float(current_level) * STOREY_HEIGHT

func enemy_spawn_allowed(position: Vector3) -> bool:
	var cell := _enemy_world_cell(position)
	if not active_tiles.has(cell):
		return false
	var source := _virtual_cell(cell, current_level)
	var sample: Dictionary = _biome_sample_for_cell(source)
	# Hallwalkers are corridor predators. Avoid spawning them inside open pool water.
	return int(sample.get("primary", BIOME_YELLOW)) != BIOME_POOL

func enemy_path_step(origin: Vector3, target: Vector3) -> Vector3:
	var start := _enemy_world_cell(origin)
	var goal := _enemy_world_cell(target)
	if start == goal:
		return target

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

		for direction in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var next: Vector2i = current + direction
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

	return Vector3(
		float(step.x) * CELL,
		float(current_level) * STOREY_HEIGHT + 1.02,
		float(step.y) * CELL
	)

func _enemy_world_cell(position: Vector3) -> Vector2i:
	return Vector2i(floori(position.x / CELL), floori(position.z / CELL))

func _enemy_cell_walkable(world_cell: Vector2i) -> bool:
	var source := _virtual_cell(world_cell, current_level)
	var sample: Dictionary = _biome_sample_for_cell(source)
	return int(sample.get("primary", BIOME_YELLOW)) != BIOME_POOL

func _enemy_cells_connected(a_world: Vector2i, b_world: Vector2i) -> bool:
	if abs(a_world.x - b_world.x) + abs(a_world.y - b_world.y) != 1:
		return false
	var a_source := _virtual_cell(a_world, current_level)
	var b_source := _virtual_cell(b_world, current_level)
	return int(_topology_edge(a_source, b_source)) != EDGE_SOLID
