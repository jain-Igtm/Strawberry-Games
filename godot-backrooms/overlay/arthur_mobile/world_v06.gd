extends "res://arthur_mobile/world_v05.gd"

const YellowDecorV06Script = preload("res://arthur_mobile/yellow_decor_v06.gd")

func _ready() -> void:
	super._ready()
	yellow_decor = YellowDecorV06Script.new()

func _add_light_for_cell(root: Node3D, cell: Vector2i, sample: Dictionary) -> void:
	var primary: int = int(sample["primary"])
	var place := false
	if primary == BIOME_POOL and _pool_block_is_open(_plan_block_for_cell(cell)):
		place = ((cell.x & 1) == 0 and (cell.y & 1) == 0)
	elif bool(yellow_plan.call("is_corridor", cell)):
		place = _hash(cell.x, cell.y, 4101) % 3 == 0
	elif bool(yellow_plan.call("is_room_anchor", cell)):
		var info: Dictionary = yellow_plan.call("room_info", cell) as Dictionary
		place = int(info.get("width", 1)) * int(info.get("height", 1)) >= 2

	if not place:
		return

	var fixture: Node3D = LIGHT.instantiate()
	fixture.rotation.y = float(_hash(cell.x, cell.y, 4111) & 1) * PI * 0.5
	var spot: SpotLight3D = fixture.get_node_or_null("SpotLight3D") as SpotLight3D
	if spot != null:
		var secondary: int = int(sample["secondary"])
		var weight: float = float(sample["weight"])
		var target_color: Color = _biome_light_color(primary).lerp(_biome_light_color(secondary), weight)
		var target_energy: float = lerpf(_biome_light_energy(primary), _biome_light_energy(secondary), weight)

		if primary == BIOME_YELLOW:
			var block: Vector2i = _plan_block_for_cell(cell)
			var mood: int = _hash(block.x, block.y, 5701) % 12
			if mood == 0:
				target_color = target_color.lerp(Color(0.86, 1.0, 0.76, 1.0), 0.34)
				target_energy *= 0.88
			elif mood == 1:
				target_color = target_color.lerp(Color(1.0, 0.82, 0.53, 1.0), 0.32)
				target_energy *= 0.92
			elif mood == 2:
				target_color = target_color.lerp(Color(1.0, 0.985, 0.88, 1.0), 0.42)
				target_energy *= 1.10
			elif mood == 3:
				target_energy *= 0.76
			else:
				var trim: float = float(_hash(block.x, block.y, 5713) % 9 - 4) * 0.012
				target_energy *= 1.0 + trim

			var fixture_roll: int = _hash(cell.x, cell.y, 5723)
			if fixture_roll % 23 == 0:
				target_energy *= 0.52
			elif fixture_roll % 17 == 0:
				target_color = target_color.lerp(Color(0.93, 1.0, 0.82, 1.0), 0.22)
				target_energy *= 0.83

		spot.light_color = target_color
		spot.light_energy = target_energy
	root.add_child(fixture)
