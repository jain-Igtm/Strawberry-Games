extends "res://arthur_mobile/parking_garage/parking_world.gd"

# Ramp cells inherit the surrounding aisle direction unless we pin their deck
# opening to the actual ramp axis. Keeping that decision here makes the first
# parking branch easy to tune without touching the proven generator core.
func _lane_along_x(cell: Vector2i, level: int) -> bool:
	if _is_ramp_cell(cell, level):
		return _ramp_along_x(cell, level)
	if _is_ramp_cell(cell, level - 1):
		return _ramp_along_x(cell, level - 1)
	return super._lane_along_x(cell, level)
