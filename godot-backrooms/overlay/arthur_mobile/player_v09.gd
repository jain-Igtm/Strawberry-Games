extends "res://arthur_mobile/player_v08.gd"

const PsychicBubbleScene: PackedScene = preload("res://arthur_mobile/psychic_air_bubble_v09.tscn")

@export var psychic_enemy_target_radius := 28.0
@export var psychic_field_launch_speed := 18.5

var psychic_bubble: Node3D
var underwater := false

func _ready() -> void:
	super._ready()
	psychic_bubble = PsychicBubbleScene.instantiate() as Node3D
	psychic_bubble.position = Vector3(0, 0.72, 0)
	add_child(psychic_bubble)

func _physics_process(delta: float) -> void:
	_update_water_state()
	super._physics_process(delta)

func _update_water_state() -> void:
	var next_underwater := false
	var world := get_parent()
	if world != null and world.has_method("is_water_at_position"):
		next_underwater = bool(world.call("is_water_at_position", camera.global_position))
	if next_underwater != underwater:
		underwater = next_underwater
		set_water_swimming(underwater)
		if psychic_bubble != null:
			psychic_bubble.call("set_active", underwater)
	if not underwater and water_swimming:
		set_water_swimming(false)

func is_underwater() -> bool:
	return underwater

func toggle_bubble_expanded() -> bool:
	if psychic_bubble == null or not underwater:
		return false
	return bool(psychic_bubble.call("toggle_expanded"))

func is_bubble_expanded() -> bool:
	return psychic_bubble != null and bool(psychic_bubble.call("is_expanded"))

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
			var enemy: Node3D = targets[index % targets.size()]
			direction = (enemy.global_position + Vector3(0, 0.8, 0) - body.global_position).normalized()
		var seed: float = float(posmod(body.get_instance_id(), 997)) / 997.0
		body.freeze = false
		body.sleeping = false
		body.gravity_scale = 0.42
		body.collision_layer = 3
		body.collision_mask = 3
		body.linear_velocity = direction * (psychic_field_launch_speed + seed * 4.0) + Vector3.UP * (0.65 + seed * 1.15)
		body.angular_velocity = Vector3(seed * 4.2 - 2.1, 2.4 - seed * 3.8, seed * 5.0 - 2.5)
	psychic_field_bodies.clear()
	psychic_field_bases.clear()

func _unhandled_input(event: InputEvent) -> void:
	super._unhandled_input(event)
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_Q:
			toggle_psychic_levitation()
		elif event.keycode == KEY_R and psychic_field_active:
			launch_psychic_field_at_enemies()
