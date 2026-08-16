extends Node3D
class_name VeilRay

const RAY_SHADER: Shader = preload("res://arthur_mobile/enemies/veil_ray.gdshader")

@export var orbit_radius_min := 4.2
@export var orbit_radius_max := 7.0
@export var cruise_height := 3.15
@export var lifetime := 24.0
@export var swoop_interval_min := 4.5
@export var swoop_interval_max := 7.5

var target: Node3D
var rng := RandomNumberGenerator.new()
var age := 0.0
var orbit_angle := 0.0
var orbit_radius := 5.5
var orbit_speed := 0.42
var next_swoop := 5.0
var swoop_time := 0.0
var swooping := false
var seed := 0.0

func configure(target_node: Node3D) -> void:
	target = target_node

func _ready() -> void:
	add_to_group("enemy")
	rng.randomize()
	seed = rng.randf_range(0.0, 100.0)
	orbit_angle = rng.randf_range(-PI, PI)
	orbit_radius = rng.randf_range(orbit_radius_min, orbit_radius_max)
	orbit_speed = rng.randf_range(0.32, 0.52) * (-1.0 if rng.randf() < 0.5 else 1.0)
	next_swoop = rng.randf_range(swoop_interval_min, swoop_interval_max)
	_build_body()
	if target == null:
		target = get_tree().get_first_node_in_group("player") as Node3D

func _process(delta: float) -> void:
	age += delta
	if age >= lifetime:
		queue_free()
		return
	if not is_instance_valid(target):
		return

	orbit_angle += delta * orbit_speed
	next_swoop -= delta
	if not swooping and next_swoop <= 0.0:
		swooping = true
		swoop_time = 0.0

	var center := target.global_position
	var desired: Vector3
	if swooping:
		swoop_time += delta
		var p := clampf(swoop_time / 1.65, 0.0, 1.0)
		var horizontal := Vector3(cos(orbit_angle), 0.0, sin(orbit_angle)) * lerpf(orbit_radius, 0.55, sin(p * PI))
		var dive := lerpf(cruise_height, 1.0, sin(p * PI))
		desired = center + horizontal + Vector3.UP * dive
		if p >= 1.0:
			swooping = false
			next_swoop = rng.randf_range(swoop_interval_min, swoop_interval_max)
			orbit_radius = rng.randf_range(orbit_radius_min, orbit_radius_max)
	else:
		var bob := sin(age * 1.7 + seed) * 0.20
		desired = center + Vector3(cos(orbit_angle) * orbit_radius, cruise_height + bob, sin(orbit_angle) * orbit_radius)

	global_position = global_position.lerp(desired, clampf(delta * 2.6, 0.0, 1.0))
	var toward := center + Vector3.UP * 0.9 - global_position
	if toward.length_squared() > 0.01:
		look_at(global_position + toward.normalized(), Vector3.UP)
		rotation.z = sin(age * 1.35 + seed) * 0.12

func _build_body() -> void:
	var wing := MeshInstance3D.new()
	wing.name = "WingSurface"
	wing.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	wing.visibility_range_end = 34.0
	var plane := PlaneMesh.new()
	plane.size = Vector2(3.6, 2.15)
	plane.subdivide_width = 5
	plane.subdivide_depth = 3
	wing.mesh = plane
	var material := ShaderMaterial.new()
	material.shader = RAY_SHADER
	material.set_shader_parameter("seed", seed)
	wing.material_override = material
	add_child(wing)

	var body := MeshInstance3D.new()
	body.name = "BodyRidge"
	body.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var body_mesh := SphereMesh.new()
	body_mesh.radius = 0.22
	body_mesh.height = 0.62
	body_mesh.radial_segments = 8
	body_mesh.rings = 4
	body.mesh = body_mesh
	body.scale = Vector3(0.72, 0.26, 1.75)
	body.position = Vector3(0.0, 0.05, 0.06)
	var body_material := StandardMaterial3D.new()
	body_material.albedo_color = Color(0.055, 0.06, 0.055, 1.0)
	body_material.roughness = 0.88
	body.material_override = body_material
	add_child(body)
