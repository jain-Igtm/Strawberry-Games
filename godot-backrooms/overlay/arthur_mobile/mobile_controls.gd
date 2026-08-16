extends Control

var player: CharacterBody3D
var move_touch := -1
var look_touch := -1
var tk_touch := -1
var light_touch := -1
var move_origin := Vector2.ZERO
var move_current := Vector2.ZERO
var tk_origin := Vector2.ZERO
var tk_current := Vector2.ZERO
var light_drag_origin := Vector2.ZERO
var light_drag_current := Vector2.ZERO
var joystick_radius := 168.0
var response_radius := 96.0
var knob_radius := 68.0
var ability_radius := 58.0
var bubble_radius := 48.0

var tk_press_started_ms := 0
var tk_field_started := false
var tk_flick_up := false

var light_press_started_ms := 0
var light_hold_active := false
var light_brightness_swipe := false
var light_tap_count := 0
var light_last_release_ms := -10000

const TK_HOLD_MS := 390
const TK_FLICK_UP_PX := 72.0
const LEVITATION_STICK_RANGE := 104.0
const LEVITATION_STICK_DEADZONE := 12.0

const LIGHT_TAP_WINDOW_MS := 280
const LIGHT_HOLD_MS := 240
const LIGHT_SPREAD_RATE := 2.45
const LIGHT_BRIGHTNESS_SWIPE_PX := 18.0
const LIGHT_BRIGHTNESS_PIXELS_PER_UNIT := 150.0
const LIGHT_MIN_BRIGHTNESS := 0.35
const LIGHT_MAX_BRIGHTNESS := 2.25

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_process_input(true)
	call_deferred("_find_player")

func _find_player() -> void:
	player = get_tree().get_first_node_in_group("player") as CharacterBody3D

func _light_center() -> Vector2:
	return Vector2(size.x - 104.0, size.y - 104.0)

func _tk_center() -> Vector2:
	return Vector2(size.x - 244.0, size.y - 104.0)

func _bubble_center() -> Vector2:
	return Vector2(94.0, 154.0)

func _inside_circle(point: Vector2, center: Vector2, radius: float) -> bool:
	return point.distance_squared_to(center) <= radius * radius

func _player_levitating() -> bool:
	return player != null and player.has_method("is_self_levitating") and bool(player.call("is_self_levitating"))

func _player_underwater() -> bool:
	return player != null and player.has_method("is_underwater") and bool(player.call("is_underwater"))

func _psychic_lights_on() -> bool:
	return player != null and player.has_method("is_psychic_light_enabled") and bool(player.call("is_psychic_light_enabled"))

func _psychic_scouting() -> bool:
	return player != null and player.has_method("is_psychic_scouting") and bool(player.call("is_psychic_scouting"))

func _psychic_brightness() -> float:
	if player != null and player.has_method("get_psychic_light_brightness"):
		return float(player.call("get_psychic_light_brightness"))
	return 1.0

func _ensure_lights_on() -> void:
	if not _psychic_lights_on() and player.has_method("toggle_psychic_light"):
		player.call("toggle_psychic_light")

func _process(delta: float) -> void:
	if not OS.has_feature("mobile") or player == null:
		return
	var now := Time.get_ticks_msec()

	if tk_touch != -1 and not _player_levitating() and not tk_field_started and not tk_flick_up and now - tk_press_started_ms >= TK_HOLD_MS:
		if player.has_method("begin_psychic_field"):
			player.call("begin_psychic_field")
			tk_field_started = true
			queue_redraw()

	if light_touch != -1 and not light_brightness_swipe:
		var held_ms: int = now - light_press_started_ms
		if held_ms >= LIGHT_HOLD_MS:
			if not light_hold_active:
				light_hold_active = true
				light_tap_count = 0
				light_last_release_ms = -10000
				_ensure_lights_on()
			# HOME and SCOUT use the same radius gesture. The illumination object keeps
			# whichever anchor mode is already active while these orbs spread.
			if player.has_method("lights_adjust_radius"):
				player.call("lights_adjust_radius", LIGHT_SPREAD_RATE * delta)
			queue_redraw()

	if light_touch == -1 and light_tap_count > 0 and now - light_last_release_ms > LIGHT_TAP_WINDOW_MS:
		_finish_light_taps()

func _input(event: InputEvent) -> void:
	if not OS.has_feature("mobile"):
		return
	if player == null:
		_find_player()
		if player == null:
			return

	if event is InputEventScreenTouch:
		if event.pressed:
			if _player_underwater() and _inside_circle(event.position, _bubble_center(), bubble_radius):
				if player.has_method("toggle_bubble_expanded"):
					player.call("toggle_bubble_expanded")
				queue_redraw()
				return

			if _inside_circle(event.position, _light_center(), ability_radius) and light_touch == -1:
				light_touch = event.index
				light_press_started_ms = Time.get_ticks_msec()
				light_hold_active = false
				light_brightness_swipe = false
				light_drag_origin = event.position
				light_drag_current = event.position
				queue_redraw()
				return

			if _inside_circle(event.position, _tk_center(), ability_radius) and tk_touch == -1:
				tk_touch = event.index
				tk_press_started_ms = Time.get_ticks_msec()
				tk_field_started = false
				tk_flick_up = false
				tk_origin = event.position
				tk_current = event.position
				if _player_levitating() and player.has_method("set_levitation_vertical_input"):
					player.call("set_levitation_vertical_input", 0.0)
				queue_redraw()
				return

			if event.position.x < get_viewport_rect().size.x * 0.42 and move_touch == -1:
				move_touch = event.index
				move_origin = event.position
				move_current = event.position
				_update_move()
				queue_redraw()
			elif look_touch == -1:
				look_touch = event.index

		else:
			if event.index == light_touch:
				light_touch = -1
				if light_brightness_swipe:
					light_brightness_swipe = false
					light_hold_active = false
					light_tap_count = 0
					light_last_release_ms = -10000
				elif light_hold_active:
					if player.has_method("lights_return_radius"):
						player.call("lights_return_radius")
					if player.has_method("lights_end_radius_gesture"):
						player.call("lights_end_radius_gesture")
					light_hold_active = false
					light_tap_count = 0
					light_last_release_ms = -10000
				else:
					var now := Time.get_ticks_msec()
					if now - light_last_release_ms <= LIGHT_TAP_WINDOW_MS:
						light_tap_count = mini(2, light_tap_count + 1)
					else:
						light_tap_count = 1
					light_last_release_ms = now
				queue_redraw()
				return

			if event.index == tk_touch:
				if _player_levitating():
					if player.has_method("set_levitation_vertical_input"):
						player.call("set_levitation_vertical_input", 0.0)
					var lev_delta := tk_current - tk_origin
					var held_ms: int = Time.get_ticks_msec() - tk_press_started_ms
					if lev_delta.length() < 18.0 and held_ms < 280 and player.has_method("toggle_psychic_levitation"):
						player.call("toggle_psychic_levitation")
				elif tk_field_started:
					if tk_flick_up and player.has_method("launch_psychic_field_at_enemies"):
						player.call("launch_psychic_field_at_enemies")
					elif player.has_method("end_psychic_field"):
						player.call("end_psychic_field")
				else:
					if tk_flick_up and player.has_method("toggle_psychic_levitation"):
						player.call("toggle_psychic_levitation")
					elif player.has_method("psychic_interact"):
						player.call("psychic_interact")
				tk_touch = -1
				tk_field_started = false
				tk_flick_up = false
				queue_redraw()
				return

			if event.index == move_touch:
				move_touch = -1
				player.set_mobile_move(Vector2.ZERO)
				queue_redraw()
			elif event.index == look_touch:
				look_touch = -1

	elif event is InputEventScreenDrag:
		if event.index == light_touch:
			light_drag_current = event.position
			if not light_hold_active:
				var light_delta: Vector2 = light_drag_current - light_drag_origin
				if not light_brightness_swipe and absf(light_delta.x) >= LIGHT_BRIGHTNESS_SWIPE_PX and absf(light_delta.x) > absf(light_delta.y) * 0.75:
					light_brightness_swipe = true
					light_tap_count = 0
					light_last_release_ms = -10000
					_ensure_lights_on()
				if light_brightness_swipe:
					if player.has_method("lights_adjust_brightness"):
						player.call("lights_adjust_brightness", event.relative.x / LIGHT_BRIGHTNESS_PIXELS_PER_UNIT)
					queue_redraw()
					return
			return

		if event.index == tk_touch:
			tk_current = event.position
			if _player_levitating():
				var rise_delta: float = tk_origin.y - tk_current.y
				var vertical := 0.0
				if absf(rise_delta) > LEVITATION_STICK_DEADZONE:
					var signed_distance: float = rise_delta - signf(rise_delta) * LEVITATION_STICK_DEADZONE
					vertical = clampf(signed_distance / (LEVITATION_STICK_RANGE - LEVITATION_STICK_DEADZONE), -1.0, 1.0)
				if player.has_method("set_levitation_vertical_input"):
					player.call("set_levitation_vertical_input", vertical)
				queue_redraw()
				return
			if tk_current.y - tk_origin.y <= -TK_FLICK_UP_PX:
				tk_flick_up = true
			queue_redraw()
			return

		if event.index == move_touch:
			move_current = event.position
			_update_move()
			queue_redraw()
		elif event.index == look_touch:
			player.add_mobile_look(event.relative)

func _finish_light_taps() -> void:
	if player == null:
		_reset_light_taps()
		return

	if light_tap_count == 1:
		# One tap is only power: off -> exact v0.7 HOME, on -> off.
		if player.has_method("toggle_psychic_light"):
			player.call("toggle_psychic_light")
	elif light_tap_count >= 2:
		# Double tap is scout. If necessary, power on first, then scout.
		_ensure_lights_on()
		if player.has_method("lights_scout_toggle"):
			player.call("lights_scout_toggle")

	_reset_light_taps()
	queue_redraw()

func _reset_light_taps() -> void:
	light_tap_count = 0
	light_last_release_ms = -10000

func _update_move() -> void:
	var delta := move_current - move_origin
	if delta.length() > joystick_radius:
		delta = delta.normalized() * joystick_radius
	var analog := Vector2(delta.x / response_radius, -delta.y / response_radius)
	player.set_mobile_move(analog.limit_length(1.0))

func _draw() -> void:
	if not OS.has_feature("mobile"):
		return

	var ghost_center := Vector2(210.0, size.y - 210.0)
	if move_touch == -1:
		draw_circle(ghost_center, joystick_radius, Color(1, 1, 1, 0.075))
		draw_arc(ghost_center, joystick_radius, 0.0, TAU, 64, Color(1, 1, 1, 0.27), 3.0)
		draw_circle(ghost_center, knob_radius, Color(1, 1, 1, 0.13))
	else:
		var delta := move_current - move_origin
		if delta.length() > joystick_radius:
			delta = delta.normalized() * joystick_radius
		draw_circle(move_origin, joystick_radius, Color(1, 1, 1, 0.085))
		draw_arc(move_origin, joystick_radius, 0.0, TAU, 64, Color(1, 1, 1, 0.38), 3.0)
		draw_circle(move_origin + delta, knob_radius, Color(1, 1, 1, 0.25))
		draw_arc(move_origin + delta, knob_radius, 0.0, TAU, 44, Color(1, 1, 1, 0.55), 3.0)

	var light_on := _psychic_lights_on()
	var levitating := _player_levitating()
	var tk_active := player != null and (
		(player.has_method("has_psychic_hold") and bool(player.call("has_psychic_hold")))
		or (player.has_method("is_psychic_field_active") and bool(player.call("is_psychic_field_active")))
	)

	_draw_ability_button(_light_center(), "LIGHTS", light_on, ability_radius)
	if light_on:
		_draw_light_brightness_meter()
	if levitating:
		_draw_levitation_stick()
	else:
		_draw_ability_button(_tk_center(), "TK", tk_active, ability_radius)

	if _player_underwater():
		var bubble_active := player.has_method("is_bubble_expanded") and bool(player.call("is_bubble_expanded"))
		_draw_ability_button(_bubble_center(), "BUBBLE", bubble_active, bubble_radius)

func _draw_light_brightness_meter() -> void:
	var center := _light_center()
	var left := center + Vector2(-34.0, 37.0)
	var right := center + Vector2(34.0, 37.0)
	var value: float = inverse_lerp(LIGHT_MIN_BRIGHTNESS, LIGHT_MAX_BRIGHTNESS, _psychic_brightness())
	var knob := left.lerp(right, clampf(value, 0.0, 1.0))
	draw_line(left, right, Color(1, 1, 1, 0.34), 3.0)
	draw_circle(knob, 5.0, Color(0.88, 0.96, 1.0, 0.88))

func _draw_levitation_stick() -> void:
	var center := _tk_center()
	var knob_offset := 0.0
	if tk_touch != -1:
		knob_offset = clampf(tk_current.y - tk_origin.y, -LEVITATION_STICK_RANGE, LEVITATION_STICK_RANGE)
	draw_circle(center, ability_radius, Color(0.66, 0.86, 1.0, 0.20))
	draw_arc(center, ability_radius, 0.0, TAU, 40, Color(0.72, 0.9, 1.0, 0.78), 2.5)
	draw_line(center + Vector2(0, -43), center + Vector2(0, 43), Color(0.82, 0.94, 1.0, 0.56), 4.0)
	draw_circle(center + Vector2(0, knob_offset * 0.42), 24.0, Color(0.78, 0.93, 1.0, 0.45))
	var font: Font = ThemeDB.fallback_font
	var text_width: float = font.get_string_size("LEV", HORIZONTAL_ALIGNMENT_LEFT, -1, 17).x
	draw_string(font, center + Vector2(-text_width * 0.5, 6.0), "LEV", HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color(1, 1, 1, 0.88))

func _draw_ability_button(center: Vector2, label: String, active: bool, radius: float) -> void:
	var fill := Color(0.66, 0.86, 1.0, 0.24) if active else Color(1, 1, 1, 0.09)
	var ring := Color(0.72, 0.9, 1.0, 0.75) if active else Color(1, 1, 1, 0.34)
	draw_circle(center, radius, fill)
	draw_arc(center, radius, 0.0, TAU, 40, ring, 2.5)
	var font: Font = ThemeDB.fallback_font
	var font_size := 18 if label == "BUBBLE" else 20
	var text_width: float = font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	draw_string(font, center + Vector2(-text_width * 0.5, 7.0), label, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, Color(1, 1, 1, 0.82))
