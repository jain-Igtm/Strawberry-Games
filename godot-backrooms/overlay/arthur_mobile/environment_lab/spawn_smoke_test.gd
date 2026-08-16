extends SceneTree

const LAB_SCENE := preload("res://arthur_mobile/environment_lab/environment_lab_main.tscn")

func _init() -> void:
	call_deferred("_run_test")

func _fail(message: String) -> void:
	push_error("ENVIRONMENT LAB SPAWN SMOKE TEST FAILED: " + message)
	quit(1)

func _run_test() -> void:
	var lab := LAB_SCENE.instantiate()
	if lab == null:
		_fail("lab scene could not instantiate")
		return

	root.add_child(lab)
	current_scene = lab

	var foundation := lab.get_node_or_null("SpawnFoundation") as StaticBody3D
	if foundation == null:
		_fail("baked SpawnFoundation is missing")
		return

	var collision := foundation.get_node_or_null("CollisionShape3D") as CollisionShape3D
	if collision == null or collision.shape == null or collision.disabled:
		_fail("SpawnFoundation has no active collision shape")
		return

	var player := lab.get_node_or_null("Player") as CharacterBody3D
	if player == null:
		_fail("Player is missing")
		return

	# Give ready callbacks and the physics server time to settle Arthur onto the baked floor.
	for _frame in range(75):
		await physics_frame

	if not is_instance_valid(player):
		_fail("Player disappeared during physics simulation")
		return

	if player.global_position.y < 0.45:
		_fail("Arthur fell below the garage floor; y=%.3f" % player.global_position.y)
		return

	if player.global_position.distance_to(Vector3(0, player.global_position.y, 18)) > 3.0:
		_fail("Arthur drifted away from the safe spawn unexpectedly; position=%s" % player.global_position)
		return

	print("ENVIRONMENT LAB SPAWN SMOKE TEST PASSED: Arthur stable at ", player.global_position)
	quit(0)
