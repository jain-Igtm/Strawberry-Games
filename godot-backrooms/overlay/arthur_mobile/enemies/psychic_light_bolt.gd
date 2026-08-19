extends Area3D

@export var speed := 28.0
@export var lifetime := 2.4

var direction := Vector3.FORWARD
var damage := 34.0
var impulse_strength := 5.2

func setup(launch_direction: Vector3, hit_damage: float = 34.0, hit_impulse: float = 5.2) -> void:
	direction = launch_direction.normalized()
	damage = hit_damage
	impulse_strength = hit_impulse

func _ready() -> void:
	monitoring = true
	monitorable = false
	body_entered.connect(_on_body_entered)

func _physics_process(delta: float) -> void:
	lifetime -= delta
	if lifetime <= 0.0:
		queue_free()
		return

	var from := global_position
	var to := from + direction * speed * delta
	var query := PhysicsRayQueryParameters3D.create(from, to)
	query.collision_mask = 2
	var result := get_world_3d().direct_space_state.intersect_ray(query)
	if not result.is_empty():
		_hit(result.get("collider") as Node)
		return
	global_position = to

func _on_body_entered(body: Node) -> void:
	_hit(body)

func _hit(body: Node) -> void:
	if not is_instance_valid(body):
		queue_free()
		return
	if body.is_in_group("enemy") and body.has_method("take_psychic_damage"):
		body.call("take_psychic_damage", damage, direction * impulse_strength, "light_orb")
	queue_free()
