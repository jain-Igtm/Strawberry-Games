extends Node3D
class_name PoolFishSchool

@export_range(1, 18, 1) var school_size := 7
@export var local_extents := Vector3(4.5, 0.8, 4.5)
@export var swim_speed_min := 0.45
@export var swim_speed_max := 1.15
@export var turn_rate := 1.7

var rng := RandomNumberGenerator.new()
var swimmers: Array[Dictionary] = []
var fish_material: StandardMaterial3D

func configure(extents: Vector3, count: int = -1) -> void:
	local_extents = extents
	if count > 0:
		school_size = count

func _ready() -> void:
	rng.randomize()
	fish_material = _make_fish_material()
	for index in range(school_size):
		_spawn_fish(index)

func _process(delta: float) -> void:
	for index in range(swimmers.size()):
		var entry: Dictionary = swimmers[index]
		var fish := entry["node"] as Node3D
		if not is_instance_valid(fish):
			continue
		var velocity: Vector3 = entry["velocity"] as Vector3
		var seed: float = float(entry["seed"])
		var time_offset := Time.get_ticks_msec() * 0.001 + seed * 19.0

		var wander := Vector3(
			sin(time_offset * 0.61 + seed * 4.0),
			sin(time_offset * 0.83 + seed * 7.0) * 0.22,
			cos(time_offset * 0.53 + seed * 3.0)
		).normalized()
		var desired := velocity.normalized().lerp(wander, clampf(delta * 0.42, 0.0, 1.0)).normalized()

		var p := fish.position
		if absf(p.x) > local_extents.x * 0.86:
			desired.x += -signf(p.x) * 1.8
		if absf(p.y) > local_extents.y * 0.78:
			desired.y += -signf(p.y) * 1.4
		if absf(p.z) > local_extents.z * 0.86:
			desired.z += -signf(p.z) * 1.8
		desired = desired.normalized()

		var speed := lerpf(swim_speed_min, swim_speed_max, seed)
		velocity = velocity.lerp(desired * speed, clampf(delta * turn_rate, 0.0, 1.0))
		fish.position += velocity * delta
		fish.position.x = clampf(fish.position.x, -local_extents.x, local_extents.x)
		fish.position.y = clampf(fish.position.y, -local_extents.y, local_extents.y)
		fish.position.z = clampf(fish.position.z, -local_extents.z, local_extents.z)

		if velocity.length_squared() > 0.002:
			fish.look_at(fish.global_position + velocity.normalized(), Vector3.UP)
		var tail := fish.get_node_or_null("Tail") as MeshInstance3D
		if tail != null:
			tail.rotation.y = sin(time_offset * (5.5 + seed * 2.4)) * 0.46

		entry["velocity"] = velocity
		swimmers[index] = entry

func _spawn_fish(index: int) -> void:
	var fish := Node3D.new()
	fish.name = "Fish_%02d" % index
	fish.position = Vector3(
		rng.randf_range(-local_extents.x, local_extents.x),
		rng.randf_range(-local_extents.y, local_extents.y),
		rng.randf_range(-local_extents.z, local_extents.z)
	)
	add_child(fish)

	var body := MeshInstance3D.new()
	body.name = "Body"
	var body_mesh := SphereMesh.new()
	body_mesh.radius = 0.19
	body_mesh.height = 0.42
	body_mesh.radial_segments = 12
	body_mesh.rings = 6
	body.mesh = body_mesh
	body.scale = Vector3(0.92, 0.58, 1.55)
	body.material_override = fish_material
	fish.add_child(body)

	var tail := MeshInstance3D.new()
	tail.name = "Tail"
	var tail_mesh := QuadMesh.new()
	tail_mesh.size = Vector2(0.34, 0.28)
	tail.mesh = tail_mesh
	tail.position = Vector3(0.0, 0.0, 0.45)
	tail.material_override = fish_material
	fish.add_child(tail)

	var seed := rng.randf()
	var initial := Vector3(rng.randf_range(-1.0, 1.0), rng.randf_range(-0.16, 0.16), rng.randf_range(-1.0, 1.0)).normalized()
	swimmers.append({
		"node": fish,
		"velocity": initial * lerpf(swim_speed_min, swim_speed_max, seed),
		"seed": seed,
	})

func _make_fish_material() -> StandardMaterial3D:
	var noise := FastNoiseLite.new()
	noise.seed = rng.randi()
	noise.frequency = 0.075
	noise.fractal_octaves = 3

	var texture := NoiseTexture2D.new()
	texture.width = 96
	texture.height = 96
	texture.seamless = true
	texture.noise = noise

	var material := StandardMaterial3D.new()
	material.albedo_color = Color(0.42, 0.49, 0.45, 1.0)
	material.albedo_texture = texture
	material.roughness = 0.48
	material.metallic = 0.08
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	return material
