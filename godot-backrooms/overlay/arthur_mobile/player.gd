extends CharacterBody3D

@export var walk_speed := 6.4
@export var run_speed := 9.0
@export var gravity := 18.0
@export var mouse_sensitivity := 0.0022
@export var touch_sensitivity := 0.0036
@export var step_height := 0.62

@onready var camera_pivot: Node3D = $CameraPivot
@onready var camera: Camera3D = $CameraPivot/Camera3D

var mobile_move := Vector2.ZERO
var pitch := 0.0

func _ready() -> void:
	floor_snap_length = step_height + 0.08
	floor_max_angle = deg_to_rad(52.0)
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

	var grounded_before := is_on_floor()
	var before_move := global_position
	var requested_horizontal := Vector3(velocity.x, 0.0, velocity.z) * delta
	move_and_slide()
	_try_step_up(before_move, requested_horizontal, grounded_before)

func _try_step_up(before_move: Vector3, requested_horizontal: Vector3, grounded_before: bool) -> void:
	if not grounded_before or requested_horizontal.length_squared() < 0.00001:
		return

	var post_slide := global_position
	var actual_horizontal := post_slide - before_move
	actual_horizontal.y = 0.0
	if actual_horizontal.length() >= requested_horizontal.length() * 0.62:
		return

	var remaining := requested_horizontal - actual_horizontal
	remaining.y = 0.0
	if remaining.length_squared() < 0.00001:
		return

	var up := Vector3.UP * step_height
	if test_move(global_transform, up):
		return

	global_position += up
	if test_move(global_transform, remaining):
		global_position = post_slide
		return

	global_position += remaining
	var landing := move_and_collide(Vector3.DOWN * (step_height + 0.10))
	if landing == null or landing.get_normal().dot(Vector3.UP) < 0.55:
		global_position = post_slide
		return

	velocity.y = 0.0
