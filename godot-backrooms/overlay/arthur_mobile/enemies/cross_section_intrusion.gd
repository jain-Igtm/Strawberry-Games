extends Node3D
class_name CrossSectionIntrusion

const SURFACE_SHADER: Shader = preload("res://arthur_mobile/enemies/higher_dimensional_surface.gdshader")

@export var visible_min := 0.52
@export var visible_max := 1.08
@export var hidden_min := 0.20
@export var hidden_max := 0.62
@export var drift_speed := 1.05
@export var reentry_min_distance := 5.5
@export var reentry_max_distance := 11.5

var target: Node3D
var rng := RandomNumberGenerator.new()
var pieces: Array[MeshInstance3D] = []
var manifested := true
var phase_timer := 0.0
var cycles_left := 0
var age := 0.0
var phase_seed := 0.0

func configure(target_node: Node3D) -> void:
	target = target_node

func _ready() -> void:
	add_to_group("enemy")
	rng.randomize()
	phase_seed = rng.randf_range(0.0, 1000.0)
	cycles_left = rng.randi_range(4, 7)
	_build_cross_section()
	_reshuffle_shape()
	phase_timer = rng.randf_range(visible_min, visible_max)
	if target == null:
		target = get_tree().get_first_node_in_group("player") as Node3D

func _process(delta: float) -> void:
	age += delta
	phase_timer -= delta
	_animate_surface(delta)

	if manifested and is_instance_valid(target):
		var target_point := target.global_position + Vector3(0.0, 0.8, 0.0)
		var toward := target_point - global_position
		if toward.length_squared() > 0.01:
			var speed_scale := 0.72 + 0.28 * sin(age * 2.1 + phase_seed)
			global_position += toward.normalized() * drift_speed * maxf(speed_scale, 0.24) * delta

	if phase_timer > 0.0:
		return

	if manifested:
		_set_manifested(false)
		phase_timer = rng.randf_range(hidden_min, hidden_max)
	else:
		cycles_left -= 1
		if cycles_left <= 0:
			queue_free()
			return
		_choose_reentry_position()
		_reshuffle_shape()
		_set_manifested(true)
		phase_timer = rng.randf_range(visible_min, visible_max)

func _build_cross_section() -> void:
	# Six pieces read more like discontinuous slices and cost substantially less than the old eleven-part cloud.
	for index in range(6):
		var mesh_instance := MeshInstance3D.new()
		mesh_instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mesh_instance.visibility_range_end = 38.0

		var tube := TubeTrailMesh.new()
		tube.radial_steps = 6
		tube.sections = 5 if index == 0 else rng.randi_range(3, 5)
		tube.section_rings = 2
		tube.section_length = rng.randf_range(0.30, 0.52) if index == 0 else rng.randf_range(0.20, 0.38)
		tube.radius = rng.randf_range(0.11, 0.17) if index == 0 else rng.randf_range(0.025, 0.075)
		tube.cap_bottom = true
		tube.cap_top = true

		var taper := Curve.new()
		if index == 0:
			taper.add_point(Vector2(0.0, 0.16))
			taper.add_point(Vector2(0.22, 1.0))
			taper.add_point(Vector2(0.68, 0.62))
			taper.add_point(Vector2(1.0, 0.06))
		else:
			taper.add_point(Vector2(0.0, rng.randf_range(0.02, 0.18)))
			taper.add_point(Vector2(rng.randf_range(0.16, 0.30), rng.randf_range(0.68, 1.0)))
			taper.add_point(Vector2(rng.randf_range(0.62, 0.82), rng.randf_range(0.22, 0.65)))
			taper.add_point(Vector2(1.0, rng.randf_range(0.0, 0.09)))
		tube.curve = taper
		mesh_instance.mesh = tube

		var material := ShaderMaterial.new()
		material.shader = SURFACE_SHADER
		material.set_shader_parameter("seed", phase_seed + float(index) * 1.731)
		material.set_shader_parameter("agitation", 0.44 if index == 0 else rng.randf_range(0.24, 0.62))
		mesh_instance.material_override = material

		add_child(mesh_instance)
		pieces.append(mesh_instance)

func _reshuffle_shape() -> void:
	for index in range(pieces.size()):
		var piece := pieces[index]
		if index == 0:
			piece.position = Vector3(rng.randf_range(-0.18, 0.18), rng.randf_range(-0.45, 0.52), rng.randf_range(-0.18, 0.18))
			piece.rotation = Vector3(rng.randf_range(-0.45, 0.45), rng.randf_range(-PI, PI), rng.randf_range(-0.35, 0.35))
			piece.scale = Vector3(0.92, rng.randf_range(1.25, 1.75), 0.92)
			continue

		var radial := rng.randf_range(0.38, 1.65)
		var angle := rng.randf_range(-PI, PI)
		piece.position = Vector3(cos(angle) * radial, rng.randf_range(-1.55, 1.55), sin(angle) * radial)
		piece.rotation = Vector3(
			rng.randf_range(-PI, PI),
			rng.randf_range(-PI, PI),
			rng.randf_range(-PI, PI)
		)
		piece.scale = Vector3(rng.randf_range(0.72, 1.05), rng.randf_range(0.85, 1.65), rng.randf_range(0.72, 1.05))

func _animate_surface(delta: float) -> void:
	if not manifested:
		return
	for index in range(pieces.size()):
		var piece := pieces[index]
		var speed := 0.035 + float(index % 3) * 0.018
		piece.rotation.x += delta * speed * sin(phase_seed + float(index) * 1.9)
		piece.rotation.y += delta * speed * 0.65 * cos(phase_seed * 0.7 + float(index))
		piece.rotation.z += delta * speed * 0.32

func _set_manifested(value: bool) -> void:
	manifested = value
	for piece in pieces:
		piece.visible = value

func _choose_reentry_position() -> void:
	if not is_instance_valid(target):
		return
	var angle := rng.randf_range(-PI, PI)
	var distance := rng.randf_range(reentry_min_distance, reentry_max_distance)
	var offset := Vector3(cos(angle) * distance, rng.randf_range(0.7, 2.6), sin(angle) * distance)
	global_position = target.global_position + offset
