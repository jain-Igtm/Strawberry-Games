extends SceneTree

const EnemyIlluminationScene: PackedScene = preload("res://arthur_mobile/psychic_illumination_enemy_workstation.tscn")
const HallwalkerScene: PackedScene = preload("res://arthur_mobile/enemies/hallwalker.tscn")

var stage: Node3D
var player: CharacterBody3D
var camera: Camera3D
var illumination: Node3D
var enemy: RigidBody3D

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	stage = Node3D.new()
	stage.name = "EnemyCombatSmokeStage"
	root.add_child(stage)

	player = CharacterBody3D.new()
	player.name = "SmokePlayer"
	player.add_to_group("player")
	stage.add_child(player)

	var pivot := Node3D.new()
	pivot.name = "CameraPivot"
	pivot.position = Vector3(0.0, 0.62, 0.0)
	player.add_child(pivot)

	camera = Camera3D.new()
	camera.name = "Camera3D"
	pivot.add_child(camera)

	illumination = EnemyIlluminationScene.instantiate() as Node3D
	player.add_child(illumination)
	illumination.call("set_enabled", true)

	enemy = HallwalkerScene.instantiate() as RigidBody3D
	enemy.freeze = true
	enemy.position = Vector3(0.0, 0.0, -6.0)
	stage.add_child(enemy)

	# Let the physics server register the Hallwalker's real collision shape.
	await process_frame
	await physics_frame
	await process_frame

	if not enemy.is_in_group("enemy"):
		_fail("Hallwalker is missing the enemy group")
		return
	if not enemy.is_in_group("psychic_prop"):
		_fail("Hallwalker is not liftable by Arthur's existing psychic_prop TK")
		return

	var orb_a := illumination.get_node_or_null("OrbA") as Node3D
	var orb_b := illumination.get_node_or_null("OrbB") as Node3D
	var orb_c := illumination.get_node_or_null("OrbC") as Node3D
	if orb_a == null or orb_b == null or orb_c == null:
		_fail("Combat illumination does not contain the three existing light orbs")
		return

	var original_child_count: int = illumination.get_child_count()
	var original_ids: Array[int] = [orb_a.get_instance_id(), orb_b.get_instance_id(), orb_c.get_instance_id()]
	var health_before: float = float(enemy.get("health"))

	if not bool(illumination.call("launch_forward")):
		_fail("Existing light-orb launch refused to start")
		return

	var attack_orbs: Array = illumination.get("attack_orbs") as Array
	if attack_orbs.size() != 3:
		_fail("Normal light attack did not launch all three existing visible orbs")
		return
	for index in range(3):
		var launched_orb := attack_orbs[index] as Node3D
		if launched_orb == null or launched_orb.get_instance_id() != original_ids[index]:
			_fail("Light attack substituted a different projectile node")
			return

	# The orbs start well above the camera in HOME formation. A correct attack aims
	# each physical orb toward the camera aim point instead of firing three parallel
	# high shots over the humanoid target.
	for _frame in range(180):
		await process_frame
		if not bool(illumination.call("is_attacking")):
			break

	var health_after: float = float(enemy.get("health"))
	if health_after >= health_before:
		_fail("Same-orb projectile flight did not damage the centered Hallwalker")
		return
	if bool(illumination.call("is_attacking")):
		_fail("Light orbs failed to return to formation after attack")
		return
	if illumination.get_child_count() != original_child_count:
		_fail("Light attack spawned or retained an extra projectile node")
		return

	for orb: Node3D in [orb_a, orb_b, orb_c]:
		if orb.get_parent() != illumination:
			_fail("An existing light orb did not return to the illumination controller")
			return
		if orb.top_level:
			_fail("An existing light orb remained detached after returning")
			return

	print("ENEMY_COMBAT_SMOKE_PASS same_orbs=true tk_group=true damage=", health_before - health_after)
	stage.queue_free()
	await process_frame
	quit(0)

func _fail(message: String) -> void:
	push_error("ENEMY_COMBAT_SMOKE_FAIL: " + message)
	quit(1)
