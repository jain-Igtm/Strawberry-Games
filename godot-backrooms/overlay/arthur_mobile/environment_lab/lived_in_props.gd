extends Node3D

# Extra lived-in set dressing kept separate from the garage geometry so the whole
# experiment can be removed or cherry-picked independently.

const FURNITURE_ROOT := "res://arthur_assets/kaykit/gltf/"

func _ready() -> void:
	_build_attendant_apartment()
	_build_waiting_room_for_nobody()
	_build_bedroom_parking_bay()
	_build_loading_dock_office()

func _build_attendant_apartment() -> void:
	# A compact domestic arrangement inside the glass/carpet island.
	_spawn_static("rug_rectangle_stripes_B.gltf", Vector3(26.5, 0.055, 17.1), 0.0, 1.45)
	_spawn_psychic("couch_pillows.gltf", Vector3(28.7, 0.08, 18.9), PI, 1.05, Vector3(2.25, 1.0, 0.9), 48.0)
	_spawn_psychic("armchair.gltf", Vector3(24.2, 0.08, 18.2), PI * 0.55, 1.05, Vector3(0.95, 1.0, 0.95), 22.0)
	_spawn_psychic("table_low.gltf", Vector3(26.7, 0.08, 17.1), 0.0, 1.15, Vector3(1.35, 0.55, 0.85), 16.0)
	_spawn_static("cabinet_medium_decorated.gltf", Vector3(30.5, 0.05, 15.0), -PI * 0.5, 1.0)
	_spawn_static("lamp_standing.gltf", Vector3(29.8, 0.05, 20.0), 0.0, 1.0)
	_spawn_psychic("cactus_medium_A.gltf", Vector3(22.2, 0.08, 19.6), 0.0, 1.15, Vector3(0.55, 0.95, 0.55), 7.0)
	_spawn_psychic("book_set.gltf", Vector3(26.7, 0.62, 17.1), 0.18, 1.0, Vector3(0.55, 0.22, 0.38), 2.0)
	_add_warm_pool(Vector3(29.6, 1.75, 19.8), 1.35, 5.2)

func _build_waiting_room_for_nobody() -> void:
	# Proper textured chairs instead of relying only on blocky placeholder seating.
	# Every chair is a psychic prop, so the row can be dismantled in seconds by Arthur.
	for index in range(6):
		_spawn_psychic(
			"chair_C.gltf",
			Vector3(-10.0 + index * 1.45, 0.08, 24.6),
			PI,
			1.05,
			Vector3(0.72, 1.0, 0.72),
			8.0
		)
	_spawn_static("pictureframe_large_A.gltf", Vector3(-5.9, 1.55, 27.70), PI, 2.0)
	_spawn_static("pictureframe_small_C.gltf", Vector3(-3.8, 1.35, 27.69), PI, 1.5)

func _build_bedroom_parking_bay() -> void:
	# A fully made bed occupies a normal marked bay with no wall around it.
	# Keeping it deep in a bay preserves the central vehicle aisle.
	_spawn_psychic("bed_double_A.gltf", Vector3(27.5, 0.08, -12.0), PI * 0.5, 1.0, Vector3(2.25, 0.75, 2.9), 65.0)
	_spawn_static("rug_rectangle_A.gltf", Vector3(27.5, 0.055, -12.0), PI * 0.5, 1.35)
	_spawn_psychic("table_small.gltf", Vector3(32.2, 0.08, -12.0), 0.0, 1.0, Vector3(0.75, 0.7, 0.75), 10.0)
	_spawn_static("lamp_table.gltf", Vector3(32.2, 0.76, -12.0), 0.0, 1.0)
	_spawn_psychic("pillow_B.gltf", Vector3(26.8, 0.82, -12.0), -0.2, 1.0, Vector3(0.55, 0.20, 0.42), 1.1)
	_add_warm_pool(Vector3(32.2, 1.75, -12.0), 1.05, 4.2)

func _build_loading_dock_office() -> void:
	# One loading shutter has apparently been turned into an office wall.
	_spawn_static("shelf_B_large_decorated.gltf", Vector3(6.95, 0.05, -61.0), -PI * 0.5, 1.05)
	_spawn_psychic("table_medium_long.gltf", Vector3(5.6, 0.08, -63.2), PI * 0.5, 1.0, Vector3(1.8, 0.75, 0.85), 18.0)
	_spawn_psychic("chair_A_wood.gltf", Vector3(4.7, 0.08, -63.2), -PI * 0.5, 1.0, Vector3(0.72, 1.0, 0.72), 8.0)
	_spawn_psychic("chair_A_wood.gltf", Vector3(6.5, 0.08, -63.2), PI * 0.5, 1.0, Vector3(0.72, 1.0, 0.72), 8.0)
	_spawn_static("cactus_small_B.gltf", Vector3(6.6, 0.80, -62.9), 0.0, 1.0)

func _spawn_static(file_name: String, pos: Vector3, yaw: float, uniform_scale: float) -> Node3D:
	var instance := _load_scene(file_name)
	if instance == null:
		return null
	instance.position = pos
	instance.rotation.y = yaw
	instance.scale = Vector3.ONE * uniform_scale
	add_child(instance)
	return instance

func _spawn_psychic(file_name: String, pos: Vector3, yaw: float, uniform_scale: float, collision_size: Vector3, mass_kg: float) -> RigidBody3D:
	var instance := _load_scene(file_name)
	if instance == null:
		return null

	var body := RigidBody3D.new()
	body.name = "PsychicFurniture_%s" % file_name.get_basename()
	body.position = pos
	body.rotation.y = yaw
	body.mass = mass_kg
	body.collision_layer = 3
	body.collision_mask = 3
	body.continuous_cd = true
	body.add_to_group("psychic_prop")

	instance.scale = Vector3.ONE * uniform_scale
	body.add_child(instance)

	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = collision_size
	collision.shape = shape
	collision.position.y = collision_size.y * 0.5
	body.add_child(collision)
	add_child(body)
	return body

func _load_scene(file_name: String) -> Node3D:
	var path := FURNITURE_ROOT + file_name
	if not ResourceLoader.exists(path):
		return null
	var resource := ResourceLoader.load(path)
	if not (resource is PackedScene):
		return null
	return (resource as PackedScene).instantiate() as Node3D

func _add_warm_pool(pos: Vector3, energy: float, range_m: float) -> void:
	var light := OmniLight3D.new()
	light.position = pos
	light.light_color = Color(1.0, 0.62, 0.34)
	light.light_energy = energy
	light.omni_range = range_m
	light.shadow_enabled = false
	light.distance_fade_enabled = true
	light.distance_fade_begin = range_m * 1.6
	light.distance_fade_length = 5.0
	add_child(light)
