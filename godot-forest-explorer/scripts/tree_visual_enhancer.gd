extends Node3D

# Replaces the cheap distance crowns produced by the streamer with a denser,
# branch-whorl silhouette once a chunk arrives. The underlying tree transforms
# stay instanced, so the visual upgrade does not turn every tree into a node.

const REFRESH_INTERVAL: float = 0.20

var refresh_clock: float = 0.0
var detailed_crown_mesh: ArrayMesh
var foliage_material: ShaderMaterial
var enhanced_chunks: Dictionary = {}

func _ready() -> void:
    foliage_material = ShaderMaterial.new()
    foliage_material.shader = load("res://shaders/foliage.gdshader")
    foliage_material.set_shader_parameter("leaf_color", Color(0.075, 0.185, 0.060))
    foliage_material.set_shader_parameter("wind_strength", 0.085)
    foliage_material.set_shader_parameter("wind_speed", 0.72)
    foliage_material.set_shader_parameter("translucency", 0.20)
    detailed_crown_mesh = _build_spruce_crown()

func _process(delta: float) -> void:
    refresh_clock -= delta
    if refresh_clock > 0.0:
        return
    refresh_clock = REFRESH_INTERVAL
    _enhance_new_chunks()
    _prune_chunk_cache()

func _enhance_new_chunks() -> void:
    var root: Node = get_parent()
    for raw_child in root.get_children():
        if not raw_child is Node3D:
            continue
        var chunk: Node3D = raw_child
        if not String(chunk.name).begins_with("Chunk_"):
            continue
        var chunk_id: int = chunk.get_instance_id()
        if enhanced_chunks.has(chunk_id):
            continue

        var trunks: MultiMeshInstance3D = chunk.get_node_or_null("TreeTrunks") as MultiMeshInstance3D
        var coarse_crowns: MultiMeshInstance3D = chunk.get_node_or_null("ConiferCrowns") as MultiMeshInstance3D
        if trunks == null or trunks.multimesh == null:
            continue

        var count: int = trunks.multimesh.instance_count
        if count <= 0:
            enhanced_chunks[chunk_id] = weakref(chunk)
            continue

        var crown_multi: MultiMesh = MultiMesh.new()
        crown_multi.transform_format = MultiMesh.TRANSFORM_3D
        crown_multi.mesh = detailed_crown_mesh
        crown_multi.instance_count = count

        for i in range(count):
            var trunk_transform: Transform3D = trunks.multimesh.get_instance_transform(i)
            var tree_scale: float = trunk_transform.basis.get_scale().y
            var crown_transform: Transform3D = trunk_transform
            crown_transform.origin.y -= 0.82 * tree_scale
            crown_multi.set_instance_transform(i, crown_transform)

        var detailed: MultiMeshInstance3D = MultiMeshInstance3D.new()
        detailed.name = "DetailedConiferCrowns"
        detailed.multimesh = crown_multi
        detailed.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
        detailed.visibility_range_end = 235.0
        detailed.visibility_range_end_margin = 18.0
        chunk.add_child(detailed)

        if coarse_crowns != null:
            coarse_crowns.visible = false
        enhanced_chunks[chunk_id] = weakref(chunk)

func _prune_chunk_cache() -> void:
    var dead: Array[int] = []
    for raw_id in enhanced_chunks.keys():
        var chunk_id: int = raw_id
        var weak: WeakRef = enhanced_chunks[chunk_id]
        if weak.get_ref() == null:
            dead.append(chunk_id)
    for chunk_id in dead:
        enhanced_chunks.erase(chunk_id)

func _build_spruce_crown() -> ArrayMesh:
    var st: SurfaceTool = SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    st.set_material(foliage_material)

    var levels: int = 11
    for level in range(levels):
        var t: float = float(level) / float(levels - 1)
        var y: float = t * 8.45
        var radial_length: float = 0.30 + pow(1.0 - t, 0.67) * 2.95
        var branch_count: int = 7 if level < 8 else 5
        var phase: float = level * 0.83 + sin(float(level) * 1.71) * 0.18
        var droop: float = lerpf(0.72, 0.18, t)

        for branch in range(branch_count):
            var angle: float = phase + TAU * float(branch) / float(branch_count)
            var irregularity: float = 0.86 + 0.13 * sin(float(level * 13 + branch * 7) * 1.91)
            var length: float = radial_length * irregularity
            _add_branch(st, Vector3(0.0, y, 0.0), angle, length, droop, t, level, branch)

    # A narrow leader breaks up the very top and prevents the crown ending in a
    # flat polygonal ring when viewed against bright sky.
    for i in range(5):
        var angle: float = TAU * float(i) / 5.0 + 0.3
        _add_branch(st, Vector3(0.0, 8.05 + float(i % 2) * 0.12, 0.0), angle, 0.62, 0.05, 0.96, 20, i)

    st.generate_normals()
    return st.commit()

func _add_branch(st: SurfaceTool, root: Vector3, angle: float, length: float, droop: float, crown_t: float, level: int, branch: int) -> void:
    var direction: Vector3 = Vector3(cos(angle), 0.0, sin(angle))
    var side: Vector3 = Vector3(-sin(angle), 0.0, cos(angle))
    var start: Vector3 = root + direction * 0.10
    var mid: Vector3 = root + direction * (length * 0.56) - Vector3.UP * droop * 0.23
    var tip: Vector3 = root + direction * length - Vector3.UP * droop

    var base_width: float = lerpf(0.23, 0.10, crown_t)
    var mid_width: float = lerpf(0.46, 0.15, crown_t)
    _add_ribbon(st, start, mid, tip, side, base_width, mid_width)

    # A second ribbon is pitched through the branch instead of lying in the same
    # plane. This gives close branches body without expensive twig cylinders.
    var lifted_side: Vector3 = (side * 0.42 + Vector3.UP * 0.91).normalized()
    _add_ribbon(st, start, mid, tip, lifted_side, base_width * 0.72, mid_width * 0.65)

    # Lower and middle boughs carry two short branchlets. Their alternating angle
    # makes the shared mesh read less like a radial wheel after tree yaw/scale vary.
    if crown_t < 0.78 and length > 1.15:
        var handedness: float = -1.0 if ((level + branch) % 2 == 0) else 1.0
        var branchlet_root_a: Vector3 = start.lerp(mid, 0.68)
        var branchlet_root_b: Vector3 = mid.lerp(tip, 0.32)
        _add_branchlet(st, branchlet_root_a, angle + handedness * 0.54, length * 0.34, droop * 0.32, crown_t)
        _add_branchlet(st, branchlet_root_b, angle - handedness * 0.43, length * 0.26, droop * 0.24, crown_t)

func _add_branchlet(st: SurfaceTool, root: Vector3, angle: float, length: float, droop: float, crown_t: float) -> void:
    var direction: Vector3 = Vector3(cos(angle), 0.0, sin(angle))
    var side: Vector3 = Vector3(-sin(angle), 0.0, cos(angle))
    var mid: Vector3 = root + direction * (length * 0.55) - Vector3.UP * droop * 0.18
    var tip: Vector3 = root + direction * length - Vector3.UP * droop
    _add_ribbon(st, root, mid, tip, side, 0.08, lerpf(0.23, 0.10, crown_t))

func _add_ribbon(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, side: Vector3, width_a: float, width_b: float) -> void:
    var a_left: Vector3 = a - side * width_a
    var a_right: Vector3 = a + side * width_a
    var b_left: Vector3 = b - side * width_b
    var b_right: Vector3 = b + side * width_b
    var c_left: Vector3 = c - side * 0.035
    var c_right: Vector3 = c + side * 0.035

    _triangle(st, a_left, b_left, a_right)
    _triangle(st, a_right, b_left, b_right)
    _triangle(st, b_left, c_left, b_right)
    _triangle(st, b_right, c_left, c_right)

func _triangle(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3) -> void:
    st.add_vertex(a)
    st.add_vertex(b)
    st.add_vertex(c)
