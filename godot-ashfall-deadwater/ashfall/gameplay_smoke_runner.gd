extends Node

func _ready() -> void:
	call_deferred("_run")

func _fail(message: String) -> void:
	print("::error::ASHFALL GAMEPLAY SMOKE FAILED: " + message)
	printerr("ASHFALL GAMEPLAY SMOKE FAILED: " + message)
	get_tree().quit(1)

func _check(condition: bool, message: String) -> bool:
	if not condition:
		_fail(message)
		return false
	return true

func _stage(message: String) -> void:
	print("ASHFALL TEST: " + message)

func _run() -> void:
	_stage("load main")
	var packed: PackedScene = load("res://ashfall/main.tscn")
	if not _check(packed != null, "main scene did not load"): return
	var game = packed.instantiate()
	add_child(game)
	await get_tree().process_frame
	await get_tree().physics_frame

	_stage("start game")
	game._start_game()
	await get_tree().process_frame
	var player = game._player
	if not _check(is_instance_valid(player), "player missing"): return
	if not _check(player.current_weapon_id == "carbine", "carbine not equipped at start"): return

	_stage("weapon roster")
	for id in ["smg", "shotgun", "marksman", "lmg", "harpoon", "arc"]:
		if not _check(player.give_weapon(id), "failed to give " + id): return
	if not _check(player.weapon_slots.size() == 7, "full weapon roster did not populate"): return
	var before_level: int = int(player.current_weapon_level())
	player.upgrade_current_weapon()
	if not _check(player.current_weapon_level() == before_level + 1, "forge level did not advance"): return
	if not _check(player.swap_weapon(), "weapon swap failed"): return

	_stage("vehicle enter and exit")
	game.score = 99999
	var first_vehicle = game._vehicles[0]
	player.global_position = first_vehicle.global_position + Vector3(2.0, 0.0, 0.0)
	game.request_use()
	if not _check(player.is_in_vehicle(), "vehicle entry failed"): return
	first_vehicle.drive(Vector2(0.0, 1.0), 0.12)
	game.request_use()
	if not _check(not player.is_in_vehicle(), "vehicle exit failed"): return

	_stage("infected combat")
	var kills_before: int = int(game.kills)
	game._spawn_zombie()
	await get_tree().physics_frame
	if not _check(game._zombies.size() > 0, "zombie did not spawn"): return
	var zombie = game._zombies[game._zombies.size() - 1]
	zombie.take_bullet(999999.0, zombie.global_position + Vector3(0.0, 1.6, 0.0), 1.0)
	await get_tree().process_frame
	if not _check(game.kills == kills_before + 1, "zombie kill did not register"): return

	_stage("weapon locker")
	player.global_position = Vector3(112.0, 0.2, 84.0)
	game.score = 99999
	game.request_use()
	if not _check(player.has_weapon("smg"), "weapon locker interaction failed"): return

	print("ASHFALL GAMEPLAY SMOKE PASSED")
	get_tree().quit(0)
