extends Control

var player: CharacterBody3D
var heater: Node

const ICE := Color(0.86, 0.94, 0.98, 0.96)
const MUTED := Color(0.68, 0.79, 0.84, 0.88)
const PANEL := Color(0.025, 0.055, 0.075, 0.74)

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	call_deferred("_find_nodes")

func _find_nodes() -> void:
	player = get_tree().get_first_node_in_group("player") as CharacterBody3D
	heater = get_tree().get_first_node_in_group("heater")

func _process(_delta: float) -> void:
	if player == null:
		_find_nodes()
	if heater == null:
		heater = get_tree().get_first_node_in_group("heater")
	queue_redraw()

func _draw() -> void:
	if player == null:
		return

	draw_rect(Rect2(20.0, 18.0, 292.0, 218.0), PANEL, true)
	draw_rect(Rect2(20.0, 18.0, 292.0, 3.0), Color(0.55, 0.75, 0.83, 0.8), true)
	_draw_text("ALASKA EXPLORER", Vector2(34.0, 48.0), 20, ICE)
	_draw_text("EARLY WINTER  //  -18°C", Vector2(34.0, 70.0), 13, MUTED)

	var core := float(player.get("core_temperature"))
	var thermal_state := str(player.call("get_thermal_state"))
	_draw_text("CORE  %.1f°C   %s" % [core, thermal_state], Vector2(34.0, 98.0), 15, _core_color(core))
	_draw_bar(Vector2(34.0, 108.0), "HEALTH", float(player.get("health")), Color(0.74, 0.28, 0.26))
	_draw_bar(Vector2(34.0, 137.0), "HUNGER", float(player.get("hunger")), Color(0.72, 0.58, 0.27))
	_draw_bar(Vector2(34.0, 166.0), "STAMINA", float(player.get("stamina")), Color(0.35, 0.70, 0.73))
	_draw_bar(Vector2(34.0, 195.0), "DRY", 100.0 - float(player.get("wetness")), Color(0.52, 0.72, 0.86))

	var heater_text := "DIESEL HEAT  --"
	var heater_color := MUTED
	if heater != null:
		var fuel := float(heater.get("fuel"))
		var burning := bool(heater.get("burning"))
		heater_text = "DIESEL HEAT  %d%%  %s" % [roundi(fuel), "BURNING" if burning else "OFF"]
		heater_color = Color(1.0, 0.67, 0.38, 0.98) if burning else MUTED
	_draw_text(heater_text, Vector2(34.0, 226.0), 13, heater_color)

	var center_width := minf(620.0, size.x - 360.0)
	var center_x := (size.x - center_width) * 0.5
	_draw_text("KEEP WARM  ·  STAY DRY  ·  FOLLOW THE RIVER", Vector2(center_x, 38.0), 14, Color(0.86, 0.94, 0.98, 0.72), center_width, HORIZONTAL_ALIGNMENT_CENTER)

	if not OS.has_feature("mobile"):
		_draw_text("WASD MOVE   SHIFT RUN   E USE   F LAMP", Vector2(size.x - 430.0, 38.0), 13, MUTED, 402.0, HORIZONTAL_ALIGNMENT_RIGHT)

	var prompt := str(player.get("interaction_prompt"))
	if prompt != "":
		var prefix := "USE  ·  " if OS.has_feature("mobile") else "E  ·  "
		draw_rect(Rect2(size.x * 0.5 - 235.0, size.y - 103.0, 470.0, 39.0), Color(0.02, 0.05, 0.065, 0.74), true)
		_draw_text(prefix + prompt, Vector2(size.x * 0.5 - 220.0, size.y - 78.0), 16, ICE, 440.0, HORIZONTAL_ALIGNMENT_CENTER)

	var message := str(player.call("get_status_message"))
	if message != "":
		draw_rect(Rect2(size.x * 0.5 - 260.0, size.y - 158.0, 520.0, 38.0), Color(0.035, 0.07, 0.08, 0.82), true)
		_draw_text(message, Vector2(size.x * 0.5 - 245.0, size.y - 133.0), 16, Color(1.0, 0.89, 0.72, 0.98), 490.0, HORIZONTAL_ALIGNMENT_CENTER)

	if bool(player.get("is_dead")):
		draw_rect(Rect2(0.0, 0.0, size.x, size.y), Color(0.02, 0.04, 0.055, 0.68), true)
		_draw_text("THE COLD TAKES HOLD", Vector2(0.0, size.y * 0.5 - 24.0), 30, ICE, size.x, HORIZONTAL_ALIGNMENT_CENTER)
		_draw_text("USE TO BEGIN AGAIN", Vector2(0.0, size.y * 0.5 + 18.0), 16, MUTED, size.x, HORIZONTAL_ALIGNMENT_CENTER)

	_draw_crosshair()

func _draw_bar(origin: Vector2, label: String, value: float, color: Color) -> void:
	var clamped := clampf(value, 0.0, 100.0)
	_draw_text(label, origin + Vector2(0.0, 11.0), 11, MUTED)
	draw_rect(Rect2(origin.x + 68.0, origin.y, 172.0, 12.0), Color(0.03, 0.07, 0.085, 0.95), true)
	draw_rect(Rect2(origin.x + 69.0, origin.y + 1.0, 170.0 * clamped / 100.0, 10.0), color, true)
	_draw_text("%d" % roundi(clamped), origin + Vector2(247.0, 11.0), 11, ICE, 28.0, HORIZONTAL_ALIGNMENT_RIGHT)

func _draw_crosshair() -> void:
	var center := size * 0.5
	draw_line(center - Vector2(7.0, 0.0), center - Vector2(2.0, 0.0), Color(0.9, 0.96, 1.0, 0.65), 1.5)
	draw_line(center + Vector2(2.0, 0.0), center + Vector2(7.0, 0.0), Color(0.9, 0.96, 1.0, 0.65), 1.5)
	draw_line(center - Vector2(0.0, 7.0), center - Vector2(0.0, 2.0), Color(0.9, 0.96, 1.0, 0.65), 1.5)
	draw_line(center + Vector2(0.0, 2.0), center + Vector2(0.0, 7.0), Color(0.9, 0.96, 1.0, 0.65), 1.5)

func _core_color(core: float) -> Color:
	if core < 34.5:
		return Color(0.57, 0.76, 1.0, 1.0)
	if core < 35.8:
		return Color(0.72, 0.86, 0.97, 1.0)
	return Color(0.98, 0.91, 0.77, 1.0)

func _draw_text(text: String, position: Vector2, font_size: int, color: Color, width: float = -1.0, alignment: HorizontalAlignment = HORIZONTAL_ALIGNMENT_LEFT) -> void:
	draw_string(ThemeDB.fallback_font, position, text, alignment, width, font_size, color)
