extends Control

var player: CharacterBody3D
var move_touch := -1
var look_touch := -1
var move_origin := Vector2.ZERO
var move_current := Vector2.ZERO
var joystick_radius := 126.0
var knob_radius := 52.0

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_process_input(true)
	call_deferred("_find_player")

func _find_player() -> void:
	player = get_tree().get_first_node_in_group("player") as CharacterBody3D

func _input(event: InputEvent) -> void:
	if not OS.has_feature("mobile"):
		return
	if player == null:
		_find_player()
		if player == null:
			return

	if event is InputEventScreenTouch:
		if event.pressed:
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
	var analog := Vector2(delta.x / joystick_radius, -delta.y / joystick_radius)
	player.set_mobile_move(analog.limit_length(1.0))

func _draw() -> void:
	if not OS.has_feature("mobile"):
		return
	var ghost_center := Vector2(158.0, size.y - 158.0)
	if move_touch == -1:
		draw_circle(ghost_center, joystick_radius, Color(1, 1, 1, 0.075))
		draw_arc(ghost_center, joystick_radius, 0.0, TAU, 56, Color(1, 1, 1, 0.24), 2.5)
		draw_circle(ghost_center, knob_radius, Color(1, 1, 1, 0.12))
	else:
		var delta := move_current - move_origin
		if delta.length() > joystick_radius:
			delta = delta.normalized() * joystick_radius
		draw_circle(move_origin, joystick_radius, Color(1, 1, 1, 0.08))
		draw_arc(move_origin, joystick_radius, 0.0, TAU, 56, Color(1, 1, 1, 0.33), 2.5)
		draw_circle(move_origin + delta, knob_radius, Color(1, 1, 1, 0.22))
		draw_arc(move_origin + delta, knob_radius, 0.0, TAU, 40, Color(1, 1, 1, 0.48), 2.5)
