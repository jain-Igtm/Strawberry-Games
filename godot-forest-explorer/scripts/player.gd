extends CharacterBody3D

const WALK_SPEED: float = 6.6
const SPRINT_SPEED: float = 10.3
const GROUND_ACCEL: float = 22.0
const AIR_ACCEL: float = 5.0
const JUMP_VELOCITY: float = 6.4
const GRAVITY: float = 18.0
const MOUSE_SENSITIVITY: float = 0.00175
const TOUCH_SENSITIVITY: float = 0.00245
const GROUND_OFFSET: float = 0.035
const CHUNK_SIZE: float = 64.0
const OBSTACLE_LAYER: int = 2

@onready var world: Node3D = get_parent()
@onready var head: Node3D = $Head
@onready var camera: Camera3D = $Head/Camera3D
@onready var mobile_controls: CanvasLayer = get_node("../MobileControls")

var yaw: float = 0.0
var pitch: float = -0.06
var bob_phase: float = 0.0
var sway: Vector2 = Vector2.ZERO
var landing_kick: float = 0.0
var mouse_captured: bool = false

# Grounding is driven by the exact triangle surface sent to the renderer. The
# terrain mesh is intentionally lower resolution on mobile, so sampling raw
# noise directly can disagree slightly with the visible triangle between grid
# vertices. Matching the rendered triangle removes that discrepancy entirely.
var terrain_grounded: bool = true
var vertical_speed: float = 0.0

func _ready() -> void:
    # Terrain elevation is analytical. The player only collides with dedicated
    # obstacle-layer bodies such as nearby trunks. Streamed terrain bodies use
    # the default layer and are therefore completely invisible to this capsule.
    motion_mode = CharacterBody3D.MOTION_MODE_FLOATING
    collision_layer = 1
    collision_mask = OBSTACLE_LAYER
    safe_margin = 0.025

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

    # Establish the exact visible ground position before obstacle collision. This
    # also repairs any frame that began inside or underneath a terrain triangle.
    if terrain_grounded:
        global_position.y = _rendered_ground_height_here() + GROUND_OFFSET

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
    var accel: float = GROUND_ACCEL if terrain_grounded else AIR_ACCEL
    velocity.x = move_toward(velocity.x, target_velocity.x, accel * delta)
    velocity.z = move_toward(velocity.z, target_velocity.z, accel * delta)

    var wants_jump: bool = Input.is_action_just_pressed("jump") or bool(mobile_controls.call("consume_jump"))
    if terrain_grounded and wants_jump:
        terrain_grounded = false
        vertical_speed = JUMP_VELOCITY

    # Only horizontal motion is sent to the physics engine. Its collision mask
    # contains only the obstacle layer, so terrain can never push or wedge us.
    velocity.y = 0.0
    move_and_slide()

    var ground_y: float = _rendered_ground_height_here() + GROUND_OFFSET
    var landed_this_frame: bool = false
    var landing_speed: float = 0.0

    if terrain_grounded:
        global_position.y = ground_y
        vertical_speed = 0.0
    else:
        vertical_speed -= GRAVITY * delta
        global_position.y += vertical_speed * delta
        if global_position.y <= ground_y and vertical_speed <= 0.0:
            landing_speed = absf(vertical_speed)
            global_position.y = ground_y
            vertical_speed = 0.0
            terrain_grounded = true
            landed_this_frame = true

    velocity.y = vertical_speed

    if landed_this_frame:
        landing_kick = minf(0.045, landing_speed * 0.006 + 0.014)

    _update_camera_motion(delta, input_vec, sprinting)

func _rendered_ground_height_here() -> float:
    var origin_offset: Vector2 = world.get("origin_offset")
    var abs_x: float = global_position.x + origin_offset.x
    var abs_z: float = global_position.z + origin_offset.y
    var resolution: int = maxi(1, int(world.get("terrain_resolution")))
    var step: float = CHUNK_SIZE / float(resolution)

    var chunk_x: int = floori(abs_x / CHUNK_SIZE)
    var chunk_z: int = floori(abs_z / CHUNK_SIZE)
    var local_x: float = abs_x - float(chunk_x) * CHUNK_SIZE
    var local_z: float = abs_z - float(chunk_z) * CHUNK_SIZE

    var cell_x: int = clampi(floori(local_x / step), 0, resolution - 1)
    var cell_z: int = clampi(floori(local_z / step), 0, resolution - 1)
    var x0: float = float(chunk_x) * CHUNK_SIZE + float(cell_x) * step
    var z0: float = float(chunk_z) * CHUNK_SIZE + float(cell_z) * step
    var x1: float = x0 + step
    var z1: float = z0 + step
    var u: float = clampf((abs_x - x0) / step, 0.0, 1.0)
    var v: float = clampf((abs_z - z0) / step, 0.0, 1.0)

    var h00: float = float(world.call("height_at", x0, z0))
    var h01: float = float(world.call("height_at", x0, z1))
    var h10: float = float(world.call("height_at", x1, z0))
    var h11: float = float(world.call("height_at", x1, z1))

    # world.gd emits each grid square as p00,p01,p10 and p10,p01,p11.
    # Reproduce those exact two triangles here rather than bilinear interpolation.
    if u + v <= 1.0:
        return h00 + (h10 - h00) * u + (h01 - h00) * v
    return h11 + (h01 - h11) * (1.0 - u) + (h10 - h11) * (1.0 - v)

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
    var moving: bool = terrain_grounded and input_vec.length() > 0.08 and planar_speed > 0.5
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
