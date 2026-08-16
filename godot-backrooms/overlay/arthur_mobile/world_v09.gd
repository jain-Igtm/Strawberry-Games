extends "res://arthur_mobile/world_v08.gd"

const PoolComplexV09Script = preload("res://arthur_mobile/pool_complex_v09.gd")
const ServiceShaftV09Script = preload("res://arthur_mobile/service_shaft_v09.gd")
const WATER_SURFACE: Material = preload("res://arthur_mobile/materials/water_surface_v09.tres")
const DEEP_POOL_TILE: Material = preload("res://arthur_mobile/materials/deep_pool_tile_v09.tres")
const POOL_ACCENT_V09: Material = preload("res://arthur_mobile/materials/pool_accent_v09.tres")

func _process(delta: float) -> void:
	super._process(delta)
	var cell := Vector2i(floori(player.global_position.x / CELL), floori(player.global_position.z / CELL))
	var sample: Dictionary = _biome_sample_for_cell(cell)
	var primary: int = int(sample["primary"])
	var local_floor: bool = primary != BIOME_YELLOW
	floor_mesh.visible = not local_floor
	floor_mesh.use_collision = not local_floor
	ceiling_mesh.visible = not local_floor

	if primary == BIOME_POOL and player.global_position.y < -4.6:
		coords_label.text = "UNDERWATER POOL ROOMS  //  SUBMERGED PASSAGE  //  %d, %d  //  y %.1f" % [
			int(player.global_position.x), int(player.global_position.z), player.global_position.y
		]
	elif primary == BIOME_SERVICE and absf(player.global_position.y) > 3.8:
		coords_label.text = "SERVICE LEVEL  //  VERTICAL SHAFT  //  %d, %d  //  y %.1f" % [
			int(player.global_position.x), int(player.global_position.z), player.global_position.y
		]

func _add_cell(cell: Vector2i) -> void:
	super._add_cell(cell)
	if not active_tiles.has(cell):
		return
	var root: Node3D = active_tiles[cell] as Node3D
	var sample: Dictionary = _biome_sample_for_cell(cell)
	var primary: int = int(sample["primary"])
	if primary == BIOME_POOL:
		_add_pool_surface_cell(root, cell)
		_add_underwater_cell(root, cell)
	elif primary == BIOME_SERVICE:
		_add_service_surface_cell(root, cell)

func _biome_ambient_energy(biome: int) -> float:
	if biome == BIOME_POOL:
		return 0.88
	return super._biome_ambient_energy(biome)

func _biome_light_energy(biome: int) -> float:
	if biome == BIOME_POOL:
		return 1.72
	return super._biome_light_energy(biome)

func _biome_exposure(biome: int) -> float:
	if biome == BIOME_POOL:
		return 1.42
	return super._biome_exposure(biome)

func _add_light_for_cell(root: Node3D, cell: Vector2i, sample: Dictionary) -> void:
	if int(sample["primary"]) != BIOME_POOL:
		super._add_light_for_cell(root, cell, sample)
		return
	var room: Vector2i = _room_for_cell(cell)
	var mood: int = _hash(room.x, room.y, 6701) % 10
	var divisor := 2
	if mood <= 4:
		divisor = 1
	elif mood >= 8:
		divisor = 4
	if _hash(cell.x, cell.y, 6703) % divisor != 0:
		return
	var fixture: Node3D = LIGHT.instantiate()
	fixture.rotation.y = float(_hash(cell.x, cell.y, 6707) & 1) * PI * 0.5
	var spot := fixture.get_node_or_null("SpotLight3D") as SpotLight3D
	if spot != null:
		spot.light_color = Color(0.64, 0.91, 1.0, 1.0).lerp(Color(0.92, 1.0, 0.86, 1.0), float(mood % 4) / 4.0)
		spot.light_energy = 2.15 if mood <= 4 else (1.45 if mood < 8 else 0.72)
		spot.spot_range = 15.5 if mood <= 4 else 11.0
	root.add_child(fixture)

func _add_pool_content(root: Node3D, cell: Vector2i, sample: Dictionary) -> void:
	var local_x: int = _positive_mod(cell.x, ROOM_SIZE)
	var local_z: int = _positive_mod(cell.y, ROOM_SIZE)
	if local_x != 0 or local_z != 0:
		return
	var room: Vector2i = _room_for_cell(cell)
	var variant: int = _pool_variant(room)
	var feature: Node3D = PoolComplexV09Script.new() as Node3D
	feature.position = _macro_room_center()
	root.add_child(feature)
	feature.call("configure", _hash(room.x, room.y, 6501), variant)
	_add_large_transition_detail(root, sample, _macro_room_center())

func _add_service_content(root: Node3D, cell: Vector2i, sample: Dictionary) -> void:
	var room: Vector2i = _room_for_cell(cell)
	var local_x: int = _positive_mod(cell.x, ROOM_SIZE)
	var local_z: int = _positive_mod(cell.y, ROOM_SIZE)
	if _is_service_shaft_room(room):
		if local_x == 0 and local_z == 0:
			var shaft: Node3D = ServiceShaftV09Script.new() as Node3D
			shaft.position = _macro_room_center()
			root.add_child(shaft)
			shaft.call("configure", _hash(room.x, room.y, 6901))
		return
	super._add_service_content(root, cell, sample)

func _add_pool_surface_cell(root: Node3D, cell: Vector2i) -> void:
	var room: Vector2i = _room_for_cell(cell)
	var open_water: bool = _pool_surface_is_water(cell, room)
	if not open_water:
		var accent: bool = _hash(cell.x, cell.y, 6511) % 9 == 0
		_box_on(root, Vector3(0, -0.11, 0), Vector3(CELL, 0.22, CELL), POOL_ACCENT_V09 if accent else POOL_TILE, true)
	else:
		_add_cell_water_surface(root)

	var variant: int = _pool_variant(room)
	var vertical_opening: bool = (variant == 3 or variant == 5) and _pool_surface_is_water(cell, room)
	if not vertical_opening:
		_box_on(root, Vector3(0, 4.06, 0), Vector3(CELL, 0.12, CELL), POOL_TILE, false)

func _add_service_surface_cell(root: Node3D, cell: Vector2i) -> void:
	var room: Vector2i = _room_for_cell(cell)
	var local_x: int = _positive_mod(cell.x, ROOM_SIZE)
	var local_z: int = _positive_mod(cell.y, ROOM_SIZE)
	var shaft_hole: bool = _is_service_shaft_room(room) and local_x >= 2 and local_x <= 3 and local_z >= 2 and local_z <= 3
	if not shaft_hole:
		_box_on(root, Vector3(0, -0.11, 0), Vector3(CELL, 0.22, CELL), SERVICE_CONCRETE, true)
		_box_on(root, Vector3(0, 4.06, 0), Vector3(CELL, 0.12, CELL), SERVICE_CONCRETE, false)

func _add_underwater_cell(root: Node3D, cell: Vector2i) -> void:
	_box_on(root, Vector3(0, -13.0, 0), Vector3(CELL, 0.28, CELL), DEEP_POOL_TILE, true)
	var room: Vector2i = _room_for_cell(cell)
	var access: bool = _pool_variant(room) == 3 and _pool_surface_is_water(cell, room)
	if not access:
		_box_on(root, Vector3(0, -5.35, 0), Vector3(CELL, 0.18, CELL), DEEP_POOL_TILE, false)

	var west := cell + Vector2i(-1, 0)
	var north := cell + Vector2i(0, -1)
	_add_underwater_edge(root, int(yellow_plan.call("edge_kind", cell, west)), true)
	_add_underwater_edge(root, int(yellow_plan.call("edge_kind", cell, north)), false)

	var roll: int = _hash(cell.x, cell.y, 6601)
	if roll % 5 == 0:
		var light := OmniLight3D.new()
		light.position = Vector3(0, -6.2, 0)
		light.light_color = Color(0.32, 0.78, 0.96, 1.0).lerp(Color(0.58, 1.0, 0.86, 1.0), float(roll % 4) / 4.0)
		light.light_energy = 1.0 + float(roll % 3) * 0.28
		light.omni_range = 8.5
		light.shadow_enabled = false
		root.add_child(light)
	if roll % 13 == 0:
		_box_on(root, Vector3(0.8, -11.9, -0.6), Vector3(2.0, 0.32, 1.2), POOL_ACCENT_V09, true)

func _add_underwater_edge(root: Node3D, kind: int, x_wall: bool) -> void:
	if kind == EDGE_OPEN:
		return
	var y := -9.15
	if kind == EDGE_DOOR:
		if x_wall:
			_box_on(root, Vector3(-2.0, y, -1.45), Vector3(0.34, 7.5, 1.1), DEEP_POOL_TILE, true)
			_box_on(root, Vector3(-2.0, y, 1.45), Vector3(0.34, 7.5, 1.1), DEEP_POOL_TILE, true)
		else:
			_box_on(root, Vector3(-1.45, y, -2.0), Vector3(1.1, 7.5, 0.34), DEEP_POOL_TILE, true)
			_box_on(root, Vector3(1.45, y, -2.0), Vector3(1.1, 7.5, 0.34), DEEP_POOL_TILE, true)
	else:
		if x_wall:
			_box_on(root, Vector3(-2.0, y, 0), Vector3(0.34, 7.5, CELL), DEEP_POOL_TILE, true)
		else:
			_box_on(root, Vector3(0, y, -2.0), Vector3(CELL, 7.5, 0.34), DEEP_POOL_TILE, true)

func _add_cell_water_surface(root: Node3D) -> void:
	var mesh := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(CELL, CELL)
	plane.subdivide_width = 4
	plane.subdivide_depth = 4
	plane.material = WATER_SURFACE
	mesh.mesh = plane
	mesh.position.y = 0.055
	root.add_child(mesh)

func _pool_variant(room: Vector2i) -> int:
	return posmod(_hash(room.x, room.y, 6491), 6)

func _pool_surface_is_water(cell: Vector2i, room: Vector2i) -> bool:
	var x: int = _positive_mod(cell.x, ROOM_SIZE)
	var z: int = _positive_mod(cell.y, ROOM_SIZE)
	match _pool_variant(room):
		0:
			return x >= 2 and x <= 3 and z >= 1 and z <= 4
		1:
			return (x >= 1 and x <= 2 and z >= 1 and z <= 4) or (x >= 3 and x <= 4 and z >= 2 and z <= 3)
		2:
			return (x == 1 or x == 4) and (z == 1 or z == 4)
		3:
			return x >= 2 and x <= 3 and z >= 2 and z <= 3
		4:
			return x >= 1 and x <= 4 and z >= 2 and z <= 3
		_:
			return x >= 2 and x <= 4 and z >= 2 and z <= 4

func _is_service_shaft_room(room: Vector2i) -> bool:
	return _hash(room.x, room.y, 6889) % 13 == 0

func is_water_at_position(position: Vector3) -> bool:
	if position.y >= 0.18:
		return false
	var cell := Vector2i(floori(position.x / CELL), floori(position.z / CELL))
	return int(_biome_sample_for_cell(cell)["primary"]) == BIOME_POOL

func _update_atmosphere(delta: float) -> void:
	super._update_atmosphere(delta)
	if not player.has_method("is_underwater") or not bool(player.call("is_underwater")):
		return
	var environment: Environment = world_environment.environment
	var t: float = clampf(delta * 2.2, 0.0, 1.0)
	environment.ambient_light_color = environment.ambient_light_color.lerp(Color(0.20, 0.58, 0.68, 1.0), t)
	environment.ambient_light_energy = lerpf(environment.ambient_light_energy, 0.78, t)
	environment.fog_light_color = environment.fog_light_color.lerp(Color(0.08, 0.34, 0.43, 1.0), t)
	environment.fog_density = lerpf(environment.fog_density, 0.020, t)
	environment.tonemap_exposure = lerpf(environment.tonemap_exposure, 1.34, t)

func _box_on(root: Node3D, position: Vector3, size: Vector3, material: Material, collision: bool) -> CSGBox3D:
	var box := CSGBox3D.new()
	box.position = position
	box.size = size
	box.material_override = material
	box.use_collision = collision
	box.collision_layer = 3 if collision else 0
	box.collision_mask = 3 if collision else 0
	root.add_child(box)
	return box
