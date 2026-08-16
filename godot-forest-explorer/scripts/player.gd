extends CharacterBody3D

const WALK_SPEED: float = 6.6
const SPRINT_SPEED: float = 10.3
const GROUND_ACCEL: float = 22.0
const AIR_ACCEL: float = 5.0
const JUMP_VELOCITY: float = 6.4
const MOUSE_SENSITIVITY: float = 0.00175
const TOUCH_SENSITIVITY: float = 0.00245
const GROUND_STICK_VELOCITY: float = -0.65

@onready var head: Node3D = $Head
@onready var camera: Camera3D = $Head/Camera3D
@onready var mobile_controls: CanvasLayer = get_node("../MobileControls")

var yaw: float = 0.0
var pitch: float = -0.06
var bob_phase: float = 0.0
var sway: Vector2 = Vector2.ZERO
var landing_kick: float = 0.0
var was_grounded: bool = false
var mouse_captured: bool = false

func _ready() -> void:
    # Keep the capsule planted on rolling terrain instead of repeatedly becoming
    # airborne over small changes in slope. Constant-speed floor motion also
    # prevents uphill/downhill terrain from changing the apparent walk speed.
    up_direction = Vector3.UP
    floor_snap_length = 0.72
    floor_max_angle = deg_to_rad(54.0)
    floor_stop_on_slope = true
    floor_constant_speed = true
    floor_block_on_wall = true
    safe_margin = 0.035

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
    var touch_look: Vector2 = mobile_controls.call("consume_look_delta")
    if touch_look.length_squared() > 0.0:
        _apply_look(touch_look, TOUCH_SENSITIVITY)

    var keyboard: Vector2 = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
    var touch_move: Vector2 = mobile_controls.get("move_vector")
    var input_vec: Vector2 = touch_move if touch_move.length_squared() > keyboard.length_squared() else keyboard

    var forward: Vector3 = -global_transform.basis.z
    var right: Vector3 = global_transform.basis.x
    forward.y = 0.0
    right.y = 0.0
    forward = forward.normalized()
    right = right.normalized()
    var wish_dir: Vector3 = (right * input_vec.x + forward * -input_vec.y).normalized()

    var sprinting: bool = Input.is_action_pressed("sprint") or bool(mobile_controls.get("sprint_held"))
    var target_speed: float = SPRINT_SPEED if sprinting else WALK_SPEED
    var target_velocity: Vector3 = wish_dir * target_speed
    var accel: float = GROUND_ACCEL if is_on_floor() else AIR_ACCEL
    velocity.x = move_toward(velocity.x, target_velocity.x, accel * delta)
    velocity.z = move_toward(velocity.z, target_velocity.z, accel * delta)

    var wants_jump: bool = Input.is_action_just_pressed("jump") or bool(mobile_controls.call("consume_jump"))
    if is_on_floor():
        if wants_jump:
            velocity.y = JUMP_VELOCITY
        else:
            # A small downward bias gives floor snapping a stable direction and
            # keeps the controller attached while cresting or descending hills.
            velocity.y = GROUND_STICK_VELOCITY
    else:
        velocity.y -= 18.0 * delta

    move_and_slide()
    _update_camera_motion(delta, input_vec, sprinting)

    if is_on_floor() and not was_grounded and velocity.y <= 0.1:
        landing_kick = minf(0.045, absf(velocity.y) * 0.006 + 0.014)
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
    var planar_speed: float = Vector2(velocity.x, velocity.z).length()
    var moving: bool = is_on_floor() and input_vec.length() > 0.08 and planar_speed > 0.5
    if moving:
        var rate: float = 10.7 if sprinting else 8.15
        bob_phase += delta * rate * clampf(planar_speed / WALK_SPEED, 0.6, 1.5)
    else:
        bob_phase = lerpf(bob_phase, roundf(bob_phase / TAU) * TAU, minf(1.0, delta * 5.0))

    var bob_strength: float = clampf(planar_speed / SPRINT_SPEED, 0.0, 1.0)
    var bob_y: float = sin(bob_phase * 2.0) * 0.014 * bob_strength
    var bob_x: float = cos(bob_phase) * 0.012 * bob_strength
    landing_kick = move_toward(landing_kick, 0.0, delta * 0.26)
    sway = sway.lerp(Vector2.ZERO, minf(1.0, delta * 5.5))

    camera.position.x = lerpf(camera.position.x, bob_x - sway.x, minf(1.0, delta * 11.0))
    camera.position.y = lerpf(camera.position.y, bob_y - landing_kick - sway.y, minf(1.0, delta * 12.0))
    camera.rotation.z = lerpf(camera.rotation.z, -bob_x * 0.28, minf(1.0, delta * 8.0))

    var target_fov: float = 78.0 if sprinting and moving else 74.0
    camera.fov = lerpf(camera.fov, target_fov, minf(1.0, delta * 4.0))
