extends Node3D

var rng := RandomNumberGenerator.new()
var gate_arms: Array[AnimatableBody3D] = []
var gate_targets: Array[float] = []
var gate_open_angles: Array[float] = []
var gate_waits: Array[float] = []
var gate_speeds: Array[float] = []

var ghost_root: Node3D
var ghost_timer := 0.0
var ghost_phase := 0.0

var booth_concrete: StandardMaterial3D
var booth_dark: StandardMaterial3D
var booth_window: StandardMaterial3D
var barrier_white: StandardMaterial3D
var barrier_orange: StandardMaterial3D
var island_mat: StandardMaterial3D
var ghost_mat: StandardMaterial3D
var warm_emissive: StandardMaterial3D

func _ready() -> void:
	rng.randomize()
	_make_materials()
	_brighten_world()
	_build_broad_fill_lighting()
	_build_toll_plaza()

func _make_materials() -> void:
	booth_concrete = _mat(Color(0.50, 0.51, 0.48), 0.88)
	booth_dark = _mat(Color(0.12, 0.13, 0.13), 0.93)
	island_mat = _mat(Color(0.58, 0.56, 0.48), 0.82)
	barrier_white = _mat(Color(0.88, 0.86, 0.74), 0.64)
	barrier_orange = _emissive_mat(Color(0.90, 0.25, 0.055), 1.35)
	warm_emissive = _emissive_mat(Color(0.96, 0.72, 0.42), 1.15)

	booth_window = _mat(Color(0.045, 0.060, 0.064), 0.18)
	booth_window.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	booth_window.albedo_color.a = 0.57

	ghost_mat = _mat(Color(0.020, 0.024, 0.026), 0.95)
	ghost_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ghost_mat.albedo_color.a = 0.72
	ghost_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED

func _mat(color: Color, roughness: float) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	return material

func _emissive_mat(color: Color, energy: float) -> StandardMaterial3D:
	var material := _mat(color, 0.42)
	material.emission_enabled = true
	material.emission = color
	material.emission_energy_multiplier = energy
	return material

func _brighten_world() -> void:
	var world_environment := get_node_or_null("../WorldEnvironment") as WorldEnvironment
	if world_environment == null or world_environment.environment == null:
		return
	var environment := world_environment.environment
	environment.background_color = Color(0.075, 0.080, 0.075, 1.0)
	environment.ambient_light_color = Color(0.76, 0.79, 0.72, 1.0)
	environment.ambient_light_energy = 0.62
	environment.fog_light_color = Color(0.55, 0.60, 0.56, 1.0)
	environment.fog_light_energy = 0.62
	environment.fog_density = 0.0016

func _build_broad_fill_lighting() -> void:
	# Broad, shadowless ceiling fill keeps the garage readable on mobile. Existing fixtures still provide local pools.
	for z in [-20.0, 0.0, 20.0]:
		for x in [-23.0, 0.0, 23.0]:
			_fill_light(Vector3(x, 2.85, z), Color(0.90, 0.94, 0.86), 0.92, 15.0)

	for z in [-38.0, -56.0, -74.0, -92.0, -111.0, -124.0]:
		_fill_light(Vector3(0, 3.0, z), Color(0.88, 0.93, 0.84), 0.95, 14.0)

func _fill_light(pos: Vector3, color: Color, energy: float, range_m: float) -> void:
	var light := OmniLight3D.new()
	light.position = pos
	light.light_color = color
	light.light_energy = energy
	light.omni_range = range_m
	light.shadow_enabled = false
	light.distance_fade_enabled = true
	light.distance_fade_begin = 20.0
	light.distance_fade_length = 10.0
	add_child(light)

func _build_toll_plaza() -> void:
	var plaza_z := -43.8

	# Center island creates two natural car lanes without widening or otherwise modifying the roadway.
	_solid_box("TollIsland", Vector3(0, 0.10, plaza_z), Vector3(3.15, 0.20, 6.6), island_mat)
	_solid_box("BoothLower", Vector3(0, 0.72, plaza_z), Vector3(2.60, 1.25, 4.15), booth_concrete)
	_solid_box("BoothRoof", Vector3(0, 2.43, plaza_z), Vector3(2.90, 0.24, 4.45), booth_dark)

	# Dark glass on all sides. It remains physical, but the attendant behind it never resolves into detail.
	_solid_box("BoothWindowFront", Vector3(0, 1.70, plaza_z + 2.04), Vector3(2.48, 1.18, 0.10), booth_window)
	_solid_box("BoothWindowBack", Vector3(0, 1.70, plaza_z - 2.04), Vector3(2.48, 1.18, 0.10), booth_window)
	_solid_box("BoothWindowLeft", Vector3(-1.26, 1.70, plaza_z), Vector3(0.10, 1.18, 3.96), booth_window)
	_solid_box("BoothWindowRight", Vector3(1.26, 1.70, plaza_z), Vector3(0.10, 1.18, 3.96), booth_window)

	# Chunky corner posts keep the booth readable as architecture rather than a glass cube.
	for x in [-1.28, 1.28]:
		for z_offset in [-2.05, 2.05]:
			_solid_box("BoothPost", Vector3(x, 1.66, plaza_z + z_offset), Vector3(0.18, 1.50, 0.18), booth_dark)

	# Tiny counter and ticket/light blocks imply ordinary parking-garage function in an otherwise impossible place.
	_solid_box("BoothCounter", Vector3(0, 1.10, plaza_z + 1.45), Vector3(2.15, 0.12, 0.48), booth_dark)
	_visual_box(Vector3(-0.66, 2.20, plaza_z + 2.11), Vector3(0.42, 0.18, 0.08), warm_emissive)
	_visual_box(Vector3(0.66, 2.20, plaza_z + 2.11), Vector3(0.42, 0.18, 0.08), barrier_orange)

	# Backlight makes the shape in the tinted booth visible without giving it a face.
	_fill_light(Vector3(0, 1.95, plaza_z - 0.65), Color(0.92, 0.72, 0.50), 0.72, 4.0)
	_build_ghost_attendant(Vector3(0, 0, plaza_z))

	# Two independent physical barrier arms. Cars have to wait, time the cycle, or hit them.
	_make_gate(-1.0, Vector3(-1.52, 1.02, plaza_z + 3.45))
	_make_gate(1.0, Vector3(1.52, 1.02, plaza_z + 3.45))

	# Bright approach lighting makes the plaza feel like functioning infrastructure, not a black ambush room.
	_fill_light(Vector3(-4.2, 2.75, plaza_z + 5.4), Color(0.98, 0.94, 0.79), 1.15, 10.0)
	_fill_light(Vector3(4.2, 2.75, plaza_z + 5.4), Color(0.98, 0.94, 0.79), 1.15, 10.0)
	_fill_light(Vector3(0, 2.90, plaza_z - 4.2), Color(0.88, 0.93, 0.84), 1.05, 10.0)

func _make_gate(side: float, pivot_pos: Vector3) -> void:
	var arm := AnimatableBody3D.new()
	arm.name = "RandomBarrierArmLeft" if side < 0.0 else "RandomBarrierArmRight"
	arm.position = pivot_pos
	arm.collision_layer = 1
	arm.collision_mask = 3
	arm.sync_to_physics = true

	var arm_length := 6.15
	var arm_mesh := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(arm_length, 0.16, 0.16)
	arm_mesh.mesh = mesh
	arm_mesh.material_override = barrier_white
	arm_mesh.position.x = side * arm_length * 0.5
	arm.add_child(arm_mesh)

	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(arm_length, 0.22, 0.22)
	collision.shape = shape
	collision.position.x = side * arm_length * 0.5
	arm.add_child(collision)

	# Emissive orange bands remain visible while the arm is moving.
	for stripe_index in range(5):
		var stripe := MeshInstance3D.new()
		var stripe_mesh := BoxMesh.new()
		stripe_mesh.size = Vector3(0.34, 0.19, 0.19)
		stripe.mesh = stripe_mesh
		stripe.material_override = barrier_orange
		stripe.position.x = side * (0.80 + stripe_index * 1.05)
		arm.add_child(stripe)

	add_child(arm)

	var open_angle := side * deg_to_rad(82.0)
	if rng.randf() > 0.5:
		arm.rotation.z = open_angle
		gate_targets.append(0.0)
	else:
		arm.rotation.z = 0.0
		gate_targets.append(open_angle)
	gate_arms.append(arm)
	gate_open_angles.append(open_angle)
	gate_waits.append(rng.randf_range(0.25, 1.80))
	gate_speeds.append(rng.randf_range(0.75, 1.45))

	# Gate pedestal and a tiny warning lamp.
	_solid_box("GatePedestal", Vector3(pivot_pos.x, 0.55, pivot_pos.z), Vector3(0.54, 1.10, 0.62), booth_dark)
	_visual_box(Vector3(pivot_pos.x, 1.16, pivot_pos.z), Vector3(0.34, 0.18, 0.34), barrier_orange)

func _build_ghost_attendant(base_pos: Vector3) -> void:
	ghost_root = Node3D.new()
	ghost_root.name = "UnresolvedAttendantShadow"
	ghost_root.position = base_pos + Vector3(0, 0.46, 0.20)
	add_child(ghost_root)

	# Deliberately crude anatomy: enough to read as someone moving behind glass, never enough to identify.
	_mesh_box(ghost_root, Vector3(-0.08, 0.84, 0.0), Vector3(0.70, 1.20, 0.34), ghost_mat)
	_mesh_box(ghost_root, Vector3(0.22, 0.92, -0.05), Vector3(0.42, 0.72, 0.30), ghost_mat)

	var head := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.22
	sphere.height = 0.44
	head.mesh = sphere
	head.material_override = ghost_mat
	head.position = Vector3(-0.06, 1.56, 0.0)
	ghost_root.add_child(head)

	ghost_timer = rng.randf_range(0.08, 0.28)

func _physics_process(delta: float) -> void:
	for index in range(gate_arms.size()):
		var arm := gate_arms[index]
		gate_waits[index] -= delta
		if gate_waits[index] > 0.0:
			continue

		var target := gate_targets[index]
		arm.rotation.z = move_toward(arm.rotation.z, target, gate_speeds[index] * delta)
		if absf(arm.rotation.z - target) <= 0.018:
			arm.rotation.z = target
			gate_waits[index] = rng.randf_range(0.35, 2.35)
			gate_speeds[index] = rng.randf_range(0.70, 1.55)
			if absf(target) < 0.10:
				gate_targets[index] = gate_open_angles[index]
			else:
				gate_targets[index] = 0.0

func _process(delta: float) -> void:
	if ghost_root == null:
		return
	ghost_phase += delta
	ghost_root.position.x = sin(ghost_phase * 0.72) * 0.30 + sin(ghost_phase * 2.45) * 0.055
	ghost_root.position.z = -43.60 + cos(ghost_phase * 0.49) * 0.31
	ghost_root.rotation.y = sin(ghost_phase * 0.61) * 0.16

	ghost_timer -= delta
	if ghost_timer <= 0.0:
		ghost_timer = rng.randf_range(0.07, 0.32)
		ghost_root.visible = rng.randf() > 0.17
		var stretch := rng.randf_range(0.94, 1.06)
		ghost_root.scale = Vector3(rng.randf_range(0.96, 1.04), stretch, 1.0)

func _solid_box(node_name: String, pos: Vector3, size: Vector3, material: Material) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.name = node_name
	body.position = pos
	body.collision_layer = 1
	body.collision_mask = 3

	var mesh_instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh_instance.mesh = mesh
	mesh_instance.material_override = material
	body.add_child(mesh_instance)

	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collision.shape = shape
	body.add_child(collision)

	add_child(body)
	return body

func _visual_box(pos: Vector3, size: Vector3, material: Material) -> MeshInstance3D:
	var mesh_instance := MeshInstance3D.new()
	mesh_instance.position = pos
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh_instance.mesh = mesh
	mesh_instance.material_override = material
	add_child(mesh_instance)
	return mesh_instance

func _mesh_box(parent: Node3D, pos: Vector3, size: Vector3, material: Material) -> MeshInstance3D:
	var mesh_instance := MeshInstance3D.new()
	mesh_instance.position = pos
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh_instance.mesh = mesh
	mesh_instance.material_override = material
	parent.add_child(mesh_instance)
	return mesh_instance
