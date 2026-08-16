extends Node3D

@onready var shell: MeshInstance3D = $Shell
@onready var glow: OmniLight3D = $Glow

var active := false
var expanded := false
var pulse := 0.0
var phase := 0.0

func _ready() -> void:
	visible = false
	set_process(false)

func set_active(value: bool) -> void:
	if value == active:
		return
	active = value
	visible = value
	set_process(value)
	if value:
		pulse = 1.0
		scale = Vector3.ONE * 0.18

func is_active() -> bool:
	return active

func set_expanded(value: bool) -> void:
	expanded = value
	if active:
		pulse = maxf(pulse, 0.45)

func toggle_expanded() -> bool:
	set_expanded(not expanded)
	return expanded

func is_expanded() -> bool:
	return expanded

func _process(delta: float) -> void:
	phase += delta
	pulse = maxf(0.0, pulse - delta * 2.4)
	var radius: float = 3.25 if expanded else 1.55
	var breathe: float = 1.0 + sin(phase * 1.8) * 0.018
	var pulse_scale: float = 1.0 + pulse * 0.12
	var target := Vector3.ONE * radius * breathe * pulse_scale
	scale = scale.lerp(target, clampf(delta * 8.5, 0.0, 1.0))
	rotation.y += delta * 0.08
	rotation.x = sin(phase * 0.31) * 0.035
	glow.light_energy = lerpf(glow.light_energy, 1.55 if expanded else 0.72, clampf(delta * 4.0, 0.0, 1.0))
	glow.omni_range = lerpf(glow.omni_range, 8.0 if expanded else 4.4, clampf(delta * 4.0, 0.0, 1.0))
