extends Node3D

var pickup_kind := "ammo"
var player: CharacterBody3D
var lifetime := 18.0
var amount := 0
var _phase := 0.0

func setup(kind_value: String, player_value: CharacterBody3D, amount_value: int) -> void:
	pickup_kind = kind_value
	player = player_value
	amount = amount_value

func _ready() -> void:
	_build_visual()

func _process(delta: float) -> void:
	lifetime -= delta
	_phase += delta
	rotation.y += delta * 1.8
	position.y = 0.48 + sin(_phase * 3.2) * 0.08
	if lifetime <= 0.0:
		queue_free()
		return
	if is_instance_valid(player) and global_position.distance_to(player.global_position) < 1.45:
		if pickup_kind == "health":
			player.heal(float(amount))
		else:
			player.add_reserve(amount)
		queue_free()

func _build_visual() -> void:
	var mesh_instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.72,0.46,0.72)
	mesh_instance.mesh = mesh
	var material := StandardMaterial3D.new()
	material.albedo_color = Color("#7f2f27") if pickup_kind == "health" else Color("#7b6334")
	material.emission_enabled = true
	material.emission = Color("#4c1816") if pickup_kind == "health" else Color("#453514")
	material.roughness = 0.72
	mesh_instance.material_override = material
	add_child(mesh_instance)
	var label := Label3D.new()
	label.text = "+HP" if pickup_kind == "health" else "+AMMO"
	label.font_size = 24
	label.outline_size = 5
	label.position = Vector3(0,0.55,0)
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.modulate = Color("#f1ddc6")
	add_child(label)
