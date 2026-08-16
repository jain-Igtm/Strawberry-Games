extends "res://arthur_mobile/player_v08.gd"

const PsychicBubbleScene: PackedScene = preload("res://arthur_mobile/psychic_air_bubble_v09.tscn")

@export var psychic_enemy_target_radius := 28.0
@export var psychic_field_launch_speed := 18.5

var psychic_bubble: Node3D
var underwater := false

var waterslide_active := false
var waterslide_points := PackedVector3Array()
var waterslide_progress := 0.0
var waterslide_duration := 3.0
var waterslide_floor_delta := 0
var waterslide_collision_mask := 3

func _ready() -> void:
	super._ready()
	psychic_bubble = PsychicBubbleScene.instantiate() as Node3D
	psychic_bubble.position = Vector3(0, 0.72, 0)
	add_child(psychic_bubble)

func _physics_process(delta: float) -> void:
	if waterslide_active:
		_update_waterslide(delta)
		return
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

func lights_end_radius_gesture() -> void:
	if illumination != null and illumination.has_method("end_radius_gesture"):
		illumination.call("end_radius_gesture")

func lights_return_home() -> void:
	if illumination != null and illumination.has_method("reset_default_formation"):
		illumination.call("reset_default_formation")

func lights_return_radius() -> void:
	if illumination != null and illumination.has_method("return_radius_to_default"):
		illumination.call("return_radius_to_default")

func lights_adjust_brightness(amount: float) -> float:
	if illumination == null or not illumination.has_method("adjust_brightness"):
		return 1.0
	return float(illumination.call("adjust_brightness", amount))

func get_psychic_light_brightness() -> float:
	if illumination == null or not illumination.has_method("get_brightness"):
		return 1.0
	return float(illumination.call("get_brightness"))

func begin_waterslide(points: PackedVector3Array, floor_delta: int = 0, duration: float = 3.0) -> void:
	if waterslide_active or points.size() < 2:
		return
	waterslide_active = true
	waterslide_points = points
	waterslide_progress = 0.0
	waterslide_duration = maxf(1.0, duration)
	waterslide_floor_delta = floor_delta
	waterslide_collision_mask = collision_mask
	collision_mask = 0
	velocity = Vector3.ZERO
	mobile_move = Vector2.ZERO
	set_psychic_levitation(false)
	set_water_swimming(false)
	underwater = false
	if psychic_bubble != null:
		psychic_bubble.call("set_active", false)
	global_position = waterslide_points[0]

func is_on_waterslide() -> bool:
	return waterslide_active

func _update_waterslide(delta: float) -> void:
	if waterslide_points.size() < 2:
		_finish_waterslide()
		return
	waterslide_progress = minf(1.0, waterslide_progress + delta / waterslide_duration)
	var p: Vector3 = _waterslide_sample(waterslide_progress)
	var p_next: Vector3 = _waterslide_sample(minf(1.0, waterslide_progress + 0.012))
	var tangent: Vector3 = (p_next - p).normalized()
	global_position = p
	velocity = Vector3.ZERO

	if tangent.length_squared() > 0.001:
		var horizontal := Vector2(tangent.x, tangent.z).length()
		if horizontal > 0.001:
			rotation.y = atan2(-tangent.x, -tangent.z)
		var ride_pitch := clampf(atan2(tangent.y, maxf(horizontal, 0.001)), deg_to_rad(-46.0), deg_to_rad(28.0))
		pitch = lerpf(pitch, ride_pitch, clampf(delta * 4.8, 0.0, 1.0))
		camera_pivot.rotation.x = pitch

	if waterslide_progress >= 1.0:
		_finish_waterslide()

func _waterslide_sample(t: float) -> Vector3:
	var count: int = waterslide_points.size()
	if count == 1:
		return waterslide_points[0]
	var scaled: float = clampf(t, 0.0, 1.0) * float(count - 1)
	var i: int = mini(int(floor(scaled)), count - 2)
	var local_t: float = scaled - float(i)
	var p0: Vector3 = waterslide_points[maxi(0, i - 1)]
	var p1: Vector3 = waterslide_points[i]
	var p2: Vector3 = waterslide_points[i + 1]
	var p3: Vector3 = waterslide_points[mini(count - 1, i + 2)]
	return _catmull_rom(p0, p1, p2, p3, local_t)

func _catmull_rom(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: float) -> Vector3:
	var t2 := t * t
	var t3 := t2 * t
	return (
		(2.0 * p1)
		+ (-p0 + p2) * t
		+ (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2
		+ (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3
	) * 0.5

func _finish_waterslide() -> void:
	if not waterslide_active:
		return
	waterslide_active = false
	collision_mask = waterslide_collision_mask
	if not waterslide_points.is_empty():
		global_position = waterslide_points[waterslide_points.size() - 1]
	var requested_delta := waterslide_floor_delta
	waterslide_floor_delta = 0
	waterslide_points = PackedVector3Array()
	waterslide_progress = 0.0
	var world := get_parent()
	if requested_delta != 0 and world != null and world.has_method("waterslide_arrive"):
		world.call("waterslide_arrive", requested_delta)
	_update_water_state()

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

func _unhandled_input(event: InputEvent) -> void:
	super._unhandled_input(event)
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_Q:
			toggle_psychic_levitation()
		elif event.keycode == KEY_R and psychic_field_active:
			launch_psychic_field_at_enemies()
