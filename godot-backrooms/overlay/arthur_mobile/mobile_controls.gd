extends Control

var player: CharacterBody3D
var move_touch := -1
var look_touch := -1
var move_origin := Vector2.ZERO
var move_current := Vector2.ZERO
var joystick_radius := 168.0
var response_radius := 96.0
var knob_radius := 68.0
var ability_radius := 58.0

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_process_input(true)
	call_deferred("_find_player")

func _find_player() -> void:
	player = get_tree().get_first_node_in_group("player") as CharacterBody3D

func _orb_center() -> Vector2:
	return Vector2(size.x - 104.0, size.y - 104.0)

func _scout_center() -> Vector2:
	return Vector2(size.x - 104.0, size.y - 244.0)

func _tk_center() -> Vector2:
	return Vector2(size.x - 244.0, size.y - 104.0)

func _inside_circle(point: Vector2, center: Vector2, radius: float) -> bool:
	return point.distance_squared_to(center) <= radius * radius

func _input(event: InputEvent) -> void:
	if not OS.has_feature("mobile"):
		return
	if player == null:
		_find_player()
		if player == null:
			return

	if event is InputEventScreenTouch:
		if event.pressed:
			if _inside_circle(event.position, _scout_center(), ability_radius):
				if player.has_method("toggle_psychic_scout"):
					player.call("toggle_psychic_scout")
				queue_redraw()
				return
			if _inside_circle(event.position, _orb_center(), ability_radius):
				if player.has_method("toggle_psychic_light"):
					player.call("toggle_psychic_light")
				queue_redraw()
				return
			if _inside_circle(event.position, _tk_center(), ability_radius):
				if player.has_method("psychic_interact"):
					player.call("psychic_interact")
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
			if event.index == move_touch:
				move_touch = -1
				player.set_mobile_move(Vector2.ZERO)
				queue_redraw()
			elif event.index == look_touch:
				look_touch = -1

	elif event is InputEventScreenDrag:
		if event.index == move_touch:
			move_current = event.position
			_update_move()
			queue_redraw()
		elif event.index == look_touch:
			player.add_mobile_look(event.relative)

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

	var scout_far := player.has_method("is_psychic_scout_far") and bool(player.call("is_psychic_scout_far"))
	_draw_ability_button(_scout_center(), "FAR" if scout_far else "SCOUT", scout_far)
	_draw_ability_button(_orb_center(), "LIGHT", player.has_method("is_psychic_light_enabled") and bool(player.call("is_psychic_light_enabled")))
	_draw_ability_button(_tk_center(), "TK", player.has_method("has_psychic_hold") and bool(player.call("has_psychic_hold")))

func _draw_ability_button(center: Vector2, label: String, active: bool) -> void:
	var fill := Color(0.66, 0.86, 1.0, 0.24) if active else Color(1, 1, 1, 0.09)
	var ring := Color(0.72, 0.9, 1.0, 0.75) if active else Color(1, 1, 1, 0.34)
	draw_circle(center, ability_radius, fill)
	draw_arc(center, ability_radius, 0.0, TAU, 40, ring, 2.5)
	var font: Font = ThemeDB.fallback_font
	var text_width: float = font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, 20).x
	draw_string(font, center + Vector2(-text_width * 0.5, 7.0), label, HORIZONTAL_ALIGNMENT_LEFT, -1, 20, Color(1, 1, 1, 0.82))
