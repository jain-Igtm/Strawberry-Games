extends SceneTree

var failures: Array[String] = []

func _init() -> void:
	call_deferred("_run")

func _run() -> void:
	var packed := load("res://scenes/main.tscn") as PackedScene
	_expect(packed != null, "main scene loads")
	if packed == null:
		_finish()
		return

	var game := packed.instantiate()
	root.add_child(game)
	await process_frame
	await process_frame

	var player := game.get_node_or_null("Player")
	var heater := game.get_node_or_null("GeneratedWorld/CabinBoat/DieselHeater")
	var food := game.get_node_or_null("GeneratedWorld/CabinBoat/FoodRations")
	var fuel := game.get_node_or_null("GeneratedWorld/CabinBoat/DieselCans")
	_expect(player != null, "player exists")
	_expect(heater != null, "diesel heater exists")
	_expect(food != null and fuel != null, "finite cabin supplies exist")
	_expect(game.get_node_or_null("GeneratedWorld/SnowValley") != null, "snow terrain generated")
	_expect(game.get_node_or_null("GeneratedWorld/WinterRiver") != null, "river generated")
	_expect(game.get_node_or_null("GeneratedWorld/CabinBoat") != null, "cabin boat generated")
	if player != null:
		for _frame in range(18):
			await physics_frame
		_expect(player.global_position.y > 1.9 and player.global_position.y < 2.6, "player settles safely on the boat deck")
		player.call("set_mobile_move", Vector2(0.0, -1.0))
		for _frame in range(46):
			await physics_frame
		player.call("set_mobile_move", Vector2.ZERO)
		player.call("_update_environment")
		_expect(bool(player.get("sheltered")), "open cabin doorway is traversable")
		player.global_position = Vector3(8.0, 2.24, 4.85)
		player.velocity = Vector3.ZERO
		player.rotation = Vector3.ZERO
		player.call("set_mobile_sprint", true)
		player.call("set_mobile_move", Vector2(1.0, 0.0))
		for _frame in range(138):
			await physics_frame
		player.call("set_mobile_move", Vector2.ZERO)
		player.call("set_mobile_sprint", false)
		player.call("_update_environment")
		print("[SMOKE INFO] gangway endpoint ", player.global_position, " in_water=", player.get("in_water"))
		_expect(player.global_position.x > 18.0 and not bool(player.get("in_water")), "gangway provides a dry route to shore")

	var cabin_sample: Dictionary = game.call("get_survival_environment", Vector3(8.0, 2.3, 0.0))
	_expect(bool(cabin_sample.get("sheltered", false)), "cabin blocks the wind")
	_expect(float(cabin_sample.get("heat_strength", 0.0)) > 0.1, "running heater warms the cabin")

	var test_z := 120.0
	var river_x := float(game.call("_river_center", test_z))
	var river_sample: Dictionary = game.call("get_survival_environment", Vector3(river_x, -1.0, test_z))
	_expect(bool(river_sample.get("in_water", false)), "river immersion is detected")

	if player != null:
		player.set("hunger", 45.0)
		var food_before := int(food.get("remaining")) if food != null else 0
		if food != null:
			food.call("interact", player)
		_expect(float(player.get("hunger")) > 45.0, "food restores hunger")
		_expect(food == null or int(food.get("remaining")) == food_before - 1, "food is finite")

		player.global_position = Vector3(river_x, -1.0, test_z)
		player.call("_update_environment")
		var core_before := float(player.get("core_temperature"))
		player.call("_update_survival", 8.0)
		_expect(float(player.get("wetness")) > 90.0, "river rapidly saturates clothing")
		_expect(float(player.get("core_temperature")) < core_before, "river lowers core temperature")

	if heater != null:
		var original_state := bool(heater.get("burning"))
		heater.call("interact", player)
		_expect(bool(heater.get("burning")) != original_state, "heater can be shut down")
		heater.call("interact", player)
		_expect(bool(heater.get("burning")) == original_state, "heater can be restarted")
		var fuel_before := float(heater.get("fuel"))
		var cans_before := int(fuel.get("remaining")) if fuel != null else 0
		if fuel != null:
			fuel.call("interact", player)
		_expect(float(heater.get("fuel")) > fuel_before, "diesel can refuels heater")
		_expect(fuel == null or int(fuel.get("remaining")) == cans_before - 1, "diesel supply is finite")

	game.queue_free()
	await process_frame
	_finish()

func _expect(condition: bool, label: String) -> void:
	if condition:
		print("[SMOKE PASS] ", label)
	else:
		failures.append(label)
		push_error("[SMOKE FAIL] " + label)

func _finish() -> void:
	if failures.is_empty():
		print("[SMOKE PASS] Alaska Explorer survival slice")
		quit(0)
	else:
		push_error("Alaska Explorer smoke test failed: " + ", ".join(failures))
		quit(1)
