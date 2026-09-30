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
	var boarding_ladder := game.get_node_or_null("GeneratedWorld/CabinBoat/BoardingLadder")
	var gangway := game.get_node_or_null("GeneratedWorld/ShoreGangway")
	var river_audio := game.get_node_or_null("GeneratedWorld/RiverAmbience")
	var wind_audio := game.get_node_or_null("GeneratedWorld/WinterWindAmbience")
	var dog := game.get_node_or_null("GeneratedWorld/Dog")
	var cabin_radio := game.get_node_or_null("GeneratedWorld/CabinBoat/CabinRadio")
	var flag_locker := game.get_node_or_null("GeneratedWorld/CabinBoat/FlagLocker")
	var hoisted_flag := game.get_node_or_null("GeneratedWorld/CabinBoat/HoistedFlag")
	var first_fuel_station := game.get_node_or_null("GeneratedWorld/FuelStop1/FuelPump")
	var first_flag_pickup := game.get_node_or_null("GeneratedWorld/FuelStop1/FlagPickup_raven")
	var environment_cycle := game.get_node_or_null("GeneratedWorld/EnvironmentCycle")
	var sun := game.get_node_or_null("GeneratedWorld/LowWinterSun") as DirectionalLight3D
	var winter_environment := game.get_node_or_null("GeneratedWorld/WinterEnvironment") as WorldEnvironment
	var snowfall := game.get_node_or_null("GeneratedWorld/FallingSnow") as GPUParticles3D
	_expect(player != null, "player exists")
	_expect(heater != null, "diesel heater exists")
	_expect(food != null and fuel != null, "finite cabin supplies exist")
	_expect(game.get_node_or_null("GeneratedWorld/SnowValley") != null, "snow terrain generated")
	_expect(game.get_node_or_null("GeneratedWorld/WinterRiver") != null, "river generated")
	_expect(boat != null and helm != null, "controllable cabin boat and helm generated")
	_expect(cabin_door != null, "hinged cabin door generated")
	_expect(boarding_ladder != null, "waterline boarding ladder generated")
	_expect(dog != null and str(dog.call("get_interaction_prompt")) == "Tell Scout to sit", "Scout is generated with a sit command")
	_expect(cabin_radio != null and flag_locker != null and hoisted_flag != null, "radio and working flag rig are installed aboard the Northstar")
	_expect(first_fuel_station != null and first_flag_pickup != null, "river fuel stops include refueling and collectible flags")
	var fuel_stop_positions: Array[float] = []
	for station_index in range(1, 5):
		var station := game.get_node_or_null("GeneratedWorld/FuelStop%d/FuelPump" % station_index)
		if station != null:
			fuel_stop_positions.append(station.global_position.z)
	_expect(fuel_stop_positions.size() == 4, "four fuel stations are distributed along the river")
	if fuel_stop_positions.size() == 4:
		fuel_stop_positions.sort()
		var minimum_spacing := INF
		for index in range(1, fuel_stop_positions.size()):
			minimum_spacing = minf(minimum_spacing, fuel_stop_positions[index] - fuel_stop_positions[index - 1])
		_expect(minimum_spacing > 150.0, "river fuel stations appear at useful travel intervals")
	_expect(environment_cycle != null, "day night and weather controller generated")
	_expect(sun != null and winter_environment != null and snowfall != null, "daylight and weather visuals are connected")
	_expect(boat != null and boat.get_node_or_null("SternBoardingRamp") != null and boat.get_node_or_null("SternBoardingPlatform") != null, "stern reboarding route generated")
	if boat != null and helm != null:
		var bunk := boat.get_node_or_null("BunkFrame")
		_expect(bunk != null and absf(bunk.position.z - helm.position.z) > 2.4, "helm is visibly separated from the bunk")
	_expect(river_audio != null and river_audio.stream != null and bool(river_audio.stream.get("loop")) and river_audio.playing, "river ambience loops in the world")
	_expect(wind_audio != null and wind_audio.stream != null and bool(wind_audio.stream.get("loop")) and wind_audio.playing, "winter wind ambience loops in the world")
	var ground_query := PhysicsRayQueryParameters3D.create(Vector3(30.0, 20.0, 4.85), Vector3(30.0, -20.0, 4.85), 1)
	var ground_hit: Dictionary = game.get_world_3d().direct_space_state.intersect_ray(ground_query)
	var ground_normal: Vector3 = ground_hit.get("normal", Vector3.ZERO)
	_expect(not ground_hit.is_empty() and ground_normal.y > 0.8, "snow terrain collision faces upward")

	if cabin_radio != null:
		_expect(not bool(cabin_radio.call("is_powered")), "cabin radio starts switched off")
		cabin_radio.call("interact", player)
		await process_frame
		var receiver := cabin_radio.get_node_or_null("ReceiverAudio") as AudioStreamPlayer3D
		_expect(bool(cabin_radio.call("is_powered")) and str(cabin_radio.call("get_frequency_text")) == "87.9", "radio tuning reaches the old-time music station")
		_expect(receiver != null and receiver.stream != null and receiver.playing, "radio broadcasts audible program audio")
		for _channel in range(int(cabin_radio.call("get_channel_count")) - 1):
			cabin_radio.call("interact", player)
		_expect(not bool(cabin_radio.call("is_powered")), "radio tuning includes a reliable off position")

	if first_flag_pickup != null and flag_locker != null:
		var flags_before := int(game.call("get_unlocked_flag_count"))
		first_flag_pickup.call("interact", player)
		_expect(int(game.call("get_unlocked_flag_count")) == flags_before + 1 and not first_flag_pickup.visible, "a discovered river flag is added to the collection")
		var flag_before := str(game.call("get_current_flag_name"))
		flag_locker.call("interact", player)
		_expect(str(game.call("get_current_flag_name")) != flag_before, "the cabin locker hoists a recovered flag")

	if player != null:
		for _frame in range(18):
			await physics_frame
		_expect(player.global_position.y > 1.9 and player.global_position.y < 2.6, "player settles safely on the boat deck")
		var swings_before := int(player.call("get_sword_swing_count"))
		player.call("request_attack")
		await process_frame
		_expect(int(player.call("get_sword_swing_count")) == swings_before + 1 and player.get_node_or_null("CameraPivot/Camera3D/Sword") != null, "player carries and can swing the sword")
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
			var nearby_door: Node = game.call("get_nearby_interactable", player.global_position) as Node
			_expect(nearby_door == cabin_door, "cabin door works nearby without exact aiming")
			cabin_door.call("interact", player)
			await physics_frame
			cabin_door.call("interact", player)
			for _frame in range(30):
				await physics_frame
			_expect(not bool(cabin_door.get("is_open")) and not bool(cabin_door.get("moving")), "cabin door reverses cleanly and remains responsive")
			cabin_door.call("interact", player)
			for _frame in range(32):
				await physics_frame
			player.global_position = boat.to_global(Vector3(0.0, 2.24, 2.30))
			player.velocity = Vector3.ZERO
			player.rotation.y = boat.rotation.y
			player.call("set_mobile_move", Vector2(0.0, -1.0))
			for _frame in range(60):
				await physics_frame
			player.call("set_mobile_move", Vector2.ZERO)
			var cabin_walk_local: Vector3 = boat.to_local(player.global_position)
			_expect(cabin_walk_local.z < -1.35 and absf(cabin_walk_local.x) < 0.45, "the cabin center aisle is fully walkable past the table")
			cabin_door.call("interact", player)
			for _frame in range(32):
				await physics_frame
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

	if dog != null and player != null:
		var dog_x := 28.0
		var dog_z := 4.85
		dog.global_position = Vector3(dog_x, float(game.call("_terrain_height", dog_x, dog_z)) + 0.85, dog_z)
		dog.velocity = Vector3.ZERO
		player.global_position = Vector3(30.5, float(game.call("_terrain_height", 30.5, dog_z)) + 0.92, dog_z)
		player.velocity = Vector3.ZERO
		for _frame in range(20):
			await physics_frame
		_expect(game.call("get_nearby_interactable", player.global_position) == dog, "Scout can be commanded without precise aiming")
		player.call("request_interact")
		_expect(bool(dog.get("is_sitting")), "Scout can be told to sit and stay")
		var sitting_position: Vector3 = dog.global_position
		player.global_position = Vector3(39.0, float(game.call("_terrain_height", 39.0, dog_z)) + 0.92, dog_z)
		player.velocity = Vector3.ZERO
		for _frame in range(45):
			await physics_frame
		_expect(dog.global_position.distance_to(sitting_position) < 0.35, "Scout stays still while the player moves away")
		player.global_position = sitting_position + Vector3(2.5, 0.1, 0.0)
		player.velocity = Vector3.ZERO
		await physics_frame
		player.call("request_interact")
		_expect(not bool(dog.get("is_sitting")), "Scout can be called back to follow")
		player.global_position = Vector3(39.0, float(game.call("_terrain_height", 39.0, dog_z)) + 0.92, dog_z)
		player.velocity = Vector3.ZERO
		for _frame in range(110):
			await physics_frame
		var dog_distance := Vector2(dog.global_position.x - player.global_position.x, dog.global_position.z - player.global_position.z).length()
		_expect(dog_distance > 2.6 and dog_distance < 6.0, "Scout follows at a comfortable distance")

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
		environment_cycle.set("time_of_day", 2.0)
		environment_cycle.call("_apply_environment")
		var night_energy := sun.light_energy if sun != null else 1.0
		environment_cycle.set("time_of_day", 12.5)
		environment_cycle.call("_apply_environment")
		var day_energy := sun.light_energy if sun != null else 0.0
		_expect(night_energy < 0.05 and day_energy > 0.35, "day night cycle changes natural light")
		environment_cycle.set("weather_index", 0)
		environment_cycle.call("_apply_environment")
		var clear_fog := winter_environment.environment.fog_density if winter_environment != null else 0.0
		var clear_chill := float(environment_cycle.call("get_wind_chill"))
		environment_cycle.set("weather_index", 3)
		environment_cycle.call("_apply_environment")
		_expect(snowfall == null or snowfall.amount >= 1200, "a squall thickens the snowfall")
		_expect(winter_environment == null or winter_environment.environment.fog_density > clear_fog * 3.0, "weather changes visibility")
		_expect(float(environment_cycle.call("get_wind_chill")) < clear_chill - 8.0, "weather changes survival exposure")
		environment_cycle.set("weather_index", 1)
		environment_cycle.set("time_of_day", 10.25)
		environment_cycle.call("_apply_environment")

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
		_expect(gangway != null and gangway.visible, "gangway stays available until throttle is applied")
		player.call("set_mobile_move", Vector2(0.42, -1.0))
		for _frame in range(5):
			await physics_frame
		_expect(gangway != null and not gangway.visible, "applying throttle retracts the gangway")
		for _frame in range(175):
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
		player.global_position = boat.to_global(Vector3(3.15, 0.65, 4.55))
		player.velocity = Vector3.ZERO
		await physics_frame
		var nearby_ladder: Node = game.call("get_nearby_interactable", player.global_position) as Node
		_expect(nearby_ladder == boarding_ladder, "boarding is available from the water without exact aiming")
		player.call("request_interact")
		await physics_frame
		var ladder_boarded_local: Vector3 = boat.to_local(player.global_position)
		_expect(ladder_boarded_local.y > 1.9 and absf(ladder_boarded_local.x) < 2.0 and absf(ladder_boarded_local.z) < 6.0, "waterline use reliably returns the player to the deck")

	if boat != null and first_fuel_station != null:
		boat.set("fuel", 55.0)
		boat.set("current_speed", float(boat.get("forward_speed")))
		boat.call("_consume_fuel", 4.0)
		_expect(float(boat.get("fuel")) < 53.0, "running the Northstar consumes vessel fuel")
		boat.set("current_speed", 0.0)
		var station_root := first_fuel_station.get_parent() as Node3D
		station_root.global_position = boat.global_position + Vector3(7.0, 0.0, 0.0)
		first_fuel_station.call("interact", player)
		_expect(float(boat.call("get_fuel_percent")) > 99.0, "a river fuel pump refills the Northstar alongside the dock")

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
