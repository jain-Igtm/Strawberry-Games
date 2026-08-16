extends CharacterBody3D

const WALK_SPEED := 6.6
const SPRINT_SPEED := 10.3
const GROUND_ACCEL := 22.0
const AIR_ACCEL := 5.0
const JUMP_VELOCITY := 6.4
const MOUSE_SENSITIVITY := 0.00175
const TOUCH_SENSITIVITY := 0.00245

@onready var head: Node3D = $Head
@onready var camera: Camera3D = $Head/Camera3D
@onready var mobile_controls: CanvasLayer = get_node("../MobileControls")

var yaw := 0.0
var pitch := -0.06
var bob_phase := 0.0
var sway := Vector2.ZERO
var landing_kick := 0.0
var was_grounded := false
var mouse_captured := false

func _ready() -> void:
    if not OS.has_feature("mobile"):
        Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
        mouse_captured = true

func _unhandled_input(event: InputEvent) -> void:
    if event is InputEventMouseMotion and mouse_captured:
        _apply_look(event.relative, MOUSE_SENSITIVITY)
    elif event is InputEventMouseButton and event.pressed and not OS.has_feature("mobile"):
        Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
        mouse_captured = true
    elif event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
        Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
        mouse_captured = false

func _physics_process(delta: float) -> void:
    var touch_look: Vector2 = mobile_controls.consume_look_delta()
    if touch_look.length_squared() > 0.0:
        _apply_look(touch_look, TOUCH_SENSITIVITY)

    var keyboard := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
    var touch_move: Vector2 = mobile_controls.move_vector
    var input_vec := touch_move if touch_move.length_squared() > keyboard.length_squared() else keyboard

    var forward := -global_transform.basis.z
    var right := global_transform.basis.x
    forward.y = 0.0
    right.y = 0.0
    forward = forward.normalized()
    right = right.normalized()
    var wish_dir := (right * input_vec.x + forward * -input_vec.y).normalized()

    var sprinting := Input.is_action_pressed("sprint") or mobile_controls.sprint_held
    var target_speed := SPRINT_SPEED if sprinting else WALK_SPEED
    var target_velocity := wish_dir * target_speed
    var accel := GROUND_ACCEL if is_on_floor() else AIR_ACCEL
    velocity.x = move_toward(velocity.x, target_velocity.x, accel * delta)
    velocity.z = move_toward(velocity.z, target_velocity.z, accel * delta)

    if not is_on_floor():
        velocity.y -= 18.0 * delta
    elif Input.is_action_just_pressed("jump") or mobile_controls.consume_jump():
        velocity.y = JUMP_VELOCITY

    move_and_slide()
    _update_camera_motion(delta, input_vec, sprinting)

    if is_on_floor() and not was_grounded and velocity.y <= 0.1:
        landing_kick = minf(0.095, abs(velocity.y) * 0.012 + 0.035)
    was_grounded = is_on_floor()

func _apply_look(delta_pixels: Vector2, sensitivity: float) -> void:
    yaw -= delta_pixels.x * sensitivity
    pitch -= delta_pixels.y * sensitivity
    pitch = clampf(pitch, deg_to_rad(-86.0), deg_to_rad(86.0))
    rotation.y = yaw
    head.rotation.x = pitch
    sway += delta_pixels * 0.00004
    sway = sway.limit_length(0.025)

func _update_camera_motion(delta: float, input_vec: Vector2, sprinting: bool) -> void:
    var planar_speed := Vector2(velocity.x, velocity.z).length()
    var moving := is_on_floor() and input_vec.length() > 0.08 and planar_speed > 0.5
    if moving:
        var rate := 10.7 if sprinting else 8.15
        bob_phase += delta * rate * clampf(planar_speed / WALK_SPEED, 0.6, 1.5)
    else:
        bob_phase = lerpf(bob_phase, round(bob_phase / TAU) * TAU, minf(1.0, delta * 5.0))

    var bob_strength := clampf(planar_speed / SPRINT_SPEED, 0.0, 1.0)
    var bob_y := sin(bob_phase * 2.0) * 0.026 * bob_strength
    var bob_x := cos(bob_phase) * 0.018 * bob_strength
    landing_kick = move_toward(landing_kick, 0.0, delta * 0.36)
    sway = sway.lerp(Vector2.ZERO, minf(1.0, delta * 5.5))

    camera.position.x = lerpf(camera.position.x, bob_x - sway.x, minf(1.0, delta * 11.0))
    camera.position.y = lerpf(camera.position.y, bob_y - landing_kick - sway.y, minf(1.0, delta * 12.0))
    camera.rotation.z = lerpf(camera.rotation.z, -bob_x * 0.32, minf(1.0, delta * 8.0))

    var target_fov := 78.0 if sprinting and moving else 74.0
    camera.fov = lerpf(camera.fov, target_fov, minf(1.0, delta * 4.0))
