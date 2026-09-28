extends Control

var player: CharacterBody3D
var move_touch := -1
var look_touch := -1
var sprint_touch := -1
var move_origin := Vector2.ZERO
var move_current := Vector2.ZERO

const JOYSTICK_RADIUS := 142.0
const JOYSTICK_RESPONSE := 92.0
const KNOB_RADIUS := 54.0
const BUTTON_RADIUS := 48.0

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
			if _inside(event.position, _use_center(), BUTTON_RADIUS + 12.0):
				player.call("request_interact")
				queue_redraw()
				return
			if _inside(event.position, _lamp_center(), BUTTON_RADIUS + 10.0):
				player.call("toggle_headlamp")
				return
			if _inside(event.position, _sprint_center(), BUTTON_RADIUS + 14.0) and sprint_touch == -1 and player.get("piloting_boat") == null:
				sprint_touch = event.index
				player.call("set_mobile_sprint", true)
				queue_redraw()
				return
			if _inside(event.position, _joystick_center(), JOYSTICK_RADIUS + 46.0) and move_touch == -1:
				move_touch = event.index
				move_origin = _joystick_center()
				move_current = event.position
				_update_move()
				queue_redraw()
			elif look_touch == -1:
				look_touch = event.index
		else:
			if event.index == move_touch:
				move_touch = -1
				player.call("set_mobile_move", Vector2.ZERO)
				queue_redraw()
			elif event.index == look_touch:
				look_touch = -1
			elif event.index == sprint_touch:
				sprint_touch = -1
				player.call("set_mobile_sprint", false)
				queue_redraw()

	elif event is InputEventScreenDrag:
		if event.index == move_touch:
			move_current = event.position
			_update_move()
			queue_redraw()
		elif event.index == look_touch:
			player.call("add_mobile_look", event.relative)

func _update_move() -> void:
	var offset := move_current - move_origin
	if offset.length() > JOYSTICK_RADIUS:
		offset = offset.normalized() * JOYSTICK_RADIUS
	var analog := Vector2(offset.x / JOYSTICK_RESPONSE, offset.y / JOYSTICK_RESPONSE)
	player.call("set_mobile_move", analog.limit_length(1.0))

func _inside(point: Vector2, center: Vector2, radius: float) -> bool:
	return point.distance_squared_to(center) <= radius * radius

func _use_center() -> Vector2:
	return Vector2(size.x - 88.0, size.y - 104.0)

func _sprint_center() -> Vector2:
	return Vector2(size.x - 212.0, size.y - 95.0)

func _lamp_center() -> Vector2:
	return Vector2(size.x - 88.0, size.y - 222.0)

func _joystick_center() -> Vector2:
	return Vector2(172.0, size.y - 165.0)

func _draw() -> void:
	if not OS.has_feature("mobile"):
		return
	var stick_center := _joystick_center()
	var stick_knob := stick_center
	if move_touch != -1:
		var offset := move_current - move_origin
		if offset.length() > JOYSTICK_RADIUS:
			offset = offset.normalized() * JOYSTICK_RADIUS
		stick_knob = move_origin + offset

	draw_circle(stick_center, JOYSTICK_RADIUS, Color(0.78, 0.88, 0.94, 0.08))
	draw_arc(stick_center, JOYSTICK_RADIUS, 0.0, TAU, 64, Color(0.84, 0.93, 0.98, 0.34), 3.0)
	draw_circle(stick_knob, KNOB_RADIUS, Color(0.78, 0.88, 0.94, 0.18))
	draw_arc(stick_knob, KNOB_RADIUS, 0.0, TAU, 44, Color(0.88, 0.95, 1.0, 0.52), 3.0)

	var piloting := player != null and player.get("piloting_boat") != null
	_draw_button(_use_center(), "LEAVE" if piloting else "USE", false)
	if not piloting:
		_draw_button(_sprint_center(), "RUN", sprint_touch != -1)
	_draw_button(_lamp_center(), "LAMP", player != null and bool(player.get("lamp_on")))

func _draw_button(center: Vector2, label: String, active: bool) -> void:
	var fill := Color(0.55, 0.76, 0.84, 0.28) if active else Color(0.11, 0.18, 0.22, 0.32)
	var line := Color(0.83, 0.93, 0.98, 0.72) if active else Color(0.80, 0.90, 0.95, 0.44)
	draw_circle(center, BUTTON_RADIUS, fill)
	draw_arc(center, BUTTON_RADIUS, 0.0, TAU, 40, line, 3.0)
	var font := ThemeDB.fallback_font
	var font_size := 16
	var text_size := font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size)
	draw_string(font, center - Vector2(text_size.x * 0.5, -5.5), label, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, Color(0.94, 0.98, 1.0, 0.9))
