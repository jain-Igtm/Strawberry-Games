extends CanvasLayer

var move_vector := Vector2.ZERO
var sprint_held := false

var _look_delta := Vector2.ZERO
var _jump_latched := false
var _move_finger := -1
var _look_finger := -1
var _jump_finger := -1
var _sprint_finger := -1
var _look_last := Vector2.ZERO
var _stick_center := Vector2.ZERO

var _root: Control
var _stick_base: Panel
var _stick_knob: Panel
var _jump_button: Panel
var _sprint_button: Panel
var _jump_label: Label
var _sprint_label: Label

const STICK_RADIUS := 62.0
const KNOB_RADIUS := 28.0

func _ready() -> void:
    if not OS.has_feature("mobile"):
        visible = false
        return
    _build_ui()
    get_viewport().size_changed.connect(_layout_buttons)
    _layout_buttons()

func consume_look_delta() -> Vector2:
    var result := _look_delta
    _look_delta = Vector2.ZERO
    return result

func consume_jump() -> bool:
    var result := _jump_latched
    _jump_latched = false
    return result

func _build_ui() -> void:
    _root = Control.new()
    _root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    _root.mouse_filter = Control.MOUSE_FILTER_IGNORE
    add_child(_root)

    _stick_base = Panel.new()
    _stick_base.size = Vector2.ONE * STICK_RADIUS * 2.0
    _stick_base.mouse_filter = Control.MOUSE_FILTER_IGNORE
    _stick_base.add_theme_stylebox_override("panel", _circle_style(Color(0.03, 0.045, 0.035, 0.34), 2, Color(0.84, 0.92, 0.80, 0.18), STICK_RADIUS))
    _root.add_child(_stick_base)

    _stick_knob = Panel.new()
    _stick_knob.size = Vector2.ONE * KNOB_RADIUS * 2.0
    _stick_knob.mouse_filter = Control.MOUSE_FILTER_IGNORE
    _stick_knob.add_theme_stylebox_override("panel", _circle_style(Color(0.86, 0.92, 0.82, 0.26), 1, Color(1, 1, 1, 0.22), KNOB_RADIUS))
    _root.add_child(_stick_knob)

    _jump_button = Panel.new()
    _jump_button.size = Vector2(78, 78)
    _jump_button.mouse_filter = Control.MOUSE_FILTER_IGNORE
    _jump_button.add_theme_stylebox_override("panel", _circle_style(Color(0.04, 0.055, 0.045, 0.36), 2, Color(0.9, 0.96, 0.88, 0.22), 39))
    _root.add_child(_jump_button)

    _jump_label = Label.new()
    _jump_label.text = "JUMP"
    _jump_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    _jump_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
    _jump_label.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    _jump_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
    _jump_label.add_theme_font_size_override("font_size", 12)
    _jump_label.add_theme_color_override("font_color", Color(1, 1, 1, 0.76))
    _jump_button.add_child(_jump_label)

    _sprint_button = Panel.new()
    _sprint_button.size = Vector2(68, 68)
    _sprint_button.mouse_filter = Control.MOUSE_FILTER_IGNORE
    _sprint_button.add_theme_stylebox_override("panel", _circle_style(Color(0.04, 0.055, 0.045, 0.31), 2, Color(0.9, 0.96, 0.88, 0.17), 34))
    _root.add_child(_sprint_button)

    _sprint_label = Label.new()
    _sprint_label.text = "RUN"
    _sprint_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    _sprint_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
    _sprint_label.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    _sprint_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
    _sprint_label.add_theme_font_size_override("font_size", 11)
    _sprint_label.add_theme_color_override("font_color", Color(1, 1, 1, 0.72))
    _sprint_button.add_child(_sprint_label)

func _circle_style(fill: Color, border_width: int, border: Color, radius: float) -> StyleBoxFlat:
    var style := StyleBoxFlat.new()
    style.bg_color = fill
    style.border_color = border
    style.set_border_width_all(border_width)
    style.corner_radius_top_left = int(radius)
    style.corner_radius_top_right = int(radius)
    style.corner_radius_bottom_left = int(radius)
    style.corner_radius_bottom_right = int(radius)
    return style

func _layout_buttons() -> void:
    if _root == null:
        return
    var size := get_viewport().get_visible_rect().size
    _stick_center = Vector2(104.0, size.y - 104.0)
    _position_stick(_stick_center, Vector2.ZERO)
    _jump_button.position = Vector2(size.x - 102.0, size.y - 118.0)
    _sprint_button.position = Vector2(size.x - 184.0, size.y - 190.0)

func _position_stick(center: Vector2, offset: Vector2) -> void:
    _stick_base.position = center - Vector2.ONE * STICK_RADIUS
    _stick_knob.position = center + offset - Vector2.ONE * KNOB_RADIUS

func _input(event: InputEvent) -> void:
    if not OS.has_feature("mobile"):
        return
    if event is InputEventScreenTouch:
        _handle_touch(event)
    elif event is InputEventScreenDrag:
        _handle_drag(event)

func _handle_touch(event: InputEventScreenTouch) -> void:
    var size := get_viewport().get_visible_rect().size
    if event.pressed:
        if _rect_for(_jump_button).has_point(event.position):
            _jump_finger = event.index
            _jump_latched = true
            return
        if _rect_for(_sprint_button).has_point(event.position):
            _sprint_finger = event.index
            sprint_held = true
            return
        if event.position.x < size.x * 0.43 and event.position.y > size.y * 0.30 and _move_finger == -1:
            _move_finger = event.index
            _stick_center = event.position
            _update_stick(event.position)
            return
        if _look_finger == -1:
            _look_finger = event.index
            _look_last = event.position
    else:
        if event.index == _move_finger:
            _move_finger = -1
            move_vector = Vector2.ZERO
            _stick_center = Vector2(104.0, size.y - 104.0)
            _position_stick(_stick_center, Vector2.ZERO)
        elif event.index == _look_finger:
            _look_finger = -1
        elif event.index == _jump_finger:
            _jump_finger = -1
        elif event.index == _sprint_finger:
            _sprint_finger = -1
            sprint_held = false

func _handle_drag(event: InputEventScreenDrag) -> void:
    if event.index == _move_finger:
        _update_stick(event.position)
    elif event.index == _look_finger:
        var delta := event.position - _look_last
        _look_delta += delta
        _look_last = event.position

func _update_stick(position: Vector2) -> void:
    var offset := (position - _stick_center).limit_length(STICK_RADIUS)
    move_vector = offset / STICK_RADIUS
    if move_vector.length() < 0.12:
        move_vector = Vector2.ZERO
    _position_stick(_stick_center, offset)

func _rect_for(control: Control) -> Rect2:
    return Rect2(control.position, control.size)
