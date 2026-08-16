extends CanvasLayer

signal start_pressed
signal restart_pressed
signal reload_pressed
signal use_pressed
signal swap_pressed
signal ads_pressed
signal jump_pressed
signal pause_pressed
signal resume_pressed
signal sensitivity_pressed
signal brightness_pressed

var move_vector := Vector2.ZERO
var fire_held := false
var _look_accumulator := Vector2.ZERO
var _move_touch := -1
var _look_touch := -1
var _game_over := false

var _root: Control
var _hud: Control
var _joystick: Panel
var _knob: Panel
var _look_pad: Control
var _health_fill: ColorRect
var _health_value: Label
var _kills_value: Label
var _score_value: Label
var _ammo_value: Label
var _reserve_value: Label
var _weapon_label: Label
var _wave_value: Label
var _district_label: Label
var _toast: Label
var _hit_marker: Label
var _wave_banner: Label
var _damage_vignette: ColorRect
var _start_screen: ColorRect
var _game_over_screen: ColorRect
var _final_score: Label
var _pause_screen: ColorRect
var _pause_sensitivity: Button
var _pause_brightness: Button
var _scope_overlay: Control

func _ready() -> void:
	_build_ui()

func consume_look_delta() -> Vector2:
	var value := _look_accumulator
	_look_accumulator = Vector2.ZERO
	return value

func update_hud(wave: int, health: float, kills: int, score: int, ammo: int, reserve: int, weapon_name: String) -> void:
	_wave_value.text = str(wave)
	_health_value.text = "%03d" % int(round(health))
	_health_fill.size.x = 126.0 * clampf(health / 100.0, 0.0, 1.0)
	_kills_value.text = str(kills)
	_score_value.text = str(score)
	_ammo_value.text = "%02d" % ammo
	_reserve_value.text = "%03d" % reserve
	_weapon_label.text = weapon_name

func set_district(text_value: String) -> void:
	_district_label.text = text_value

func set_reloading(reloading: bool) -> void:
	_ammo_value.modulate = Color("#ffad7f") if reloading else Color("#ffe2bf")

func set_ads(active: bool) -> void:
	_scope_overlay.visible = active

func flash_hit(killed: bool) -> void:
	_hit_marker.text = "✕" if not killed else "✦"
	_hit_marker.modulate = Color.WHITE if not killed else Color("#ff7649")
	_hit_marker.visible = true
	var timer := get_tree().create_timer(0.09 if not killed else 0.14)
	timer.timeout.connect(func() -> void:
		if is_instance_valid(_hit_marker): _hit_marker.visible = false
	)

func flash_damage() -> void:
	_damage_vignette.visible = true
	var timer := get_tree().create_timer(0.16)
	timer.timeout.connect(func() -> void:
		if is_instance_valid(_damage_vignette): _damage_vignette.visible = false
	)

func show_toast(text_value: String, seconds := 1.5) -> void:
	_toast.text = text_value
	_toast.visible = true
	var timer := get_tree().create_timer(seconds)
	timer.timeout.connect(func() -> void:
		if is_instance_valid(_toast) and _toast.text == text_value: _toast.visible = false
	)

func show_wave_banner(wave: int, total: int) -> void:
	_wave_banner.text = "WAVE %d\n%d INFECTED" % [wave, total]
	_wave_banner.visible = true
	var timer := get_tree().create_timer(1.8)
	timer.timeout.connect(func() -> void:
		if is_instance_valid(_wave_banner): _wave_banner.visible = false
	)

func show_game_over(score: int, kills: int, wave: int) -> void:
	_game_over = true
	_final_score.text = "SCORE %d   •   KILLS %d   •   WAVE %d" % [score, kills, wave]
	_game_over_screen.visible = true
	fire_held = false

func hide_start() -> void:
	_start_screen.visible = false

func hide_game_over() -> void:
	_game_over_screen.visible = false
	_game_over = false

func set_paused(paused: bool, sensitivity_label: String = "FAST", brightness_label: String = "HIGH") -> void:
	_pause_screen.visible = paused
	fire_held = false if paused else fire_held
	_pause_sensitivity.text = "LOOK: " + sensitivity_label
	_pause_brightness.text = "BRIGHTNESS: " + brightness_label

func _build_ui() -> void:
	_root = Control.new()
	_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)

	_hud = Control.new()
	_hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(_hud)

	_build_top_hud()
	_build_status_hud()
	_build_crosshair()
	_build_touch_controls()
	_build_overlays()
	_build_screens()

func _build_top_hud() -> void:
	var brand := VBoxContainer.new()
	brand.position = Vector2(14, 12)
	brand.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_hud.add_child(brand)
	var eyebrow := _label("ASHFALL", 11, Color("#b77b5d"))
	brand.add_child(eyebrow)
	_district_label = _label("DOCK TOWN", 16, Color("#d7c7ae"))
	brand.add_child(_district_label)

	var wave_panel := PanelContainer.new()
	wave_panel.anchor_left = 1.0
	wave_panel.anchor_right = 1.0
	wave_panel.offset_left = -84
	wave_panel.offset_right = -14
	wave_panel.offset_top = 12
	wave_panel.offset_bottom = 70
	wave_panel.add_theme_stylebox_override("panel", _box(Color(0.12,0.05,0.03,0.72), Color(0.88,0.43,0.24,0.42), 0))
	_hud.add_child(wave_panel)
	var wave_column := VBoxContainer.new()
	wave_column.alignment = BoxContainer.ALIGNMENT_CENTER
	wave_panel.add_child(wave_column)
	var wave_text := _label("WAVE", 10, Color("#b77b5d"))
	wave_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	wave_column.add_child(wave_text)
	_wave_value = _label("1", 27, Color("#ff9c59"))
	_wave_value.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	wave_column.add_child(_wave_value)

	var pause := _round_button("Ⅱ", 42)
	pause.anchor_left = 1.0
	pause.anchor_right = 1.0
	pause.offset_left = -136
	pause.offset_right = -94
	pause.offset_top = 12
	pause.offset_bottom = 54
	_hud.add_child(pause)
	pause.pressed.connect(func() -> void: pause_pressed.emit())

func _build_status_hud() -> void:
	var status := PanelContainer.new()
	status.anchor_top = 1.0
	status.anchor_bottom = 1.0
	status.offset_left = 14
	status.offset_right = 264
	status.offset_top = -72
	status.offset_bottom = -14
	status.add_theme_stylebox_override("panel", _left_panel_style())
	_hud.add_child(status)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 4)
	status.add_child(column)
	var row := HBoxContainer.new()
	column.add_child(row)
	row.add_child(_label("HEALTH", 10, Color("#c9b9a5")))
	var meter := Control.new()
	meter.custom_minimum_size = Vector2(134, 9)
	row.add_child(meter)
	var meter_back := ColorRect.new()
	meter_back.color = Color(1,1,1,0.12)
	meter_back.position = Vector2(4,1)
	meter_back.size = Vector2(126,7)
	meter.add_child(meter_back)
	_health_fill = ColorRect.new()
	_health_fill.color = Color("#c84b31")
	_health_fill.position = Vector2(4,1)
	_health_fill.size = Vector2(126,7)
	meter.add_child(_health_fill)
	_health_value = _label("100", 15, Color("#ffc7a9"))
	row.add_child(_health_value)
	var score_row := HBoxContainer.new()
	score_row.add_theme_constant_override("separation", 20)
	column.add_child(score_row)
	score_row.add_child(_label("KILLS", 9, Color("#95867a")))
	_kills_value = _label("0", 10, Color("#d8c7b2"))
	score_row.add_child(_kills_value)
	score_row.add_child(_label("POINTS", 9, Color("#95867a")))
	_score_value = _label("0", 10, Color("#d8c7b2"))
	score_row.add_child(_score_value)

	var ammo := VBoxContainer.new()
	ammo.anchor_left = 1.0
	ammo.anchor_top = 1.0
	ammo.anchor_right = 1.0
	ammo.anchor_bottom = 1.0
	ammo.offset_left = -210
	ammo.offset_right = -16
	ammo.offset_top = -92
	ammo.offset_bottom = -13
	ammo.alignment = BoxContainer.ALIGNMENT_END
	_hud.add_child(ammo)
	_weapon_label = _label("RUSTLINE CARBINE", 9, Color("#aa765b"))
	_weapon_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	ammo.add_child(_weapon_label)
	var ammo_row := HBoxContainer.new()
	ammo_row.alignment = BoxContainer.ALIGNMENT_END
	ammo.add_child(ammo_row)
	_ammo_value = _label("30", 40, Color("#ffe2bf"))
	ammo_row.add_child(_ammo_value)
	ammo_row.add_child(_label(" / ", 22, Color("#8a5f4a")))
	_reserve_value = _label("180", 22, Color("#bfae99"))
	ammo_row.add_child(_reserve_value)

func _build_crosshair() -> void:
	for rect in [Rect2(-1,-12,2,7),Rect2(-1,5,2,7),Rect2(-12,-1,7,2),Rect2(5,-1,7,2)]:
		var piece := ColorRect.new()
		piece.color = Color(1.0,0.91,0.79,0.82)
		piece.anchor_left = 0.5
		piece.anchor_top = 0.5
		piece.anchor_right = 0.5
		piece.anchor_bottom = 0.5
		piece.position = rect.position
		piece.size = rect.size
		piece.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_hud.add_child(piece)
	_hit_marker = _label("✕", 30, Color.WHITE)
	_hit_marker.anchor_left = 0.5
	_hit_marker.anchor_top = 0.5
	_hit_marker.anchor_right = 0.5
	_hit_marker.anchor_bottom = 0.5
	_hit_marker.offset_left = -18
	_hit_marker.offset_right = 18
	_hit_marker.offset_top = -22
	_hit_marker.offset_bottom = 22
	_hit_marker.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hit_marker.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_hit_marker.visible = false
	_hud.add_child(_hit_marker)

func _build_touch_controls() -> void:
	_look_pad = Control.new()
	_look_pad.anchor_left = 0.37
	_look_pad.anchor_right = 1.0
	_look_pad.anchor_bottom = 1.0
	_look_pad.mouse_filter = Control.MOUSE_FILTER_STOP
	_hud.add_child(_look_pad)
	_look_pad.gui_input.connect(_on_look_input)

	_joystick = Panel.new()
	_joystick.anchor_top = 1.0
	_joystick.anchor_bottom = 1.0
	_joystick.offset_left = 22
	_joystick.offset_right = 138
	_joystick.offset_top = -180
	_joystick.offset_bottom = -64
	_joystick.mouse_filter = Control.MOUSE_FILTER_STOP
	_joystick.add_theme_stylebox_override("panel", _circle_style(Color(0.11,0.055,0.043,0.34), Color(0.92,0.70,0.56,0.32), 58))
	_hud.add_child(_joystick)
	_joystick.gui_input.connect(_on_move_input)
	_knob = Panel.new()
	_knob.size = Vector2(44,44)
	_knob.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_knob.add_theme_stylebox_override("panel", _circle_style(Color(0.68,0.30,0.18,0.62), Color(1.0,0.81,0.67,0.45), 22))
	_joystick.add_child(_knob)
	call_deferred("_center_knob")

	var fire := _round_button("FIRE", 92, true)
	_anchor_bottom_right(fire, 20, 57, 92, 92)
	_hud.add_child(fire)
	fire.button_down.connect(func() -> void: fire_held = true)
	fire.button_up.connect(func() -> void: fire_held = false)

	var reload := _round_button("RLD", 62)
	_anchor_bottom_right(reload, 102, 103, 62, 62)
	_hud.add_child(reload)
	reload.pressed.connect(func() -> void: reload_pressed.emit())

	var use := _round_button("USE", 62)
	_anchor_bottom_right(use, 108, 23, 62, 62)
	_hud.add_child(use)
	use.pressed.connect(func() -> void: use_pressed.emit())

	var swap := _round_button("SWP", 62)
	_anchor_bottom_right(swap, 169, 96, 62, 62)
	_hud.add_child(swap)
	swap.pressed.connect(func() -> void: swap_pressed.emit())

	var ads := _round_button("ADS", 62)
	_anchor_bottom_right(ads, 172, 25, 62, 62)
	_hud.add_child(ads)
	ads.pressed.connect(func() -> void: ads_pressed.emit())

	var jump := _round_button("JMP", 56)
	_anchor_bottom_right(jump, 236, 25, 56, 56)
	_hud.add_child(jump)
	jump.pressed.connect(func() -> void: jump_pressed.emit())

	var touch_available := DisplayServer.is_touchscreen_available()
	_joystick.visible = touch_available
	_look_pad.visible = touch_available
	fire.visible = touch_available
	reload.visible = touch_available
	use.visible = touch_available
	swap.visible = touch_available
	ads.visible = touch_available
	jump.visible = touch_available

func _build_overlays() -> void:
	_damage_vignette = ColorRect.new()
	_damage_vignette.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_damage_vignette.color = Color(0.48,0.04,0.02,0.36)
	_damage_vignette.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_damage_vignette.visible = false
	_hud.add_child(_damage_vignette)

	_toast = _label("", 12, Color("#f2d8ba"))
	_toast.anchor_left = 0.5
	_toast.anchor_top = 0.76
	_toast.anchor_right = 0.5
	_toast.anchor_bottom = 0.76
	_toast.offset_left = -260
	_toast.offset_right = 260
	_toast.offset_top = -20
	_toast.offset_bottom = 20
	_toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_toast.visible = false
	_hud.add_child(_toast)

	_wave_banner = _label("", 18, Color("#f1dfc7"))
	_wave_banner.anchor_left = 0.5
	_wave_banner.anchor_top = 0.19
	_wave_banner.anchor_right = 0.5
	_wave_banner.anchor_bottom = 0.19
	_wave_banner.offset_left = -220
	_wave_banner.offset_right = 220
	_wave_banner.offset_top = -28
	_wave_banner.offset_bottom = 38
	_wave_banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_wave_banner.visible = false
	_hud.add_child(_wave_banner)

	_scope_overlay = Control.new()
	_scope_overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_scope_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_scope_overlay.visible = false
	_hud.add_child(_scope_overlay)
	for spec in [Rect2(0,0,0.22,1),Rect2(0.78,0,0.22,1),Rect2(0.22,0,0.56,0.17),Rect2(0.22,0.83,0.56,0.17)]:
		var shade := ColorRect.new()
		shade.color = Color(0,0,0,0.92)
		shade.anchor_left = spec.position.x
		shade.anchor_top = spec.position.y
		shade.anchor_right = spec.position.x + spec.size.x
		shade.anchor_bottom = spec.position.y + spec.size.y
		shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_scope_overlay.add_child(shade)

func _build_screens() -> void:
	_start_screen = _screen_backdrop()
	_root.add_child(_start_screen)
	var start_card := _screen_card(_start_screen, 610, 330)
	var start_column := VBoxContainer.new()
	start_column.add_theme_constant_override("separation", 13)
	start_card.add_child(start_column)
	start_column.add_child(_label("STRAWBERRY GAMES • DEADWATER", 12, Color("#c78962")))
	var title := _label("ASHFALL", 58, Color("#eee0cb"))
	start_column.add_child(title)
	var subtitle := _label("DOCK TOWN", 26, Color("#d35d35"))
	start_column.add_child(subtitle)
	var copy := _label("The sirens are already running. Hold the streets.\nLeft stick moves • right side looks • FIRE shoots • RLD reloads • JMP jumps • USE interacts.", 15, Color("#c9b9a5"))
	copy.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	start_column.add_child(copy)
	var start_button := Button.new()
	start_button.text = "ENTER DEADWATER"
	start_button.custom_minimum_size = Vector2(0,56)
	start_button.focus_mode = Control.FOCUS_NONE
	start_button.add_theme_font_size_override("font_size", 17)
	start_button.add_theme_stylebox_override("normal", _box(Color("#5d2418"), Color("#df7548"), 3))
	start_column.add_child(start_button)
	start_button.pressed.connect(func() -> void:
		hide_start()
		start_pressed.emit()
	)

	_game_over_screen = _screen_backdrop()
	_game_over_screen.visible = false
	_root.add_child(_game_over_screen)
	var over_card := _screen_card(_game_over_screen, 500, 280)
	var over_column := VBoxContainer.new()
	over_column.add_theme_constant_override("separation", 18)
	over_card.add_child(over_column)
	over_column.add_child(_label("DEADWATER SYSTEMS", 12, Color("#c78962")))
	over_column.add_child(_label("YOU DIED", 54, Color("#eee0cb")))
	_final_score = _label("", 15, Color("#c9b9a5"))
	over_column.add_child(_final_score)
	var restart := Button.new()
	restart.text = "RESTART"
	restart.custom_minimum_size = Vector2(0,55)
	restart.focus_mode = Control.FOCUS_NONE
	restart.add_theme_font_size_override("font_size", 17)
	restart.add_theme_stylebox_override("normal", _box(Color("#5d2418"), Color("#df7548"), 3))
	over_column.add_child(restart)
	restart.pressed.connect(func() -> void:
		hide_game_over()
		restart_pressed.emit()
	)

	_pause_screen = _screen_backdrop()
	_pause_screen.visible = false
	_root.add_child(_pause_screen)
	var pause_card := _screen_card(_pause_screen, 430, 340)
	var pause_column := VBoxContainer.new()
	pause_column.add_theme_constant_override("separation", 10)
	pause_card.add_child(pause_column)
	pause_column.add_child(_label("DEADWATER SYSTEMS", 12, Color("#c78962")))
	pause_column.add_child(_label("PAUSED", 48, Color("#eee0cb")))
	var resume := Button.new()
	resume.text = "RESUME"
	resume.custom_minimum_size = Vector2(0,52)
	resume.focus_mode = Control.FOCUS_NONE
	resume.add_theme_stylebox_override("normal", _box(Color("#5d2418"), Color("#df7548"), 3))
	pause_column.add_child(resume)
	resume.pressed.connect(func() -> void: resume_pressed.emit())
	_pause_sensitivity = Button.new()
	_pause_sensitivity.text = "LOOK: FAST"
	_pause_sensitivity.custom_minimum_size = Vector2(0,48)
	_pause_sensitivity.focus_mode = Control.FOCUS_NONE
	_pause_sensitivity.add_theme_stylebox_override("normal", _box(Color("#411c13"), Color(0.85,0.46,0.26,0.4), 3))
	pause_column.add_child(_pause_sensitivity)
	_pause_sensitivity.pressed.connect(func() -> void: sensitivity_pressed.emit())
	_pause_brightness = Button.new()
	_pause_brightness.text = "BRIGHTNESS: HIGH"
	_pause_brightness.custom_minimum_size = Vector2(0,48)
	_pause_brightness.focus_mode = Control.FOCUS_NONE
	_pause_brightness.add_theme_stylebox_override("normal", _box(Color("#411c13"), Color(0.85,0.46,0.26,0.4), 3))
	pause_column.add_child(_pause_brightness)
	_pause_brightness.pressed.connect(func() -> void: brightness_pressed.emit())

func _on_move_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed and _move_touch == -1:
			_move_touch = event.index
			_update_move(event.position)
		elif not event.pressed and event.index == _move_touch:
			_move_touch = -1
			move_vector = Vector2.ZERO
			_center_knob()
	elif event is InputEventScreenDrag and event.index == _move_touch:
		_update_move(event.position)

func _update_move(local_position: Vector2) -> void:
	var center := _joystick.size * 0.5
	var offset := local_position - center
	var maximum := _joystick.size.x * 0.31
	offset = offset.limit_length(maximum)
	move_vector = Vector2(offset.x / maximum, offset.y / maximum)
	_knob.position = center - _knob.size * 0.5 + offset

func _center_knob() -> void:
	if is_instance_valid(_joystick) and is_instance_valid(_knob):
		_knob.position = (_joystick.size - _knob.size) * 0.5

func _on_look_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed and _look_touch == -1:
			_look_touch = event.index
		elif not event.pressed and event.index == _look_touch:
			_look_touch = -1
	elif event is InputEventScreenDrag and event.index == _look_touch:
		_look_accumulator += event.relative

func _anchor_bottom_right(control: Control, right_gap: float, bottom_gap: float, width: float, height: float) -> void:
	control.anchor_left = 1.0
	control.anchor_top = 1.0
	control.anchor_right = 1.0
	control.anchor_bottom = 1.0
	control.offset_left = -right_gap - width
	control.offset_right = -right_gap
	control.offset_top = -bottom_gap - height
	control.offset_bottom = -bottom_gap

func _round_button(text_value: String, size_value: int, fire_style := false) -> Button:
	var button := Button.new()
	button.text = text_value
	button.custom_minimum_size = Vector2(size_value,size_value)
	button.focus_mode = Control.FOCUS_NONE
	button.add_theme_font_size_override("font_size", 11 if not fire_style else 14)
	button.add_theme_color_override("font_color", Color("#f4dcc1"))
	var fill := Color(0.21,0.095,0.067,0.66) if not fire_style else Color(0.45,0.13,0.075,0.78)
	var border := Color(0.87,0.52,0.33,0.48) if not fire_style else Color(1.0,0.60,0.38,0.66)
	button.add_theme_stylebox_override("normal", _circle_style(fill,border,size_value/2))
	button.add_theme_stylebox_override("pressed", _circle_style(fill.lightened(0.15),border.lightened(0.12),size_value/2))
	return button

func _label(text_value: String, size_value: int, color: Color) -> Label:
	var label := Label.new()
	label.text = text_value
	label.add_theme_font_size_override("font_size", size_value)
	label.add_theme_color_override("font_color", color)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return label

func _screen_backdrop() -> ColorRect:
	var screen := ColorRect.new()
	screen.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	screen.color = Color(0.03,0.018,0.016,0.92)
	screen.mouse_filter = Control.MOUSE_FILTER_STOP
	return screen

func _screen_card(screen: Control, width: float, height: float) -> MarginContainer:
	var panel := PanelContainer.new()
	panel.anchor_left = 0.5
	panel.anchor_top = 0.5
	panel.anchor_right = 0.5
	panel.anchor_bottom = 0.5
	panel.offset_left = -width*0.5
	panel.offset_right = width*0.5
	panel.offset_top = -height*0.5
	panel.offset_bottom = height*0.5
	panel.add_theme_stylebox_override("panel", _box(Color(0.09,0.045,0.035,0.98), Color(0.9,0.48,0.27,0.42), 6))
	screen.add_child(panel)
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 28)
	margin.add_theme_constant_override("margin_right", 28)
	margin.add_theme_constant_override("margin_top", 25)
	margin.add_theme_constant_override("margin_bottom", 25)
	panel.add_child(margin)
	return margin

func _box(fill: Color, border: Color, radius: int) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.border_color = border
	style.border_width_left = 1
	style.border_width_right = 1
	style.border_width_top = 1
	style.border_width_bottom = 1
	style.corner_radius_top_left = radius
	style.corner_radius_top_right = radius
	style.corner_radius_bottom_left = radius
	style.corner_radius_bottom_right = radius
	return style

func _circle_style(fill: Color, border: Color, radius: int) -> StyleBoxFlat:
	return _box(fill,border,radius)

func _left_panel_style() -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.07,0.03,0.025,0.64)
	style.border_color = Color("#a2472c")
	style.border_width_left = 2
	return style
