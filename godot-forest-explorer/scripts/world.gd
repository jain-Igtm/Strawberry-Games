extends Node3D

# Deterministic infinite forest streamer. Every visible feature is derived from
# absolute world coordinates, so returning to a place recreates the same place.

const WORLD_SEED: int = 824771
const CHUNK_SIZE: float = 64.0
const MOBILE_RADIUS: int = 2
const DESKTOP_RADIUS: int = 3
const MOBILE_RES: int = 17
const DESKTOP_RES: int = 23
const WATER_LEVEL: float = 0.12
const REBASE_DISTANCE: float = 3072.0

@onready var player: CharacterBody3D = $Player
@onready var biome_label: Label = $HUD/TopLeft/VBox/Biome
@onready var coords_label: Label = $HUD/TopLeft/VBox/Coords
@onready var hud: CanvasLayer = $HUD

var terrain_noise: FastNoiseLite = FastNoiseLite.new()
var hill_noise: FastNoiseLite = FastNoiseLite.new()
var ridge_noise: FastNoiseLite = FastNoiseLite.new()
var moisture_noise: FastNoiseLite = FastNoiseLite.new()
var forest_noise: FastNoiseLite = FastNoiseLite.new()
var clearing_noise: FastNoiseLite = FastNoiseLite.new()
var detail_noise: FastNoiseLite = FastNoiseLite.new()

var terrain_material: ShaderMaterial
var foliage_material: ShaderMaterial
var bark_material: ShaderMaterial
var water_material: ShaderMaterial
var rock_material: StandardMaterial3D

var trunk_mesh: CylinderMesh
var crown_mesh: CylinderMesh
var rock_mesh: SphereMesh
var fern_mesh: ArrayMesh
var log_mesh: CylinderMesh

var world_environment: WorldEnvironment
var sun: DirectionalLight3D
var chunks: Dictionary = {}
var pending_chunks: Array[Vector2i] = []
var current_center: Vector2i = Vector2i(999999, 999999)
var origin_offset: Vector2 = Vector2.ZERO
var view_radius: int = DESKTOP_RADIUS
var terrain_resolution: int = DESKTOP_RES
var world_clock: float = 0.0

func _ready() -> void:
    view_radius = MOBILE_RADIUS if OS.has_feature("mobile") else DESKTOP_RADIUS
    terrain_resolution = MOBILE_RES if OS.has_feature("mobile") else DESKTOP_RES
    _configure_noise()
    _build_shared_resources()
    _build_environment()

    var spawn_abs: Vector2 = Vector2(6.0, _path_center_z(6.0))
    player.global_position = Vector3(spawn_abs.x, height_at(spawn_abs.x, spawn_abs.y) + 2.2, spawn_abs.y)
    _refresh_streaming(true)

func _process(delta: float) -> void:
    world_clock += delta
    _maybe_rebase_world()
    _refresh_streaming(false)
    _build_one_pending_chunk()
    _update_hud()
    _update_atmosphere()

func _configure_noise() -> void:
    _setup_noise(terrain_noise, WORLD_SEED + 11, 0.0017, 5, 0.52, 2.03)
    _setup_noise(hill_noise, WORLD_SEED + 29, 0.0062, 4, 0.48, 2.10)
    _setup_noise(ridge_noise, WORLD_SEED + 47, 0.0038, 4, 0.55, 2.00)
    _setup_noise(moisture_noise, WORLD_SEED + 83, 0.0029, 4, 0.50, 2.02)
    _setup_noise(forest_noise, WORLD_SEED + 101, 0.0054, 3, 0.52, 2.00)
    _setup_noise(clearing_noise, WORLD_SEED + 139, 0.00135, 3, 0.50, 2.00)
    _setup_noise(detail_noise, WORLD_SEED + 173, 0.026, 2, 0.44, 2.30)

func _setup_noise(noise: FastNoiseLite, seed_value: int, frequency: float, octaves: int, gain: float, lacunarity: float) -> void:
    noise.seed = seed_value
    noise.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
    noise.frequency = frequency
    noise.fractal_type = FastNoiseLite.FRACTAL_FBM
    noise.fractal_octaves = octaves
    noise.fractal_gain = gain
    noise.fractal_lacunarity = lacunarity

func _build_shared_resources() -> void:
    terrain_material = ShaderMaterial.new()
    terrain_material.shader = load("res://shaders/terrain.gdshader")

    foliage_material = ShaderMaterial.new()
    foliage_material.shader = load("res://shaders/foliage.gdshader")
    foliage_material.set_shader_parameter("leaf_color", Color(0.105, 0.235, 0.075))
    foliage_material.set_shader_parameter("wind_strength", 0.12)

    bark_material = ShaderMaterial.new()
    bark_material.shader = load("res://shaders/bark.gdshader")

    water_material = ShaderMaterial.new()
    water_material.shader = load("res://shaders/water.gdshader")

    rock_material = StandardMaterial3D.new()
    rock_material.albedo_color = Color(0.285, 0.30, 0.285)
    rock_material.roughness = 0.96

    trunk_mesh = CylinderMesh.new()
    trunk_mesh.height = 7.6
    trunk_mesh.top_radius = 0.18
    trunk_mesh.bottom_radius = 0.42
    trunk_mesh.radial_segments = 9
    trunk_mesh.rings = 2
    trunk_mesh.material = bark_material

    crown_mesh = CylinderMesh.new()
    crown_mesh.height = 4.6
    crown_mesh.top_radius = 0.035
    crown_mesh.bottom_radius = 2.35
    crown_mesh.radial_segments = 10
    crown_mesh.rings = 3
    crown_mesh.material = foliage_material

    rock_mesh = SphereMesh.new()
    rock_mesh.radius = 1.0
    rock_mesh.height = 2.0
    rock_mesh.radial_segments = 9
    rock_mesh.rings = 5
    rock_mesh.material = rock_material

    log_mesh = CylinderMesh.new()
    log_mesh.height = 5.0
    log_mesh.top_radius = 0.28
    log_mesh.bottom_radius = 0.38
    log_mesh.radial_segments = 8
    log_mesh.rings = 2
    log_mesh.material = bark_material

    fern_mesh = _make_fern_mesh()

func _build_environment() -> void:
    world_environment = WorldEnvironment.new()
    world_environment.name = "WorldEnvironment"

    var env: Environment = Environment.new()
    env.background_mode = Environment.BG_SKY

    var sky: Sky = Sky.new()
    var sky_mat: ProceduralSkyMaterial = ProceduralSkyMaterial.new()
    sky_mat.sky_top_color = Color(0.22, 0.39, 0.59)
    sky_mat.sky_horizon_color = Color(0.70, 0.75, 0.72)
    sky_mat.ground_bottom_color = Color(0.08, 0.10, 0.075)
    sky_mat.ground_horizon_color = Color(0.45, 0.48, 0.40)
    sky_mat.sun_angle_max = 18.0
    sky_mat.sun_curve = 0.08
    sky.sky_material = sky_mat
    env.sky = sky

    env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
    env.ambient_light_energy = 0.74
    env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
    env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
    env.tonemap_exposure = 1.12
    env.fog_enabled = true
    env.fog_light_color = Color(0.58, 0.67, 0.65)
    env.fog_light_energy = 0.72
    env.fog_density = 0.0075 if OS.has_feature("mobile") else 0.0055
    env.fog_height = 1.7
    env.fog_height_density = 0.055
    env.fog_aerial_perspective = 0.55
    env.adjustment_enabled = true
    env.adjustment_brightness = 1.02
    env.adjustment_contrast = 1.08
    env.adjustment_saturation = 0.92
    world_environment.environment = env
    add_child(world_environment)

    sun = DirectionalLight3D.new()
    sun.name = "Sun"
    sun.light_color = Color(1.0, 0.84, 0.66)
    sun.light_energy = 1.55
    sun.shadow_enabled = true
    sun.directional_shadow_max_distance = 190.0 if OS.has_feature("mobile") else 285.0
    sun.rotation_degrees = Vector3(-42.0, -31.0, 0.0)
    add_child(sun)

func _update_atmosphere() -> void:
    var drift: float = sin(world_clock * 0.0045)
    sun.rotation_degrees.x = -41.0 + drift * 4.0
    sun.rotation_degrees.y = -31.0 + sin(world_clock * 0.002) * 7.0
    sun.light_energy = 1.48 + drift * 0.12

func _absolute_player_position() -> Vector2:
    return Vector2(player.global_position.x + origin_offset.x, player.global_position.z + origin_offset.y)

func _refresh_streaming(force: bool) -> void:
    var abs_pos: Vector2 = _absolute_player_position()
    var center: Vector2i = Vector2i(floori(abs_pos.x / CHUNK_SIZE), floori(abs_pos.y / CHUNK_SIZE))
    if not force and center == current_center:
        return
    current_center = center

    var wanted: Dictionary = {}
    var queue: Array[Vector2i] = []
    for ring in range(view_radius + 1):
        for z in range(center.y - ring, center.y + ring + 1):
            for x in range(center.x - ring, center.x + ring + 1):
                if maxi(absi(x - center.x), absi(z - center.y)) != ring:
                    continue
                var key: Vector2i = Vector2i(x, z)
                wanted[key] = true
                if not chunks.has(key):
                    queue.append(key)

    pending_chunks = queue
    var remove_keys: Array[Vector2i] = []
    for raw_key in chunks.keys():
        var chunk_key: Vector2i = raw_key
        if not wanted.has(chunk_key):
            remove_keys.append(chunk_key)
    for key in remove_keys:
        var old_chunk: Node3D = chunks[key]
        old_chunk.queue_free()
        chunks.erase(key)

    if force:
        for z in range(center.y - 1, center.y + 2):
            for x in range(center.x - 1, center.x + 2):
                var spawn_key: Vector2i = Vector2i(x, z)
                if not chunks.has(spawn_key):
                    _create_chunk(spawn_key)
                    pending_chunks.erase(spawn_key)

func _build_one_pending_chunk() -> void:
    if pending_chunks.is_empty():
        return
    var key: Vector2i = pending_chunks.pop_front()
    if not chunks.has(key):
        _create_chunk(key)

func _create_chunk(key: Vector2i) -> void:
    var chunk: Node3D = Node3D.new()
    chunk.name = "Chunk_%d_%d" % [key.x, key.y]
    chunk.position = Vector3(key.x * CHUNK_SIZE - origin_offset.x, 0.0, key.y * CHUNK_SIZE - origin_offset.y)
    add_child(chunk)
    chunks[key] = chunk

    var terrain: MeshInstance3D = MeshInstance3D.new()
    terrain.name = "Terrain"
    terrain.mesh = _build_terrain_mesh(key)
    terrain.material_override = terrain_material
    terrain.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
    chunk.add_child(terrain)

    var body: StaticBody3D = StaticBody3D.new()
    body.name = "TerrainCollision"
    var collider: CollisionShape3D = CollisionShape3D.new()
    collider.shape = terrain.mesh.create_trimesh_shape()
    body.add_child(collider)
    chunk.add_child(body)

    var water_mesh: ArrayMesh = _build_water_mesh(key)
    if water_mesh != null and water_mesh.get_surface_count() > 0:
        var water: MeshInstance3D = MeshInstance3D.new()
        water.name = "Wetlands"
        water.mesh = water_mesh
        water.material_override = water_material
        water.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
        chunk.add_child(water)

    _populate_trees(chunk, key)
    _populate_rocks(chunk, key)
    _populate_understory(chunk, key)
    _populate_fallen_logs(chunk, key)
    _maybe_add_landmark(chunk, key)

func _build_terrain_mesh(key: Vector2i) -> ArrayMesh:
    var st: SurfaceTool = SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    var step: float = CHUNK_SIZE / float(terrain_resolution)
    for z in range(terrain_resolution):
        for x in range(terrain_resolution):
            var lx0: float = x * step
            var lz0: float = z * step
            var lx1: float = (x + 1) * step
            var lz1: float = (z + 1) * step
            var ax0: float = key.x * CHUNK_SIZE + lx0
            var az0: float = key.y * CHUNK_SIZE + lz0
            var ax1: float = key.x * CHUNK_SIZE + lx1
            var az1: float = key.y * CHUNK_SIZE + lz1

            var p00: Vector3 = Vector3(lx0, height_at(ax0, az0), lz0)
            var p01: Vector3 = Vector3(lx0, height_at(ax0, az1), lz1)
            var p10: Vector3 = Vector3(lx1, height_at(ax1, az0), lz0)
            var p11: Vector3 = Vector3(lx1, height_at(ax1, az1), lz1)

            _terrain_vertex(st, p00, ax0, az0)
            _terrain_vertex(st, p01, ax0, az1)
            _terrain_vertex(st, p10, ax1, az0)
            _terrain_vertex(st, p10, ax1, az0)
            _terrain_vertex(st, p01, ax0, az1)
            _terrain_vertex(st, p11, ax1, az1)

    st.index()
    st.generate_normals()
    st.generate_tangents()
    return st.commit()

func _terrain_vertex(st: SurfaceTool, point: Vector3, abs_x: float, abs_z: float) -> void:
    var trail: float = _path_blend(abs_x, abs_z)
    var wet: float = _lake_mask(abs_x, abs_z)
    st.set_color(Color(trail, wet, 0.0, 1.0))
    st.set_uv(Vector2(abs_x, abs_z) * 0.025)
    st.add_vertex(point)

func _build_water_mesh(key: Vector2i) -> ArrayMesh:
    var st: SurfaceTool = SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    var step: float = CHUNK_SIZE / float(terrain_resolution)
    var added: int = 0
    for z in range(terrain_resolution):
        for x in range(terrain_resolution):
            var lx0: float = x * step
            var lz0: float = z * step
            var lx1: float = (x + 1) * step
            var lz1: float = (z + 1) * step
            var ax: float = key.x * CHUNK_SIZE + (lx0 + lx1) * 0.5
            var az: float = key.y * CHUNK_SIZE + (lz0 + lz1) * 0.5
            if _lake_mask(ax, az) < 0.58:
                continue
            var y: float = WATER_LEVEL + moisture_noise.get_noise_2d(ax, az) * 0.025
            st.add_vertex(Vector3(lx0, y, lz0))
            st.add_vertex(Vector3(lx0, y, lz1))
            st.add_vertex(Vector3(lx1, y, lz0))
            st.add_vertex(Vector3(lx1, y, lz0))
            st.add_vertex(Vector3(lx0, y, lz1))
            st.add_vertex(Vector3(lx1, y, lz1))
            added += 6
    if added == 0:
        return null
    st.generate_normals()
    return st.commit()

func _populate_trees(chunk: Node3D, key: Vector2i) -> void:
    var transforms: Array[Transform3D] = []
    var target_count: int = 72 if OS.has_feature("mobile") else 118
    for i in range(target_count):
        var lx: float = 2.5 + _hash01(key.x, key.y, i * 17 + 1) * (CHUNK_SIZE - 5.0)
        var lz: float = 2.5 + _hash01(key.x, key.y, i * 17 + 2) * (CHUNK_SIZE - 5.0)
        var ax: float = key.x * CHUNK_SIZE + lx
        var az: float = key.y * CHUNK_SIZE + lz
        var y: float = height_at(ax, az)
        var slope: float = _slope_at(ax, az)
        var density: float = _forest_density(ax, az)
        if _hash01(key.x, key.y, i * 17 + 3) > density:
            continue
        if slope > 0.72 or _path_blend(ax, az) > 0.15 or _lake_mask(ax, az) > 0.38:
            continue
        var scale_value: float = lerpf(0.72, 1.48, _hash01(key.x, key.y, i * 17 + 4))
        var yaw: float = _hash01(key.x, key.y, i * 17 + 5) * TAU
        var lean_x: float = (_hash01(key.x, key.y, i * 17 + 6) - 0.5) * 0.035
        var lean_z: float = (_hash01(key.x, key.y, i * 17 + 7) - 0.5) * 0.035
        var basis: Basis = Basis.from_euler(Vector3(lean_x, yaw, lean_z)).scaled(Vector3.ONE * scale_value)
        transforms.append(Transform3D(basis, Vector3(lx, y, lz)))

    if transforms.is_empty():
        return

    var trunks: MultiMeshInstance3D = MultiMeshInstance3D.new()
    trunks.name = "TreeTrunks"
    var trunk_multi: MultiMesh = MultiMesh.new()
    trunk_multi.transform_format = MultiMesh.TRANSFORM_3D
    trunk_multi.mesh = trunk_mesh
    trunk_multi.instance_count = transforms.size()
    for i in range(transforms.size()):
        var tree_transform: Transform3D = transforms[i]
        var tree_scale: float = tree_transform.basis.get_scale().y
        var trunk_transform: Transform3D = tree_transform
        trunk_transform.origin.y += 3.8 * tree_scale
        trunk_multi.set_instance_transform(i, trunk_transform)
    trunks.multimesh = trunk_multi
    trunks.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
    chunk.add_child(trunks)

    var crowns: MultiMeshInstance3D = MultiMeshInstance3D.new()
    crowns.name = "ConiferCrowns"
    var crown_multi: MultiMesh = MultiMesh.new()
    crown_multi.transform_format = MultiMesh.TRANSFORM_3D
    crown_multi.mesh = crown_mesh
    crown_multi.instance_count = transforms.size() * 3
    var crown_index: int = 0
    for raw_transform in transforms:
        var base_transform: Transform3D = raw_transform
        var scale_y: float = base_transform.basis.get_scale().y
        for layer in range(3):
            var layer_scale: float = 1.0 - layer * 0.19
            var layer_basis: Basis = base_transform.basis.scaled(Vector3(layer_scale, 0.92, layer_scale))
            var layer_origin: Vector3 = base_transform.origin + Vector3(0.0, (6.0 + layer * 2.0) * scale_y, 0.0)
            crown_multi.set_instance_transform(crown_index, Transform3D(layer_basis, layer_origin))
            crown_index += 1
    crowns.multimesh = crown_multi
    crowns.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
    chunk.add_child(crowns)

func _populate_rocks(chunk: Node3D, key: Vector2i) -> void:
    var count: int = 16 if OS.has_feature("mobile") else 28
    var rock_multi: MultiMesh = MultiMesh.new()
    rock_multi.transform_format = MultiMesh.TRANSFORM_3D
    rock_multi.mesh = rock_mesh
    rock_multi.instance_count = count
    for i in range(count):
        var lx: float = _hash01(key.x, key.y, 700 + i * 9) * CHUNK_SIZE
        var lz: float = _hash01(key.x, key.y, 701 + i * 9) * CHUNK_SIZE
        var ax: float = key.x * CHUNK_SIZE + lx
        var az: float = key.y * CHUNK_SIZE + lz
        var y: float = height_at(ax, az)
        var s: float = lerpf(0.18, 1.15, pow(_hash01(key.x, key.y, 702 + i * 9), 2.2))
        var scale_value: Vector3 = Vector3(
            s * lerpf(0.8, 1.8, _hash01(key.x, key.y, 703 + i * 9)),
            s * lerpf(0.45, 1.0, _hash01(key.x, key.y, 704 + i * 9)),
            s
        )
        var basis: Basis = Basis(Vector3.UP, _hash01(key.x, key.y, 705 + i * 9) * TAU).scaled(scale_value)
        rock_multi.set_instance_transform(i, Transform3D(basis, Vector3(lx, y + scale_value.y * 0.42, lz)))
    var rocks: MultiMeshInstance3D = MultiMeshInstance3D.new()
    rocks.name = "GlacialRocks"
    rocks.multimesh = rock_multi
    rocks.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
    chunk.add_child(rocks)

func _populate_understory(chunk: Node3D, key: Vector2i) -> void:
    var transforms: Array[Transform3D] = []
    var attempts: int = 120 if OS.has_feature("mobile") else 220
    for i in range(attempts):
        var lx: float = _hash01(key.x, key.y, 1300 + i * 11) * CHUNK_SIZE
        var lz: float = _hash01(key.x, key.y, 1301 + i * 11) * CHUNK_SIZE
        var ax: float = key.x * CHUNK_SIZE + lx
        var az: float = key.y * CHUNK_SIZE + lz
        if _path_blend(ax, az) > 0.28 or _lake_mask(ax, az) > 0.5 or _slope_at(ax, az) > 0.62:
            continue
        var moisture: float = _moisture(ax, az)
        if _hash01(key.x, key.y, 1302 + i * 11) > 0.38 + moisture * 0.54:
            continue
        var s: float = lerpf(0.42, 1.12, _hash01(key.x, key.y, 1303 + i * 11))
        var basis: Basis = Basis(Vector3.UP, _hash01(key.x, key.y, 1304 + i * 11) * TAU).scaled(Vector3.ONE * s)
        transforms.append(Transform3D(basis, Vector3(lx, height_at(ax, az) + 0.02, lz)))

    if transforms.is_empty():
        return
    var multi: MultiMesh = MultiMesh.new()
    multi.transform_format = MultiMesh.TRANSFORM_3D
    multi.mesh = fern_mesh
    multi.instance_count = transforms.size()
    for i in range(transforms.size()):
        multi.set_instance_transform(i, transforms[i])
    var ferns: MultiMeshInstance3D = MultiMeshInstance3D.new()
    ferns.name = "FernsAndGroundcover"
    ferns.multimesh = multi
    ferns.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    chunk.add_child(ferns)

func _populate_fallen_logs(chunk: Node3D, key: Vector2i) -> void:
    var count: int = 2 + int(_hash01(key.x, key.y, 1881) * 4.0)
    var multi: MultiMesh = MultiMesh.new()
    multi.transform_format = MultiMesh.TRANSFORM_3D
    multi.mesh = log_mesh
    multi.instance_count = count
    for i in range(count):
        var lx: float = 5.0 + _hash01(key.x, key.y, 1900 + i * 8) * (CHUNK_SIZE - 10.0)
        var lz: float = 5.0 + _hash01(key.x, key.y, 1901 + i * 8) * (CHUNK_SIZE - 10.0)
        var ax: float = key.x * CHUNK_SIZE + lx
        var az: float = key.y * CHUNK_SIZE + lz
        var y: float = height_at(ax, az)
        var yaw: float = _hash01(key.x, key.y, 1902 + i * 8) * TAU
        var scale_value: float = lerpf(0.65, 1.35, _hash01(key.x, key.y, 1903 + i * 8))
        var basis: Basis = Basis.from_euler(Vector3(0.0, yaw, PI * 0.5)).scaled(Vector3.ONE * scale_value)
        multi.set_instance_transform(i, Transform3D(basis, Vector3(lx, y + 0.35 * scale_value, lz)))
    var logs: MultiMeshInstance3D = MultiMeshInstance3D.new()
    logs.name = "FallenLogs"
    logs.multimesh = multi
    logs.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
    chunk.add_child(logs)

func _maybe_add_landmark(chunk: Node3D, key: Vector2i) -> void:
    if _hash01(key.x, key.y, 9001) < 0.965:
        return
    var lx: float = lerpf(14.0, CHUNK_SIZE - 14.0, _hash01(key.x, key.y, 9002))
    var lz: float = lerpf(14.0, CHUNK_SIZE - 14.0, _hash01(key.x, key.y, 9003))
    var ax: float = key.x * CHUNK_SIZE + lx
    var az: float = key.y * CHUNK_SIZE + lz
    if _lake_mask(ax, az) > 0.3:
        return
    var y: float = height_at(ax, az)

    var landmark: Node3D = Node3D.new()
    landmark.name = "AncientStone"
    landmark.position = Vector3(lx, y, lz)
    chunk.add_child(landmark)

    for i in range(5):
        var stone: MeshInstance3D = MeshInstance3D.new()
        stone.mesh = rock_mesh
        stone.material_override = rock_material
        var angle: float = TAU * float(i) / 5.0
        stone.position = Vector3(cos(angle) * 3.2, 1.15, sin(angle) * 3.2)
        stone.scale = Vector3(0.72, 1.75 + _hash01(key.x, key.y, 9100 + i) * 0.65, 0.82)
        stone.rotation.y = angle * 0.63
        landmark.add_child(stone)

func _make_fern_mesh() -> ArrayMesh:
    var st: SurfaceTool = SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    st.set_material(foliage_material)
    var half_width: float = 0.55
    var height_value: float = 0.72
    var angles: Array[float] = [0.0, PI * 0.5]
    for angle in angles:
        var right: Vector3 = Vector3(cos(angle), 0.0, sin(angle)) * half_width
        var a: Vector3 = -right
        var b: Vector3 = right
        var c: Vector3 = right + Vector3.UP * height_value
        var d: Vector3 = -right + Vector3.UP * height_value
        st.add_vertex(a)
        st.add_vertex(c)
        st.add_vertex(b)
        st.add_vertex(a)
        st.add_vertex(d)
        st.add_vertex(c)
    st.generate_normals()
    return st.commit()

func _raw_height(x: float, z: float) -> float:
    var continental: float = terrain_noise.get_noise_2d(x, z)
    var hills: float = hill_noise.get_noise_2d(x, z)
    var ridge: float = 1.0 - absf(ridge_noise.get_noise_2d(x, z))
    ridge = pow(clampf(ridge, 0.0, 1.0), 3.4)
    var detail: float = detail_noise.get_noise_2d(x, z)
    var ridge_gate: float = smoothstep(0.03, 0.72, continental * 0.5 + 0.5)
    return continental * 8.0 + hills * 4.8 + ridge * 15.0 * ridge_gate + detail * 0.72

func height_at(x: float, z: float) -> float:
    var raw: float = _raw_height(x, z)
    var lake: float = _lake_mask_from_raw(x, z, raw)
    var h: float = lerpf(raw, WATER_LEVEL - 0.82, lake * 0.92)
    var trail: float = _path_blend(x, z)
    if trail > 0.0:
        var center_z: float = _path_center_z(x)
        var path_h: float = _raw_height(x, center_z)
        var path_lake: float = _lake_mask_from_raw(x, center_z, path_h)
        path_h = lerpf(path_h, WATER_LEVEL + 0.2, path_lake * 0.86)
        h = lerpf(h, path_h, trail * 0.84)
        h -= trail * 0.08
    return h

func _path_center_z(x: float) -> float:
    return sin(x * 0.0047) * 31.0 + sin(x * 0.00125 + 1.7) * 54.0 + sin(x * 0.013 + 0.4) * 5.5

func _path_blend(x: float, z: float) -> float:
    var distance: float = absf(z - _path_center_z(x))
    return 1.0 - smoothstep(2.2, 7.4, distance)

func _moisture(x: float, z: float) -> float:
    return moisture_noise.get_noise_2d(x, z) * 0.5 + 0.5

func _lake_mask(x: float, z: float) -> float:
    return _lake_mask_from_raw(x, z, _raw_height(x, z))

func _lake_mask_from_raw(x: float, z: float, raw_height: float) -> float:
    var wet: float = smoothstep(0.64, 0.88, _moisture(x, z))
    var low: float = 1.0 - smoothstep(-0.8, 3.0, raw_height)
    var basin: float = clearing_noise.get_noise_2d(x + 1300.0, z - 900.0) * 0.5 + 0.5
    basin = smoothstep(0.46, 0.74, basin)
    return clampf(wet * low * basin * 1.9, 0.0, 1.0)

func _forest_density(x: float, z: float) -> float:
    var base: float = forest_noise.get_noise_2d(x, z) * 0.5 + 0.5
    var clearing: float = clearing_noise.get_noise_2d(x - 420.0, z + 270.0) * 0.5 + 0.5
    var moisture: float = _moisture(x, z)
    var density: float = 0.38 + base * 0.47 + moisture * 0.18
    density *= 0.35 + smoothstep(0.24, 0.55, clearing) * 0.72
    return clampf(density, 0.08, 0.95)

func _slope_at(x: float, z: float) -> float:
    var sample_distance: float = 1.25
    var dx: float = height_at(x + sample_distance, z) - height_at(x - sample_distance, z)
    var dz: float = height_at(x, z + sample_distance) - height_at(x, z - sample_distance)
    return Vector2(dx, dz).length() / (sample_distance * 2.0)

func _hash01(x: int, z: int, salt: int) -> float:
    var n: int = x * 374761393 + z * 668265263 + salt * 1442695041
    n = (n ^ (n >> 13)) * 1274126177
    n = n ^ (n >> 16)
    return float(n & 0x7fffffff) / 2147483647.0

func _maybe_rebase_world() -> void:
    if absf(player.global_position.x) < REBASE_DISTANCE and absf(player.global_position.z) < REBASE_DISTANCE:
        return
    var shift: Vector3 = Vector3(
        roundf(player.global_position.x / CHUNK_SIZE) * CHUNK_SIZE,
        0.0,
        roundf(player.global_position.z / CHUNK_SIZE) * CHUNK_SIZE
    )
    player.global_position -= shift
    origin_offset += Vector2(shift.x, shift.z)
    for raw_chunk in chunks.values():
        var chunk: Node3D = raw_chunk
        chunk.position -= shift

func _update_hud() -> void:
    var p: Vector2 = _absolute_player_position()
    coords_label.text = "%.0f m E   %.0f m N  •  seed %d" % [p.x, p.y, WORLD_SEED]
    biome_label.text = _biome_name(p.x, p.y)
    hud.visible = not Input.is_action_pressed("toggle_ui")

func _biome_name(x: float, z: float) -> String:
    var h: float = height_at(x, z)
    var wet: float = _moisture(x, z)
    var density: float = _forest_density(x, z)
    if _lake_mask(x, z) > 0.48:
        return "Mosswater hollow"
    if h > 11.0:
        return "Granite ridge forest"
    if wet > 0.72:
        return "Fern-rich old growth"
    if density < 0.38:
        return "Windfall clearing"
    if density > 0.78:
        return "Deep conifer stand"
    return "Old-growth forest"
