extends Node

# The visible forest floor is generated from world.height_at(). On mobile, using
# a second physics representation of that same surface created mismatch states
# where the player could fall through or become embedded in the terrain. Ground
# locomotion now follows the authoritative procedural height directly. This node
# disables only streamed terrain colliders; trees and other nearby obstacle
# colliders remain active.

@onready var world: Node3D = get_parent()

var _disabled_chunks: Dictionary = {}

func _ready() -> void:
    _disable_streamed_terrain_colliders()

func _process(_delta: float) -> void:
    # Chunks are created during the world's process step, so catch new terrain
    # bodies before the following physics tick whenever possible.
    _disable_streamed_terrain_colliders()

func _physics_process(_delta: float) -> void:
    _disable_streamed_terrain_colliders()

func _disable_streamed_terrain_colliders() -> void:
    var chunks: Dictionary = world.get("chunks")
    for raw_key in chunks.keys():
        var chunk: Node3D = chunks[raw_key]
        if not is_instance_valid(chunk):
            continue

        var instance_id: int = chunk.get_instance_id()
        if _disabled_chunks.has(instance_id):
            continue

        var body: StaticBody3D = chunk.get_node_or_null("TerrainCollision")
        if body != null:
            body.collision_layer = 0
            body.collision_mask = 0
            var collider: CollisionShape3D = body.get_node_or_null("CollisionShape3D")
            if collider != null:
                collider.disabled = true

        _disabled_chunks[instance_id] = true

    _prune_dead_chunk_ids()

func _prune_dead_chunk_ids() -> void:
    if _disabled_chunks.size() < 64:
        return
    var live_ids: Dictionary = {}
    var chunks: Dictionary = world.get("chunks")
    for raw_chunk in chunks.values():
        var chunk: Node3D = raw_chunk
        if is_instance_valid(chunk):
            live_ids[chunk.get_instance_id()] = true
    for raw_id in _disabled_chunks.keys():
        var instance_id: int = raw_id
        if not live_ids.has(instance_id):
            _disabled_chunks.erase(instance_id)
