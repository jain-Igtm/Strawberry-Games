extends StaticBody3D

var fuel := 72.0
var burning := true
var glow: OmniLight3D
var ember: MeshInstance3D

func _ready() -> void:
	add_to_group("heater")
	glow = get_node_or_null("Glow") as OmniLight3D
	ember = get_node_or_null("Ember") as MeshInstance3D
	_update_visuals()

func _process(delta: float) -> void:
	if burning:
		fuel = maxf(0.0, fuel - delta * 0.030)
		if fuel <= 0.0:
			burning = false
			_update_visuals()

func interact(player: Node) -> void:
	if burning:
		burning = false
		_update_visuals()
		_notify(player, "Diesel heater shut down.")
	elif fuel > 0.05:
		burning = true
		_update_visuals()
		_notify(player, "Diesel heater started.")
	else:
		_notify(player, "The heater tank is empty.")

func get_interaction_prompt() -> String:
	if burning:
		return "Shut down diesel heater"
	if fuel > 0.05:
		return "Start diesel heater"
	return "Heater needs fuel"

func add_fuel(amount: float) -> bool:
	if fuel >= 99.5:
		return false
	fuel = minf(100.0, fuel + amount)
	return true

func get_heat_strength(world_position: Vector3) -> float:
	if not burning:
		return 0.0
	var distance := global_position.distance_to(world_position)
	return clampf(1.0 - distance / 5.8, 0.0, 1.0)

func _update_visuals() -> void:
	if glow != null:
		glow.visible = burning
	if ember != null:
		var material := ember.material_override as StandardMaterial3D
		if material == null:
			material = ember.get_active_material(0) as StandardMaterial3D
		if material != null:
			material.emission_enabled = burning
			material.emission_energy_multiplier = 2.8 if burning else 0.0

func _notify(player: Node, message: String) -> void:
	if player != null and player.has_method("show_status_message"):
		player.call("show_status_message", message)
