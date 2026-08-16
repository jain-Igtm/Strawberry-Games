extends CanvasLayer

signal start_pressed
signal restart_pressed
signal fire_pressed

var move_vector := Vector2.ZERO
var _look_accumulator := Vector2.ZERO
var _move_touch := -1
var _look_touch := -1
var _game_over_mode := false

var _move_pad: Panel
var _stick: Panel
var _look_pad: Control
var _fire_button: Button
var _overlay: ColorRect
var _overlay_title: Label
var _overlay_subtitle: Label
var _overlay_button: Button
var _stats: Label
var _round_label: Label

func _ready() -> void:
	_build_ui()

func consume_look_delta() -> Vector2:
	var value := _look_accumulator
	_look_accumulator = Vector2.ZERO
	return value

func update_hud(round_number: int, health: int, zombie_count: int, kills: int) -> void:
	_round_label.text = "ASHFALL  •  ROUND %d" % round_number
	_stats.text = "HEALTH %03d\nZOMBIES %02d\nKILLS %03d" % [health, zombie_count, kills]

func show_game_over(round_number: int, kills: int) -> void:
	_game_over_mode = true
	_overlay_title.text = "YOU DIED"
	_overlay_subtitle.text = "Round %d  •  %d kills\nThe town is still full of them." % [round_number, kills]
	_overlay_button.text = "RESTART"
	_overlay.visible = true

func hide_overlay() -> void:
	_overlay.visible = false

func _build_ui() -> void:
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	_round_label = Label.new()
	_round_label.position = Vector2(18, 14)
	_round_label.add_theme_font_size_override("font_size", 18)
	_round_label.add_theme_color_override("font_color", Color("#fff0bd"))
	root.add_child(_round_label)

	_stats = Label.new()
	_stats.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_stats.anchor_left = 1.0
	_stats.anchor_right = 1.0
	_stats.offset_left = -230.0
	_stats.offset_right = -18.0
	_stats.offset_top = 14.0
	_stats.offset_bottom = 110.0
	_stats.add_theme_font_size_override("font_size", 17)
	_stats.add_theme_color_override("font_color", Color("#e9dfc6"))
	root.add_child(_stats)

	var cross_h := ColorRect.new()
	cross_h.color = Color(1.0, 0.93, 0.76, 0.82)
	cross_h.anchor_left = 0.5
	cross_h.anchor_top = 0.5
	cross_h.anchor_right = 0.5
	cross_h.anchor_bottom = 0.5
	cross_h.offset_left = -7.0
	cross_h.offset_right = 7.0
	cross_h.offset_top = -1.0
	cross_h.offset_bottom = 1.0
	cross_h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(cross_h)

	var cross_v := ColorRect.new()
	cross_v.color = Color(1.0, 0.93, 0.76, 0.82)
	cross_v.anchor_left = 0.5
	cross_v.anchor_top = 0.5
	cross_v.anchor_right = 0.5
	cross_v.anchor_bottom = 0.5
	cross_v.offset_left = -1.0
	cross_v.offset_right = 1.0
	cross_v.offset_top = -7.0
	cross_v.offset_bottom = 7.0
	cross_v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(cross_v)

	_move_pad = Panel.new()
	_move_pad.anchor_top = 1.0
	_move_pad.anchor_bottom = 1.0
	_move_pad.offset_left = 22.0
	_move_pad.offset_right = 134.0
	_move_pad.offset_top = -134.0
	_move_pad.offset_bottom = -22.0
	_move_pad.mouse_filter = Control.MOUSE_FILTER_STOP
	_move_pad.add_theme_stylebox_override("panel", _round_style(Color(0.06, 0.055, 0.045, 0.58), Color(1, 1, 1, 0.22), 56))
	root.add_child(_move_pad)
	_move_pad.gui_input.connect(_on_move_input)

	_stick = Panel.new()
	_stick.size = Vector2(42, 42)
	_stick.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_stick.add_theme_stylebox_override("panel", _round_style(Color(0.96, 0.90, 0.72, 0.78), Color(1, 0.92, 0.72, 0.38), 21))
	_move_pad.add_child(_stick)
	call_deferred("_center_stick")

	_look_pad = Control.new()
	_look_pad.anchor_left = 0.35
	_look_pad.anchor_right = 0.77
	_look_pad.anchor_bottom = 1.0
	_look_pad.mouse_filter = Control.MOUSE_FILTER_STOP
	root.add_child(_look_pad)
	_look_pad.gui_input.connect(_on_look_input)

	_fire_button = Button.new()
	_fire_button.text = "FIRE"
	_fire_button.anchor_left = 1.0
	_fire_button.anchor_top = 1.0
	_fire_button.anchor_right = 1.0
	_fire_button.anchor_bottom = 1.0
	_fire_button.offset_left = -132.0
	_fire_button.offset_right = -22.0
	_fire_button.offset_top = -132.0
	_fire_button.offset_bottom = -22.0
	_fire_button.focus_mode = Control.FOCUS_NONE
	_fire_button.add_theme_font_size_override("font_size", 18)
	_fire_button.add_theme_color_override("font_color", Color("#fff0bd"))
	_fire_button.add_theme_stylebox_override("normal", _round_style(Color(0.34, 0.12, 0.08, 0.72), Color(1.0, 0.86, 0.60, 0.68), 55))
	_fire_button.add_theme_stylebox_override("pressed", _round_style(Color(0.56, 0.18, 0.08, 0.9), Color(1.0, 0.92, 0.70, 0.9), 55))
	root.add_child(_fire_button)
	_fire_button.pressed.connect(func() -> void: fire_pressed.emit())

	var touch_available := DisplayServer.is_touchscreen_available()
	_move_pad.visible = touch_available
	_look_pad.visible = touch_available
	_fire_button.visible = touch_available

	_overlay = ColorRect.new()
	_overlay.color = Color(0.01, 0.008, 0.006, 0.88)
	_overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_overlay.mouse_filter = Control.MOUSE_FILTER_STOP
	root.add_child(_overlay)

	var card := PanelContainer.new()
	card.anchor_left = 0.5
	card.anchor_top = 0.5
	card.anchor_right = 0.5
	card.anchor_bottom = 0.5
	card.offset_left = -290.0
	card.offset_right = 290.0
	card.offset_top = -175.0
	card.offset_bottom = 175.0
	card.add_theme_stylebox_override("panel", _card_style())
	_overlay.add_child(card)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 28)
	margin.add_theme_constant_override("margin_right", 28)
	margin.add_theme_constant_override("margin_top", 24)
	margin.add_theme_constant_override("margin_bottom", 24)
	card.add_child(margin)

	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 14)
	margin.add_child(column)

	var eyebrow := Label.new()
	eyebrow.text = "STRAWBERRY GAMES  •  GODOT REBUILD"
	eyebrow.add_theme_font_size_override("font_size", 14)
	eyebrow.add_theme_color_override("font_color", Color("#c49d64"))
	column.add_child(eyebrow)

	_overlay_title = Label.new()
	_overlay_title.text = "ASHFALL"
	_overlay_title.add_theme_font_size_override("font_size", 42)
	_overlay_title.add_theme_color_override("font_color", Color("#fff0bd"))
	column.add_child(_overlay_title)

	_overlay_subtitle = Label.new()
	_overlay_subtitle.text = "Sundown Village, rebuilt as a real 3D zombie game.\nLeft stick to move. Drag the middle-right screen to look. Fire on the right."
	_overlay_subtitle.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_overlay_subtitle.add_theme_font_size_override("font_size", 17)
	_overlay_subtitle.add_theme_color_override("font_color", Color("#d6cdb9"))
	column.add_child(_overlay_subtitle)

	_overlay_button = Button.new()
	_overlay_button.text = "ENTER SUNDOWN"
	_overlay_button.custom_minimum_size = Vector2(0, 58)
	_overlay_button.focus_mode = Control.FOCUS_NONE
	_overlay_button.add_theme_font_size_override("font_size", 18)
	_overlay_button.add_theme_color_override("font_color", Color("#fff0bd"))
	_overlay_button.add_theme_stylebox_override("normal", _rect_style(Color("#573720"), Color(1.0, 0.86, 0.60, 0.62), 8))
	column.add_child(_overlay_button)
	_overlay_button.pressed.connect(_on_overlay_button)

	update_hud(1, 100, 0, 0)

func _on_overlay_button() -> void:
	_overlay.visible = false
	if _game_over_mode:
		_game_over_mode = false
		restart_pressed.emit()
	else:
		start_pressed.emit()

func _on_move_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed and _move_touch == -1:
			_move_touch = event.index
			_update_move(event.position)
		elif not event.pressed and event.index == _move_touch:
			_move_touch = -1
			move_vector = Vector2.ZERO
			_center_stick()
	elif event is InputEventScreenDrag and event.index == _move_touch:
		_update_move(event.position)

func _update_move(local_position: Vector2) -> void:
	var center := _move_pad.size * 0.5
	var raw := local_position - center
	var limit := _move_pad.size.x * 0.32
	var clamped := raw.limit_length(limit)
	move_vector = Vector2(clamped.x / limit, clamped.y / limit)
	_stick.position = center - _stick.size * 0.5 + clamped

func _center_stick() -> void:
	if is_instance_valid(_move_pad) and is_instance_valid(_stick):
		_stick.position = (_move_pad.size - _stick.size) * 0.5

func _on_look_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed and _look_touch == -1:
			_look_touch = event.index
		elif not event.pressed and event.index == _look_touch:
			_look_touch = -1
	elif event is InputEventScreenDrag and event.index == _look_touch:
		_look_accumulator += event.relative

func _round_style(fill: Color, border: Color, radius: int) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.border_color = border
	style.set_border_width_all(1)
	style.corner_radius_top_left = radius
	style.corner_radius_top_right = radius
	style.corner_radius_bottom_left = radius
	style.corner_radius_bottom_right = radius
	return style

func _rect_style(fill: Color, border: Color, radius: int) -> StyleBoxFlat:
	return _round_style(fill, border, radius)

func _card_style() -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.055, 0.043, 0.032, 0.98)
	style.border_color = Color(1.0, 0.86, 0.60, 0.34)
	style.set_border_width_all(1)
	style.corner_radius_top_left = 12
	style.corner_radius_top_right = 12
	style.corner_radius_bottom_left = 12
	style.corner_radius_bottom_right = 12
	return style
