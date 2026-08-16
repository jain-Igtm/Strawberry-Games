extends CharacterBody3D

@export var walk_speed := 6.4
@export var run_speed := 9.0
@export var gravity := 18.0
@export var mouse_sensitivity := 0.0022
@export var touch_sensitivity := 0.0039
@export var levitation_speed := 6.2
@export var swim_speed := 4.35

@onready var camera_pivot: Node3D = $CameraPivot
@onready var camera: Camera3D = $CameraPivot/Camera3D

var mobile_move := Vector2.ZERO
var pitch := 0.0
var psychic_levitation := false
var water_swimming := false
var levitation_burst := 0.0

func _ready() -> void:
	if not OS.has_feature("mobile"):
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func set_mobile_move(value: Vector2) -> void:
	mobile_move = value.limit_length(1.0)

func add_mobile_look(delta_pixels: Vector2) -> void:
	_apply_look(delta_pixels, touch_sensitivity)

func _apply_look(delta_pixels: Vector2, sensitivity: float) -> void:
	rotate_y(-delta_pixels.x * sensitivity)
	pitch = clamp(pitch - delta_pixels.y * sensitivity, deg_to_rad(-82.0), deg_to_rad(82.0))
	camera_pivot.rotation.x = pitch

func set_psychic_levitation(value: bool) -> void:
	psychic_levitation = value
	if value:
		levitation_burst = 0.82
		velocity.y = maxf(velocity.y, 3.8)

func toggle_psychic_levitation() -> bool:
	set_psychic_levitation(not psychic_levitation)
	return psychic_levitation

func is_self_levitating() -> bool:
	return psychic_levitation

func set_water_swimming(value: bool) -> void:
	water_swimming = value

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	elif event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_apply_look(event.relative, mouse_sensitivity)

func _desktop_move() -> Vector2:
	var out := Vector2.ZERO
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		out.x -= 1.0
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		out.x += 1.0
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
		out.y += 1.0
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
		out.y -= 1.0
	return out.limit_length(1.0)

func _physics_process(delta: float) -> void:
	var move_input := (_desktop_move() + mobile_move).limit_length(1.0)

	if psychic_levitation or water_swimming:
		var camera_forward: Vector3 = (-camera.global_transform.basis.z).normalized()
		var camera_right: Vector3 = camera.global_transform.basis.x.normalized()
		camera_right.y = 0.0
		camera_right = camera_right.normalized()
		var desired_3d: Vector3 = (camera_right * move_input.x + camera_forward * move_input.y)
		if desired_3d.length_squared() > 0.001:
			desired_3d = desired_3d.normalized()
		var travel_speed: float = swim_speed if water_swimming else levitation_speed
		velocity = desired_3d * travel_speed
		if psychic_levitation and not water_swimming and levitation_burst > 0.0 and move_input.length() < 0.08:
			velocity.y = 3.9 * clampf(levitation_burst / 0.3, 0.28, 1.0)
		levitation_burst = maxf(0.0, levitation_burst - delta)
		move_and_slide()
		return

	var forward := -global_transform.basis.z
	forward.y = 0.0
	forward = forward.normalized()
	var right := global_transform.basis.x
	right.y = 0.0
	right = right.normalized()
	var desired := (right * move_input.x + forward * move_input.y)
	var speed := run_speed if Input.is_key_pressed(KEY_SHIFT) else walk_speed
	velocity.x = desired.x * speed
	velocity.z = desired.z * speed
	if not is_on_floor():
		velocity.y -= gravity * delta
	else:
		velocity.y = min(velocity.y, 0.0)
	move_and_slide()
