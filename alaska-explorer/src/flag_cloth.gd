extends Node3D

var panels: Array[Node3D] = []
var upper_materials: Array[StandardMaterial3D] = []
var lower_materials: Array[StandardMaterial3D] = []
var flutter_time := 0.0

func _ready() -> void:
	for child in get_children():
		if child is Node3D:
			panels.append(child)

func _process(delta: float) -> void:
	flutter_time += delta
	for index in range(panels.size()):
		var panel := panels[index]
		var strength := 0.025 + float(index) * 0.026
		panel.rotation.y = sin(flutter_time * 3.1 - float(index) * 0.72) * strength
		panel.rotation.x = cos(flutter_time * 2.2 - float(index) * 0.54) * strength * 0.34

func configure_materials(uppers: Array[StandardMaterial3D], lowers: Array[StandardMaterial3D]) -> void:
	upper_materials = uppers
	lower_materials = lowers

func set_palette(upper: Color, lower: Color) -> void:
	for material in upper_materials:
		material.albedo_color = upper
	for material in lower_materials:
		material.albedo_color = lower

