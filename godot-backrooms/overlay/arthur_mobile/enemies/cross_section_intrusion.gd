extends Node3D
class_name CrossSectionIntrusion

const SURFACE_SHADER: Shader = preload("res://arthur_mobile/enemies/higher_dimensional_surface.gdshader")

@export var visible_min := 0.48
@export var visible_max := 1.15
@export var hidden_min := 0.16
@export var hidden_max := 0.72
@export var drift_speed := 1.35
@export var reentry_min_distance := 4.5
@export var reentry_max_distance := 11.0

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
	cycles_left = rng.randi_range(5, 9)
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
		var target_point := target.global_position + Vector3(0.0, 0.75, 0.0)
		var toward := target_point - global_position
		if toward.length_squared() > 0.01:
			var speed_scale := 0.58 + 0.42 * sin(age * 2.7 + phase_seed)
			global_position += toward.normalized() * drift_speed * maxf(speed_scale, 0.16) * delta

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
	for index in range(11):
		var mesh_instance := MeshInstance3D.new()
		mesh_instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON

		var tube := TubeTrailMesh.new()
		tube.radial_steps = 8
		tube.sections = rng.randi_range(5, 9)
		tube.section_rings = 3
		tube.section_length = rng.randf_range(0.24, 0.48)
		tube.radius = rng.randf_range(0.035, 0.13)
		tube.cap_bottom = true
		tube.cap_top = true

		var taper := Curve.new()
		taper.add_point(Vector2(0.0, rng.randf_range(0.08, 0.35)))
		taper.add_point(Vector2(rng.randf_range(0.12, 0.32), rng.randf_range(0.75, 1.0)))
		taper.add_point(Vector2(rng.randf_range(0.58, 0.78), rng.randf_range(0.28, 0.78)))
		taper.add_point(Vector2(1.0, rng.randf_range(0.0, 0.18)))
		tube.curve = taper
		mesh_instance.mesh = tube

		var material := ShaderMaterial.new()
		material.shader = SURFACE_SHADER
		material.set_shader_parameter("seed", phase_seed + float(index) * 1.731)
		material.set_shader_parameter("agitation", rng.randf_range(0.45, 1.2))
		mesh_instance.material_override = material

		add_child(mesh_instance)
		pieces.append(mesh_instance)

func _reshuffle_shape() -> void:
	for index in range(pieces.size()):
		var piece := pieces[index]
		var radial := rng.randf_range(0.12, 1.3)
		var angle := rng.randf_range(-PI, PI)
		piece.position = Vector3(cos(angle) * radial, rng.randf_range(-1.4, 1.7), sin(angle) * radial)
		piece.rotation = Vector3(
			rng.randf_range(-PI, PI),
			rng.randf_range(-PI, PI),
			rng.randf_range(-PI, PI)
		)
		var long_axis := rng.randf_range(0.75, 1.85)
		piece.scale = Vector3(rng.randf_range(0.72, 1.15), long_axis, rng.randf_range(0.72, 1.15))

func _animate_surface(delta: float) -> void:
	if not manifested:
		return
	for index in range(pieces.size()):
		var piece := pieces[index]
		var speed := 0.08 + float(index % 4) * 0.035
		piece.rotation.x += delta * speed * sin(phase_seed + float(index) * 1.9)
		piece.rotation.y += delta * speed * 0.7 * cos(phase_seed * 0.7 + float(index))
		piece.rotation.z += delta * speed * 0.45

func _set_manifested(value: bool) -> void:
	manifested = value
	for piece in pieces:
		piece.visible = value

func _choose_reentry_position() -> void:
	if not is_instance_valid(target):
		return
	var angle := rng.randf_range(-PI, PI)
	var distance := rng.randf_range(reentry_min_distance, reentry_max_distance)
	var offset := Vector3(cos(angle) * distance, rng.randf_range(0.6, 2.9), sin(angle) * distance)
	global_position = target.global_position + offset
