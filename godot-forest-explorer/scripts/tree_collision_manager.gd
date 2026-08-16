extends Node3D

const COLLISION_RADIUS := 20.0
const MAX_ACTIVE_TRUNKS := 72
const REFRESH_INTERVAL := 0.22
const OBSTACLE_LAYER := 2

@onready var player: CharacterBody3D = get_node("../Player")

var _body: StaticBody3D
var _pool: Array[CollisionShape3D] = []
var _refresh_clock := 0.0

func _ready() -> void:
    _body = StaticBody3D.new()
    _body.name = "NearbyTreeCollisionBody"
    _body.collision_layer = OBSTACLE_LAYER
    _body.collision_mask = 0
    add_child(_body)
    for i in range(MAX_ACTIVE_TRUNKS):
        var shape := CollisionShape3D.new()
        var cylinder := CylinderShape3D.new()
        cylinder.radius = 0.4
        cylinder.height = 7.2
        shape.shape = cylinder
        shape.disabled = true
        _body.add_child(shape)
        _pool.append(shape)

func _physics_process(delta: float) -> void:
    _refresh_clock -= delta
    if _refresh_clock > 0.0:
        return
    _refresh_clock = REFRESH_INTERVAL
    _refresh_nearby_trunks()

func _refresh_nearby_trunks() -> void:
    var candidates: Array = []
    var root := get_parent()
    for chunk in root.get_children():
        if not chunk is Node3D or not String(chunk.name).begins_with("Chunk_"):
            continue
        var trunks := chunk.get_node_or_null("TreeTrunks") as MultiMeshInstance3D
        if trunks == null or trunks.multimesh == null:
            continue
        var count := trunks.multimesh.instance_count
        for i in range(count):
            var local_t := trunks.multimesh.get_instance_transform(i)
            var world_t := trunks.global_transform * local_t
            var flat_delta := Vector2(world_t.origin.x - player.global_position.x, world_t.origin.z - player.global_position.z)
            var distance_sq := flat_delta.length_squared()
            if distance_sq <= COLLISION_RADIUS * COLLISION_RADIUS:
                candidates.append({"transform": world_t, "distance_sq": distance_sq})

    candidates.sort_custom(func(a, b): return a.distance_sq < b.distance_sq)
    var active := mini(candidates.size(), MAX_ACTIVE_TRUNKS)
    for i in range(_pool.size()):
        var shape_node := _pool[i]
        if i >= active:
            shape_node.disabled = true
            continue
        var item = candidates[i]
        var tree_t: Transform3D = item.transform
        var scale_y := maxf(0.45, tree_t.basis.get_scale().y)
        var cylinder := shape_node.shape as CylinderShape3D
        cylinder.radius = 0.36 * scale_y
        cylinder.height = 7.0 * scale_y
        shape_node.global_position = tree_t.origin
        shape_node.disabled = false
