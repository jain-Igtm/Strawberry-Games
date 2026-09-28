extends Node3D

const HeaterScript = preload("res://src/heater.gd")
const SupplyScript = preload("res://src/supply_cache.gd")
const BoatScript = preload("res://src/boat.gd")
const HelmScript = preload("res://src/helm.gd")
const CabinDoorScript = preload("res://src/cabin_door.gd")
const BoardingLadderScript = preload("res://src/boarding_ladder.gd")
const DogScript = preload("res://src/dog.gd")
const EnvironmentCycleScript = preload("res://src/environment_cycle.gd")
const FuelStationScript = preload("res://src/fuel_station.gd")
const FlagPickupScript = preload("res://src/flag_pickup.gd")
const FlagLockerScript = preload("res://src/flag_locker.gd")
const FlagClothScript = preload("res://src/flag_cloth.gd")
const CabinRadioScript = preload("res://src/cabin_radio.gd")
const RiverShader = preload("res://shaders/river.gdshader")

const TERRAIN_HALF_WIDTH := 220.0
const TERRAIN_HALF_LENGTH := 480.0
const TERRAIN_STEP := 8.0
const WATER_LEVEL := 0.05
const BOAT_POSITION := Vector3(8.0, 0.0, 0.0)
const FUEL_STOPS := [
	{"z": -326.0, "name": "Raven Bend Fuel", "flag": "raven"},
	{"z": -162.0, "name": "Kuskokwim Landing", "flag": "aurora"},
	{"z": 158.0, "name": "Glacier Mile Service", "flag": "glacier"},
	{"z": 324.0, "name": "Midnight Sun Fuel", "flag": "midnight_sun"},
]
const FLAG_DATA := {
	"northstar": {"name": "Northstar", "upper": Color(0.08, 0.23, 0.34), "lower": Color(0.82, 0.89, 0.91)},
	"aurora": {"name": "Aurora", "upper": Color(0.10, 0.60, 0.51), "lower": Color(0.20, 0.12, 0.36)},
	"raven": {"name": "Raven", "upper": Color(0.055, 0.065, 0.075), "lower": Color(0.65, 0.18, 0.12)},
	"glacier": {"name": "Glacier", "upper": Color(0.76, 0.93, 0.97), "lower": Color(0.10, 0.42, 0.62)},
	"midnight_sun": {"name": "Midnight Sun", "upper": Color(0.08, 0.09, 0.19), "lower": Color(0.94, 0.49, 0.13)},
}

@onready var generated: Node3D = $GeneratedWorld
@onready var player: CharacterBody3D = $Player

var terrain_noise := FastNoiseLite.new()
var detail_noise := FastNoiseLite.new()
var heater: Node3D
var boat: AnimatableBody3D
var cabin_door: AnimatableBody3D
var boarding_ladder: StaticBody3D
var gangway: StaticBody3D
var snowfall: GPUParticles3D
var river_audio: AudioStreamPlayer3D
var wind_audio: AudioStreamPlayer
var dog: CharacterBody3D
var environment_cycle: Node
var winter_environment: WorldEnvironment
var winter_sun: DirectionalLight3D
var cabin_radio: StaticBody3D
var flag_visual: Node3D
var fuel_stations: Array[StaticBody3D] = []
var flag_pickups: Array[StaticBody3D] = []
var unlocked_flags: Array[String] = ["northstar"]
var current_flag_index := 0

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
	add_to_group("world")
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
	_build_fuel_stations()
	_build_ambient_audio()
	_build_snowfall()
	_build_dog()
	_build_environment_cycle()

func _process(delta: float) -> void:
	if snowfall != null and player != null:
		snowfall.global_position = Vector3(player.global_position.x, player.global_position.y + 19.0, player.global_position.z)
	if river_audio != null and player != null:
		river_audio.global_position = Vector3(_river_center(player.global_position.z), WATER_LEVEL, player.global_position.z)
	if wind_audio != null and player != null:
		var wind_target := -2.0 if bool(player.get("sheltered")) else 8.0
		if environment_cycle != null and environment_cycle.has_method("get_wind_volume_db"):
			wind_target = float(environment_cycle.call("get_wind_volume_db", bool(player.get("sheltered"))))
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
	var door_open := cabin_door != null and (bool(cabin_door.get("is_open")) or bool(cabin_door.get("moving")))
	var sheltered := inside_cabin and not door_open
	var river_distance := absf(world_position.x - _river_center(world_position.z))
	var in_river := river_distance < _river_half_width(world_position.z) - 0.25 and world_position.y < 0.84
	var heat := 0.0
	if inside_cabin and heater != null and heater.has_method("get_heat_strength"):
		heat = float(heater.call("get_heat_strength", world_position))
		if door_open:
			heat *= 0.42
	var outside_air := -18.0
	var outside_chill := -24.0
	if environment_cycle != null:
		if environment_cycle.has_method("get_air_temperature"):
			outside_air = float(environment_cycle.call("get_air_temperature"))
		if environment_cycle.has_method("get_wind_chill"):
			outside_chill = float(environment_cycle.call("get_wind_chill"))
	var cabin_air := maxf(outside_air + 10.0, -8.0)
	var cabin_chill := maxf(outside_chill + 11.0, -10.0)
	return {
		"in_water": in_river,
		"inside_cabin": inside_cabin,
		"sheltered": sheltered,
		"heat_strength": heat,
		"air_temperature": (cabin_air + 2.0 if sheltered else (cabin_air if inside_cabin else outside_air)),
		"wind_chill": (cabin_chill + 3.0 if sheltered else (cabin_chill if inside_cabin else outside_chill)),
	}

func get_nearby_interactable(world_position: Vector3) -> Node:
	if boat != null and boarding_ladder != null:
		var boat_local := boat.to_local(world_position)
		var beside_hull := absf(boat_local.x) < 4.2 and absf(boat_local.z) < 8.8
		if beside_hull and boat_local.y < 1.70:
			return boarding_ladder
	var nearest: Node3D
	var nearest_distance := INF
	if cabin_door != null:
		var door_distance := world_position.distance_to(cabin_door.global_position)
		if door_distance < 2.8:
			nearest = cabin_door
			nearest_distance = door_distance
	if dog != null:
		var dog_distance := world_position.distance_to(dog.global_position)
		if dog_distance < 4.25 and dog_distance < nearest_distance:
			nearest = dog
			nearest_distance = dog_distance
	for candidate_node in get_tree().get_nodes_in_group("world_interactable"):
		var candidate := candidate_node as Node3D
		if candidate == null or not candidate.visible:
			continue
		var radius := 3.0
		if candidate.has_method("get_interaction_radius"):
			radius = float(candidate.call("get_interaction_radius"))
		var distance := world_position.distance_to(candidate.global_position)
		if distance <= radius and distance < nearest_distance:
			nearest = candidate
			nearest_distance = distance
	return nearest

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
	winter_environment = world_environment

	var sun := DirectionalLight3D.new()
	sun.name = "LowWinterSun"
	sun.rotation_degrees = Vector3(-24.0, -34.0, 0.0)
	sun.light_color = Color(1.0, 0.76, 0.58)
	sun.light_energy = 1.08
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 170.0
	generated.add_child(sun)
	winter_sun = sun

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
	_build_boarding_ladder(boat)
	_build_heater(boat)
	_build_supplies(boat)
	_build_flag_rig(boat)
	_build_flag_locker(boat)
	_build_cabin_radio(boat)
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
	_add_box(boat_body, "BunkFrame", Vector3(1.20, 0.28, 2.10), Vector3(1.20, 1.63, 0.35), wood_material)
	_add_box(boat_body, "BunkMattress", Vector3(1.08, 0.20, 1.92), Vector3(1.20, 1.87, 0.35), mattress_material, false)
	# Keep the compact table tight against the port wall. The center aisle must
	# accommodate the player's 0.72 m capsule without catching either side.
	_add_box(boat_body, "TableTop", Vector3(0.58, 0.12, 1.16), Vector3(-1.58, 2.05, 1.10), wood_material)
	for z in [0.64, 1.56]:
		_add_box(boat_body, "TableLeg", Vector3(0.08, 0.62, 0.08), Vector3(-1.58, 1.70, z), wood_material)

	_add_box(boat_body, "PortAftRail", Vector3(0.08, 0.08, 5.0), Vector3(-2.18, 2.05, 4.05), metal_material)
	_add_box(boat_body, "StarboardRailForward", Vector3(0.08, 0.08, 2.0), Vector3(2.18, 2.05, 2.65), metal_material)
	_add_box(boat_body, "StarboardRailAft", Vector3(0.08, 0.08, 0.55), Vector3(2.18, 2.05, 5.95), metal_material)
	for z in [1.65, 3.25, 5.0, 6.15]:
		_add_box(boat_body, "PortRailPost", Vector3(0.08, 0.78, 0.08), Vector3(-2.18, 1.68, z), metal_material)
	for z in [1.65, 3.25, 6.15]:
		_add_box(boat_body, "StarboardRailPost", Vector3(0.08, 0.78, 0.08), Vector3(2.18, 1.68, z), metal_material)
	_add_box(boat_body, "SternRailPort", Vector3(1.45, 0.08, 0.08), Vector3(-1.47, 2.05, 6.22), metal_material)
	_add_box(boat_body, "SternRailStarboard", Vector3(1.45, 0.08, 0.08), Vector3(1.47, 2.05, 6.22), metal_material)
	_build_reboarding_ramp(boat_body)

func _build_reboarding_ramp(boat_body: AnimatableBody3D) -> void:
	# Meet the deck exactly at its stern edge so the player never catches the
	# deck's vertical collision face while walking up from the waterline.
	var ramp_angle := deg_to_rad(36.0)
	_add_box(boat_body, "SternBoardingPlatform", Vector3(1.75, 0.16, 0.90), Vector3(0.0, 0.18, 8.28), metal_material)
	_add_box(
		boat_body,
		"SternBoardingRamp",
		Vector3(1.62, 0.14, 1.80),
		Vector3(0.0, 0.785, 7.375),
		metal_material,
		true,
		Vector3(ramp_angle, 0.0, 0.0)
	)
	for x in [-0.82, 0.82]:
		_add_box(
			boat_body,
			"BoardingHandrail",
			Vector3(0.06, 0.06, 1.80),
			Vector3(x, 1.34, 7.375),
			metal_material,
			false,
			Vector3(ramp_angle, 0.0, 0.0)
	)

func _build_dog() -> void:
	if boat == null:
		return
	dog = CharacterBody3D.new()
	dog.name = "Dog"
	dog.collision_layer = 1
	dog.collision_mask = 1
	dog.floor_max_angle = deg_to_rad(52.0)
	dog.floor_snap_length = 0.28
	dog.floor_stop_on_slope = true
	dog.set_script(DogScript)

	var dog_shape := CapsuleShape3D.new()
	dog_shape.radius = 0.28
	dog_shape.height = 0.82
	var dog_collision := CollisionShape3D.new()
	dog_collision.name = "DogCollision"
	dog_collision.shape = dog_shape
	dog.add_child(dog_collision)

	var fur_dark := _material(Color(0.17, 0.19, 0.20), 0.96)
	var fur_light := _material(Color(0.76, 0.79, 0.78), 0.98)
	var nose_material := _material(Color(0.035, 0.04, 0.04), 0.92)

	var visual := Node3D.new()
	visual.name = "Visual"
	dog.add_child(visual)
	_add_box(visual, "Body", Vector3(0.56, 0.44, 0.92), Vector3(0.0, 0.02, 0.0), fur_dark, false)
	_add_box(visual, "Chest", Vector3(0.46, 0.40, 0.42), Vector3(0.0, 0.02, -0.38), fur_light, false)

	var head := SphereMesh.new()
	head.radius = 0.29
	head.height = 0.56
	head.radial_segments = 10
	head.rings = 6
	head.material = fur_dark
	var head_mesh := MeshInstance3D.new()
	head_mesh.name = "Head"
	head_mesh.mesh = head
	head_mesh.position = Vector3(0.0, 0.22, -0.60)
	visual.add_child(head_mesh)
	_add_box(visual, "Muzzle", Vector3(0.28, 0.20, 0.26), Vector3(0.0, 0.14, -0.87), fur_light, false)
	_add_box(visual, "Nose", Vector3(0.15, 0.11, 0.10), Vector3(0.0, 0.18, -1.02), nose_material, false)

	for x in [-0.20, 0.20]:
		for z in [-0.30, 0.30]:
			_add_cylinder(visual, "Leg", 0.065, 0.48, Vector3(x, -0.40, z), fur_light, false)

	for x in [-0.16, 0.16]:
		var ear := _add_box(visual, "Ear", Vector3(0.12, 0.28, 0.10), Vector3(x, 0.54, -0.64), fur_dark, false)
		ear.rotation.z = deg_to_rad(-12.0 if x < 0.0 else 12.0)

	var tail_pivot := Node3D.new()
	tail_pivot.name = "TailPivot"
	tail_pivot.position = Vector3(0.0, 0.12, 0.47)
	visual.add_child(tail_pivot)
	_add_cylinder(tail_pivot, "Tail", 0.075, 0.62, Vector3(0.0, 0.19, 0.20), fur_dark, false, Vector3(deg_to_rad(54.0), 0.0, 0.0))

	generated.add_child(dog)
	dog.global_position = boat.to_global(Vector3(-1.20, 1.78, 4.25))

func _build_environment_cycle() -> void:
	environment_cycle = Node.new()
	environment_cycle.name = "EnvironmentCycle"
	environment_cycle.set_script(EnvironmentCycleScript)
	generated.add_child(environment_cycle)
	if environment_cycle.has_method("configure"):
		environment_cycle.call("configure", winter_environment, winter_sun, snowfall)

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
	helm.position = Vector3(0.90, 1.84, -2.42)
	helm.collision_layer = 1
	helm.collision_mask = 2
	helm.set_script(HelmScript)
	_add_box(helm, "HelmInteraction", Vector3(1.15, 0.82, 0.62), Vector3.ZERO, metal_material)
	_add_cylinder(helm, "Wheel", 0.34, 0.06, Vector3(0.0, 0.24, 0.36), wood_material, false, Vector3(deg_to_rad(90.0), 0.0, 0.0))
	boat_body.add_child(helm)

	var helm_seat := Marker3D.new()
	helm_seat.name = "HelmSeat"
	helm_seat.position = Vector3(0.90, 2.24, -1.48)
	boat_body.add_child(helm_seat)

	var helm_exit := Marker3D.new()
	helm_exit.name = "HelmExit"
	helm_exit.position = Vector3(0.0, 2.24, 2.18)
	boat_body.add_child(helm_exit)

func _build_boarding_ladder(boat_body: AnimatableBody3D) -> void:
	boarding_ladder = StaticBody3D.new()
	boarding_ladder.name = "BoardingLadder"
	boarding_ladder.position = Vector3(2.46, 0.75, 4.55)
	boarding_ladder.collision_layer = 4
	boarding_ladder.collision_mask = 2
	boarding_ladder.set_script(BoardingLadderScript)
	for z in [-0.34, 0.34]:
		_add_cylinder(boarding_ladder, "LadderRail", 0.045, 1.86, Vector3(0.0, 0.0, z), metal_material, false)
	for rung_y in [-0.70, -0.35, 0.0, 0.35, 0.70]:
		_add_cylinder(boarding_ladder, "LadderRung", 0.038, 0.70, Vector3(0.0, rung_y, 0.0), metal_material, false, Vector3(deg_to_rad(90.0), 0.0, 0.0))
	var interaction_shape := BoxShape3D.new()
	interaction_shape.size = Vector3(0.60, 2.05, 1.10)
	var interaction_collision := CollisionShape3D.new()
	interaction_collision.name = "BoardingInteractionCollision"
	interaction_collision.shape = interaction_shape
	boarding_ladder.add_child(interaction_collision)
	boat_body.add_child(boarding_ladder)

	var boarding_point := Marker3D.new()
	boarding_point.name = "BoardingPoint"
	boarding_point.position = Vector3(1.52, 2.24, 4.55)
	boat_body.add_child(boarding_point)

	var dog_spot := Marker3D.new()
	dog_spot.name = "DogSpot"
	dog_spot.position = Vector3(-1.20, 1.78, 4.25)
	boat_body.add_child(dog_spot)

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

func _build_flag_rig(boat_body: AnimatableBody3D) -> void:
	_add_cylinder(boat_body, "FlagMast", 0.045, 3.55, Vector3(-1.54, 5.48, 0.82), metal_material, false)
	_add_cylinder(boat_body, "FlagHalyard", 0.012, 3.18, Vector3(-1.47, 5.38, 0.82), _material(Color(0.72, 0.68, 0.57), 0.88), false)
	var mast_light := OmniLight3D.new()
	mast_light.name = "MastLight"
	mast_light.position = Vector3(-1.54, 7.28, 0.82)
	mast_light.light_color = Color(1.0, 0.22, 0.12)
	mast_light.light_energy = 0.85
	mast_light.omni_range = 4.0
	boat_body.add_child(mast_light)

	flag_visual = Node3D.new()
	flag_visual.name = "HoistedFlag"
	flag_visual.position = Vector3(-1.54, 6.55, 0.82)
	flag_visual.set_script(FlagClothScript)
	var upper_materials: Array[StandardMaterial3D] = []
	var lower_materials: Array[StandardMaterial3D] = []
	for segment_index in range(3):
		var panel := Node3D.new()
		panel.name = "FlagPanel%d" % segment_index
		panel.position = Vector3(0.0, 0.0, float(segment_index) * 0.42)
		flag_visual.add_child(panel)
		var upper := _material(Color.WHITE, 0.76)
		var lower := _material(Color.WHITE, 0.76)
		upper_materials.append(upper)
		lower_materials.append(lower)
		_add_box(panel, "Upper", Vector3(0.045, 0.36, 0.42), Vector3(0.0, 0.18, 0.21), upper, false)
		_add_box(panel, "Lower", Vector3(0.045, 0.36, 0.42), Vector3(0.0, -0.18, 0.21), lower, false)
	boat_body.add_child(flag_visual)
	flag_visual.call("configure_materials", upper_materials, lower_materials)
	_apply_current_flag()

func _build_flag_locker(boat_body: AnimatableBody3D) -> void:
	var locker := StaticBody3D.new()
	locker.name = "FlagLocker"
	locker.position = Vector3(-1.76, 2.66, 1.34)
	locker.collision_layer = 1
	locker.collision_mask = 2
	locker.set_script(FlagLockerScript)
	_add_box(locker, "LockerCase", Vector3(0.22, 0.68, 0.76), Vector3.ZERO, _material(Color(0.18, 0.23, 0.24), 0.64, 0.32))
	_add_box(locker, "LockerStripe", Vector3(0.025, 0.10, 0.58), Vector3(0.13, 0.13, 0.0), _material(Color(0.71, 0.28, 0.18), 0.70), false)
	var label := Label3D.new()
	label.name = "FlagLockerLabel"
	label.position = Vector3(0.14, -0.08, 0.0)
	label.text = "FLAGS"
	label.font_size = 28
	label.pixel_size = 0.0045
	label.modulate = Color(0.83, 0.89, 0.88)
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	locker.add_child(label)
	boat_body.add_child(locker)

func _build_cabin_radio(boat_body: AnimatableBody3D) -> void:
	cabin_radio = StaticBody3D.new()
	cabin_radio.name = "CabinRadio"
	cabin_radio.position = Vector3(-1.76, 2.68, -0.18)
	cabin_radio.collision_layer = 1
	cabin_radio.collision_mask = 2
	cabin_radio.set_script(CabinRadioScript)
	var radio_case := _material(Color(0.12, 0.095, 0.07), 0.90)
	var radio_metal := _material(Color(0.34, 0.31, 0.25), 0.58, 0.24)
	_add_box(cabin_radio, "RadioCase", Vector3(0.24, 0.58, 0.94), Vector3.ZERO, radio_case)
	_add_box(cabin_radio, "SpeakerGrille", Vector3(0.03, 0.25, 0.36), Vector3(0.135, 0.08, 0.22), radio_metal, false)
	for knob_z in [-0.29, -0.10]:
		_add_cylinder(cabin_radio, "TuningKnob", 0.075, 0.055, Vector3(0.16, -0.15, knob_z), radio_metal, false, Vector3(0.0, 0.0, deg_to_rad(90.0)))
	var display := Label3D.new()
	display.name = "FrequencyDisplay"
	display.position = Vector3(0.15, 0.15, -0.20)
	display.text = "OFF"
	display.font_size = 34
	display.pixel_size = 0.0042
	display.outline_size = 5
	display.outline_modulate = Color(0.04, 0.025, 0.018)
	display.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	cabin_radio.add_child(display)
	var receiver := AudioStreamPlayer3D.new()
	receiver.name = "ReceiverAudio"
	receiver.volume_db = 2.0
	receiver.unit_size = 2.8
	receiver.max_distance = 22.0
	receiver.attenuation_filter_cutoff_hz = 3900.0
	cabin_radio.add_child(receiver)
	boat_body.add_child(cabin_radio)

func _build_fuel_stations() -> void:
	for index in range(FUEL_STOPS.size()):
		var stop: Dictionary = FUEL_STOPS[index]
		_build_fuel_station(index, float(stop["z"]), str(stop["name"]), str(stop["flag"]))

func _build_fuel_station(index: int, station_z: float, station_name: String, flag_id: String) -> void:
	var river_x := _river_center(station_z)
	var dock_center_x := river_x + _river_half_width(station_z) - 0.15
	var root := Node3D.new()
	root.name = "FuelStop%d" % (index + 1)
	root.position = Vector3(dock_center_x, 0.0, station_z)

	var dock := StaticBody3D.new()
	dock.name = "FuelDock"
	dock.collision_layer = 1
	dock.collision_mask = 2
	_add_box(dock, "DockDeck", Vector3(9.0, 0.24, 4.5), Vector3(0.0, 1.20, 0.0), wood_material)
	for post_x in [-4.18, -2.6, 0.8, 4.18]:
		for post_z in [-1.92, 1.92]:
			_add_cylinder(dock, "DockPost", 0.10, 2.2, Vector3(post_x, 0.72, post_z), wood_material, false)
	for bollard_z in [-1.42, 1.42]:
		_add_cylinder(dock, "MooringBollard", 0.13, 0.62, Vector3(-3.72, 1.60, bollard_z), metal_material, false)
	root.add_child(dock)

	var pump := StaticBody3D.new()
	pump.name = "FuelPump"
	pump.position = Vector3(1.25, 1.34, -0.35)
	pump.collision_layer = 1
	pump.collision_mask = 2
	pump.set_script(FuelStationScript)
	pump.set("station_name", station_name)
	var pump_red := _material(Color(0.54, 0.12, 0.075), 0.56, 0.18)
	_add_box(pump, "PumpBody", Vector3(0.72, 1.15, 0.72), Vector3(0.0, 0.57, 0.0), pump_red)
	_add_box(pump, "PumpFace", Vector3(0.04, 0.38, 0.46), Vector3(-0.38, 0.70, 0.0), _material(Color(0.82, 0.84, 0.76), 0.48), false)
	_add_cylinder(pump, "PumpHose", 0.035, 1.20, Vector3(0.40, 0.43, 0.0), _material(Color(0.035, 0.04, 0.04), 0.92), false)
	var pump_label := Label3D.new()
	pump_label.name = "PumpLabel"
	pump_label.position = Vector3(0.0, 1.50, 0.0)
	pump_label.text = "RIVER FUEL"
	pump_label.font_size = 42
	pump_label.pixel_size = 0.0052
	pump_label.modulate = Color(1.0, 0.82, 0.54)
	pump_label.outline_size = 7
	pump_label.outline_modulate = Color(0.10, 0.035, 0.02)
	pump_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	pump.add_child(pump_label)
	root.add_child(pump)
	fuel_stations.append(pump)

	var canopy := StaticBody3D.new()
	canopy.name = "FuelCanopy"
	canopy.collision_layer = 1
	canopy.collision_mask = 2
	_add_box(canopy, "CanopyRoof", Vector3(4.15, 0.20, 4.15), Vector3(2.10, 4.12, 0.0), roof_material)
	for post_x in [0.30, 3.90]:
		for post_z in [-1.68, 1.68]:
			_add_cylinder(canopy, "CanopyPost", 0.075, 3.0, Vector3(post_x, 2.63, post_z), metal_material)
	root.add_child(canopy)

	var beacon := OmniLight3D.new()
	beacon.name = "FuelBeacon"
	beacon.position = Vector3(-2.8, 4.3, 0.0)
	beacon.light_color = Color(1.0, 0.43, 0.18)
	beacon.light_energy = 3.0
	beacon.omni_range = 17.0
	root.add_child(beacon)

	var pickup := StaticBody3D.new()
	pickup.name = "FlagPickup_%s" % flag_id
	pickup.position = Vector3(-1.55, 1.72, 0.76)
	pickup.collision_layer = 1
	pickup.collision_mask = 2
	pickup.set_script(FlagPickupScript)
	pickup.set("flag_id", flag_id)
	var flag_name := get_flag_name(flag_id)
	pickup.set("flag_name", flag_name)
	var flag_data: Dictionary = FLAG_DATA[flag_id]
	_add_box(pickup, "FlagStand", Vector3(0.38, 0.68, 0.38), Vector3(0.0, 0.0, 0.0), _material(Color(0.24, 0.18, 0.11), 0.92))
	_add_box(pickup, "FlagUpper", Vector3(0.055, 0.28, 0.72), Vector3(0.0, 0.48, 0.08), _material(flag_data["upper"], 0.76), false)
	_add_box(pickup, "FlagLower", Vector3(0.055, 0.28, 0.72), Vector3(0.0, 0.20, 0.08), _material(flag_data["lower"], 0.76), false)
	var flag_label := Label3D.new()
	flag_label.name = "FlagName"
	flag_label.position = Vector3(0.0, 0.95, 0.0)
	flag_label.text = flag_name.upper()
	flag_label.font_size = 30
	flag_label.pixel_size = 0.0045
	flag_label.modulate = Color(0.89, 0.93, 0.90)
	flag_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	pickup.add_child(flag_label)
	root.add_child(pickup)
	flag_pickups.append(pickup)

	generated.add_child(root)

func unlock_flag(flag_id: String) -> bool:
	if not FLAG_DATA.has(flag_id) or flag_id in unlocked_flags:
		return false
	unlocked_flags.append(flag_id)
	return true

func cycle_flag(player_node: Node = null) -> void:
	if unlocked_flags.size() <= 1:
		if player_node != null and player_node.has_method("show_status_message"):
			player_node.call("show_status_message", "The Northstar flag is flying. Find more flags at river fuel stops.", 3.2)
		return
	current_flag_index = (current_flag_index + 1) % unlocked_flags.size()
	_apply_current_flag()
	if player_node != null and player_node.has_method("show_status_message"):
		player_node.call("show_status_message", "%s flag hoisted." % get_current_flag_name(), 2.5)

func get_flag_name(flag_id: String) -> String:
	if not FLAG_DATA.has(flag_id):
		return "Unknown"
	return str(FLAG_DATA[flag_id]["name"])

func get_current_flag_name() -> String:
	return get_flag_name(unlocked_flags[current_flag_index])

func get_next_flag_name() -> String:
	if unlocked_flags.size() <= 1:
		return get_current_flag_name()
	return get_flag_name(unlocked_flags[(current_flag_index + 1) % unlocked_flags.size()])

func get_unlocked_flag_count() -> int:
	return unlocked_flags.size()

func _apply_current_flag() -> void:
	if flag_visual == null or unlocked_flags.is_empty():
		return
	var flag_id := unlocked_flags[current_flag_index]
	var data: Dictionary = FLAG_DATA[flag_id]
	flag_visual.call("set_palette", data["upper"], data["lower"])

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
