extends Node3D

var panels: Array[Node3D] = []
var upper_materials: Array[StandardMaterial3D] = []
var lower_materials: Array[StandardMaterial3D] = []
var accent_materials: Array[StandardMaterial3D] = []
var flutter_time := 0.0

func _ready() -> void:
	for child in get_children():
		if child is Node3D:
			panels.append(child)

func _process(delta: float) -> void:
	flutter_time += delta
	for index in range(panels.size()):
		var panel := panels[index]
		var strength := 0.014 + float(index) * 0.018
		panel.rotation.y = sin(flutter_time * 3.0 - float(index) * 0.58) * strength
		panel.rotation.x = cos(flutter_time * 2.15 - float(index) * 0.47) * strength * 0.28
		panel.position.y = sin(flutter_time * 2.6 - float(index) * 0.65) * strength * 0.14

func configure_materials(uppers: Array[StandardMaterial3D], lowers: Array[StandardMaterial3D], accents: Array[StandardMaterial3D]) -> void:
	upper_materials = uppers
	lower_materials = lowers
	accent_materials = accents

func set_palette(upper: Color, lower: Color, accent: Color) -> void:
	for material in upper_materials:
		material.albedo_color = upper
	for material in lower_materials:
		material.albedo_color = lower
	for material in accent_materials:
		material.albedo_color = accent
