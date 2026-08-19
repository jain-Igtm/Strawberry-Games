extends "res://arthur_mobile/world_stair_fixture_cull.gd"

# Final visual-only stair polish. The phone-tested stair geometry, ramp collision,
# landings, rails, and anti-wedge guide colliders remain inherited unchanged.
# Only objects that visually float across the architectural opening are altered.

func _add_architectural_opening_trim(
	root: Node3D,
	center: Vector3,
	direction: Vector3,
	side: Vector3,
	yaw: float
) -> void:
	var opening_width: float = _arch_opening_width()
	var opening_length: float = _arch_opening_length()
	var half_width: float = opening_width * 0.5
	var trim_y: float = STOREY_HEIGHT + 0.035

	# Keep only the long side trim that visually frames the stairwell. The inherited
	# transverse end bars crossed open air at the upper arrival and read as floating
	# ceiling slabs from below.
	for sign_value: float in [-1.0, 1.0]:
		var side_center := center + side * ((half_width + 0.10) * sign_value)
		side_center.y = trim_y
		_add_stair_mesh_box(
			root,
			side_center,
			Vector3(0.18, 0.13, opening_length + 0.34),
			stair_tread_material,
			yaw
		)

func _add_stairwell_light(root: Node3D, opening_center: Vector3) -> void:
	# Preserve a soft stairwell fill light, but do not create the old emissive mesh.
	# The visible fixture was hanging inside the ceiling opening with nothing to mount
	# to, so it looked like a floating fluorescent panel from the stairs.
	var light := OmniLight3D.new()
	light.name = "StairwellFillLight"
	light.position = opening_center + Vector3.UP * (STOREY_HEIGHT - 0.55)
	light.light_color = Color(1.0, 0.87, 0.58, 1.0)
	light.light_energy = 0.52
	light.omni_range = 5.8
	light.omni_attenuation = 1.35
	light.shadow_enabled = false
	root.add_child(light)
