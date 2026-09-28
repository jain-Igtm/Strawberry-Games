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
	var boat := game.get_node_or_null("GeneratedWorld/CabinBoat")
	var helm := game.get_node_or_null("GeneratedWorld/CabinBoat/Helm")
	var cabin_door := game.get_node_or_null("GeneratedWorld/CabinBoat/CabinDoor")
	var gangway := game.get_node_or_null("GeneratedWorld/ShoreGangway")
	var river_audio := game.get_node_or_null("GeneratedWorld/RiverAmbience")
	var wind_audio := game.get_node_or_null("GeneratedWorld/WinterWindAmbience")
	var dog := game.get_node_or_null("GeneratedWorld/Dog")
	var environment_cycle := game.get_node_or_null("GeneratedWorld/EnvironmentCycle")
	_expect(player != null, "player exists")
	_expect(heater != null, "diesel heater exists")
	_expect(food != null and fuel != null, "finite cabin supplies exist")
	_expect(game.get_node_or_null("GeneratedWorld/SnowValley") != null, "snow terrain generated")
	_expect(game.get_node_or_null("GeneratedWorld/WinterRiver") != null, "river generated")
	_expect(boat != null and helm != null, "controllable cabin boat and helm generated")
	_expect(cabin_door != null, "hinged cabin door generated")
	_expect(dog != null and str(dog.call("get_interaction_prompt")) == "Pet dog", "pet dog companion generated and interactable")
	_expect(environment_cycle != null, "day night and weather controller generated")
	_expect(boat != null and boat.get_node_or_null("SternBoardingRamp") != null and boat.get_node_or_null("SternBoardingPlatform") != null, "stern reboarding route generated")
	if boat != null and helm != null:
		var bunk := boat.get_node_or_null("BunkFrame")
		_expect(bunk != null and absf(bunk.position.z - helm.position.z) > 1.1, "helm is physically separated from the bunk")
	_expect(river_audio != null and river_audio.stream != null and bool(river_audio.stream.get("loop")) and river_audio.playing, "river ambience loops in the world")
	_expect(wind_audio != null and wind_audio.stream != null and bool(wind_audio.stream.get("loop")) and wind_audio.playing, "winter wind ambience loops in the world")
	var ground_query := PhysicsRayQueryParameters3D.create(Vector3(30.0, 20.0, 4.85), Vector3(30.0, -20.0, 4.85), 1)
	var ground_hit: Dictionary = game.get_world_3d().direct_space_state.intersect_ray(ground_query)
	var ground_normal: Vector3 = ground_hit.get("normal", Vector3.ZERO)
	_expect(not ground_hit.is_empty() and ground_normal.y > 0.8, "snow terrain collision faces upward")
	if player != null:
		for _frame in range(18):
			await physics_frame
		_expect(player.global_position.y > 1.9 and player.global_position.y < 2.6, "player settles safely on the boat deck")
		player.call("_update_interaction")
		_expect(str(player.get("interaction_prompt")) == "Open cabin door", "cabin door is reachable with the use control")
		if cabin_door != null:
			_expect(not bool(cabin_door.get("is_open")), "cabin door starts secured")
			cabin_door.call("interact", player)
			for _frame in range(32):
				await physics_frame
			_expect(bool(cabin_door.get("is_open")) and absf(cabin_door.rotation.y) > 1.5, "cabin door opens on its hinge")
		player.call("set_mobile_move", Vector2(0.0, -1.0))
		for _frame in range(46):
			await physics_frame
		player.call("set_mobile_move", Vector2.ZERO)
		player.call("_update_environment")
		var doorway_sample: Dictionary = game.call("get_survival_environment", player.global_position)
		_expect(bool(doorway_sample.get("inside_cabin", false)), "opened cabin doorway is traversable")
		_expect(not bool(player.get("sheltered")), "open cabin door admits the winter wind")
		if cabin_door != null:
			cabin_door.call("interact", player)
			for _frame in range(32):
				await physics_frame
			player.call("_update_environment")
			_expect(not bool(cabin_door.get("is_open")) and bool(player.get("sheltered")), "closed cabin door restores shelter")
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
		var shore_start_x: float = player.global_position.x
		player.call("set_mobile_move", Vector2(1.0, 0.0))
		for _frame in range(80):
			await physics_frame
		player.call("set_mobile_move", Vector2.ZERO)
		for _frame in range(8):
			await physics_frame
		var terrain_y := float(game.call("_terrain_height", player.global_position.x, player.global_position.z))
		print("[SMOKE INFO] shore walk ", player.global_position, " terrain_y=", terrain_y, " floor=", player.is_on_floor())
		_expect(player.global_position.x > shore_start_x + 2.0, "player can walk across the snow terrain")
		_expect(player.is_on_floor() and absf(player.global_position.y - (terrain_y + 0.9)) < 1.1, "terrain mesh has dependable walkable collision")

	if environment_cycle != null:
		var time_before := str(environment_cycle.call("get_time_string"))
		environment_cycle.call("_process", 10.0)
		var time_after := str(environment_cycle.call("get_time_string"))
		_expect(time_before != time_after, "day night clock advances")
		var weather_before := str(environment_cycle.call("get_weather_name"))
		environment_cycle.set("weather_elapsed", 999.0)
		environment_cycle.call("_process", 0.1)
		var weather_after := str(environment_cycle.call("get_weather_name"))
		_expect(weather_before != weather_after, "weather cycle changes conditions")

	if player != null and boat != null:
		player.global_position = boat.to_global(Vector3(0.0, 1.22, 8.30))
		player.velocity = Vector3.ZERO
		player.rotation.y = boat.rotation.y
		player.call("set_mobile_move", Vector2(0.0, -1.0))
		for _frame in range(95):
			await physics_frame
		player.call("set_mobile_move", Vector2.ZERO)
		var boarded_local: Vector3 = boat.to_local(player.global_position)
		print("[SMOKE INFO] reboard local ", boarded_local, " floor=", player.is_on_floor())
		_expect(boarded_local.z < 6.65 and boarded_local.y > 1.85, "stern ramp lets the player climb back onto the boat")

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

	if player != null and boat != null and helm != null:
		var boat_start: Vector3 = boat.global_position
		var door_start: Vector3 = cabin_door.global_position if cabin_door != null else Vector3.ZERO
		helm.call("interact", player)
		await physics_frame
		_expect(player.get("piloting_boat") == boat, "helm puts the player in control of the boat")
		_expect(gangway != null and not gangway.visible, "casting off retracts the shore gangway")
		player.call("set_mobile_move", Vector2(0.42, -1.0))
		for _frame in range(180):
			await physics_frame
		player.call("set_mobile_move", Vector2.ZERO)
		var travelled: float = boat.global_position.distance_to(boat_start)
		var channel_offset := absf(boat.global_position.x - float(game.call("_river_center", boat.global_position.z)))
		var channel_limit := float(game.call("_river_half_width", boat.global_position.z)) - 7.1
		print("[SMOKE INFO] boat travelled=", travelled, " yaw=", boat.rotation.y, " speed=", boat.call("get_speed_mps"), " helm_gap=", player.global_position.distance_to(boat.get_node("HelmSeat").global_position))
		_expect(travelled > 3.0 and absf(boat.rotation.y) > 0.08, "boat responds to throttle and steering")
		_expect(channel_offset <= channel_limit, "boat remains inside the navigable river channel")
		var helm_seat := boat.get_node_or_null("HelmSeat")
		_expect(helm_seat != null and player.global_position.distance_to(helm_seat.global_position) < 0.08, "player remains securely at the moving helm")
		_expect(cabin_door == null or cabin_door.global_position.distance_to(door_start) > 3.0, "cabin door travels with the boat")
		var moving_cabin_sample: Dictionary = game.call("get_survival_environment", boat.to_global(Vector3(0.0, 2.3, 0.0)))
		_expect(bool(moving_cabin_sample.get("sheltered", false)), "cabin shelter follows the moving boat")
		player.call("request_interact")
		await physics_frame
		_expect(player.get("piloting_boat") == null and player.collision_layer == 2, "player can leave the helm safely")
		for _frame in range(90):
			await physics_frame
		var exit_local: Vector3 = boat.to_local(player.global_position)
		_expect(absf(exit_local.x) < 1.85 and absf(exit_local.z) < 2.85 and player.is_on_floor(), "moving deck carries the player after leaving the helm")

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
