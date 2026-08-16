extends Node

# Android-safe terrain collision layer. The visible world is a height field, so
# use Godot's dedicated HeightMapShape3D instead of a hollow concave trimesh.
# This node upgrades each streamed chunk as it appears and only performs an
# emergency recovery if the player has genuinely fallen far beneath the world.

const CHUNK_SIZE: float = 64.0
const RECOVERY_DEPTH: float = 6.0
const RECOVERY_HEIGHT: float = 1.35

@onready var world: Node3D = get_parent()
@onready var player: CharacterBody3D = world.get_node("Player")

var _upgraded_chunks: Dictionary = {}

func _physics_process(_delta: float) -> void:
    _upgrade_streamed_chunks()
    _recover_player_if_below_surface()

func _upgrade_streamed_chunks() -> void:
    var chunks: Dictionary = world.get("chunks")
    var resolution: int = int(world.get("terrain_resolution"))
    if resolution <= 0:
        return

    for raw_key in chunks.keys():
        var key: Vector2i = raw_key
        var chunk: Node3D = chunks[key]
        if not is_instance_valid(chunk):
            continue

        var instance_id: int = chunk.get_instance_id()
        if _upgraded_chunks.has(instance_id):
            continue

        var collider: CollisionShape3D = chunk.get_node_or_null("TerrainCollision/CollisionShape3D")
        if collider == null:
            continue

        collider.shape = _build_heightmap_shape(key, resolution)
        var step: float = CHUNK_SIZE / float(resolution)
        collider.position = Vector3(CHUNK_SIZE * 0.5, 0.0, CHUNK_SIZE * 0.5)
        collider.scale = Vector3.ONE * step
        _upgraded_chunks[instance_id] = true

    _prune_dead_chunk_ids()

func _build_heightmap_shape(key: Vector2i, resolution: int) -> HeightMapShape3D:
    var side: int = resolution + 1
    var step: float = CHUNK_SIZE / float(resolution)
    var heights: PackedFloat32Array = PackedFloat32Array()
    heights.resize(side * side)

    var write_index: int = 0
    for z in range(side):
        var abs_z: float = key.y * CHUNK_SIZE + float(z) * step
        for x in range(side):
            var abs_x: float = key.x * CHUNK_SIZE + float(x) * step
            # CollisionShape3D is uniformly scaled by step, so divide Y by the
            # same factor to keep the final world-space height exact.
            heights[write_index] = float(world.call("height_at", abs_x, abs_z)) / step
            write_index += 1

    var shape: HeightMapShape3D = HeightMapShape3D.new()
    shape.map_width = side
    shape.map_depth = side
    shape.map_data = heights
    shape.margin = 0.04
    return shape

func _recover_player_if_below_surface() -> void:
    if not is_instance_valid(player):
        return

    # This is intentionally a deep-abyss recovery, not a terrain-following
    # mechanism. Normal slopes can put the character origin below the sampled
    # surface by a small amount, especially because the capsule is offset from
    # the origin. A generous threshold prevents the guard from repeatedly
    # lifting the player while walking over ordinary hills.
    var origin_offset: Vector2 = world.get("origin_offset")
    var abs_x: float = player.global_position.x + origin_offset.x
    var abs_z: float = player.global_position.z + origin_offset.y
    var ground_y: float = float(world.call("height_at", abs_x, abs_z))

    if player.global_position.y < ground_y - RECOVERY_DEPTH:
        var recovered: Vector3 = player.global_position
        recovered.y = ground_y + RECOVERY_HEIGHT
        player.global_position = recovered
        player.velocity.y = 0.0

func _prune_dead_chunk_ids() -> void:
    if _upgraded_chunks.size() < 64:
        return
    var live_ids: Dictionary = {}
    var chunks: Dictionary = world.get("chunks")
    for raw_chunk in chunks.values():
        var chunk: Node3D = raw_chunk
        if is_instance_valid(chunk):
            live_ids[chunk.get_instance_id()] = true
    for raw_id in _upgraded_chunks.keys():
        var instance_id: int = raw_id
        if not live_ids.has(instance_id):
            _upgraded_chunks.erase(instance_id)
