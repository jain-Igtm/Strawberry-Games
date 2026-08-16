extends Node3D
class_name PoolEel

const EEL_SHADER: Shader = preload("res://arthur_mobile/enemies/pool_eel.gdshader")

@export var orbit_radius_min := 2.8
@export var orbit_radius_max := 5.4
@export var depth_offset := -0.35
@export var lifetime := 22.0
@export var lunge_interval_min := 4.0
@export var lunge_interval_max := 6.5

var target: Node3D
var rng := RandomNumberGenerator.new()
var age := 0.0
var dry_time := 0.0
var orbit_angle := 0.0
var orbit_radius := 4.0
var orbit_speed := 0.58
var next_lunge := 4.0
var lunge_time := 0.0
var lunging := false
var seed := 0.0

func configure(target_node: Node3D) -> void:
	target = target_node

func _ready() -> void:
	add_to_group("enemy")
	rng.randomize()
	seed = rng.randf_range(0.0, 100.0)
	orbit_angle = rng.randf_range(-PI, PI)
	orbit_radius = rng.randf_range(orbit_radius_min, orbit_radius_max)
	orbit_speed = rng.randf_range(0.48, 0.72) * (-1.0 if rng.randf() < 0.5 else 1.0)
	next_lunge = rng.randf_range(lunge_interval_min, lunge_interval_max)
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

	var underwater := false
	if target.has_method("is_underwater"):
		underwater = bool(target.call("is_underwater"))
	if not underwater:
		dry_time += delta
		visible = false
		if dry_time > 2.5:
			queue_free()
		return
	visible = true
	dry_time = 0.0

	orbit_angle += delta * orbit_speed
	next_lunge -= delta
	if not lunging and next_lunge <= 0.0:
		lunging = true
		lunge_time = 0.0

	var center := target.global_position + Vector3.UP * depth_offset
	var desired: Vector3
	if lunging:
		lunge_time += delta
		var p := clampf(lunge_time / 1.35, 0.0, 1.0)
		var radial := lerpf(orbit_radius, 0.48, sin(p * PI))
		desired = center + Vector3(cos(orbit_angle) * radial, sin(age * 2.3 + seed) * 0.20, sin(orbit_angle) * radial)
		if p >= 1.0:
			lunging = false
			next_lunge = rng.randf_range(lunge_interval_min, lunge_interval_max)
			orbit_radius = rng.randf_range(orbit_radius_min, orbit_radius_max)
	else:
		desired = center + Vector3(
			cos(orbit_angle) * orbit_radius,
			sin(age * 1.9 + seed) * 0.34,
			sin(orbit_angle) * orbit_radius
		)

	global_position = global_position.lerp(desired, clampf(delta * (3.8 if lunging else 2.2), 0.0, 1.0))
	var travel := desired - global_position
	if travel.length_squared() > 0.002:
		look_at(global_position + travel.normalized(), Vector3.UP)
		rotation.z = sin(age * 3.0 + seed) * 0.10

func _build_body() -> void:
	var body := MeshInstance3D.new()
	body.name = "EelBody"
	body.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	body.visibility_range_end = 28.0

	var tube := TubeTrailMesh.new()
	tube.radial_steps = 7
	tube.sections = 7
	tube.section_rings = 2
	tube.section_length = 0.24
	tube.radius = 0.12
	tube.cap_bottom = true
	tube.cap_top = true
	var taper := Curve.new()
	taper.add_point(Vector2(0.0, 0.05))
	taper.add_point(Vector2(0.16, 0.76))
	taper.add_point(Vector2(0.42, 1.0))
	taper.add_point(Vector2(0.76, 0.62))
	taper.add_point(Vector2(1.0, 0.0))
	tube.curve = taper
	body.mesh = tube
	body.rotation.x = PI * 0.5

	var material := ShaderMaterial.new()
	material.shader = EEL_SHADER
	material.set_shader_parameter("seed", seed)
	body.material_override = material
	add_child(body)

	var eye_material := StandardMaterial3D.new()
	eye_material.albedo_color = Color(0.62, 0.62, 0.45, 1.0)
	eye_material.emission_enabled = true
	eye_material.emission = Color(0.12, 0.12, 0.08, 1.0)
	eye_material.emission_energy_multiplier = 0.35

	for side in [-1.0, 1.0]:
		var eye := MeshInstance3D.new()
		var eye_mesh := SphereMesh.new()
		eye_mesh.radius = 0.025
		eye_mesh.height = 0.05
		eye_mesh.radial_segments = 6
		eye_mesh.rings = 3
		eye.mesh = eye_mesh
		eye.position = Vector3(side * 0.075, 0.02, -0.72)
		eye.material_override = eye_material
		add_child(eye)
