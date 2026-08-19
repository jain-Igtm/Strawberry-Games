extends "res://arthur_mobile/psychic_illumination.gd"

# Enemy-workstation extension: the visible illumination orbs ARE the projectiles.
# No duplicate bolt meshes are created. A launched orb leaves its current HOME or
# SCOUT formation, flies from that exact position toward the camera aim point,
# hits with its own node, then flies back into the live formation.

@export var attack_speed := 22.0
@export var attack_range := 38.0
@export var attack_damage := 34.0
@export var attack_impulse := 5.2
@export var return_speed := 25.0
@export var hit_radius := 0.42

const ORB_FLYING := 1
const ORB_RETURNING := 2
const ORB_HOME := 3

var attacking := false
var attack_orbs: Array[Node3D] = []
var orb_modes: Dictionary = {}
var orb_velocities: Dictionary = {}
var orb_distances: Dictionary = {}
var attack_damage_multiplier := 1.0
var hit_shape: SphereShape3D

func _ready() -> void:
	super._ready()
	hit_shape = SphereShape3D.new()
	hit_shape.radius = hit_radius

func set_enabled(value: bool) -> void:
	if not value and attacking:
		_cancel_attack_to_formation()
	super.set_enabled(value)

func launch_forward() -> bool:
	if attacking:
		return false
	if not active:
		set_enabled(true)
	if camera == null or not is_instance_valid(camera):
		if anchor != null:
			camera = anchor.get_node_or_null("CameraPivot/Camera3D") as Camera3D
	if camera == null:
		return false

	# Put the inherited orbit at its exact live position before detaching any orb.
	super._process(0.0)
	var aim_point: Vector3 = _camera_aim_point()
	attack_damage_multiplier = 3.0 if is_combined() else 1.0
	attack_orbs.clear()
	orb_modes.clear()
	orb_velocities.clear()
	orb_distances.clear()

	for orb: Node3D in [orb_a, orb_b, orb_c]:
		if orb == null or not orb.visible:
			continue
		var start: Vector3 = orb.global_position
		var direction: Vector3 = (aim_point - start).normalized()
		if direction.length_squared() <= 0.0001:
			direction = (-camera.global_transform.basis.z).normalized()
		orb.top_level = true
		orb.global_position = start
		attack_orbs.append(orb)
		var id: int = orb.get_instance_id()
		orb_modes[id] = ORB_FLYING
		orb_velocities[id] = direction * attack_speed
		orb_distances[id] = 0.0

	if attack_orbs.is_empty():
		attack_damage_multiplier = 1.0
		return false
	attacking = true
	set_process(true)
	return true

func is_attacking() -> bool:
	return attacking

func _process(delta: float) -> void:
	if not attacking:
		super._process(delta)
		return
	if anchor == null or not is_instance_valid(anchor):
		_cancel_attack_to_formation()
		return
	if camera == null or not is_instance_valid(camera):
		camera = anchor.get_node_or_null("CameraPivot/Camera3D") as Camera3D

	_update_attack_anchor(delta)
	var all_home: bool = true
	for orb: Node3D in attack_orbs:
		if orb == null or not is_instance_valid(orb):
			continue
		var id: int = orb.get_instance_id()
		var mode: int = int(orb_modes.get(id, ORB_HOME))
		if mode == ORB_FLYING:
			all_home = false
			_update_flying_orb(orb, delta)
		elif mode == ORB_RETURNING:
			all_home = false
			_update_returning_orb(orb, delta)
		else:
			_snap_orb_to_live_formation(orb)

	if all_home:
		attacking = false
		attack_damage_multiplier = 1.0
		attack_orbs.clear()
		orb_modes.clear()
		orb_velocities.clear()
		orb_distances.clear()
		super._process(0.0)

func _camera_aim_point() -> Vector3:
	var from: Vector3 = camera.global_position
	var direction: Vector3 = (-camera.global_transform.basis.z).normalized()
	var to: Vector3 = from + direction * attack_range
	var query := PhysicsRayQueryParameters3D.create(from, to)
	query.collision_mask = 3
	if anchor is CollisionObject3D:
		query.exclude = [(anchor as CollisionObject3D).get_rid()]
	var hit: Dictionary = get_world_3d().direct_space_state.intersect_ray(query)
	if not hit.is_empty():
		return hit.get("position", to) as Vector3
	return to

func _update_attack_anchor(delta: float) -> void:
	phase += delta
	if returning_to_default:
		formation_radius = move_toward(formation_radius, DEFAULT_RADIUS, DEFAULT_RETURN_SPEED * delta)
		if absf(formation_radius - DEFAULT_RADIUS) <= 0.005:
			formation_radius = DEFAULT_RADIUS
			returning_to_default = false

	if scouting and camera != null:
		var look: Vector3 = (-camera.global_transform.basis.z).normalized()
		var target_anchor: Vector3 = anchor.global_position + look * SCOUT_DISTANCE
		visual_anchor = visual_anchor.lerp(target_anchor, clampf(delta * 5.4, 0.0, 1.0))
		global_position = visual_anchor
	else:
		global_position = anchor.global_position
		visual_anchor = anchor.global_position

func _update_flying_orb(orb: Node3D, delta: float) -> void:
	var id: int = orb.get_instance_id()
	var velocity_value: Vector3 = orb_velocities.get(id, Vector3.ZERO) as Vector3
	var from: Vector3 = orb.global_position
	var to: Vector3 = from + velocity_value * delta

	var environment_hit: Dictionary = _ray_attack_collision(from, to)
	if not environment_hit.is_empty():
		var collider: Object = environment_hit.get("collider") as Object
		if collider is Node and (collider as Node).is_in_group("enemy"):
			_damage_enemy(collider as Node, velocity_value.normalized())
		orb_modes[id] = ORB_RETURNING
		return

	orb.global_position = to
	orb_distances[id] = float(orb_distances.get(id, 0.0)) + from.distance_to(to)
	var enemy: Node = _enemy_overlapping_orb(to)
	if enemy != null:
		_damage_enemy(enemy, velocity_value.normalized())
		orb_modes[id] = ORB_RETURNING
		return
	if float(orb_distances[id]) >= attack_range:
		orb_modes[id] = ORB_RETURNING

func _update_returning_orb(orb: Node3D, delta: float) -> void:
	var target: Vector3 = _formation_global_target(orb)
	orb.global_position = orb.global_position.move_toward(target, return_speed * delta)
	if orb.global_position.distance_to(target) <= 0.09:
		var id: int = orb.get_instance_id()
		orb.top_level = false
		orb.position = _formation_local_target(orb)
		orb_modes[id] = ORB_HOME

func _snap_orb_to_live_formation(orb: Node3D) -> void:
	if orb.top_level:
		orb.top_level = false
	orb.position = _formation_local_target(orb)

func _formation_global_target(orb: Node3D) -> Vector3:
	return global_transform * _formation_local_target(orb)

func _formation_local_target(orb: Node3D) -> Vector3:
	if is_combined():
		if orb == orb_a:
			return Vector3(
				sin(phase * 0.55) * 0.16,
				1.83 + sin(phase * 0.88) * 0.13,
				cos(phase * 0.49) * 0.16
			)
		return Vector3.ZERO

	var spread: float = formation_radius / DEFAULT_RADIUS
	if orb == orb_a:
		return Vector3(
			cos(phase * 0.62) * HOME_A_RADIUS * spread,
			1.72 + sin(phase * 1.31) * 0.18,
			sin(phase * 0.62) * HOME_A_RADIUS * spread
		)
	if orb == orb_b:
		return Vector3(
			cos(phase * 0.54 + 2.1) * HOME_B_RADIUS * spread,
			2.18 + sin(phase * 1.07 + 1.4) * 0.21,
			sin(phase * 0.54 + 2.1) * HOME_B_RADIUS * spread
		)
	return Vector3(
		cos(phase * 0.47 + 4.15) * HOME_C_RADIUS * spread,
		1.38 + sin(phase * 0.91 + 3.2) * 0.16,
		sin(phase * 0.47 + 4.15) * HOME_C_RADIUS * spread
	)

func _ray_attack_collision(from: Vector3, to: Vector3) -> Dictionary:
	var query := PhysicsRayQueryParameters3D.create(from, to)
	query.collision_mask = 3
	if anchor is CollisionObject3D:
		query.exclude = [(anchor as CollisionObject3D).get_rid()]
	return get_world_3d().direct_space_state.intersect_ray(query)

func _enemy_overlapping_orb(position_value: Vector3) -> Node:
	if hit_shape == null:
		return null
	var query := PhysicsShapeQueryParameters3D.new()
	query.shape = hit_shape
	query.transform = Transform3D(Basis.IDENTITY, position_value)
	query.collision_mask = 2
	query.collide_with_bodies = true
	query.collide_with_areas = false
	if anchor is CollisionObject3D:
		query.exclude = [(anchor as CollisionObject3D).get_rid()]
	var overlaps: Array[Dictionary] = get_world_3d().direct_space_state.intersect_shape(query, 12)
	for hit: Dictionary in overlaps:
		var collider: Object = hit.get("collider") as Object
		if collider is Node and (collider as Node).is_in_group("enemy"):
			return collider as Node
	return null

func _damage_enemy(enemy: Node, direction: Vector3) -> void:
	var impulse: Vector3 = direction * attack_impulse + Vector3.UP * 0.45
	var damage: float = attack_damage * attack_damage_multiplier
	if enemy.has_method("take_psychic_damage"):
		enemy.call("take_psychic_damage", damage, impulse, "light_orb")
	elif enemy.has_method("take_psychic_hit"):
		enemy.call("take_psychic_hit", damage, impulse, self)

func _cancel_attack_to_formation() -> void:
	for orb: Node3D in attack_orbs:
		if orb == null or not is_instance_valid(orb):
			continue
		orb.top_level = false
		orb.position = _formation_local_target(orb)
	attacking = false
	attack_damage_multiplier = 1.0
	attack_orbs.clear()
	orb_modes.clear()
	orb_velocities.clear()
	orb_distances.clear()
