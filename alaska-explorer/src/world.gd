extends Node3D

const HeaterScript = preload("res://src/heater.gd")
const SupplyScript = preload("res://src/supply_cache.gd")
const BoatScript = preload("res://src/boat.gd")
const HelmScript = preload("res://src/helm.gd")
const CabinDoorScript = preload("res://src/cabin_door.gd")
const RiverShader = preload("res://shaders/river.gdshader")

const TERRAIN_HALF_WIDTH := 220.0
const TERRAIN_HALF_LENGTH := 480.0
const TERRAIN_STEP := 8.0
const WATER_LEVEL := 0.05
const BOAT_POSITION := Vector3(8.0, 0.0, 0.0)

@onready var generated: Node3D = $GeneratedWorld
@onready var player: CharacterBody3D = $Player

var terrain_noise := FastNoiseLite.new()
var detail_noise := FastNoiseLite.new()
var heater: Node3D
var boat: AnimatableBody3D
var cabin_door: AnimatableBody3D
var gangway: StaticBody3D
var snowfall: GPUParticles3D
var river_audio: AudioStreamPlayer3D
var wind_audio: AudioStreamPlayer

var snow_material: StandardMaterial3D
var rock_material: StandardMaterial3D
var bark_material: StandardMaterial3D
var spruce_material: StandardMaterial3D
var spruce_shadow_material: StandardMaterial3D
var hull_material: StandardMaterial3D
var metal_material: StandardMaterial3D
var cabin_material: StandardMaterial3D
var roof_material: StandardMaterial3D
var wood_material: StandardMaterial3D
var glass_material: StandardMaterial3D
var mattress_material: StandardMaterial3D

func _ready() -> void:
	terrain_noise.seed = 73021
	terrain_noise.frequency = 0.0065
	terrain_noise.fractal_octaves = 5
	detail_noise.seed = 1947
	detail_noise.frequency = 0.031
	detail_noise.fractal_octaves = 3
	_create_materials()
	_create_environment()
	_build_terrain()
	_build_river()
	_build_ice_floes()
	_build_forest()
	_build_boat()
	_build_ambient_audio()
	_build_snowfall()

func _process(delta: float) -> void:
	if snowfall != null and player != null:
		snowfall.global_position = Vector3(player.global_position.x, player.global_position.y + 19.0, player.global_position.z)
	if river_audio != null and player != null:
		river_audio.global_position = Vector3(_river_center(player.global_position.z), WATER_LEVEL, player.global_position.z)
	if wind_audio != null and player != null:
		var wind_target := -2.0 if bool(player.get("sheltered")) else 8.0
		wind_audio.volume_db = move_toward(wind_audio.volume_db, wind_target, delta * 7.0)

func _exit_tree() -> void:
	if river_audio != null:
		river_audio.stop()
		river_audio.stream = null
	if wind_audio != null:
		wind_audio.stop()
		wind_audio.stream = null

func get_survival_environment(world_position: Vector3) -> Dictionary:
	var local := boat.to_local(world_position) if boat != null else world_position - BOAT_POSITION
	var inside_cabin := (
		absf(local.x) < 1.86
		and local.z > -2.95
		and local.z < 2.95
		and world_position.y > 1.20
		and world_position.y < 3.72
	)
	var door_open := cabin_door != null and bool(cabin_door.get("is_open"))
	var sheltered := inside_cabin and not door_open
	var river_distance := absf(world_position.x - _river_center(world_position.z))
	var in_river := river_distance < _river_half_width(world_position.z) - 0.25 and world_position.y < 0.84
	var heat := 0.0
	if inside_cabin and heater != null and heater.has_method("get_heat_strength"):
		heat = float(heater.call("get_heat_strength", world_position))
		if door_open:
			heat *= 0.42
	return {
		"in_water": in_river,
		"inside_cabin": inside_cabin,
		"sheltered": sheltered,
		"heat_strength": heat,
		"air_temperature": (-6.0 if sheltered else (-12.0 if inside_cabin else -18.0)),
		"wind_chill": (-7.0 if sheltered else (-16.0 if inside_cabin else -24.0)),
	}

func constrain_boat_position(proposed: Vector3) -> Vector3:
	var result := proposed
	result.z = clampf(result.z, -TERRAIN_HALF_LENGTH + 30.0, TERRAIN_HALF_LENGTH - 30.0)
	var channel_center := _river_center(result.z)
	var safe_half_width := maxf(5.0, _river_half_width(result.z) - 7.2)
	result.x = clampf(result.x, channel_center - safe_half_width, channel_center + safe_half_width)
	result.y = BOAT_POSITION.y
	return result

func cast_off_boat() -> void:
	if gangway == null:
		return
	gangway.visible = false
	gangway.process_mode = Node.PROCESS_MODE_DISABLED
	for child in gangway.get_children():
		if child is CollisionShape3D:
			child.set_deferred("disabled", true)

func get_rescue_position() -> Vector3:
	if boat != null:
		return boat.to_global(Vector3(0.0, 2.24, 5.15))
	return BOAT_POSITION + Vector3(0.0, 2.24, 5.15)

func _create_materials() -> void:
	snow_material = _material(Color(0.88, 0.92, 0.94), 0.92)
	snow_material.vertex_color_use_as_albedo = true
	rock_material = _material(Color(0.22, 0.27, 0.29), 0.94)
	bark_material = _material(Color(0.19, 0.135, 0.09), 1.0)
	spruce_material = _material(Color(0.075, 0.16, 0.145), 0.96)
	spruce_shadow_material = _material(Color(0.055, 0.115, 0.11), 0.98)
	hull_material = _material(Color(0.18, 0.24, 0.27), 0.72, 0.34)
	metal_material = _material(Color(0.39, 0.45, 0.47), 0.56, 0.48)
	cabin_material = _material(Color(0.72, 0.77, 0.77), 0.84, 0.05)
	roof_material = _material(Color(0.24, 0.12, 0.10), 0.78, 0.18)
	wood_material = _material(Color(0.34, 0.23, 0.13), 0.9)
	glass_material = _material(Color(0.23, 0.39, 0.46, 0.34), 0.15, 0.12, Color(0, 0, 0, 0), true)
	mattress_material = _material(Color(0.26, 0.38, 0.40), 0.96)

func _material(color: Color, roughness: float = 0.9, metallic: float = 0.0, emission: Color = Color(0, 0, 0, 0), transparent: bool = false) -> StandardMaterial3D:
	var result := StandardMaterial3D.new()
	result.albedo_color = color
	result.roughness = roughness
	result.metallic = metallic
	if emission.a > 0.0:
		result.emission_enabled = true
		result.emission = emission
		result.emission_energy_multiplier = 1.0
	if transparent:
		result.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		result.cull_mode = BaseMaterial3D.CULL_DISABLED
	return result

func _create_environment() -> void:
	var sky_material := ProceduralSkyMaterial.new()
	sky_material.sky_top_color = Color(0.085, 0.13, 0.20)
	sky_material.sky_horizon_color = Color(0.50, 0.56, 0.61)
	sky_material.ground_bottom_color = Color(0.075, 0.10, 0.13)
	sky_material.ground_horizon_color = Color(0.46, 0.51, 0.54)
	sky_material.sun_angle_max = 12.0
	sky_material.sun_curve = 0.08

	var sky := Sky.new()
	sky.sky_material = sky_material
	sky.radiance_size = Sky.RADIANCE_SIZE_64

	var environment := Environment.new()
	environment.background_mode = Environment.BG_SKY
	environment.sky = sky
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	environment.ambient_light_color = Color(0.59, 0.68, 0.74)
	environment.ambient_light_energy = 0.72
	environment.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment.fog_enabled = true
	environment.fog_light_color = Color(0.58, 0.64, 0.68)
	environment.fog_light_energy = 0.76
	environment.fog_density = 0.0042
	environment.fog_height = 4.0
	environment.fog_height_density = 0.085

	var world_environment := WorldEnvironment.new()
	world_environment.name = "WinterEnvironment"
	world_environment.environment = environment
	generated.add_child(world_environment)

	var sun := DirectionalLight3D.new()
	sun.name = "LowWinterSun"
	sun.rotation_degrees = Vector3(-24.0, -34.0, 0.0)
	sun.light_color = Color(1.0, 0.76, 0.58)
	sun.light_energy = 1.08
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 170.0
	generated.add_child(sun)

func _terrain_height(x: float, z: float) -> float:
	var rolling := terrain_noise.get_noise_2d(x, z) * 3.4
	var close_detail := detail_noise.get_noise_2d(x, z) * 0.52
	var wall_factor := maxf(0.0, (absf(x) - 70.0) / 146.0)
	var valley_wall := pow(wall_factor, 1.72) * 63.0
	var base := 1.55 + rolling + close_detail + valley_wall
	var distance := absf(x - _river_center(z))
	var water_half := _river_half_width(z)
	var bed_half := water_half - 6.4
	if distance < water_half + 3.0:
		var t := clampf((distance - bed_half) / 9.4, 0.0, 1.0)
		var eased := t * t * (3.0 - 2.0 * t)
		base = lerpf(-3.75 + detail_noise.get_noise_2d(x * 0.6, z * 0.6) * 0.25, base, eased)
	return base

func _river_center(z: float) -> float:
	return sin(z * 0.0072) * 17.0 + sin(z * 0.019) * 3.8

func _river_half_width(z: float) -> float:
	return 18.5 + sin(z * 0.011 + 1.4) * 1.7 + sin(z * 0.027) * 0.75

func _build_terrain() -> void:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	surface.set_material(snow_material)
	var x_cells := int((TERRAIN_HALF_WIDTH * 2.0) / TERRAIN_STEP)
	var z_cells := int((TERRAIN_HALF_LENGTH * 2.0) / TERRAIN_STEP)
	for zi in range(z_cells):
		var z0 := -TERRAIN_HALF_LENGTH + float(zi) * TERRAIN_STEP
		var z1 := z0 + TERRAIN_STEP
		for xi in range(x_cells):
			var x0 := -TERRAIN_HALF_WIDTH + float(xi) * TERRAIN_STEP
			var x1 := x0 + TERRAIN_STEP
			var a := Vector3(x0, _terrain_height(x0, z0), z0)
			var b := Vector3(x1, _terrain_height(x1, z0), z0)
			var c := Vector3(x0, _terrain_height(x0, z1), z1)
			var d := Vector3(x1, _terrain_height(x1, z1), z1)
			_add_terrain_vertex(surface, a)
			_add_terrain_vertex(surface, b)
			_add_terrain_vertex(surface, c)
			_add_terrain_vertex(surface, b)
			_add_terrain_vertex(surface, d)
			_add_terrain_vertex(surface, c)
	surface.generate_normals()
	var mesh := surface.commit()
	var terrain_mesh := MeshInstance3D.new()
	terrain_mesh.name = "SnowValley"
	terrain_mesh.mesh = mesh
	terrain_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	generated.add_child(terrain_mesh)

	var terrain_body := StaticBody3D.new()
	terrain_body.name = "TerrainCollision"
	terrain_body.collision_layer = 1
	terrain_body.collision_mask = 2
	var terrain_collision := CollisionShape3D.new()
	terrain_collision.shape = mesh.create_trimesh_shape()
	terrain_body.add_child(terrain_collision)
	generated.add_child(terrain_body)

func _add_terrain_vertex(surface: SurfaceTool, vertex: Vector3) -> void:
	var grain := detail_noise.get_noise_2d(vertex.x * 2.8, vertex.z * 2.8) * 0.035
	var height_tint := clampf(vertex.y / 75.0, 0.0, 1.0) * 0.055
	var shade := grain + height_tint
	surface.set_color(Color(0.82 + shade, 0.87 + shade, 0.90 + shade, 1.0))
	surface.set_uv(Vector2(vertex.x, vertex.z) * 0.025)
	surface.add_vertex(vertex)

func _build_river() -> void:
	var water_material := ShaderMaterial.new()
	water_material.shader = RiverShader
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	surface.set_material(water_material)
	var step := 6.0
	var segment_count := int((TERRAIN_HALF_LENGTH * 2.0) / step)
	for index in range(segment_count):
		var z0 := -TERRAIN_HALF_LENGTH + float(index) * step
		var z1 := z0 + step
		var center0 := _river_center(z0)
		var center1 := _river_center(z1)
		var half0 := _river_half_width(z0)
		var half1 := _river_half_width(z1)
		var a := Vector3(center0 - half0, WATER_LEVEL, z0)
		var b := Vector3(center0 + half0, WATER_LEVEL, z0)
		var c := Vector3(center1 - half1, WATER_LEVEL, z1)
		var d := Vector3(center1 + half1, WATER_LEVEL, z1)
		_add_water_vertex(surface, a, Vector2(0.0, float(index) * 0.12))
		_add_water_vertex(surface, b, Vector2(1.0, float(index) * 0.12))
		_add_water_vertex(surface, c, Vector2(0.0, float(index + 1) * 0.12))
		_add_water_vertex(surface, b, Vector2(1.0, float(index) * 0.12))
		_add_water_vertex(surface, d, Vector2(1.0, float(index + 1) * 0.12))
		_add_water_vertex(surface, c, Vector2(0.0, float(index + 1) * 0.12))
	var water_mesh := MeshInstance3D.new()
	water_mesh.name = "WinterRiver"
	water_mesh.mesh = surface.commit()
	water_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	generated.add_child(water_mesh)

func _add_water_vertex(surface: SurfaceTool, vertex: Vector3, uv: Vector2) -> void:
	surface.set_normal(Vector3.UP)
	surface.set_uv(uv)
	surface.add_vertex(vertex)

func _build_ice_floes() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 81077
	var floe_mesh := BoxMesh.new()
	floe_mesh.size = Vector3(1.0, 0.10, 1.0)
	floe_mesh.material = _material(Color(0.68, 0.82, 0.87, 0.88), 0.42, 0.02, Color(0, 0, 0, 0), true)
	var multimesh := MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	multimesh.instance_count = 72
	multimesh.mesh = floe_mesh
	for i in range(multimesh.instance_count):
		var z := rng.randf_range(-440.0, 440.0)
		if absf(z) < 19.0:
			z += 42.0 * signf(z if z != 0.0 else 1.0)
		var half := _river_half_width(z)
		var x := _river_center(z) + rng.randf_range(-half + 2.4, half - 2.4)
		var scale := Vector3(rng.randf_range(0.8, 3.6), 1.0, rng.randf_range(0.7, 2.7))
		var basis := Basis(Vector3.UP, rng.randf_range(0.0, TAU)).scaled(scale)
		multimesh.set_instance_transform(i, Transform3D(basis, Vector3(x, WATER_LEVEL + 0.07, z)))
	var floes := MultiMeshInstance3D.new()
	floes.name = "NewRiverIce"
	floes.multimesh = multimesh
	floes.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	generated.add_child(floes)

func _build_forest() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 428144
	var trees: Array[Dictionary] = []
	var attempts := 0
	while trees.size() < 290 and attempts < 4200:
		attempts += 1
		var z := rng.randf_range(-455.0, 455.0)
		var x := rng.randf_range(-192.0, 192.0)
		var river_clearance := absf(x - _river_center(z)) - _river_half_width(z)
		if river_clearance < 7.5:
			continue
		if Vector2(x - BOAT_POSITION.x, z - BOAT_POSITION.z).length() < 32.0:
			continue
		var ground := _terrain_height(x, z)
		if ground > 42.0:
			continue
		trees.append({"position": Vector3(x, ground, z), "scale": rng.randf_range(0.72, 1.38), "yaw": rng.randf_range(0.0, TAU)})

	var trunk_mesh := CylinderMesh.new()
	trunk_mesh.top_radius = 0.14
	trunk_mesh.bottom_radius = 0.22
	trunk_mesh.height = 2.5
	trunk_mesh.radial_segments = 6
	trunk_mesh.material = bark_material
	var trunk_multimesh := MultiMesh.new()
	trunk_multimesh.transform_format = MultiMesh.TRANSFORM_3D
	trunk_multimesh.instance_count = trees.size()
	trunk_multimesh.mesh = trunk_mesh

	var bough_mesh := CylinderMesh.new()
	bough_mesh.top_radius = 0.04
	bough_mesh.bottom_radius = 1.32
	bough_mesh.height = 2.75
	bough_mesh.radial_segments = 8
	bough_mesh.material = spruce_material
	var bough_multimesh := MultiMesh.new()
	bough_multimesh.transform_format = MultiMesh.TRANSFORM_3D
	bough_multimesh.instance_count = trees.size() * 3
	bough_multimesh.mesh = bough_mesh

	var top_mesh := CylinderMesh.new()
	top_mesh.top_radius = 0.0
	top_mesh.bottom_radius = 0.78
	top_mesh.height = 2.1
	top_mesh.radial_segments = 8
	top_mesh.material = spruce_shadow_material
	var top_multimesh := MultiMesh.new()
	top_multimesh.transform_format = MultiMesh.TRANSFORM_3D
	top_multimesh.instance_count = trees.size()
	top_multimesh.mesh = top_mesh

	var nearby_collision := StaticBody3D.new()
	nearby_collision.name = "NearbyTreeCollision"
	nearby_collision.collision_layer = 1
	nearby_collision.collision_mask = 2

	for index in range(trees.size()):
		var data: Dictionary = trees[index]
		var base: Vector3 = data["position"]
		var scale: float = data["scale"]
		var yaw: float = data["yaw"]
		var tree_basis := Basis(Vector3.UP, yaw).scaled(Vector3(scale, scale, scale))
		trunk_multimesh.set_instance_transform(index, Transform3D(tree_basis, base + Vector3.UP * 1.25 * scale))
		for tier in range(3):
			var tier_scale := scale * (1.0 - float(tier) * 0.16)
			var tier_basis := Basis(Vector3.UP, yaw + float(tier) * 0.42).scaled(Vector3(tier_scale, tier_scale, tier_scale))
			var tier_position := base + Vector3.UP * (2.35 + float(tier) * 1.18) * scale
			bough_multimesh.set_instance_transform(index * 3 + tier, Transform3D(tier_basis, tier_position))
		var top_basis := Basis(Vector3.UP, yaw).scaled(Vector3(scale * 0.78, scale * 0.78, scale * 0.78))
		top_multimesh.set_instance_transform(index, Transform3D(top_basis, base + Vector3.UP * 5.42 * scale))

		if Vector2(base.x - BOAT_POSITION.x, base.z - BOAT_POSITION.z).length() < 115.0:
			var shape := CylinderShape3D.new()
			shape.radius = 0.23 * scale
			shape.height = 2.5 * scale
			var collision := CollisionShape3D.new()
			collision.position = base + Vector3.UP * 1.25 * scale
			collision.shape = shape
			nearby_collision.add_child(collision)

	var trunks := MultiMeshInstance3D.new()
	trunks.name = "SpruceTrunks"
	trunks.multimesh = trunk_multimesh
	generated.add_child(trunks)
	var boughs := MultiMeshInstance3D.new()
	boughs.name = "SpruceBoughs"
	boughs.multimesh = bough_multimesh
	generated.add_child(boughs)
	var tops := MultiMeshInstance3D.new()
	tops.name = "SpruceTops"
	tops.multimesh = top_multimesh
	generated.add_child(tops)
	generated.add_child(nearby_collision)
	_build_rocks(rng)

func _build_rocks(rng: RandomNumberGenerator) -> void:
	var rock_mesh := SphereMesh.new()
	rock_mesh.radius = 0.65
	rock_mesh.height = 1.2
	rock_mesh.radial_segments = 8
	rock_mesh.rings = 4
	rock_mesh.material = rock_material
	var multimesh := MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	multimesh.instance_count = 92
	multimesh.mesh = rock_mesh
	var placed := 0
	while placed < multimesh.instance_count:
		var z := rng.randf_range(-450.0, 450.0)
		var x := rng.randf_range(-205.0, 205.0)
		if absf(x - _river_center(z)) < _river_half_width(z) + 2.0:
			continue
		var y := _terrain_height(x, z)
		var scale := Vector3(rng.randf_range(0.45, 1.8), rng.randf_range(0.35, 1.0), rng.randf_range(0.55, 2.0))
		var basis := Basis(Vector3.UP, rng.randf_range(0.0, TAU)).scaled(scale)
		multimesh.set_instance_transform(placed, Transform3D(basis, Vector3(x, y + 0.18 * scale.y, z)))
		placed += 1
	var rocks := MultiMeshInstance3D.new()
	rocks.name = "RiverValleyRocks"
	rocks.multimesh = multimesh
	generated.add_child(rocks)

func _build_boat() -> void:
	boat = AnimatableBody3D.new()
	boat.name = "CabinBoat"
	boat.position = BOAT_POSITION
	boat.collision_layer = 1
	boat.collision_mask = 2
	boat.set_script(BoatScript)

	_add_box(boat, "Hull", Vector3(4.8, 1.45, 12.5), Vector3(0.0, 0.35, 0.0), hull_material)
	_add_box(boat, "Bow", Vector3(3.4, 1.25, 2.5), Vector3(0.0, 0.38, -6.25), hull_material, true, Vector3(0.0, deg_to_rad(45.0), 0.0))
	_add_box(boat, "Deck", Vector3(4.65, 0.22, 13.3), Vector3(0.0, 1.20, 0.0), metal_material)
	_add_box(boat, "CabinFloor", Vector3(3.82, 0.04, 6.0), Vector3(0.0, 1.33, 0.0), wood_material, false)
	_build_cabin_shell(boat)
	_build_boat_details(boat)
	_build_cabin_door(boat)
	_build_helm(boat)
	_build_heater(boat)
	_build_supplies(boat)
	generated.add_child(boat)
	_build_gangway()

func _build_cabin_shell(boat_body: AnimatableBody3D) -> void:
	for side in [-1.0, 1.0]:
		var x: float = float(side) * 1.96
		_add_box(boat_body, "CabinSideSill", Vector3(0.15, 0.72, 6.0), Vector3(x, 1.73, 0.0), cabin_material)
		_add_box(boat_body, "CabinSideHeader", Vector3(0.15, 0.48, 6.0), Vector3(x, 3.38, 0.0), cabin_material)
		for z in [-2.72, 0.0, 2.72]:
			_add_box(boat_body, "CabinSidePost", Vector3(0.18, 1.32, 0.24), Vector3(x, 2.52, z), cabin_material)
		_add_box(boat_body, "CabinSideGlassA", Vector3(0.08, 1.22, 2.45), Vector3(x, 2.53, -1.36), glass_material)
		_add_box(boat_body, "CabinSideGlassB", Vector3(0.08, 1.22, 2.45), Vector3(x, 2.53, 1.36), glass_material)

	_add_box(boat_body, "CabinFrontLower", Vector3(3.92, 0.75, 0.16), Vector3(0.0, 1.74, -3.0), cabin_material)
	_add_box(boat_body, "CabinFrontUpper", Vector3(3.92, 0.48, 0.16), Vector3(0.0, 3.38, -3.0), cabin_material)
	for x in [-1.72, 0.0, 1.72]:
		_add_box(boat_body, "CabinFrontPost", Vector3(0.22, 1.28, 0.18), Vector3(x, 2.52, -3.0), cabin_material)
	_add_box(boat_body, "FrontGlassLeft", Vector3(1.48, 1.18, 0.08), Vector3(-0.86, 2.53, -3.02), glass_material)
	_add_box(boat_body, "FrontGlassRight", Vector3(1.48, 1.18, 0.08), Vector3(0.86, 2.53, -3.02), glass_material)

	_add_box(boat_body, "RearWallLeft", Vector3(1.30, 2.1, 0.16), Vector3(-1.31, 2.35, 3.0), cabin_material)
	_add_box(boat_body, "RearWallRight", Vector3(1.30, 2.1, 0.16), Vector3(1.31, 2.35, 3.0), cabin_material)
	_add_box(boat_body, "RearDoorHeader", Vector3(1.32, 0.45, 0.16), Vector3(0.0, 3.38, 3.0), cabin_material)
	_add_box(boat_body, "CabinRoof", Vector3(4.25, 0.22, 6.5), Vector3(0.0, 3.70, 0.0), roof_material)

	var cabin_light := OmniLight3D.new()
	cabin_light.name = "CabinLight"
	cabin_light.position = Vector3(0.45, 3.25, 0.25)
	cabin_light.light_color = Color(1.0, 0.70, 0.43)
	cabin_light.light_energy = 1.65
	cabin_light.omni_range = 5.6
	cabin_light.shadow_enabled = false
	boat_body.add_child(cabin_light)

	var nameplate := Label3D.new()
	nameplate.name = "BoatName"
	nameplate.position = Vector3(0.0, 3.08, 3.10)
	nameplate.text = "M/V NORTHSTAR  •  AK"
	nameplate.font_size = 42
	nameplate.modulate = Color(0.84, 0.91, 0.92)
	nameplate.outline_size = 8
	nameplate.outline_modulate = Color(0.06, 0.09, 0.10)
	nameplate.pixel_size = 0.006
	boat_body.add_child(nameplate)

func _build_boat_details(boat_body: AnimatableBody3D) -> void:
	_add_box(boat_body, "BunkFrame", Vector3(1.25, 0.28, 2.45), Vector3(1.18, 1.63, -1.35), wood_material)
	_add_box(boat_body, "BunkMattress", Vector3(1.12, 0.20, 2.26), Vector3(1.18, 1.87, -1.35), mattress_material, false)
	_add_box(boat_body, "TableTop", Vector3(1.35, 0.12, 0.82), Vector3(0.76, 2.05, 1.15), wood_material)
	for x in [0.20, 1.32]:
		for z in [0.86, 1.44]:
			_add_box(boat_body, "TableLeg", Vector3(0.10, 0.62, 0.10), Vector3(x, 1.70, z), wood_material)
	_add_box(boat_body, "HelmConsole", Vector3(1.15, 0.82, 0.62), Vector3(0.74, 1.84, -2.38), metal_material, false)

	_add_box(boat_body, "PortAftRail", Vector3(0.08, 0.08, 5.0), Vector3(-2.18, 2.05, 4.05), metal_material)
	_add_box(boat_body, "StarboardRailForward", Vector3(0.08, 0.08, 2.0), Vector3(2.18, 2.05, 2.65), metal_material)
	_add_box(boat_body, "StarboardRailAft", Vector3(0.08, 0.08, 0.55), Vector3(2.18, 2.05, 5.95), metal_material)
	for z in [1.65, 3.25, 5.0, 6.15]:
		_add_box(boat_body, "PortRailPost", Vector3(0.08, 0.78, 0.08), Vector3(-2.18, 1.68, z), metal_material)
	for z in [1.65, 3.25, 6.15]:
		_add_box(boat_body, "StarboardRailPost", Vector3(0.08, 0.78, 0.08), Vector3(2.18, 1.68, z), metal_material)
	_add_box(boat_body, "SternRail", Vector3(4.4, 0.08, 0.08), Vector3(0.0, 2.05, 6.22), metal_material)

func _build_cabin_door(boat_body: AnimatableBody3D) -> void:
	cabin_door = AnimatableBody3D.new()
	cabin_door.name = "CabinDoor"
	cabin_door.position = Vector3(-0.64, 1.36, 2.91)
	cabin_door.collision_layer = 1
	cabin_door.collision_mask = 2
	cabin_door.set_script(CabinDoorScript)
	_add_box(cabin_door, "DoorPanel", Vector3(1.22, 1.74, 0.10), Vector3(0.61, 0.87, 0.0), cabin_material)
	_add_box(cabin_door, "DoorWindow", Vector3(0.62, 0.52, 0.04), Vector3(0.61, 1.18, -0.07), glass_material, false)
	_add_box(cabin_door, "DoorHandle", Vector3(0.08, 0.08, 0.16), Vector3(1.08, 0.82, -0.13), metal_material, false)
	boat_body.add_child(cabin_door)

func _build_helm(boat_body: AnimatableBody3D) -> void:
	var helm := StaticBody3D.new()
	helm.name = "Helm"
	helm.position = Vector3(0.74, 1.84, -2.38)
	helm.collision_layer = 1
	helm.collision_mask = 2
	helm.set_script(HelmScript)
	_add_box(helm, "HelmInteraction", Vector3(1.15, 0.82, 0.62), Vector3.ZERO, metal_material)
	_add_cylinder(helm, "Wheel", 0.34, 0.06, Vector3(0.0, 0.24, 0.36), wood_material, false, Vector3(deg_to_rad(90.0), 0.0, 0.0))
	boat_body.add_child(helm)

	var helm_seat := Marker3D.new()
	helm_seat.name = "HelmSeat"
	helm_seat.position = Vector3(0.74, 2.24, -1.52)
	boat_body.add_child(helm_seat)

	var helm_exit := Marker3D.new()
	helm_exit.name = "HelmExit"
	helm_exit.position = Vector3(0.0, 2.24, 2.18)
	boat_body.add_child(helm_exit)

func _build_heater(boat_body: AnimatableBody3D) -> void:
	var heater_body := StaticBody3D.new()
	heater_body.name = "DieselHeater"
	heater_body.position = Vector3(-1.18, 1.42, -1.24)
	heater_body.collision_layer = 1
	heater_body.collision_mask = 2
	heater_body.set_script(HeaterScript)
	var heater_case := _material(Color(0.15, 0.17, 0.17), 0.56, 0.62)
	_add_box(heater_body, "HeaterCase", Vector3(0.70, 1.02, 0.56), Vector3(0.0, 0.52, 0.0), heater_case)
	var ember_material := _material(Color(0.22, 0.055, 0.015), 0.48, 0.15, Color(1.0, 0.20, 0.025, 1.0))
	ember_material.emission_energy_multiplier = 2.8
	_add_box(heater_body, "Ember", Vector3(0.48, 0.33, 0.035), Vector3(0.0, 0.49, 0.30), ember_material, false)
	_add_cylinder(heater_body, "Exhaust", 0.08, 2.4, Vector3(0.0, 1.83, 0.0), metal_material, false)
	var glow := OmniLight3D.new()
	glow.name = "Glow"
	glow.position = Vector3(0.0, 0.62, 0.52)
	glow.light_color = Color(1.0, 0.28, 0.055)
	glow.light_energy = 2.15
	glow.omni_range = 5.0
	glow.shadow_enabled = false
	heater_body.add_child(glow)
	boat_body.add_child(heater_body)
	heater = heater_body

func _build_supplies(boat_body: AnimatableBody3D) -> void:
	var food := StaticBody3D.new()
	food.name = "FoodRations"
	food.position = Vector3(1.22, 1.62, 1.92)
	food.collision_layer = 1
	food.collision_mask = 2
	food.set_script(SupplyScript)
	food.set("supply_kind", "food")
	food.set("remaining", 4)
	_add_box(food, "RationBox", Vector3(0.74, 0.46, 0.62), Vector3.ZERO, _material(Color(0.31, 0.28, 0.16), 0.94))
	boat_body.add_child(food)

	var fuel := StaticBody3D.new()
	fuel.name = "DieselCans"
	fuel.position = Vector3(-1.38, 1.68, 4.64)
	fuel.collision_layer = 1
	fuel.collision_mask = 2
	fuel.set_script(SupplyScript)
	fuel.set("supply_kind", "fuel")
	fuel.set("remaining", 3)
	_add_box(fuel, "FuelCan", Vector3(0.62, 0.78, 0.42), Vector3.ZERO, _material(Color(0.46, 0.13, 0.08), 0.62, 0.18))
	boat_body.add_child(fuel)

func _build_gangway() -> void:
	var start := BOAT_POSITION + Vector3(2.30, 1.23, 4.85)
	var end_x := _river_center(4.85) + _river_half_width(4.85) + 1.65
	var end := Vector3(end_x, _terrain_height(end_x, 4.85) + 0.02, 4.85)
	var midpoint := (start + end) * 0.5
	var length := start.distance_to(end)
	var angle := atan2(end.y - start.y, end.x - start.x)
	gangway = StaticBody3D.new()
	gangway.name = "ShoreGangway"
	gangway.collision_layer = 1
	gangway.collision_mask = 2
	_add_box(gangway, "GangwayDeck", Vector3(length, 0.16, 1.05), midpoint, wood_material, true, Vector3(0.0, 0.0, angle))
	for z_offset in [-0.48, 0.48]:
		_add_box(gangway, "GangwayRail", Vector3(length, 0.07, 0.07), midpoint + Vector3(0.0, 0.62, z_offset), metal_material, false, Vector3(0.0, 0.0, angle))
	generated.add_child(gangway)

func _add_box(body: Node3D, node_name: String, size: Vector3, position: Vector3, material: Material, collision: bool = true, rotation: Vector3 = Vector3.ZERO) -> MeshInstance3D:
	var box := BoxMesh.new()
	box.size = size
	box.material = material
	var mesh_instance := MeshInstance3D.new()
	mesh_instance.name = node_name
	mesh_instance.mesh = box
	mesh_instance.position = position
	mesh_instance.rotation = rotation
	body.add_child(mesh_instance)
	if collision and body is CollisionObject3D:
		var shape := BoxShape3D.new()
		shape.size = size
		var collision_shape := CollisionShape3D.new()
		collision_shape.name = node_name + "Collision"
		collision_shape.shape = shape
		collision_shape.position = position
		collision_shape.rotation = rotation
		body.add_child(collision_shape)
	return mesh_instance

func _add_cylinder(body: Node3D, node_name: String, radius: float, height: float, position: Vector3, material: Material, collision: bool = true, rotation: Vector3 = Vector3.ZERO) -> MeshInstance3D:
	var cylinder := CylinderMesh.new()
	cylinder.top_radius = radius
	cylinder.bottom_radius = radius
	cylinder.height = height
	cylinder.radial_segments = 10
	cylinder.material = material
	var mesh_instance := MeshInstance3D.new()
	mesh_instance.name = node_name
	mesh_instance.mesh = cylinder
	mesh_instance.position = position
	mesh_instance.rotation = rotation
	body.add_child(mesh_instance)
	if collision and body is CollisionObject3D:
		var shape := CylinderShape3D.new()
		shape.radius = radius
		shape.height = height
		var collision_shape := CollisionShape3D.new()
		collision_shape.shape = shape
		collision_shape.position = position
		collision_shape.rotation = rotation
		body.add_child(collision_shape)
	return mesh_instance

func _build_ambient_audio() -> void:
	var river_stream := load("res://audio/river_loop.ogg") as AudioStream
	var wind_stream := load("res://audio/winter_wind.ogg") as AudioStream

	wind_audio = AudioStreamPlayer.new()
	wind_audio.name = "WinterWindAmbience"
	wind_audio.stream = wind_stream
	wind_audio.volume_db = 8.0
	wind_audio.autoplay = true
	generated.add_child(wind_audio)

	river_audio = AudioStreamPlayer3D.new()
	river_audio.name = "RiverAmbience"
	river_audio.stream = river_stream
	river_audio.volume_db = 5.0
	river_audio.unit_size = 11.0
	river_audio.max_distance = 100.0
	river_audio.attenuation_filter_cutoff_hz = 7200.0
	river_audio.autoplay = true
	river_audio.position = Vector3(_river_center(0.0), WATER_LEVEL, 0.0)
	generated.add_child(river_audio)

func _build_snowfall() -> void:
	var snow_process := ParticleProcessMaterial.new()
	snow_process.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	snow_process.emission_box_extents = Vector3(66.0, 20.0, 66.0)
	snow_process.direction = Vector3(0.16, -1.0, 0.08)
	snow_process.spread = 10.0
	snow_process.initial_velocity_min = 2.6
	snow_process.initial_velocity_max = 4.8
	snow_process.gravity = Vector3(0.62, -0.62, 0.22)
	snow_process.scale_min = 0.55
	snow_process.scale_max = 1.45

	var flake_material := StandardMaterial3D.new()
	flake_material.albedo_color = Color(0.91, 0.96, 1.0, 0.78)
	flake_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	flake_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	flake_material.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	var flake := QuadMesh.new()
	flake.size = Vector2(0.045, 0.17)
	flake.material = flake_material

	snowfall = GPUParticles3D.new()
	snowfall.name = "FallingSnow"
	snowfall.amount = 1250
	snowfall.lifetime = 13.0
	snowfall.preprocess = 13.0
	snowfall.randomness = 0.82
	snowfall.local_coords = false
	snowfall.visibility_aabb = AABB(Vector3(-75.0, -28.0, -75.0), Vector3(150.0, 55.0, 150.0))
	snowfall.process_material = snow_process
	snowfall.draw_pass_1 = flake
	generated.add_child(snowfall)
