extends CharacterBody3D

@export var walk_speed := 4.6
@export var sprint_speed := 7.2
@export var swim_speed := 2.35
@export var mouse_sensitivity := 0.0022
@export var touch_sensitivity := 0.0034

@onready var camera_pivot: Node3D = $CameraPivot
@onready var camera: Camera3D = $CameraPivot/Camera3D
@onready var interaction_ray: RayCast3D = $CameraPivot/Camera3D/InteractionRay
@onready var headlamp: SpotLight3D = $CameraPivot/Camera3D/Headlamp

var mobile_move := Vector2.ZERO
var mobile_sprint := false
var pitch := 0.0
var bob_time := 0.0

var health := 100.0
var core_temperature := 36.8
var hunger := 88.0
var stamina := 100.0
var wetness := 0.0

var in_water := false
var sheltered := false
var heat_strength := 0.0
var air_temperature := -18.0
var wind_chill := -24.0
var is_sprinting := false
var is_dead := false
var lamp_on := true
var piloting_boat: Node3D
var pilot_seat: Marker3D
var pilot_exit: Marker3D
var world_controller: Node3D

var interaction_prompt := ""
var status_message := ""
var status_message_until := 0
var sword_pivot: Node3D
var sword_audio: AudioStreamPlayer
var sword_swing_elapsed := -1.0
var sword_swing_count := 0

const CAMERA_BASE := Vector3(0.0, 0.64, 0.0)
const FALLBACK_SPAWN := Vector3(8.0, 2.24, 5.15)
const SWORD_REST_POSITION := Vector3(0.64, -0.64, -1.05)
const SWORD_REST_ROTATION := Vector3(-0.12, -0.16, 0.38)
const SWORD_SWING_DURATION := 0.46

func _ready() -> void:
	world_controller = get_parent() as Node3D
	motion_mode = CharacterBody3D.MOTION_MODE_GROUNDED
	floor_max_angle = deg_to_rad(50.0)
	floor_snap_length = 0.42
	floor_constant_speed = true
	floor_stop_on_slope = true
	floor_block_on_wall = true
	max_slides = 8
	if not OS.has_feature("mobile"):
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	headlamp.visible = lamp_on
	_build_sword()

func _process(delta: float) -> void:
	_update_sword_animation(delta)

func _physics_process(delta: float) -> void:
	_update_environment()
	if piloting_boat != null:
		_update_piloting(delta)
		return
	if is_dead:
		velocity.x = move_toward(velocity.x, 0.0, delta * 5.0)
		velocity.z = move_toward(velocity.z, 0.0, delta * 5.0)
		if not is_on_floor():
			velocity += get_gravity() * delta
		move_and_slide()
		interaction_prompt = "Restart expedition"
		if Input.is_action_just_pressed("interact"):
			request_interact()
		return

	var move_input := get_piloting_input()

	var requested_sprint := (Input.is_action_pressed("sprint") or mobile_sprint)
	var can_sprint := not in_water and stamina > 0.5 and move_input.length_squared() > 0.08
	is_sprinting = requested_sprint and can_sprint
	var speed := swim_speed if in_water else (sprint_speed if is_sprinting else walk_speed)

	var direction := (transform.basis * Vector3(move_input.x, 0.0, move_input.y)).normalized()
	if direction.length_squared() > 0.001:
		velocity.x = move_toward(velocity.x, direction.x * speed, delta * 13.0)
		velocity.z = move_toward(velocity.z, direction.z * speed, delta * 13.0)
	else:
		velocity.x = move_toward(velocity.x, 0.0, delta * 11.0)
		velocity.z = move_toward(velocity.z, 0.0, delta * 11.0)

	if in_water:
		velocity.y = move_toward(velocity.y, 0.75, delta * 3.2)
		velocity.z += delta * 0.38
		if Input.is_action_pressed("jump"):
			velocity.y = 2.6
	elif is_on_floor():
		if Input.is_action_just_pressed("jump"):
			velocity.y = 4.25
	else:
		velocity += get_gravity() * delta

	move_and_slide()
	_update_camera_bob(delta, move_input)
	_update_survival(delta)
	_update_interaction()

	if Input.is_action_just_pressed("interact"):
		request_interact()
	if Input.is_action_just_pressed("toggle_lamp"):
		toggle_headlamp()
	if Input.is_action_just_pressed("attack"):
		request_attack()

	if global_position.y < -12.0:
		global_position = world_controller.call("get_rescue_position") if world_controller != null and world_controller.has_method("get_rescue_position") else FALLBACK_SPAWN
		velocity = Vector3.ZERO
		health = maxf(1.0, health - 12.0)
		show_status_message("You drag yourself back onto the boat.")

func _update_piloting(delta: float) -> void:
	if not is_instance_valid(piloting_boat) or not is_instance_valid(pilot_seat):
		end_boat_piloting()
		return
	global_position = pilot_seat.global_position
	velocity = Vector3.ZERO
	is_sprinting = false
	_update_environment()
	_update_camera_bob(delta, Vector2.ZERO)
	_update_survival(delta)
	interaction_prompt = "Leave the helm"

	if Input.is_action_just_pressed("interact"):
		request_interact()
	if Input.is_action_just_pressed("toggle_lamp"):
		toggle_headlamp()
	if is_dead and piloting_boat != null and piloting_boat.has_method("end_piloting"):
		piloting_boat.call("end_piloting")

func _update_environment() -> void:
	if world_controller == null or not world_controller.has_method("get_survival_environment"):
		return
	var sample: Dictionary = world_controller.call("get_survival_environment", global_position)
	in_water = bool(sample.get("in_water", false))
	sheltered = bool(sample.get("sheltered", false))
	heat_strength = float(sample.get("heat_strength", 0.0))
	air_temperature = float(sample.get("air_temperature", -18.0))
	wind_chill = float(sample.get("wind_chill", -24.0))

func _update_survival(delta: float) -> void:
	hunger = maxf(0.0, hunger - delta * (0.032 if is_sprinting else 0.020))
	var stamina_ceiling := lerpf(58.0, 100.0, clampf(hunger / 55.0, 0.0, 1.0))
	if is_sprinting:
		stamina = maxf(0.0, stamina - delta * 17.0)
	else:
		var recovery := 12.0 if sheltered else 9.0
		stamina = minf(stamina_ceiling, stamina + delta * recovery)

	if in_water:
		wetness = minf(100.0, wetness + delta * 38.0)
	else:
		var drying_rate := 0.045
		if sheltered:
			drying_rate += 0.28
		if heat_strength > 0.0:
			drying_rate += heat_strength * 3.8
		wetness = maxf(0.0, wetness - delta * drying_rate)

	var target_core := 32.4
	var thermal_rate := 0.0027
	if in_water:
		target_core = 29.5
		thermal_rate = 0.034
	elif heat_strength > 0.02:
		target_core = 37.15
		thermal_rate = 0.004 + heat_strength * 0.014
	elif sheltered:
		target_core = 35.75
		thermal_rate = 0.0011
	else:
		var weather_exposure := clampf((-wind_chill - 12.0) / 20.0, 0.0, 1.35)
		thermal_rate *= (1.0 + weather_exposure * 0.72) * (1.0 + wetness / 52.0)

	if hunger < 20.0 and target_core < core_temperature:
		thermal_rate *= 1.25
	if is_sprinting and not in_water:
		target_core += 0.28
	core_temperature = move_toward(core_temperature, target_core, thermal_rate * delta)

	if core_temperature < 35.0:
		health = maxf(0.0, health - delta * (35.0 - core_temperature) * 0.46)
	elif heat_strength > 0.35 and hunger > 15.0:
		health = minf(100.0, health + delta * 0.06)
	if hunger <= 0.0:
		health = maxf(0.0, health - delta * 0.08)

	if health <= 0.0:
		is_dead = true
		is_sprinting = false
		mobile_sprint = false
		show_status_message("You succumbed to exposure.", 3600.0)

func _update_camera_bob(delta: float, move_input: Vector2) -> void:
	var target := CAMERA_BASE
	if is_on_floor() and not in_water and move_input.length_squared() > 0.02:
		bob_time += delta * (11.0 if is_sprinting else 7.6)
		target.y += sin(bob_time) * (0.035 if is_sprinting else 0.022)
		target.x += cos(bob_time * 0.5) * 0.012
	else:
		bob_time = 0.0
	camera_pivot.position = camera_pivot.position.lerp(target, clampf(delta * 9.0, 0.0, 1.0))

func _update_interaction() -> void:
	interaction_prompt = ""
	var interactable := _get_interactable()
	if interactable != null and interactable.has_method("get_interaction_prompt"):
		interaction_prompt = str(interactable.call("get_interaction_prompt"))

func request_interact() -> void:
	if is_dead:
		get_tree().reload_current_scene()
		return
	if piloting_boat != null:
		if piloting_boat.has_method("end_piloting"):
			piloting_boat.call("end_piloting")
		return
	var interactable := _get_interactable()
	if interactable == null:
		show_status_message("Nothing within reach.", 1.4)
		return
	if interactable.has_method("interact"):
		interactable.call("interact", self)
	else:
		show_status_message("Nothing useful here.", 1.4)

func _get_interactable() -> Node:
	interaction_ray.force_raycast_update()
	if interaction_ray.is_colliding():
		var collider := interaction_ray.get_collider() as Node
		if collider != null and collider.has_method("interact"):
			return collider
	if world_controller != null and world_controller.has_method("get_nearby_interactable"):
		return world_controller.call("get_nearby_interactable", global_position) as Node
	return null

func eat_ration() -> bool:
	if hunger >= 96.0:
		show_status_message("You are not hungry enough to use a ration.")
		return false
	hunger = minf(100.0, hunger + 30.0)
	show_status_message("You eat a cold trail ration.")
	return true

func show_status_message(message: String, seconds: float = 3.0) -> void:
	status_message = message
	status_message_until = Time.get_ticks_msec() + int(seconds * 1000.0)

func get_status_message() -> String:
	if Time.get_ticks_msec() > status_message_until:
		return ""
	return status_message

func get_thermal_state() -> String:
	if is_dead:
		return "EXPOSURE"
	if in_water:
		return "IN THE RIVER"
	if wetness >= 65.0:
		return "SOAKED"
	if heat_strength >= 0.25:
		return "WARMING"
	if sheltered:
		return "SHELTERED"
	if wetness >= 15.0:
		return "WET / COOLING"
	return "EXPOSED"

func get_piloting_input() -> Vector2:
	var keyboard_move := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var move_input := mobile_move if mobile_move.length_squared() > 0.001 else keyboard_move
	return move_input.limit_length(1.0)

func begin_boat_piloting(next_boat: Node3D, next_seat: Marker3D, next_exit: Marker3D) -> void:
	if is_dead or next_boat == null or next_seat == null:
		return
	piloting_boat = next_boat
	pilot_seat = next_seat
	pilot_exit = next_exit
	if get_parent() != piloting_boat:
		reparent(piloting_boat, true)
	global_position = pilot_seat.global_position
	velocity = Vector3.ZERO
	collision_layer = 0
	collision_mask = 0
	is_sprinting = false
	mobile_sprint = false
	if sword_pivot != null:
		sword_pivot.visible = false
	show_status_message("Helm engaged. Apply throttle to cast off.", 2.6)

func end_boat_piloting() -> void:
	var exit_position := global_position
	if pilot_exit != null and is_instance_valid(pilot_exit):
		exit_position = pilot_exit.global_position
	if world_controller != null and get_parent() != world_controller:
		reparent(world_controller, true)
	global_position = exit_position
	piloting_boat = null
	pilot_seat = null
	pilot_exit = null
	velocity = Vector3.ZERO
	collision_layer = 2
	collision_mask = 1
	interaction_prompt = ""
	if sword_pivot != null:
		sword_pivot.visible = true
	show_status_message("You leave the helm.", 1.5)

func board_boat(boarding_point: Marker3D) -> void:
	if is_dead or boarding_point == null:
		return
	if world_controller != null and get_parent() != world_controller:
		reparent(world_controller, true)
	global_position = boarding_point.global_position
	velocity = Vector3.ZERO
	in_water = false
	reset_physics_interpolation()
	show_status_message("You climb aboard the Northstar.", 2.2)

func set_mobile_move(value: Vector2) -> void:
	mobile_move = value.limit_length(1.0)

func set_mobile_sprint(active: bool) -> void:
	mobile_sprint = active

func add_mobile_look(relative: Vector2) -> void:
	_apply_look(relative * touch_sensitivity)

func toggle_headlamp() -> void:
	lamp_on = not lamp_on
	headlamp.visible = lamp_on
	show_status_message("Headlamp on." if lamp_on else "Headlamp off.", 1.3)

func request_attack() -> void:
	if is_dead or piloting_boat != null or sword_swing_elapsed >= 0.0:
		return
	sword_swing_elapsed = 0.0
	sword_swing_count += 1
	if sword_audio != null:
		sword_audio.play()
	var from := camera.global_position
	var to := from + -camera.global_transform.basis.z * 2.35
	var query := PhysicsRayQueryParameters3D.create(from, to, 5)
	query.exclude = [get_rid()]
	var hit := get_world_3d().direct_space_state.intersect_ray(query)
	var target := hit.get("collider") as Node
	if target != null and target.has_method("on_sword_hit"):
		target.call("on_sword_hit", self)

func get_sword_swing_count() -> int:
	return sword_swing_count

func _build_sword() -> void:
	sword_pivot = Node3D.new()
	sword_pivot.name = "Sword"
	sword_pivot.position = SWORD_REST_POSITION
	sword_pivot.rotation = SWORD_REST_ROTATION
	camera.add_child(sword_pivot)

	var blade_material := StandardMaterial3D.new()
	blade_material.albedo_color = Color(0.60, 0.66, 0.67)
	blade_material.metallic = 0.88
	blade_material.roughness = 0.23
	blade_material.cull_mode = BaseMaterial3D.CULL_DISABLED
	var fuller_material := StandardMaterial3D.new()
	fuller_material.albedo_color = Color(0.25, 0.29, 0.30)
	fuller_material.metallic = 0.84
	fuller_material.roughness = 0.34
	var guard_material := StandardMaterial3D.new()
	guard_material.albedo_color = Color(0.42, 0.35, 0.22)
	guard_material.metallic = 0.72
	guard_material.roughness = 0.39
	var grip_material := StandardMaterial3D.new()
	grip_material.albedo_color = Color(0.105, 0.070, 0.048)
	grip_material.roughness = 0.96

	_add_sword_blade(blade_material)
	_add_sword_box("Fuller", Vector3(0.016, 0.62, 0.008), Vector3(0.0, 0.34, 0.021), fuller_material)
	_add_sword_cylinder("Guard", 0.020, 0.31, Vector3(0.0, -0.035, 0.0), guard_material, Vector3(0.0, 0.0, deg_to_rad(90.0)))
	_add_sword_sphere("GuardCapLeft", 0.027, Vector3(-0.157, -0.035, 0.0), guard_material)
	_add_sword_sphere("GuardCapRight", 0.027, Vector3(0.157, -0.035, 0.0), guard_material)
	_add_sword_cylinder("Grip", 0.037, 0.25, Vector3(0.0, -0.185, 0.0), grip_material)
	for wrap_index in range(5):
		_add_sword_cylinder("GripWrap%d" % wrap_index, 0.040, 0.010, Vector3(0.0, -0.095 - float(wrap_index) * 0.045, 0.0), guard_material)
	_add_sword_sphere("Pommel", 0.052, Vector3(0.0, -0.345, 0.0), guard_material)

	sword_audio = AudioStreamPlayer.new()
	sword_audio.name = "SwordSwingAudio"
	sword_audio.stream = load("res://audio/sword_swing.ogg") as AudioStream
	sword_audio.volume_db = -2.0
	camera.add_child(sword_audio)

func _add_sword_box(node_name: String, size: Vector3, position: Vector3, material: Material) -> void:
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = material
	var instance := MeshInstance3D.new()
	instance.name = node_name
	instance.mesh = mesh
	instance.position = position
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	sword_pivot.add_child(instance)

func _add_sword_blade(material: Material) -> void:
	var blade_surface := SurfaceTool.new()
	blade_surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	blade_surface.set_material(material)
	var left_base := Vector3(-0.058, 0.0, 0.0)
	var right_base := Vector3(0.058, 0.0, 0.0)
	var front_base := Vector3(0.0, 0.0, 0.019)
	var back_base := Vector3(0.0, 0.0, -0.019)
	var left_shoulder := Vector3(-0.043, 0.74, 0.0)
	var right_shoulder := Vector3(0.043, 0.74, 0.0)
	var front_shoulder := Vector3(0.0, 0.74, 0.014)
	var back_shoulder := Vector3(0.0, 0.74, -0.014)
	var tip := Vector3(0.0, 0.96, 0.0)
	_add_blade_quad(blade_surface, left_base, left_shoulder, front_shoulder, front_base)
	_add_blade_quad(blade_surface, front_base, front_shoulder, right_shoulder, right_base)
	_add_blade_quad(blade_surface, back_base, back_shoulder, left_shoulder, left_base)
	_add_blade_quad(blade_surface, right_base, right_shoulder, back_shoulder, back_base)
	_add_blade_triangle(blade_surface, left_shoulder, tip, front_shoulder)
	_add_blade_triangle(blade_surface, front_shoulder, tip, right_shoulder)
	_add_blade_triangle(blade_surface, back_shoulder, tip, left_shoulder)
	_add_blade_triangle(blade_surface, right_shoulder, tip, back_shoulder)
	_add_blade_triangle(blade_surface, left_base, front_base, right_base)
	_add_blade_triangle(blade_surface, left_base, right_base, back_base)
	blade_surface.generate_normals()
	var instance := MeshInstance3D.new()
	instance.name = "Blade"
	instance.mesh = blade_surface.commit()
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	sword_pivot.add_child(instance)

func _add_blade_quad(surface: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, d: Vector3) -> void:
	_add_blade_triangle(surface, a, b, c)
	_add_blade_triangle(surface, a, c, d)

func _add_blade_triangle(surface: SurfaceTool, a: Vector3, b: Vector3, c: Vector3) -> void:
	surface.add_vertex(a)
	surface.add_vertex(b)
	surface.add_vertex(c)

func _add_sword_cylinder(node_name: String, radius: float, height: float, position: Vector3, material: Material, rotation: Vector3 = Vector3.ZERO) -> void:
	var cylinder := CylinderMesh.new()
	cylinder.top_radius = radius
	cylinder.bottom_radius = radius
	cylinder.height = height
	cylinder.radial_segments = 12
	cylinder.material = material
	var instance := MeshInstance3D.new()
	instance.name = node_name
	instance.mesh = cylinder
	instance.position = position
	instance.rotation = rotation
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	sword_pivot.add_child(instance)

func _add_sword_sphere(node_name: String, radius: float, position: Vector3, material: Material) -> void:
	var sphere := SphereMesh.new()
	sphere.radius = radius
	sphere.height = radius * 2.0
	sphere.radial_segments = 10
	sphere.rings = 5
	sphere.material = material
	var instance := MeshInstance3D.new()
	instance.name = node_name
	instance.mesh = sphere
	instance.position = position
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	sword_pivot.add_child(instance)

func _update_sword_animation(delta: float) -> void:
	if sword_pivot == null:
		return
	if sword_swing_elapsed < 0.0:
		sword_pivot.position = SWORD_REST_POSITION
		sword_pivot.rotation = SWORD_REST_ROTATION
		return
	sword_swing_elapsed += delta
	var phase := clampf(sword_swing_elapsed / SWORD_SWING_DURATION, 0.0, 1.0)
	var arc := sin(phase * PI)
	sword_pivot.rotation = SWORD_REST_ROTATION + Vector3(-arc * 0.38, arc * 0.18, -arc * 1.35)
	sword_pivot.position = SWORD_REST_POSITION + Vector3(-arc * 0.30, arc * 0.11, -arc * 0.12)
	if phase >= 1.0:
		sword_swing_elapsed = -1.0

func _apply_look(delta_look: Vector2) -> void:
	rotate_y(-delta_look.x)
	pitch = clampf(pitch - delta_look.y, deg_to_rad(-85.0), deg_to_rad(85.0))
	camera_pivot.rotation.x = pitch

func _unhandled_input(event: InputEvent) -> void:
	if OS.has_feature("mobile"):
		return
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_apply_look(event.relative * mouse_sensitivity)
	elif event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_LEFT and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
			request_attack()
		else:
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
