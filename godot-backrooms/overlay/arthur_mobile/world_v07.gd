extends "res://arthur_mobile/world_v06.gd"

const YellowDecorV07Script = preload("res://arthur_mobile/yellow_decor_v07.gd")
const YELLOW_WALL_FIXTURE: PackedScene = preload("res://arthur_mobile/yellow_wall_fixture.tscn")

func _ready() -> void:
	super._ready()
	yellow_decor = YellowDecorV07Script.new()

func _biome_ambient_energy(biome: int) -> float:
	if biome == BIOME_YELLOW:
		return 0.94
	return super._biome_ambient_energy(biome)

func _biome_light_energy(biome: int) -> float:
	if biome == BIOME_YELLOW:
		return 1.58
	return super._biome_light_energy(biome)

func _biome_fog_density(biome: int) -> float:
	if biome == BIOME_YELLOW:
		return 0.0064
	return super._biome_fog_density(biome)

func _update_atmosphere(delta: float) -> void:
	super._update_atmosphere(delta)
	var sample: Dictionary = _biome_sample_at_world(player.global_position)
	var primary: int = int(sample["primary"])
	var secondary: int = int(sample["secondary"])
	var weight: float = float(sample["weight"])
	var target: float = lerpf(_biome_exposure(primary), _biome_exposure(secondary), weight)
	var environment: Environment = world_environment.environment
	environment.tonemap_exposure = lerpf(environment.tonemap_exposure, target, clampf(delta * 1.5, 0.0, 1.0))

func _biome_exposure(biome: int) -> float:
	if biome == BIOME_YELLOW:
		return 1.58
	if biome == BIOME_POOL:
		return 1.08
	return 1.05

func _add_light_for_cell(root: Node3D, cell: Vector2i, sample: Dictionary) -> void:
	var primary: int = int(sample["primary"])
	if primary != BIOME_YELLOW:
		super._add_light_for_cell(root, cell, sample)
		return

	var block: Vector2i = _plan_block_for_cell(cell)
	var mood: int = _hash(block.x, block.y, 5701) % 12
	var place := false

	if bool(yellow_plan.call("is_corridor", cell)):
		var divisor := 3
		if mood == 2 or mood == 6:
			divisor = 2
		elif mood == 3 or mood == 9:
			divisor = 5
		place = _hash(cell.x, cell.y, 4101) % divisor == 0
	elif bool(yellow_plan.call("is_room_anchor", cell)):
		var info: Dictionary = yellow_plan.call("room_info", cell) as Dictionary
		var area: int = int(info.get("width", 1)) * int(info.get("height", 1))
		if area >= 2:
			place = true
			if mood == 3 or mood == 9:
				place = _hash(cell.x, cell.y, 5731) % 3 != 0

	if not place:
		return

	var fixture: Node3D = LIGHT.instantiate()
	fixture.rotation.y = float(_hash(cell.x, cell.y, 4111) & 1) * PI * 0.5
	var spot: SpotLight3D = fixture.get_node_or_null("SpotLight3D") as SpotLight3D
	if spot != null:
		var target_color: Color = _biome_light_color(BIOME_YELLOW)
		var target_energy: float = _biome_light_energy(BIOME_YELLOW)

		if mood == 0:
			target_color = target_color.lerp(Color(0.76, 1.0, 0.68, 1.0), 0.48)
			target_energy *= 0.86
		elif mood == 1:
			target_color = target_color.lerp(Color(1.0, 0.74, 0.43, 1.0), 0.44)
			target_energy *= 0.9
		elif mood == 2:
			target_color = target_color.lerp(Color(1.0, 0.995, 0.92, 1.0), 0.58)
			target_energy *= 1.18
		elif mood == 3:
			target_color = target_color.lerp(Color(0.85, 0.91, 0.68, 1.0), 0.24)
			target_energy *= 0.48
		elif mood == 4:
			target_color = target_color.lerp(Color(0.9, 1.0, 0.78, 1.0), 0.28)
		elif mood == 5:
			target_color = target_color.lerp(Color(1.0, 0.86, 0.58, 1.0), 0.24)
		elif mood == 6:
			target_color = target_color.lerp(Color(0.92, 0.96, 1.0, 1.0), 0.36)
			target_energy *= 1.08
		elif mood == 9:
			target_energy *= 0.62

		var fixture_roll: int = _hash(cell.x, cell.y, 5723)
		if fixture_roll % 29 == 0:
			target_energy *= 0.2
		elif fixture_roll % 17 == 0:
			target_color = target_color.lerp(Color(0.72, 1.0, 0.66, 1.0), 0.34)
			target_energy *= 0.68
		elif fixture_roll % 13 == 0:
			target_color = target_color.lerp(Color(1.0, 0.8, 0.49, 1.0), 0.28)

		spot.light_color = target_color
		spot.light_energy = target_energy
	root.add_child(fixture)

func _add_yellow_content(root: Node3D, cell: Vector2i, sample: Dictionary) -> void:
	super._add_yellow_content(root, cell, sample)
	_add_yellow_wall_light(root, cell)

func _add_yellow_wall_light(root: Node3D, cell: Vector2i) -> void:
	var roll: int = _hash(cell.x, cell.y, 5901)
	if roll % 19 != 0:
		return

	var west_kind: int = _topology_edge(cell, cell + Vector2i(-1, 0))
	var north_kind: int = _topology_edge(cell, cell + Vector2i(0, -1))
	var use_west: bool = west_kind == EDGE_SOLID and (north_kind != EDGE_SOLID or ((roll >> 3) & 1) == 0)
	var use_north: bool = north_kind == EDGE_SOLID and not use_west
	if not use_west and not use_north:
		return

	var fixture: Node3D = YELLOW_WALL_FIXTURE.instantiate() as Node3D
	if use_west:
		fixture.position = Vector3(-1.82, 2.18, 0.0)
		fixture.rotation.y = PI * 0.5
	else:
		fixture.position = Vector3(0.0, 2.18, -1.82)
		fixture.rotation.y = 0.0

	var omni: OmniLight3D = fixture.get_node_or_null("OmniLight3D") as OmniLight3D
	if omni != null:
		var tone: int = (roll >> 5) % 5
		if tone == 0:
			omni.light_color = Color(1.0, 0.76, 0.45, 1.0)
			omni.light_energy = 0.92
		elif tone == 1:
			omni.light_color = Color(0.75, 1.0, 0.72, 1.0)
			omni.light_energy = 0.78
		elif tone == 2:
			omni.light_color = Color(0.9, 0.94, 1.0, 1.0)
			omni.light_energy = 1.08
		elif tone == 3:
			omni.light_color = Color(1.0, 0.91, 0.62, 1.0)
			omni.light_energy = 0.48
		else:
			omni.light_color = Color(1.0, 0.9, 0.62, 1.0)
			omni.light_energy = 0.86
	root.add_child(fixture)
