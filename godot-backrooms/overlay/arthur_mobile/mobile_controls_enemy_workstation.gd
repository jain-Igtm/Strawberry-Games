extends "res://arthur_mobile/mobile_controls.gd"

const LIGHT_ATTACK_SWIPE_PX := 78.0
var light_attack_armed := false

func _input(event: InputEvent) -> void:
	if not OS.has_feature("mobile"):
		super._input(event)
		return

	if event is InputEventScreenTouch and event.pressed:
		if _inside_circle(event.position, _light_center(), ability_radius) and light_touch == -1:
			light_attack_armed = false

	if event is InputEventScreenDrag and event.index == light_touch and light_touch != -1:
		if light_attack_armed:
			light_drag_current = event.position
			queue_redraw()
			return
		super._input(event)
		if light_touch != -1 and not light_hold_active and not light_brightness_swipe:
			var drag := light_drag_current - light_drag_origin
			if drag.y <= -LIGHT_ATTACK_SWIPE_PX and absf(drag.y) > absf(drag.x) * 1.15:
				light_attack_armed = true
				# This also prevents the inherited hold-to-spread timer from claiming the gesture.
				light_brightness_swipe = true
				light_tap_count = 0
				light_last_release_ms = -10000
				_ensure_lights_on()
				queue_redraw()
		return

	if event is InputEventScreenTouch and not event.pressed and event.index == light_touch and light_attack_armed:
		if player != null and player.has_method("fire_psychic_light_attack"):
			player.call("fire_psychic_light_attack")
		light_touch = -1
		light_attack_armed = false
		light_hold_active = false
		light_brightness_swipe = false
		light_tap_count = 0
		light_last_release_ms = -10000
		queue_redraw()
		return

	super._input(event)
