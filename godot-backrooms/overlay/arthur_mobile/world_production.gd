extends "res://arthur_mobile/world_v12.gd"

const MaintenanceCartScene: PackedScene = preload("res://arthur_mobile/maintenance_cart.tscn")

const PROD_MOBILE_LOAD_RADIUS := 7
const PROD_DESKTOP_LOAD_RADIUS := 10
const PROD_MOBILE_UNLOAD_RADIUS := 9
const PROD_DESKTOP_UNLOAD_RADIUS := 13
const PROD_MOBILE_BUILD_BUDGET := 5
const PROD_DESKTOP_BUILD_BUDGET := 10
const PROD_CLEANUP_BUDGET := 12
const PROD_VEHICLE_KEEP_DISTANCE := 72.0
const PROD_ROOM_CENTER := Vector3(10.0, 0.0, 10.0)

var vehicle_root: Node3D
var vehicles_by_room: Dictionary = {}
var prod_warm_material: StandardMaterial3D
var prod_dark_material: StandardMaterial3D
var prod_metal_material: StandardMaterial3D
var prod_glow_warm: StandardMaterial3D
var prod_glow_cool: StandardMaterial3D
var prod_pool_material: StandardMaterial3D
var prod_service_material: StandardMaterial3D
var prod_black_material: StandardMaterial3D

func _ready() -> void:
	super._ready()
	vehicle_root = Node3D.new()
	vehicle_root.name = "PersistentVehicles"
	add_child(vehicle_root)
	_ensure_production_materials()
	ceiling_mesh.use_collision = true
	ceiling_mesh.collision_layer = 3
	ceiling_mesh.collision_mask = 3

func _process(delta: float) -> void:
	super._process(delta)
	_cleanup_far_vehicles()

func _rebuild_queue() -> void:
	build_queue.clear()
	var radius := PROD_MOBILE_LOAD_RADIUS if OS.has_feature("mobile") else PROD_DESKTOP_LOAD_RADIUS
	for ring in range(radius + 1):
		for z in range(-ring, ring + 1):
			for x in range(-ring, ring + 1):
				if maxi(abs(x), abs(z)) != ring:
					continue
				var cell := center_cell + Vector2i(x, z)
				if not active_tiles.has(cell):
					build_queue.append(cell)

func _build_some_tiles() -> void:
	var budget := PROD_MOBILE_BUILD_BUDGET if OS.has_feature("mobile") else PROD_DESKTOP_BUILD_BUDGET
	var count := mini(budget, build_queue.size())
	for _i in range(count):
		var cell: Vector2i = build_queue.pop_front()
		if active_tiles.has(cell):
			continue
		_add_cell(cell)

func _cleanup_far_tiles() -> void:
	var radius := PROD_MOBILE_UNLOAD_RADIUS if OS.has_feature("mobile") else PROD_DESKTOP_UNLOAD_RADIUS
	var removed := 0
	for raw_cell in active_tiles.keys():
		if removed >= PROD_CLEANUP_BUDGET:
			break
		var cell := raw_cell as Vector2i
		if maxi(absi(cell.x - center_cell.x), absi(cell.y - center_cell.y)) <= radius:
			continue
		var root := active_tiles.get(cell) as Node
		active_tiles.erase(cell)
		if root != null and is_instance_valid(root):
			root.queue_free()
		removed += 1

func _add_cell(world_cell: Vector2i) -> void:
	super._add_cell(world_cell)
	if not active_tiles.has(world_cell):
		return
	var root := active_tiles[world_cell] as Node3D
	if root == null:
		return
	var source_cell := _virtual_cell(world_cell, current_level)
	var sample := _biome_sample_for_cell(source_cell)
	_add_production_room_pass(root, world_cell, source_cell, sample)

func _add_production_room_pass(root: Node3D, world_cell: Vector2i, source_cell: Vector2i, sample: Dictionary) -> void:
	var local_x := _positive_mod(source_cell.x, ROOM_SIZE)
	var local_z := _positive_mod(source_cell.y, ROOM_SIZE)
	if local_x != 0 or local_z != 0:
		return

	var room := _room_for_cell(source_cell)
	var biome := int(sample["primary"])
	var roll := _hash(room.x + current_level * 31, room.y - current_level * 47, 9101)
	var center := PROD_ROOM_CENTER

	if biome == BIOME_YELLOW:
		_add_yellow_architecture(root, center, roll)
	elif biome == BIOME_POOL:
		_add_pool_architecture(root, center, roll)
	else:
		_add_service_architecture(root, center, roll)

	_add_story_cluster(root, center, biome, roll)
	_add_room_atmosphere_detail(root, center, biome, roll)
	_maybe_spawn_vehicle(root, world_cell, source_cell, sample, roll)

func _add_yellow_architecture(root: Node3D, center: Vector3, roll: int) -> void:
	match posmod(roll, 7):
		0:
			_add_recursive_frames(root, center, prod_warm_material, prod_glow_warm)
		1:
			_add_false_window(root, center + Vector3(0.0, 0.0, -5.9), 0.0, prod_glow_warm)
		2:
			_add_column_pair(root, center, prod_warm_material)
		3:
			_add_low_split_level(root, center, prod_warm_material)
		4:
			_add_ceiling_ribs(root, center, prod_dark_material)
		5:
			_add_offset_threshold(root, center, prod_warm_material)
		_:
			pass

func _add_pool_architecture(root: Node3D, center: Vector3, roll: int) -> void:
	match posmod(roll, 6):
		0:
			_add_recursive_frames(root, center + Vector3(0.0, 0.05, 0.0), prod_pool_material, prod_glow_cool)
		1:
			_add_false_window(root, center + Vector3(5.8, 0.0, 0.0), PI * 0.5, prod_glow_cool)
		2:
			_add_column_pair(root, center, prod_pool_material)
		3:
			_add_ceiling_ribs(root, center, prod_pool_material)
		4:
			_add_offset_threshold(root, center, prod_pool_material)
		_:
			pass

func _add_service_architecture(root: Node3D, center: Vector3, roll: int) -> void:
	match posmod(roll, 6):
		0:
			_add_service_pipe_bridge(root, center)
		1:
			_add_false_window(root, center + Vector3(0.0, 0.0, -5.8), 0.0, prod_glow_cool)
		2:
			_add_column_pair(root, center, prod_service_material)
		3:
			_add_ceiling_ribs(root, center, prod_metal_material)
		4:
			_add_offset_threshold(root, center, prod_service_material)
		_:
			pass

func _add_recursive_frames(root: Node3D, center: Vector3, material: Material, glow: Material) -> void:
	for i in range(4):
		var depth := -3.0 + float(i) * 2.0
		var width := 4.5 - float(i) * 0.42
		var height := 3.35 - float(i) * 0.18
		_add_mesh_box(root, center + Vector3(-width * 0.5, height * 0.5, depth), Vector3(0.14, height, 0.18), material, false)
		_add_mesh_box(root, center + Vector3(width * 0.5, height * 0.5, depth), Vector3(0.14, height, 0.18), material, false)
		_add_mesh_box(root, center + Vector3(0.0, height, depth), Vector3(width, 0.14, 0.18), material, false)
		if i == 3:
			_add_mesh_box(root, center + Vector3(0.0, height - 0.18, depth - 0.05), Vector3(width * 0.68, 0.05, 0.05), glow, false)

func _add_false_window(root: Node3D, center: Vector3, yaw: float, glow: Material) -> void:
	var holder := Node3D.new()
	holder.position = center
	holder.rotation.y = yaw
	root.add_child(holder)
	_add_mesh_box(holder, Vector3(0.0, 1.65, 0.0), Vector3(3.7, 2.35, 0.10), prod_black_material, false)
	_add_mesh_box(holder, Vector3(-1.90, 1.65, -0.04), Vector3(0.12, 2.60, 0.18), prod_metal_material, false)
	_add_mesh_box(holder, Vector3(1.90, 1.65, -0.04), Vector3(0.12, 2.60, 0.18), prod_metal_material, false)
	_add_mesh_box(holder, Vector3(0.0, 2.95, -0.04), Vector3(3.92, 0.12, 0.18), prod_metal_material, false)
	_add_mesh_box(holder, Vector3(0.0, 0.35, -0.04), Vector3(3.92, 0.12, 0.18), prod_metal_material, false)
	_add_mesh_box(holder, Vector3(0.0, 2.72, -0.10), Vector3(2.8, 0.035, 0.035), glow, false)

func _add_column_pair(root: Node3D, center: Vector3, material: Material) -> void:
	for x_sign in [-1.0, 1.0]:
		_add_mesh_box(root, center + Vector3(3.1 * x_sign, 1.95, 0.0), Vector3(0.62, 3.90, 0.62), material, true)
		_add_mesh_box(root, center + Vector3(3.1 * x_sign, 3.72, 0.0), Vector3(1.10, 0.18, 1.10), material, false)

func _add_low_split_level(root: Node3D, center: Vector3, material: Material) -> void:
	_add_mesh_box(root, center + Vector3(4.2, 0.18, 3.2), Vector3(5.2, 0.36, 4.7), material, true)
	for i in range(3):
		var step_height := 0.12 * float(i + 1)
		_add_mesh_box(root, center + Vector3(1.15 + float(i) * 0.55, step_height * 0.5, 3.2), Vector3(0.58, step_height, 2.0), material, true)

func _add_ceiling_ribs(root: Node3D, center: Vector3, material: Material) -> void:
	for i in range(5):
		var offset := (float(i) - 2.0) * 2.55
		_add_mesh_box(root, center + Vector3(offset, 3.76, 0.0), Vector3(0.16, 0.22, 8.8), material, false)

func _add_offset_threshold(root: Node3D, center: Vector3, material: Material) -> void:
	var pivot := Node3D.new()
	pivot.position = center + Vector3(0.0, 0.0, 1.2)
	pivot.rotation.y = deg_to_rad(7.5)
	root.add_child(pivot)
	_add_mesh_box(pivot, Vector3(-2.25, 1.75, 0.0), Vector3(0.18, 3.5, 0.30), material, true)
	_add_mesh_box(pivot, Vector3(2.25, 1.75, 0.0), Vector3(0.18, 3.5, 0.30), material, true)
	_add_mesh_box(pivot, Vector3(0.0, 3.42, 0.0), Vector3(4.65, 0.16, 0.30), material, false)

func _add_service_pipe_bridge(root: Node3D, center: Vector3) -> void:
	for z_offset in [-1.1, 1.1]:
		var pipe := MeshInstance3D.new()
		var mesh := CylinderMesh.new()
		mesh.top_radius = 0.16
		mesh.bottom_radius = 0.16
		mesh.height = 8.5
		mesh.radial_segments = 10
		mesh.material = prod_metal_material
		pipe.mesh = mesh
		pipe.rotation.z = PI * 0.5
		pipe.position = center + Vector3(0.0, 3.25, z_offset)
		root.add_child(pipe)
	_add_mesh_box(root, center + Vector3(-4.2, 2.3, 0.0), Vector3(0.24, 2.0, 3.0), prod_service_material, true)
	_add_mesh_box(root, center + Vector3(4.2, 2.3, 0.0), Vector3(0.24, 2.0, 3.0), prod_service_material, true)

func _add_story_cluster(root: Node3D, center: Vector3, biome: int, roll: int) -> void:
	var story := posmod(roll / 7, 9)
	if story == 0:
		_add_abandoned_staging(root, center + Vector3(-3.0, 0.0, 3.4), biome, roll)
	elif story == 1:
		_add_direction_sign(root, center + Vector3(0.0, 2.25, -5.5), biome, roll)
	elif story == 2:
		_add_psychic_debris(root, center + Vector3(3.4, 0.0, 3.1), biome, roll)
	elif story == 3 and biome == BIOME_SERVICE:
		_add_service_console(root, center + Vector3(-3.6, 0.0, -2.8))

func _add_abandoned_staging(root: Node3D, position: Vector3, biome: int, roll: int) -> void:
	var material := prod_warm_material
	if biome == BIOME_POOL:
		material = prod_pool_material
	elif biome == BIOME_SERVICE:
		material = prod_service_material
	_add_mesh_box(root, position + Vector3(0.0, 0.34, 0.0), Vector3(1.7, 0.68, 0.74), material, true)
	_add_rigid_prop(root, position + Vector3(1.15, 0.32, 0.45), Vector3(0.52, 0.52, 0.52), material, float(roll & 3) * 0.4)
	_add_rigid_prop(root, position + Vector3(-1.05, 0.22, -0.42), Vector3(0.38, 0.38, 0.62), material, float((roll >> 3) & 3) * 0.5)

func _add_direction_sign(root: Node3D, position: Vector3, biome: int, roll: int) -> void:
	var sign := Label3D.new()
	sign.position = position
	sign.text = _sign_text(biome, roll)
	sign.font_size = 44
	sign.outline_size = 8
	sign.modulate = Color(0.84, 0.82, 0.66, 1.0) if biome == BIOME_YELLOW else Color(0.68, 0.88, 0.86, 1.0)
	sign.no_depth_test = false
	root.add_child(sign)

func _sign_text(biome: int, roll: int) -> String:
	if biome == BIOME_POOL:
		return "BATH %02d  /  DEPTH VARIES" % [posmod(roll, 37)]
	if biome == BIOME_SERVICE:
		return "PUMP %02d  /  ACCESS CONTINUES" % [posmod(roll, 41)]
	return "SUITE %02d  /  RETURN ROUTE" % [posmod(roll, 53)]

func _add_psychic_debris(root: Node3D, position: Vector3, biome: int, roll: int) -> void:
	var material := prod_warm_material if biome == BIOME_YELLOW else (prod_pool_material if biome == BIOME_POOL else prod_service_material)
	for i in range(3):
		var x := float(i - 1) * 0.62
		var z := float(posmod(roll >> (i + 2), 5) - 2) * 0.22
		_add_rigid_prop(root, position + Vector3(x, 0.24 + float(i) * 0.06, z), Vector3(0.38, 0.38 + float(i) * 0.08, 0.38), material, float(i) * 0.35)

func _add_service_console(root: Node3D, position: Vector3) -> void:
	_add_mesh_box(root, position + Vector3(0.0, 0.65, 0.0), Vector3(2.25, 1.30, 0.62), prod_dark_material, true)
	_add_mesh_box(root, position + Vector3(0.0, 1.05, -0.34), Vector3(1.62, 0.46, 0.05), prod_glow_cool, false)

func _add_room_atmosphere_detail(root: Node3D, center: Vector3, biome: int, roll: int) -> void:
	if posmod(roll, 4) != 0:
		return
	var fixture_material := prod_glow_warm
	var light_color := Color(1.0, 0.84, 0.52, 1.0)
	if biome == BIOME_POOL:
		fixture_material = prod_glow_cool
		light_color = Color(0.55, 0.88, 0.93, 1.0)
	elif biome == BIOME_SERVICE:
		fixture_material = prod_glow_cool
		light_color = Color(0.62, 0.78, 0.70, 1.0)
	_add_mesh_box(root, center + Vector3(0.0, 3.74, 1.6), Vector3(1.8, 0.05, 0.18), fixture_material, false)
	var light := OmniLight3D.new()
	light.position = center + Vector3(0.0, 3.35, 1.6)
	light.light_color = light_color
	light.light_energy = 0.52
	light.omni_range = 5.6
	light.shadow_enabled = false
	root.add_child(light)

func _maybe_spawn_vehicle(root: Node3D, _world_cell: Vector2i, source_cell: Vector2i, sample: Dictionary, roll: int) -> void:
	if vehicle_root == null:
		return
	var biome := int(sample["primary"])
	if biome == BIOME_POOL:
		return
	var room := _room_for_cell(source_cell)
	if not _room_is_hall(room):
		return
	if posmod(roll, 29) != 0:
		return
	var key := Vector3i(room.x, current_level, room.y)
	if vehicles_by_room.has(key):
		return
	var cart := MaintenanceCartScene.instantiate() as CharacterBody3D
	if cart == null:
		return
	cart.global_position = root.global_position + PROD_ROOM_CENTER + Vector3(0.0, 0.15, 0.0)
	cart.rotation.y = float((roll >> 4) & 1) * PI * 0.5
	vehicle_root.add_child(cart)
	vehicles_by_room[key] = cart

func _cleanup_far_vehicles() -> void:
	if vehicle_root == null:
		return
	for raw_key in vehicles_by_room.keys():
		var cart := vehicles_by_room.get(raw_key) as CharacterBody3D
		if cart == null or not is_instance_valid(cart):
			vehicles_by_room.erase(raw_key)
			continue
		if cart.has_method("has_driver") and bool(cart.call("has_driver")):
			continue
		if cart.global_position.distance_to(player.global_position) > PROD_VEHICLE_KEEP_DISTANCE or absf(cart.global_position.y - player.global_position.y) > STOREY_HEIGHT * 1.5:
			vehicles_by_room.erase(raw_key)
			cart.queue_free()

func _build_stair_run(root: Node3D, direction_2d: Vector2i) -> void:
	var direction := Vector3(float(direction_2d.x), 0.0, float(direction_2d.y))
	var side := Vector3(-direction.z, 0.0, direction.x)
	var yaw := PI * 0.5 if direction_2d.x != 0 else 0.0
	var rise := STOREY_HEIGHT / float(STAIR_STEPS)
	var start_offset := -direction * 0.55
	var total_run := float(STAIR_STEPS - 1) * STAIR_RUN

	for i in range(STAIR_STEPS):
		var top_y := rise * float(i + 1)
		var along := start_offset + direction * (float(i) * STAIR_RUN)
		_add_mesh_box(root, along + Vector3.UP * (top_y - 0.045), Vector3(STAIR_WIDTH, 0.09, STAIR_RUN + 0.03), prod_warm_material, false, yaw)
		var riser := along - direction * (STAIR_RUN * 0.5) + Vector3.UP * (top_y - rise * 0.5)
		_add_mesh_box(root, riser, Vector3(STAIR_WIDTH, rise, 0.055), prod_warm_material, false, yaw)

	var ramp_start := start_offset - direction * 0.10 + Vector3.UP * 0.08
	var ramp_end := start_offset + direction * (total_run + 0.12) + Vector3.UP * (STOREY_HEIGHT - 0.18)
	_add_sloped_collision(root, ramp_start, ramp_end, STAIR_WIDTH * 0.92, 0.18)
	_add_sloped_mesh(root, ramp_start - Vector3.UP * 0.12, ramp_end - Vector3.UP * 0.12, STAIR_WIDTH * 0.94, 0.10, prod_dark_material)

	var landing := start_offset + direction * (total_run + 0.74)
	landing.y = STOREY_HEIGHT - 0.09
	_add_mesh_box(root, landing, Vector3(STAIR_WIDTH + 0.60, 0.18, 1.72), prod_warm_material, true, yaw)

	for sign_value in [-1.0, 1.0]:
		var lateral := side * ((STAIR_WIDTH * 0.5 + 0.08) * sign_value)
		var rail_a := start_offset + lateral + Vector3.UP * (rise + 0.94)
		var rail_b := start_offset + direction * total_run + lateral + Vector3.UP * (STOREY_HEIGHT + 0.94)
		_add_beam_between(root, rail_a, rail_b, 0.07, prod_metal_material)
		for post_i in range(0, STAIR_STEPS, 4):
			var post_base := start_offset + direction * (float(post_i) * STAIR_RUN) + lateral
			post_base.y = rise * float(post_i + 1)
			_add_mesh_box(root, post_base + Vector3.UP * 0.46, Vector3(0.06, 0.92, 0.06), prod_metal_material, false)

func _add_sloped_collision(root: Node3D, a: Vector3, b: Vector3, width: float, thickness: float) -> void:
	var delta := b - a
	if delta.length() < 0.05:
		return
	var body := StaticBody3D.new()
	body.position = (a + b) * 0.5
	body.collision_layer = 3
	body.collision_mask = 3
	root.add_child(body)
	body.look_at(body.global_position + delta.normalized(), Vector3.UP)
	var shape_node := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(width, thickness, delta.length() + 0.30)
	shape_node.shape = shape
	body.add_child(shape_node)

func _add_sloped_mesh(root: Node3D, a: Vector3, b: Vector3, width: float, thickness: float, material: Material) -> void:
	var delta := b - a
	if delta.length() < 0.05:
		return
	var pivot := Node3D.new()
	pivot.position = (a + b) * 0.5
	root.add_child(pivot)
	pivot.look_at(pivot.global_position + delta.normalized(), Vector3.UP)
	_add_mesh_box(pivot, Vector3.ZERO, Vector3(width, thickness, delta.length()), material, false)

func _add_beam_between(root: Node3D, a: Vector3, b: Vector3, thickness: float, material: Material) -> void:
	var delta := b - a
	if delta.length() < 0.05:
		return
	var pivot := Node3D.new()
	pivot.position = (a + b) * 0.5
	root.add_child(pivot)
	pivot.look_at(pivot.global_position + delta.normalized(), Vector3.UP)
	_add_mesh_box(pivot, Vector3.ZERO, Vector3(thickness, thickness, delta.length()), material, false)

func _add_mesh_box(root: Node3D, position: Vector3, size: Vector3, material: Material, collision: bool, yaw: float = 0.0) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = material
	instance.mesh = mesh
	instance.position = position
	instance.rotation.y = yaw
	root.add_child(instance)
	if collision:
		var body := StaticBody3D.new()
		body.position = position
		body.rotation.y = yaw
		body.collision_layer = 3
		body.collision_mask = 3
		var shape_node := CollisionShape3D.new()
		var shape := BoxShape3D.new()
		shape.size = size
		shape_node.shape = shape
		body.add_child(shape_node)
		root.add_child(body)
	return instance

func _add_rigid_prop(root: Node3D, position: Vector3, size: Vector3, material: Material, yaw: float) -> void:
	var body := RigidBody3D.new()
	body.position = position
	body.rotation.y = yaw
	body.mass = maxf(0.8, size.length())
	body.collision_layer = 3
	body.collision_mask = 3
	body.add_to_group("psychic_prop")
	var shape_node := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	shape_node.shape = shape
	body.add_child(shape_node)
	var mesh_instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = material
	mesh_instance.mesh = mesh
	body.add_child(mesh_instance)
	root.add_child(body)

func _ensure_production_materials() -> void:
	if prod_warm_material != null:
		return
	prod_warm_material = StandardMaterial3D.new()
	prod_warm_material.albedo_color = Color(0.66, 0.62, 0.39, 1.0)
	prod_warm_material.roughness = 0.90

	prod_dark_material = StandardMaterial3D.new()
	prod_dark_material.albedo_color = Color(0.13, 0.12, 0.09, 1.0)
	prod_dark_material.roughness = 0.94

	prod_metal_material = StandardMaterial3D.new()
	prod_metal_material.albedo_color = Color(0.31, 0.32, 0.29, 1.0)
	prod_metal_material.metallic = 0.34
	prod_metal_material.roughness = 0.57

	prod_pool_material = StandardMaterial3D.new()
	prod_pool_material.albedo_color = Color(0.62, 0.78, 0.76, 1.0)
	prod_pool_material.roughness = 0.72

	prod_service_material = StandardMaterial3D.new()
	prod_service_material.albedo_color = Color(0.30, 0.33, 0.30, 1.0)
	prod_service_material.roughness = 0.91

	prod_black_material = StandardMaterial3D.new()
	prod_black_material.albedo_color = Color(0.004, 0.006, 0.007, 1.0)
	prod_black_material.roughness = 1.0

	prod_glow_warm = StandardMaterial3D.new()
	prod_glow_warm.albedo_color = Color(1.0, 0.89, 0.58, 1.0)
	prod_glow_warm.emission_enabled = true
	prod_glow_warm.emission = Color(1.0, 0.76, 0.31, 1.0)

	prod_glow_cool = StandardMaterial3D.new()
	prod_glow_cool.albedo_color = Color(0.58, 0.90, 0.93, 1.0)
	prod_glow_cool.emission_enabled = true
	prod_glow_cool.emission = Color(0.28, 0.70, 0.78, 1.0)
