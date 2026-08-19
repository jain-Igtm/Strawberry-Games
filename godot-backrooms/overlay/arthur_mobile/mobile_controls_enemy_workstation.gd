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
		if light_touch != -1 and not light_brightness_swipe:
			var drag: Vector2 = light_drag_current - light_drag_origin
			if drag.y <= -LIGHT_ATTACK_SWIPE_PX and absf(drag.y) > absf(drag.x) * 1.15:
				# An upward attack swipe has priority even if the finger lingered long
				# enough to begin the inherited spread hold. This also means players can
				# deliberately spread first and finish with an upward launch gesture.
				light_attack_armed = true
				light_hold_active = false
				# Reuse this inherited gesture-lock flag so the hold timer and horizontal
				# brightness gesture cannot steal the touch after attack is committed.
				light_brightness_swipe = true
				light_tap_count = 0
				light_last_release_ms = -10000
				_ensure_lights_on()
				queue_redraw()
		return

	if event is InputEventScreenTouch and not event.pressed and event.index == light_touch and light_attack_armed:
		# Match normal hold-release semantics if the attack began after a spread:
		# launch from the current physical orb positions, then let the live formation
		# contract back toward its default radius while those same orbs return.
		if player != null and player.has_method("lights_return_radius"):
			player.call("lights_return_radius")
		if player != null and player.has_method("lights_end_radius_gesture"):
			player.call("lights_end_radius_gesture")
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
