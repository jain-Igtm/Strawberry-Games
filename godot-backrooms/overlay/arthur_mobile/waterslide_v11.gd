extends Node3D

const TILE: Material = preload("res://arthur_mobile/materials/pool_tiles.tres")
const ACCENT: Material = preload("res://arthur_mobile/materials/pool_accent_v09.tres")
const WATER: Material = preload("res://arthur_mobile/materials/water_surface_v09.tres")
const WATER_LOOP: AudioStream = preload("res://arthur_mobile/audio/loop_water_02.ogg")

var seed := 0
var cross_floor := false
var ride_points := PackedVector3Array()
var armed := true

func configure(new_seed: int, new_cross_floor: bool) -> void:
	seed = new_seed
	cross_floor = new_cross_floor
	_build()

func _build() -> void:
	ride_points.clear()
	var side_sign := -1.0 if (seed & 1) == 0 else 1.0
	var start := Vector3(7.4 * side_sign, 3.55, -7.8)
	var end_y := -3.55 if cross_floor else 0.62

	# The path bends instead of reading as a staircase with a water texture. The
	# cross-floor version dives below the current plane and hands the player to
	# the next generated storey at the end of the ride.
	ride_points.append(start)
	ride_points.append(start + Vector3(-0.6 * side_sign, -0.25, 2.1))
	ride_points.append(start + Vector3(-2.0 * side_sign, -0.85, 4.4))
	ride_points.append(start + Vector3(-3.8 * side_sign, -1.35, 6.8))
	ride_points.append(start + Vector3(-3.0 * side_sign, -2.05, 9.4))
	if cross_floor:
		ride_points.append(start + Vector3(-1.2 * side_sign, -3.6, 11.8))
		ride_points.append(Vector3(3.2 * side_sign, end_y, 5.8))
	else:
		ride_points.append(start + Vector3(-0.8 * side_sign, -2.55, 12.0))
		ride_points.append(Vector3(2.7 * side_sign, end_y, 5.4))

	_add_entry_platform(start)
	for i in range(ride_points.size() - 1):
		_add_segment(ride_points[i], ride_points[i + 1])
	_add_trigger(start)
	_add_water_audio()

func _add_entry_platform(start: Vector3) -> void:
	var platform := CSGBox3D.new()
	platform.position = start + Vector3(0, -0.24, -0.85)
	platform.size = Vector3(3.1, 0.30, 2.3)
	platform.material_override = TILE
	platform.use_collision = true
	platform.collision_layer = 3
	platform.collision_mask = 3
	add_child(platform)

func _add_segment(a: Vector3, b: Vector3) -> void:
	var delta := b - a
	var length := delta.length()
	if length <= 0.01:
		return
	var pivot := Node3D.new()
	pivot.position = (a + b) * 0.5
	add_child(pivot)
	pivot.look_at(pivot.global_position + delta.normalized(), Vector3.UP)

	var base := CSGBox3D.new()
	base.position = Vector3(0, -0.09, 0)
	base.size = Vector3(1.95, 0.18, length + 0.10)
	base.material_override = ACCENT
	base.use_collision = true
	base.collision_layer = 3
	base.collision_mask = 3
	pivot.add_child(base)

	for side in [-1.0, 1.0]:
		var lip := CSGBox3D.new()
		lip.position = Vector3(side * 1.02, 0.28, 0)
		lip.size = Vector3(0.18, 0.72, length + 0.12)
		lip.material_override = TILE
		lip.use_collision = true
		lip.collision_layer = 3
		lip.collision_mask = 3
		pivot.add_child(lip)

	var water_mesh := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(1.72, length)
	plane.subdivide_width = 3
	plane.subdivide_depth = 5
	plane.material = WATER
	water_mesh.mesh = plane
	water_mesh.position = Vector3(0, 0.025, 0)
	pivot.add_child(water_mesh)

func _add_trigger(start: Vector3) -> void:
	var area := Area3D.new()
	area.position = start + Vector3(0, 0.55, 0.2)
	area.collision_layer = 0
	area.collision_mask = 1
	add_child(area)
	var shape_node := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(2.25, 1.6, 2.0)
	shape_node.shape = shape
	area.add_child(shape_node)
	area.body_entered.connect(_on_body_entered)

func _add_water_audio() -> void:
	if ride_points.is_empty():
		return
	var sound := AudioStreamPlayer3D.new()
	sound.stream = WATER_LOOP
	sound.autoplay = true
	sound.volume_db = -11.0
	sound.max_distance = 28.0
	sound.unit_size = 6.0
	var middle_index: int = int(ride_points.size() / 2)
	sound.position = ride_points[middle_index]
	add_child(sound)

func _on_body_entered(body: Node3D) -> void:
	if not armed or body == null or not body.has_method("begin_waterslide"):
		return
	armed = false
	var global_points := PackedVector3Array()
	for point in ride_points:
		global_points.append(to_global(point))
	body.call("begin_waterslide", global_points, -1 if cross_floor else 0, 3.65 if cross_floor else 3.0)
	_rearm_later()

func _rearm_later() -> void:
	await get_tree().create_timer(4.0).timeout
	armed = true
