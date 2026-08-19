extends "res://arthur_mobile/player_v09.gd"

# Grounded traversal tuned for the continuous hidden stair ramps. The visible
# stair treads do not own collision, so Arthur moves over a stable walking plane.
func _ready() -> void:
	super._ready()
	motion_mode = CharacterBody3D.MOTION_MODE_GROUNDED
	floor_max_angle = deg_to_rad(50.0)
	floor_snap_length = 0.32
	floor_constant_speed = true
	floor_stop_on_slope = true
	floor_block_on_wall = true
	max_slides = 8
	safe_margin = 0.008
