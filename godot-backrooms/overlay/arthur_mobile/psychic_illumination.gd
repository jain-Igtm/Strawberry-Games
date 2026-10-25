extends Node3D

@onready var orb_a: Node3D = $OrbA
@onready var orb_b: Node3D = $OrbB
@onready var orb_c: Node3D = $OrbC

var anchor: Node3D
var camera: Camera3D
var active := false
var scouting := false
var phase := 0.0
var formation_radius := 1.45
var brightness := 1.30
var visual_anchor := Vector3.ZERO
var returning_to_default := false
var spread_locked_until_release := false

# HOME is sacred: these values and equations come directly from stable-v0.7-first-stable.
const DEFAULT_RADIUS := 1.45
const HOME_A_RADIUS := 1.45
const HOME_B_RADIUS := 1.22
const HOME_C_RADIUS := 1.70
const MIN_RADIUS := 0.16
const MAX_RADIUS := 5.6
const COMBINE_RADIUS := 0.42
const SCOUT_DISTANCE := 7.2
const DEFAULT_RETURN_SPEED := 3.85
const MIN_BRIGHTNESS := 0.35
const MAX_BRIGHTNESS := 2.25
const DEFAULT_BRIGHTNESS := 1.30

func _ready() -> void:
	anchor = get_parent() as Node3D
	if anchor != null:
		camera = anchor.get_node_or_null("CameraPivot/Camera3D") as Camera3D
		visual_anchor = anchor.global_position
	top_level = true
	visible = false
	set_process(false)

func set_enabled(value: bool) -> void:
	var was_active := active
	active = value
	visible = value
	set_process(value)
	if value and anchor != null:
		visual_anchor = anchor.global_position
		global_position = anchor.global_position
	if value and not was_active:
		# Every activation starts in the exact original close, world-space HOME orbit,
		# at 50% illumination capacity. The brightness control can then extend reach.
		formation_radius = DEFAULT_RADIUS
		brightness = DEFAULT_BRIGHTNESS
		returning_to_default = false
		spread_locked_until_release = false
		scouting = false
	if not value:
		scouting = false

func toggle() -> bool:
	set_enabled(not active)
	return active

func is_enabled() -> bool:
	return active

func toggle_scout() -> bool:
	if not active:
		set_enabled(true)
		return false
	scouting = not scouting
	if not scouting and anchor != null:
		# HOME follows Arthur exactly, as it did in v0.7. No generalized anchor smoothing.
		visual_anchor = anchor.global_position
		global_position = anchor.global_position
	return scouting

func is_scouting() -> bool:
	return scouting

func adjust_radius(amount: float) -> float:
	if not active:
		set_enabled(true)
	if amount > 0.0:
		if spread_locked_until_release:
			return formation_radius
		returning_to_default = false
		formation_radius = clampf(formation_radius + amount, MIN_RADIUS, MAX_RADIUS)
		if formation_radius >= MAX_RADIUS:
			formation_radius = MAX_RADIUS
			spread_locked_until_release = true
	else:
		returning_to_default = false
		formation_radius = clampf(formation_radius + amount, MIN_RADIUS, MAX_RADIUS)

	# Radius is independent of anchor mode. HOME spreads around Arthur; SCOUT spreads
	# around the forward scout anchor and remains in SCOUT for the entire gesture.
	if not scouting and anchor != null:
		visual_anchor = anchor.global_position
		global_position = anchor.global_position
	return formation_radius

func end_radius_gesture() -> void:
	spread_locked_until_release = false

func return_radius_to_default() -> void:
	returning_to_default = true
	spread_locked_until_release = false
	if not scouting and anchor != null:
		visual_anchor = anchor.global_position
		global_position = anchor.global_position

func reset_default_formation() -> void:
	# Explicit HOME command retained for compatibility. Long-hold release now uses
	# return_radius_to_default(), which deliberately preserves SCOUT state.
	scouting = false
	return_radius_to_default()

func adjust_brightness(amount: float) -> float:
	if not active:
		set_enabled(true)
	brightness = clampf(brightness + amount, MIN_BRIGHTNESS, MAX_BRIGHTNESS)
	return brightness

func set_brightness(value: float) -> float:
	brightness = clampf(value, MIN_BRIGHTNESS, MAX_BRIGHTNESS)
	return brightness

func get_brightness() -> float:
	return brightness

func is_combined() -> bool:
	return formation_radius <= COMBINE_RADIUS

func get_formation_radius() -> float:
	return formation_radius

func _brightness_capacity() -> float:
	return clampf(inverse_lerp(MIN_BRIGHTNESS, MAX_BRIGHTNESS, brightness), 0.0, 1.0)

func _capacity_range_multiplier() -> float:
	var capacity := _brightness_capacity()
	if capacity <= 0.5:
		return lerpf(0.62, 1.0, capacity / 0.5)
	return lerpf(1.0, 1.85, (capacity - 0.5) / 0.5)

func _capacity_energy_multiplier() -> float:
	var capacity := _brightness_capacity()
	if capacity <= 0.5:
		return lerpf(0.72, 1.0, capacity / 0.5)
	return lerpf(1.0, 1.18, (capacity - 0.5) / 0.5)

func _capacity_attenuation(base_attenuation: float) -> float:
	var capacity := _brightness_capacity()
	if capacity <= 0.5:
		return lerpf(base_attenuation * 1.18, base_attenuation, capacity / 0.5)
	return lerpf(base_attenuation, maxf(0.68, base_attenuation * 0.72), (capacity - 0.5) / 0.5)

func _process(delta: float) -> void:
	if anchor == null or not is_instance_valid(anchor):
		return
	if camera == null or not is_instance_valid(camera):
		camera = anchor.get_node_or_null("CameraPivot/Camera3D") as Camera3D

	phase += delta
	if returning_to_default:
		formation_radius = move_toward(formation_radius, DEFAULT_RADIUS, DEFAULT_RETURN_SPEED * delta)
		if absf(formation_radius - DEFAULT_RADIUS) <= 0.005:
			formation_radius = DEFAULT_RADIUS
			returning_to_default = false

	if scouting and camera != null:
		var look: Vector3 = (-camera.global_transform.basis.z).normalized()
		var target_anchor: Vector3 = anchor.global_position + look * SCOUT_DISTANCE
		visual_anchor = visual_anchor.lerp(target_anchor, clampf(delta * 5.4, 0.0, 1.0))
		global_position = visual_anchor
	else:
		# This exact world-space anchoring is part of the original v0.7 feel.
		global_position = anchor.global_position
		visual_anchor = anchor.global_position

	if is_combined():
		_update_combined()
	else:
		_update_separate()

func _update_separate() -> void:
	orb_a.visible = true
	orb_b.visible = true
	orb_c.visible = true
	orb_a.scale = Vector3.ONE
	orb_b.scale = Vector3.ONE
	orb_c.scale = Vector3.ONE
	_restore_light(orb_a, 1.45, 9.5, 1.20)
	_restore_light(orb_b, 1.2, 8.5, 1.25)
	_restore_light(orb_c, 1.15, 8.0, 1.30)

	# At DEFAULT_RADIUS these are literally the original stable-v0.7 equations.
	# Spread/contract only multiplies their horizontal world-space wander.
	var spread: float = formation_radius / DEFAULT_RADIUS
	orb_a.position = Vector3(
		cos(phase * 0.62) * HOME_A_RADIUS * spread,
		1.72 + sin(phase * 1.31) * 0.18,
		sin(phase * 0.62) * HOME_A_RADIUS * spread
	)
	orb_b.position = Vector3(
		cos(phase * 0.54 + 2.1) * HOME_B_RADIUS * spread,
		2.18 + sin(phase * 1.07 + 1.4) * 0.21,
		sin(phase * 0.54 + 2.1) * HOME_B_RADIUS * spread
	)
	orb_c.position = Vector3(
		cos(phase * 0.47 + 4.15) * HOME_C_RADIUS * spread,
		1.38 + sin(phase * 0.91 + 3.2) * 0.16,
		sin(phase * 0.47 + 4.15) * HOME_C_RADIUS * spread
	)

func _update_combined() -> void:
	orb_a.visible = true
	orb_b.visible = false
	orb_c.visible = false
	var merge: float = 1.0 - clampf((formation_radius - MIN_RADIUS) / maxf(0.001, COMBINE_RADIUS - MIN_RADIUS), 0.0, 1.0)
	orb_a.scale = Vector3.ONE * lerpf(1.55, 2.45, merge)
	orb_a.position = Vector3(
		sin(phase * 0.55) * 0.16,
		1.83 + sin(phase * 0.88) * 0.13,
		cos(phase * 0.49) * 0.16
	)
	var light := orb_a.get_node_or_null("Light") as OmniLight3D
	if light != null:
		_apply_light_capacity(light, lerpf(2.7, 4.2, merge), lerpf(11.5, 14.0, merge), 1.05)

func _restore_light(orb: Node3D, energy: float, light_range: float, attenuation: float) -> void:
	var light := orb.get_node_or_null("Light") as OmniLight3D
	if light != null:
		_apply_light_capacity(light, energy, light_range, attenuation)

func _apply_light_capacity(light: OmniLight3D, base_energy: float, base_range: float, base_attenuation: float) -> void:
	# Capacity is intentionally range-first. At the 50% activation point the old
	# light footprint is preserved. Turning it up then pushes illumination farther
	# into the room while nearby surfaces only become modestly brighter.
	light.light_energy = base_energy * _capacity_energy_multiplier()
	light.omni_range = base_range * _capacity_range_multiplier()
	light.omni_attenuation = _capacity_attenuation(base_attenuation)
