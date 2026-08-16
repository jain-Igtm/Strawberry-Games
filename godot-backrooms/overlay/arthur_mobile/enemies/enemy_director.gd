extends Node3D
class_name ArthurEnemyDirector

signal psychic_warning_started(seconds: float)
signal intrusion_started
signal intrusion_ended
signal dissociation_started
signal dissociation_ended
signal ambient_enemy_spawned(kind: String)

const CROSS_SECTION_SCRIPT: Script = preload("res://arthur_mobile/enemies/cross_section_intrusion.gd")
const GROUND_STALKER_SCRIPT: Script = preload("res://arthur_mobile/enemies/ground_stalker.gd")
const POOL_EEL_SCRIPT: Script = preload("res://arthur_mobile/enemies/pool_eel.gd")
const DISSOCIATION_SHADER: Shader = preload("res://arthur_mobile/enemies/dissociation_overlay.gdshader")

enum EncounterState {
	WAITING,
	WARNING,
	DISSOCIATING,
	INTRUSION,
	RECOVERY,
}

@export var enabled := true
@export var lab_mode := false
@export var first_event_min := 38.0
@export var first_event_max := 82.0
@export var repeat_event_min := 70.0
@export var repeat_event_max := 165.0
@export var warning_min := 5.5
@export var warning_max := 9.0
@export_range(0.0, 1.0, 0.01) var dissociation_chance := 0.24
@export var dissociation_duration_min := 1.15
@export var dissociation_duration_max := 1.75
@export var intrusion_window := 8.8
@export var psychic_prop_slam_radius := 24.0
@export var psychic_prop_down_speed := 15.0
@export var ambient_enemy_min := 44.0
@export var ambient_enemy_max := 92.0
@export_range(1, 2, 1) var max_ambient_enemies := 1

var rng := RandomNumberGenerator.new()
var state := EncounterState.WAITING
var state_time := 0.0
var state_total := 1.0
var first_event := true
var player: Node3D
var camera: Camera3D
var camera_base_fov := 75.0
var overlay: ColorRect
var overlay_material: ShaderMaterial
var visual_phase := 0.0
var ambient_timer := 12.0
var underwater_time := 0.0

func _ready() -> void:
	rng.randomize()
	_acquire_player()
	_create_overlay()
	_schedule_next()
	_reset_ambient_timer(true)

func _process(delta: float) -> void:
	if not enabled:
		_set_overlay_intensity(0.0)
		return
	if not is_instance_valid(player):
		_acquire_player()
	if not is_instance_valid(player):
		return

	visual_phase += delta
	if overlay_material != null and overlay != null and overlay.visible:
		overlay_material.set_shader_parameter("phase", visual_phase)

	_update_underwater_time(delta)
	_update_ambient_enemies(delta)
	state_time -= delta
	match state:
		EncounterState.WAITING:
			_set_overlay_intensity(0.0)
			if state_time <= 0.0:
				_begin_warning()
		EncounterState.WARNING:
			_update_warning()
			if state_time <= 0.0:
				if rng.randf() < dissociation_chance:
					_begin_dissociation()
				else:
					_begin_intrusion()
		EncounterState.DISSOCIATING:
			_update_dissociation()
			if state_time <= 0.0:
				_finish_dissociation()
				_begin_intrusion()
		EncounterState.INTRUSION:
			var pulse := 0.012 + 0.008 * (0.5 + 0.5 * sin(visual_phase * 4.6))
			_set_overlay_intensity(pulse)
			if state_time <= 0.0:
				intrusion_ended.emit()
				state = EncounterState.RECOVERY
				state_total = 1.2
				state_time = state_total
		EncounterState.RECOVERY:
			var recovery_ratio := clampf(state_time / maxf(state_total, 0.001), 0.0, 1.0)
			_set_overlay_intensity(recovery_ratio * 0.035)
			if state_time <= 0.0:
				first_event = false
				_schedule_next()

func _acquire_player() -> void:
	player = get_tree().get_first_node_in_group("player") as Node3D
	camera = null
	if is_instance_valid(player):
		camera = player.get_node_or_null("CameraPivot/Camera3D") as Camera3D
		if is_instance_valid(camera):
			camera_base_fov = camera.fov

func _schedule_next() -> void:
	state = EncounterState.WAITING
	if lab_mode:
		state_total = 6.0 if first_event else 20.0
	else:
		state_total = rng.randf_range(first_event_min, first_event_max) if first_event else rng.randf_range(repeat_event_min, repeat_event_max)
	state_time = state_total

func _begin_warning() -> void:
	state = EncounterState.WARNING
	state_total = rng.randf_range(warning_min, warning_max)
	state_time = state_total
	psychic_warning_started.emit(state_total)

func _update_warning() -> void:
	var progress := 1.0 - clampf(state_time / maxf(state_total, 0.001), 0.0, 1.0)
	var pulse := 0.5 + 0.5 * sin(visual_phase * (4.0 + progress * 3.0))
	var intensity := lerpf(0.012, 0.155, progress * progress) + pulse * progress * 0.015
	_set_overlay_intensity(intensity)
	if is_instance_valid(camera):
		camera.fov = lerpf(camera_base_fov, camera_base_fov - 2.0, progress)

func _begin_dissociation() -> void:
	state = EncounterState.DISSOCIATING
	state_total = rng.randf_range(dissociation_duration_min, dissociation_duration_max)
	state_time = state_total
	dissociation_started.emit()

func _update_dissociation() -> void:
	var progress := 1.0 - clampf(state_time / maxf(state_total, 0.001), 0.0, 1.0)
	var crest := sin(progress * PI)
	var intensity := clampf(0.18 + crest * 0.62 + progress * 0.05, 0.0, 0.82)
	_set_overlay_intensity(intensity)
	if is_instance_valid(camera):
		camera.fov = lerpf(camera_base_fov - 0.5, camera_base_fov + 18.0, smoothstep(0.0, 0.88, progress))

func _finish_dissociation() -> void:
	if is_instance_valid(camera):
		camera.fov = camera_base_fov
	_set_overlay_intensity(0.0)
	_slam_back_psychic_props()
	dissociation_ended.emit()

func _begin_intrusion() -> void:
	state = EncounterState.INTRUSION
	state_total = intrusion_window
	state_time = state_total
	_spawn_cross_section_intrusion()
	intrusion_started.emit()

func _spawn_cross_section_intrusion() -> void:
	if not is_instance_valid(player):
		return
	var intruder := Node3D.new()
	intruder.name = "CrossSectionIntrusion"
	intruder.set_script(CROSS_SECTION_SCRIPT)
	intruder.call("configure", player)
	add_child(intruder)

	var forward := Vector3(0.0, 0.0, -1.0)
	var right := Vector3(1.0, 0.0, 0.0)
	if is_instance_valid(camera):
		forward = -camera.global_transform.basis.z
		right = camera.global_transform.basis.x
	forward.y = 0.0
	right.y = 0.0
	forward = forward.normalized()
	right = right.normalized()
	var spawn_distance := rng.randf_range(6.5, 11.5)
	var lateral := rng.randf_range(-4.5, 4.5)
	intruder.global_position = player.global_position + forward * spawn_distance + right * lateral + Vector3(0.0, rng.randf_range(0.8, 2.3), 0.0)

func _update_underwater_time(delta: float) -> void:
	if not is_instance_valid(player):
		underwater_time = 0.0
		return
	var underwater := false
	if player.has_method("is_underwater"):
		underwater = bool(player.call("is_underwater"))
	underwater_time = underwater_time + delta if underwater else 0.0

func _update_ambient_enemies(delta: float) -> void:
	ambient_timer -= delta
	if ambient_timer > 0.0:
		return
	if state == EncounterState.WARNING or state == EncounterState.DISSOCIATING or state == EncounterState.INTRUSION:
		return
	if get_tree().get_nodes_in_group("enemy_ambient").size() >= max_ambient_enemies:
		_reset_ambient_timer(false)
		return

	# Aquatic predators only appear after Arthur has actually spent time in the
	# water, which avoids a visible pop the instant he breaks the surface.
	if underwater_time >= 5.0:
		if not _spawn_pool_eel():
			_reset_ambient_timer(false)
			return
	else:
		if not _spawn_ground_stalker():
			# No safe ground point behind Arthur: skip the encounter rather than
			# materializing a creature in his field of view.
			ambient_timer = 4.0 if lab_mode else rng.randf_range(14.0, 28.0)
			return
	_reset_ambient_timer(false)

func _reset_ambient_timer(initial: bool) -> void:
	if lab_mode:
		ambient_timer = 8.0 if initial else rng.randf_range(15.0, 23.0)
	else:
		ambient_timer = rng.randf_range(ambient_enemy_min, ambient_enemy_max)

func _spawn_ground_stalker() -> bool:
	if not is_instance_valid(player):
		return false
	var spawn_point := _find_ground_spawn_behind_player()
	if spawn_point == Vector3.INF:
		return false

	var creature := CharacterBody3D.new()
	creature.name = "GroundStalker"
	creature.set_script(GROUND_STALKER_SCRIPT)
	creature.call("configure", player)
	add_child(creature)
	creature.global_position = spawn_point + Vector3.UP * 0.05
	ambient_enemy_spawned.emit("ground_stalker")
	return true

func _find_ground_spawn_behind_player() -> Vector3:
	if not is_instance_valid(player) or not is_instance_valid(camera):
		return Vector3.INF
	var back := camera.global_transform.basis.z
	var right := camera.global_transform.basis.x
	back.y = 0.0
	right.y = 0.0
	if back.length_squared() < 0.01 or right.length_squared() < 0.01:
		return Vector3.INF
	back = back.normalized()
	right = right.normalized()

	var space := get_world_3d().direct_space_state
	var excluded: Array[RID] = []
	if player is CollisionObject3D:
		excluded.append((player as CollisionObject3D).get_rid())

	for attempt in range(8):
		var distance := rng.randf_range(5.8, 9.2)
		var lateral := rng.randf_range(-3.4, 3.4)
		var candidate := player.global_position + back * distance + right * lateral
		var down_query := PhysicsRayQueryParameters3D.create(candidate + Vector3.UP * 3.2, candidate + Vector3.DOWN * 5.0)
		down_query.exclude = excluded
		var floor_hit := space.intersect_ray(down_query)
		if floor_hit.is_empty():
			continue
		var floor_point: Vector3 = floor_hit.position
		var floor_normal: Vector3 = floor_hit.normal
		if floor_normal.dot(Vector3.UP) < 0.70:
			continue
		# Multi-floor safeguard: do not silently create it on the floor above or below.
		if absf(floor_point.y - player.global_position.y) > 1.65:
			continue

		# Until navigation is integrated, only spawn where a straight ground chase
		# is physically plausible. This also means it enters from behind rather than
		# appearing through a wall and getting stuck there.
		var sight_query := PhysicsRayQueryParameters3D.create(
			player.global_position + Vector3.UP * 0.55,
			floor_point + Vector3.UP * 0.55
		)
		sight_query.exclude = excluded
		var obstruction := space.intersect_ray(sight_query)
		if not obstruction.is_empty():
			continue
		return floor_point
	return Vector3.INF

func _spawn_pool_eel() -> bool:
	if not is_instance_valid(player):
		return false
	var creature := Node3D.new()
	creature.name = "PoolEel"
	creature.set_script(POOL_EEL_SCRIPT)
	creature.call("configure", player)
	add_child(creature)
	creature.add_to_group("enemy_ambient")

	var back := Vector3(0.0, 0.0, 1.0)
	var right := Vector3(1.0, 0.0, 0.0)
	if is_instance_valid(camera):
		back = camera.global_transform.basis.z
		right = camera.global_transform.basis.x
	back.y = 0.0
	right.y = 0.0
	back = back.normalized()
	right = right.normalized()
	creature.global_position = player.global_position + back * rng.randf_range(4.5, 6.5) + right * rng.randf_range(-2.2, 2.2) + Vector3.DOWN * 0.35
	ambient_enemy_spawned.emit("pool_eel")
	return true

func _slam_back_psychic_props() -> void:
	if is_instance_valid(player) and player.has_method("is_psychic_field_active"):
		if bool(player.call("is_psychic_field_active")) and player.has_method("end_psychic_field"):
			player.call("end_psychic_field")

	for node in get_tree().get_nodes_in_group("psychic_prop"):
		if not (node is RigidBody3D):
			continue
		var body := node as RigidBody3D
		if not is_instance_valid(body):
			continue
		if is_instance_valid(player) and body.global_position.distance_to(player.global_position) > psychic_prop_slam_radius:
			continue
		body.freeze = false
		body.sleeping = false
		body.gravity_scale = 1.0
		var seed := float(posmod(body.get_instance_id(), 997)) / 997.0
		body.linear_velocity = Vector3(
			body.linear_velocity.x * 0.22,
			minf(body.linear_velocity.y, -psychic_prop_down_speed * (0.86 + seed * 0.28)),
			body.linear_velocity.z * 0.22
		)
		body.angular_velocity += Vector3(seed * 4.0 - 2.0, 1.4 - seed * 2.8, seed * 5.0 - 2.5)

func _create_overlay() -> void:
	var layer := CanvasLayer.new()
	layer.name = "EnemyPerceptionLayer"
	layer.layer = 70
	add_child(layer)

	overlay = ColorRect.new()
	overlay.name = "DissociationOverlay"
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(overlay)
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)

	overlay_material = ShaderMaterial.new()
	overlay_material.shader = DISSOCIATION_SHADER
	overlay.material = overlay_material
	_set_overlay_intensity(0.0)

func _set_overlay_intensity(value: float) -> void:
	var clamped := clampf(value, 0.0, 1.0)
	if overlay_material != null:
		overlay_material.set_shader_parameter("intensity", clamped)
	if overlay != null:
		overlay.visible = clamped > 0.002
