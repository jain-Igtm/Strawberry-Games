extends Node3D

const CONCRETE: Material = preload("res://arthur_mobile/materials/service_concrete.tres")
const FURNACE: Material = preload("res://arthur_mobile/materials/furnace_glow_v09.tres")
const ACCENT: Material = preload("res://arthur_mobile/materials/pool_accent_v09.tres")

var seed := 0

func configure(new_seed: int) -> void:
	seed = new_seed
	_build()

func _build() -> void:
	var shaft_width: float = 5.5 + float(seed % 3) * 1.35
	var half := shaft_width * 0.5
	# Shaft walls run far above and below the ordinary four-metre world.
	_box(Vector3(-half, 2.0, 0), Vector3(0.45, 23.0, shaft_width), CONCRETE, true)
	_box(Vector3(half, 2.0, 0), Vector3(0.45, 23.0, shaft_width), CONCRETE, true)
	_box(Vector3(0, 2.0, -half), Vector3(shaft_width, 23.0, 0.45), CONCRETE, true)
	# Split the front wall to leave stacked catwalk doorways.
	_box(Vector3(-half * 0.58, 2.0, half), Vector3(half * 0.84, 23.0, 0.45), CONCRETE, true)
	_box(Vector3(half * 0.58, 2.0, half), Vector3(half * 0.84, 23.0, 0.45), CONCRETE, true)

	var levels := [-8.0, -4.0, 4.4, 8.6, 12.8]
	for i in range(levels.size()):
		var y: float = levels[i]
		_add_catwalk(y, half, i)

	# Bottom floor and a furnace chamber make the downward route terminate somewhere tangible.
	_box(Vector3(0, -10.0, 0), Vector3(shaft_width, 0.35, shaft_width), CONCRETE, true)
	_add_furnace(Vector3(0, -8.9, -half + 0.85))
	if seed % 2 == 0:
		_add_furnace(Vector3(-half + 0.85, -4.2, 0))

	# A crooked stair run covers the first upper storey; beyond it Arthur can levitate.
	_add_stair_run(Vector3(-half - 2.0, 0.0, -4.6), 18, 0.27, 0.0)
	_add_stair_run(Vector3(-half - 2.0, 4.4, 4.6), 16, 0.27, PI)

	# Shaft illumination alternates sterile and furnace-orange pools.
	for i in range(levels.size()):
		var light := OmniLight3D.new()
		light.position = Vector3(0.0, levels[i] + 1.0, 0.0)
		light.light_color = Color(0.58, 0.78, 0.82, 1.0) if i % 2 == 0 else Color(0.95, 0.51, 0.24, 1.0)
		light.light_energy = 1.2 if i % 2 == 0 else 0.88
		light.omni_range = 8.5
		light.shadow_enabled = false
		add_child(light)

func _add_catwalk(y: float, half: float, index: int) -> void:
	var width: float = half * 2.0 + 5.4
	var platform := _box(Vector3(0, y, half + 2.0), Vector3(width, 0.28, 3.2), ACCENT, true)
	if index % 2 == 1:
		platform.position.x += 1.2
	# Short doorway throat leading away from the shaft.
	_box(Vector3(0, y + 1.9, half + 3.45), Vector3(5.0, 3.8, 0.35), CONCRETE, true)
	_box(Vector3(-2.35, y + 1.5, half + 4.9), Vector3(0.35, 3.0, 3.0), CONCRETE, true)
	_box(Vector3(2.35, y + 1.5, half + 4.9), Vector3(0.35, 3.0, 3.0), CONCRETE, true)
	_box(Vector3(0, y + 3.0, half + 4.9), Vector3(5.0, 0.28, 3.0), CONCRETE, true)
	# Simple rails so the catwalk reads as a place, not a floating slab.
	_box(Vector3(-width * 0.5 + 0.15, y + 0.65, half + 2.0), Vector3(0.18, 1.3, 3.2), ACCENT, true)
	_box(Vector3(width * 0.5 - 0.15, y + 0.65, half + 2.0), Vector3(0.18, 1.3, 3.2), ACCENT, true)

func _add_furnace(position: Vector3) -> void:
	_box(position, Vector3(2.8, 2.2, 1.5), CONCRETE, true)
	_box(position + Vector3(0, 0.1, 0.78), Vector3(1.65, 1.2, 0.08), FURNACE, false)
	var light := OmniLight3D.new()
	light.position = position + Vector3(0, 0.25, 1.0)
	light.light_color = Color(1.0, 0.22, 0.035, 1.0)
	light.light_energy = 2.4
	light.omni_range = 9.0
	light.shadow_enabled = false
	add_child(light)

func _add_stair_run(start: Vector3, count: int, rise: float, yaw: float) -> void:
	var direction := Vector3(sin(yaw), 0, cos(yaw))
	for i in range(count):
		var h: float = rise * float(i + 1)
		var step := _box(start + direction * float(i) * 0.48 + Vector3(0, h * 0.5, 0), Vector3(2.0, h, 0.58), CONCRETE, true)
		step.rotation.y = yaw

func _box(position: Vector3, size: Vector3, material: Material, collision: bool) -> CSGBox3D:
	var box := CSGBox3D.new()
	box.position = position
	box.size = size
	box.material_override = material
	box.use_collision = collision
	box.collision_layer = 3 if collision else 0
	box.collision_mask = 3 if collision else 0
	add_child(box)
	return box
