extends "res://arthur_mobile/player_v10_stairs.gd"

const PsychicLightBoltScene: PackedScene = preload("res://arthur_mobile/enemies/psychic_light_bolt.tscn")

@export var enemy_max_health := 100.0
@export var light_orb_damage := 34.0
@export var light_orb_impulse := 5.2

var enemy_health := 100.0
var hurt_roll := 0.0
var enemy_dead := false
var light_attack_index := 0

func _ready() -> void:
	super._ready()
	enemy_health = enemy_max_health

func receive_enemy_attack(amount: float, impulse: Vector3, _attacker: Node = null) -> void:
	if enemy_dead:
		return
	enemy_health = maxf(0.0, enemy_health - maxf(0.0, amount))
	velocity += impulse
	hurt_roll = minf(0.12, hurt_roll + 0.055)
	if enemy_health <= 0.0:
		enemy_dead = true
		call_deferred("_restart_after_enemy_death")

func get_enemy_health() -> float:
	return enemy_health

func get_enemy_max_health() -> float:
	return enemy_max_health

func _restart_after_enemy_death() -> void:
	get_tree().reload_current_scene()

func fire_psychic_light_attack() -> bool:
	if enemy_dead:
		return false
	if not is_psychic_light_enabled():
		toggle_psychic_light()
	if illumination == null or camera == null:
		return false

	var orb_names := ["OrbA", "OrbB", "OrbC"]
	var launch_origin := camera.global_position + (-camera.global_transform.basis.z).normalized() * 0.42
	for offset in range(orb_names.size()):
		var index := (light_attack_index + offset) % orb_names.size()
		var orb := illumination.get_node_or_null(orb_names[index]) as Node3D
		if orb != null and orb.visible:
			launch_origin = orb.global_position
			light_attack_index = (index + 1) % orb_names.size()
			break

	var aim_point := camera.global_position + (-camera.global_transform.basis.z).normalized() * 45.0
	var direction := (aim_point - launch_origin).normalized()
	var bolt := PsychicLightBoltScene.instantiate() as Area3D
	get_tree().current_scene.add_child(bolt)
	bolt.global_position = launch_origin
	bolt.call("setup", direction, light_orb_damage, light_orb_impulse)
	return true

func _throw_held_prop() -> void:
	var thrown := held_prop
	var was_enemy := thrown != null and is_instance_valid(thrown) and thrown.is_in_group("enemy")
	super._throw_held_prop()
	if was_enemy and thrown != null and is_instance_valid(thrown):
		thrown.angular_velocity = Vector3(2.2, -1.4, 2.8)

func launch_psychic_field_at_enemies() -> void:
	if not psychic_field_active:
		return
	psychic_field_active = false
	var targets: Array[Node3D] = []
	for node in get_tree().get_nodes_in_group("enemy"):
		if node is Node3D:
			var target := node as Node3D
			if target.global_position.distance_to(global_position) <= psychic_enemy_target_radius:
				targets.append(target)

	var fallback: Vector3 = (-camera.global_transform.basis.z).normalized()
	for index in range(psychic_field_bodies.size()):
		var body: RigidBody3D = psychic_field_bodies[index]
		if not is_instance_valid(body):
			continue
		var direction := fallback
		if not targets.is_empty():
			var selected: Node3D = null
			for offset in range(targets.size()):
				var candidate := targets[(index + offset) % targets.size()]
				if candidate != body:
					selected = candidate
					break
			if selected != null:
				direction = (selected.global_position + Vector3(0, 0.8, 0) - body.global_position).normalized()
		var seed_value: float = float(posmod(body.get_instance_id(), 997)) / 997.0
		body.freeze = false
		body.sleeping = false
		body.gravity_scale = 0.42
		body.collision_layer = 3
		body.collision_mask = 3
		body.linear_velocity = direction * (psychic_field_launch_speed + seed_value * 4.0) + Vector3.UP * (0.65 + seed_value * 1.15)
		body.angular_velocity = Vector3(seed_value * 4.2 - 2.1, 2.4 - seed_value * 3.8, seed_value * 5.0 - 2.5)
	psychic_field_bodies.clear()
	psychic_field_bases.clear()

func _physics_process(delta: float) -> void:
	super._physics_process(delta)
	hurt_roll = move_toward(hurt_roll, 0.0, delta * 0.18)
	if camera_pivot != null:
		camera_pivot.rotation.z = sin(float(Time.get_ticks_msec()) * 0.028) * hurt_roll

func _unhandled_input(event: InputEvent) -> void:
	super._unhandled_input(event)
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_G:
		fire_psychic_light_attack()
